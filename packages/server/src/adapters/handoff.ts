import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { parse as parseYaml } from 'yaml';
import {
  classifyLane,
  emptyCockpitEvidence,
  foldedChainFor,
  resolveDecidedInFlight,
  sourceRecordKey,
  type AdapterHealth,
  type ChainedPredecessor,
  type CockpitEvidence,
  type HandoffRecordEvidence,
  type LaneContext,
  type LaneInput,
  type SourceRecordRef,
  type UnresolvedRelationDiagnostic,
  type WorkItem,
  type WorkItemKind,
  type WorkItemStatus,
} from '@cockpit/shared';
import { config } from '../config.js';

const BEAD_TYPES = new Set(['brief', 'report', 'decision', 'discovery']);

interface ParsedBead {
  id?: string;
  type?: string;
  title?: string;
  actor?: string;
  to?: string;
  status?: string;
  created_at?: string;
  responding_to?: string;
  refs?: string[];
  filePath: string;
  relativePath: string;
  mtimeIso: string;
}

interface ScannedBead {
  bead: ParsedBead;
  repo: string;
  kind: WorkItemKind;
  status: WorkItemStatus;
  openHook: boolean;
  createdIso: string;
  activityAt: string;
  sourceRecord: SourceRecordRef;
  sourceRecordKey: string;
  evidence: HandoffRecordEvidence;
}

export interface HandoffAdapterResult {
  items: WorkItem[];
  health: AdapterHealth;
  evidence: CockpitEvidence;
}

function toIso(value: unknown, fallback: string): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return fallback;
}

function literalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isProvenAbsence(error: unknown): boolean {
  if (!(error instanceof Error) || !('code' in error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}

/** Read only the YAML frontmatter and stop the stream at its closing delimiter. */
async function readFrontmatter(filePath: string): Promise<string | null> {
  const stream = createReadStream(filePath, { encoding: 'utf8' });
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  const yaml: string[] = [];
  let opened = false;
  try {
    for await (const line of lines) {
      if (!opened) {
        if (line !== '---') return null;
        opened = true;
        continue;
      }
      if (line === '---') return yaml.join('\n');
      yaml.push(line);
    }
    return null;
  } finally {
    lines.close();
    stream.destroy();
  }
}

function makeDiagnostic(
  reason: UnresolvedRelationDiagnostic['reason'],
  relation: UnresolvedRelationDiagnostic['relation'],
  targetNativeId: string | null,
  keys: string[],
): UnresolvedRelationDiagnostic {
  return {
    reason,
    relation,
    targetNativeId,
    affectedSourceRecordKeys: [...new Set(keys)].sort(),
  };
}

function sortDiagnostics(diagnostics: UnresolvedRelationDiagnostic[]): UnresolvedRelationDiagnostic[] {
  const keyed = diagnostics.map((diagnostic) => [JSON.stringify(diagnostic), diagnostic] as const);
  return [...new Map(keyed).values()].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

function buildPopulation(records: HandoffRecordEvidence[]) {
  const sorted = [...records].sort((a, b) => a.sourceRecordKey.localeCompare(b.sourceRecordKey));
  const counts = new Map<string, number>();
  for (const record of sorted) {
    const repository = record.sourceRecord.repository ?? 'unknown';
    counts.set(repository, (counts.get(repository) ?? 0) + 1);
  }
  return {
    name: 'standaloneUnansweredBriefs' as const,
    records: sorted,
    total: sorted.length,
    byRepository: [...counts]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([repository, count]) => ({ repository, count })),
  };
}

/** Read-only handoff collection plus a metadata-only REST evidence projection. */
export async function fetchHandoff(ctx: LaneContext): Promise<HandoffAdapterResult> {
  const health: AdapterHealth = { name: 'handoff-bead', status: 'down', itemCount: 0 };
  let skipped = 0;
  let unreadableRepositories = 0;
  let repoCount = 0;
  let repositoriesObserved = 0;
  const items: WorkItem[] = [];
  const scanned: ScannedBead[] = [];
  const collectedAt = ctx.now.toISOString();

  let rootEntries: string[];
  try {
    rootEntries = (await readdir(config.handoff.repoRoot)).sort();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    health.lastError = reason;
    health.note = 'Configured handoff root unavailable';
    return {
      items,
      health,
      evidence: emptyCockpitEvidence({
        status: 'unavailable',
        repositoriesObserved: 0,
        skippedRecords: 0,
        unreadableRepositories: 0,
        reason,
      }),
    };
  }

  const dirs: string[] = [];
  for (const name of rootEntries) {
    const candidate = path.join(config.handoff.repoRoot, name, '.handoff');
    try {
      if ((await stat(candidate)).isDirectory()) dirs.push(candidate);
    } catch (error) {
      // ENOENT/ENOTDIR proves absence. Permission and I/O errors leave coverage incomplete.
      if (!isProvenAbsence(error)) unreadableRepositories++;
    }
  }

  for (const dir of dirs.sort()) {
    repoCount++;
    const repo = path.basename(path.dirname(dir));
    let files: string[];
    try {
      files = (await readdir(dir)).filter((file) => file.endsWith('.md') && file !== 'README.md').sort();
      repositoriesObserved++;
    } catch {
      unreadableRepositories++;
      continue;
    }

    const parsed: ParsedBead[] = [];
    for (const file of files) {
      const full = path.join(dir, file);
      try {
        const yaml = await readFrontmatter(full);
        if (yaml === null) {
          skipped++;
          continue;
        }
        const frontmatter = (parseYaml(yaml) ?? {}) as Record<string, unknown>;
        if (!BEAD_TYPES.has(String(frontmatter['type']))) {
          skipped++;
          continue;
        }
        const rawRefs = frontmatter['refs'];
        parsed.push({
          id: literalString(frontmatter['id']),
          type: literalString(frontmatter['type']),
          title: literalString(frontmatter['title']),
          actor: literalString(frontmatter['actor']),
          to: literalString(frontmatter['to']),
          status: literalString(frontmatter['status']),
          created_at: literalString(frontmatter['created_at']),
          responding_to: literalString(frontmatter['responding_to']),
          refs: Array.isArray(rawRefs) ? rawRefs.filter((ref): ref is string => typeof ref === 'string') : undefined,
          filePath: full,
          relativePath: path.posix.join('.handoff', file),
          mtimeIso: (await stat(full)).mtime.toISOString(),
        });
      } catch {
        skipped++;
      }
    }

    for (const bead of parsed) {
      const kind = bead.type as WorkItemKind;
      const createdIso = toIso(bead.created_at, bead.mtimeIso);
      const activityAt = Date.parse(bead.mtimeIso) > Date.parse(createdIso) ? bead.mtimeIso : createdIso;
      const sourceRecord: SourceRecordRef = {
        source: 'handoff-bead',
        repository: repo,
        nativeId: bead.id ?? null,
        sourcePath: bead.relativePath,
      };
      const key = sourceRecordKey(sourceRecord);
      const evidence: HandoffRecordEvidence = {
        sourceRecordKey: key,
        sourceRecord,
        title: bead.title ?? path.basename(bead.filePath),
        literal: {
          type: bead.type ?? null,
          status: bead.status ?? null,
          actor: bead.actor ?? null,
          to: bead.to ?? null,
          respondingTo: bead.responding_to ?? null,
          refs: bead.refs ?? [],
          authoredCreatedAt: bead.created_at ?? null,
        },
        observedModifiedAt: bead.mtimeIso,
        collectedAt,
      };
      scanned.push({
        bead,
        repo,
        kind,
        status: kind === 'brief' ? 'open' : 'done',
        openHook: false,
        createdIso,
        activityAt,
        sourceRecord,
        sourceRecordKey: key,
        evidence,
      });
    }
  }

  const diagnostics: UnresolvedRelationDiagnostic[] = [];
  const affected = new Set<string>();
  const respondedKeys = new Set<string>();

  // responding_to resolves only within a repository; the authored token carries no repo.
  for (const report of scanned.filter((record) => record.kind === 'report' && record.bead.responding_to)) {
    const targetNativeId = report.bead.responding_to!;
    const candidates = scanned.filter(
      (record) => record.repo === report.repo && record.kind === 'brief' && record.bead.id === targetNativeId,
    );
    if (candidates.length === 1) {
      respondedKeys.add(candidates[0]!.sourceRecordKey);
    } else {
      const diagnostic = makeDiagnostic(
        candidates.length === 0 ? 'target-not-observed' : 'target-matches-multiple-records',
        'responding_to',
        targetNativeId,
        [report.sourceRecordKey, ...candidates.map((candidate) => candidate.sourceRecordKey)],
      );
      diagnostics.push(diagnostic);
      for (const key of diagnostic.affectedSourceRecordKeys) affected.add(key);
    }
  }

  for (const record of scanned) {
    if (record.kind !== 'brief') continue;
    record.openHook = record.bead.status === 'live' && !respondedKeys.has(record.sourceRecordKey);
    record.status = record.openHook ? 'open' : 'done';
  }

  const resolution = resolveDecidedInFlight(
    scanned.map((record) => ({
      sourceRecordKey: record.sourceRecordKey,
      id: record.bead.id,
      status: record.bead.status,
      open: record.openHook,
      refs: record.bead.refs,
      createdAt: record.bead.created_at,
    })),
  );
  diagnostics.push(...resolution.diagnostics);
  for (const key of resolution.affectedSourceRecordKeys) affected.add(key);
  // A supported edge cannot fold into a successor that is itself held outside normal lanes by
  // another unresolved observation. Keep the otherwise-unaffected predecessor standalone.
  for (const [predecessorKey, successorKey] of resolution.decided) {
    if (affected.has(predecessorKey) || affected.has(successorKey)) resolution.decided.delete(predecessorKey);
  }

  const byKey = new Map(scanned.map((record) => [record.sourceRecordKey, record]));
  let folded = 0;
  const population: HandoffRecordEvidence[] = [];

  for (const record of scanned) {
    const { bead, kind, status, openHook } = record;
    if (affected.has(record.sourceRecordKey)) continue;
    if (resolution.decided.has(record.sourceRecordKey)) {
      folded++;
      continue;
    }
    const input: LaneInput = { source: 'handoff-bead', kind, status, activityAt: record.activityAt, openHook };
    const lane = classifyLane(input, ctx);
    if (!lane) continue;

    let chain: ChainedPredecessor[] | undefined;
    const foldedKeys = foldedChainFor(record.sourceRecordKey, resolution.decided);
    if (foldedKeys.length > 0) {
      chain = foldedKeys.flatMap((key) => {
        const predecessor = byKey.get(key);
        if (!predecessor) return [];
        return [{
          sourceRecordKey: key,
          nativeId: predecessor.bead.id ?? path.basename(predecessor.bead.filePath),
          title: predecessor.evidence.title,
          url: `file://${predecessor.bead.filePath}`,
          createdAt: predecessor.createdIso,
          state: 'decided-in-flight' as const,
        }];
      });
      if (chain.length === 0) chain = undefined;
    }

    const nativeId = bead.id ?? path.basename(bead.filePath);
    items.push({
      id: `handoff-bead:${nativeId}`,
      nativeId,
      sourceRecord: record.sourceRecord,
      sourceRecordKey: record.sourceRecordKey,
      source: 'handoff-bead',
      kind,
      status,
      lane,
      title: record.evidence.title,
      repo: record.repo,
      actor: bead.actor,
      createdAt: record.createdIso,
      updatedAt: bead.mtimeIso,
      activityAt: record.activityAt,
      ...(chain ? { chain } : {}),
      url: `file://${bead.filePath}`,
      detail: { kind: 'brief', to: bead.to, openHook },
      // Absolute path remains internal for the separately gated chat attachment reader.
      provenance: { sourcePath: bead.filePath, ...(bead.refs?.length ? { refs: bead.refs } : {}) },
    });
    if (kind === 'brief' && openHook) population.push(record.evidence);
  }

  const unresolved = sortDiagnostics(diagnostics);
  const partial = skipped > 0 || unreadableRepositories > 0;
  health.status = partial || unresolved.length > 0 ? 'degraded' : 'up';
  health.itemCount = items.length;
  health.note = [
    `${repoCount} repos with .handoff`,
    skipped ? `${skipped} records skipped` : '',
    unreadableRepositories ? `${unreadableRepositories} repos unreadable` : '',
    folded ? `${folded} decided-in-flight folded` : '',
    unresolved.length ? `${unresolved.length} unresolved relations` : '',
  ].filter(Boolean).join(' · ');

  return {
    items,
    health,
    evidence: {
      coverage: partial
        ? {
            status: 'partial',
            repositoriesObserved,
            skippedRecords: skipped,
            unreadableRepositories,
          }
        : { status: 'complete', repositoriesObserved: repoCount, skippedRecords: 0, unreadableRepositories: 0 },
      records: scanned.map((record) => record.evidence).sort((a, b) => a.sourceRecordKey.localeCompare(b.sourceRecordKey)),
      standaloneUnansweredBriefs: buildPopulation(population),
      unresolvedRelations: unresolved,
    },
  };
}
