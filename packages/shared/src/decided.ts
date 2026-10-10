import type { UnresolvedRelationDiagnostic } from './source-record.js';

/**
 * Decided-in-flight derivation (rm:rm-l1-morning-cockpit#S8) — the read side of the
 * decision→delivery seam.
 *
 * Approve & emit (ADR-0005) writes a successor brief whose frontmatter carries
 * `refs: [closes:<old-bead-id>]`, and mutates nothing else — bead `status:` transitions belong
 * to core's verbs. So between decision and delivery BOTH beads are `status: live`, and a read
 * side that only understands "delivered" double-counts the pair. Instead we derive the seam:
 * a live bead referenced by an OPEN bead's `closes:` ref is `decided-in-flight` — it leaves
 * the Briefing decision pool and folds under its successor as one chained Pickup item. When
 * the successor closes at delivery the derivation ends and the predecessor reads normally
 * again. Derivation, never bead mutation (liveness.ts precedent: derive from evidence, don't
 * trust stored status to tell the whole story).
 */

const CLOSES_PREFIX = 'closes:';

/** Extract the target ids of `closes:<id>` ref tokens; other kinds and blanks are ignored. */
export function parseClosesRefs(refs: readonly string[] | undefined): string[] {
  if (!refs) return [];
  const ids: string[] = [];
  for (const ref of refs) {
    if (typeof ref !== 'string' || !ref.startsWith(CLOSES_PREFIX)) continue;
    const id = ref.slice(CLOSES_PREFIX.length).trim();
    if (id) ids.push(id);
  }
  return ids;
}

/** Minimal projection of a scanned bead — just what the derivation needs (LaneInput precedent). */
export interface DecidedBead {
  /** Stable cockpit source-record key. */
  sourceRecordKey: string;
  id?: string;
  /** Raw frontmatter status (`live` is the only value that can derive). */
  status?: string;
  /** Adapter-computed open hook: a live brief no report responds to. */
  open: boolean;
  /** Raw `refs:` tokens from frontmatter. */
  refs?: string[];
  /** ISO created_at — tie-break when two open successors close the same bead. */
  createdAt?: string;
}

/** The folded predecessor carried on a successor WorkItem. Derived read-side, never stored. */
export interface ChainedPredecessor {
  sourceRecordKey?: string;
  nativeId: string;
  title: string;
  url?: string;
  createdAt?: string;
  state: 'decided-in-flight';
}

/**
 * The folded stack for an emitted successor: every bead that rides under it, transitively —
 * a successor may itself close a bead that closed another (live example: the S8 delivery brief
 * closes the pick-up brief which closes the northstar brief). Nearest link first; within one
 * depth, sorted by id for determinism. Cycle-safe via the seen set.
 */
export function foldedChainFor(successorId: string, decided: ReadonlyMap<string, string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>([successorId]);
  let frontier = [successorId];
  while (frontier.length > 0) {
    const level: string[] = [];
    for (const [pred, succ] of decided) {
      if (frontier.includes(succ) && !seen.has(pred)) {
        seen.add(pred);
        level.push(pred);
      }
    }
    level.sort();
    out.push(...level);
    frontier = level;
  }
  return out;
}

export interface DecidedResolution {
  /** Qualified predecessor key → qualified successor key. */
  decided: Map<string, string>;
  diagnostics: UnresolvedRelationDiagnostic[];
  affectedSourceRecordKeys: Set<string>;
}

function diagnosticKey(diagnostic: UnresolvedRelationDiagnostic): string {
  return JSON.stringify([
    diagnostic.reason,
    diagnostic.relation,
    diagnostic.targetNativeId,
    diagnostic.affectedSourceRecordKeys,
  ]);
}

/**
 * Resolve supported read-side folds while retaining ambiguous observations as typed diagnostics.
 * Bare authored ids are only resolved when exactly one live source record carries that id.
 */
export function resolveDecidedInFlight(beads: readonly DecidedBead[]): DecidedResolution {
  const liveByNativeId = new Map<string, DecidedBead[]>();
  for (const bead of beads) {
    if (!bead.id || bead.status !== 'live') continue;
    const candidates = liveByNativeId.get(bead.id) ?? [];
    candidates.push(bead);
    liveByNativeId.set(bead.id, candidates);
  }

  const diagnostics: UnresolvedRelationDiagnostic[] = [];
  const affected = new Set<string>();
  const proposals = new Map<string, Array<{ successorKey: string; createdAt: number | null }>>();

  const addDiagnostic = (diagnostic: UnresolvedRelationDiagnostic) => {
    diagnostic.affectedSourceRecordKeys = [...new Set(diagnostic.affectedSourceRecordKeys)].sort();
    diagnostics.push(diagnostic);
    for (const key of diagnostic.affectedSourceRecordKeys) affected.add(key);
  };

  for (const bead of beads) {
    if (!bead.open) continue;
    for (const targetNativeId of parseClosesRefs(bead.refs)) {
      const candidates = liveByNativeId.get(targetNativeId) ?? [];
      if (candidates.length === 0) {
        addDiagnostic({
          reason: 'target-not-observed',
          relation: 'closes',
          targetNativeId,
          affectedSourceRecordKeys: [bead.sourceRecordKey],
        });
        continue;
      }
      if (candidates.length > 1) {
        addDiagnostic({
          reason: 'target-matches-multiple-records',
          relation: 'closes',
          targetNativeId,
          affectedSourceRecordKeys: [bead.sourceRecordKey, ...candidates.map((candidate) => candidate.sourceRecordKey)],
        });
        continue;
      }

      const predecessorKey = candidates[0]!.sourceRecordKey;
      const parsedCreatedAt = Date.parse(bead.createdAt ?? '');
      const candidate = {
        successorKey: bead.sourceRecordKey,
        createdAt: Number.isNaN(parsedCreatedAt) ? null : parsedCreatedAt,
      };
      const current = proposals.get(predecessorKey) ?? [];
      if (!current.some((entry) => entry.successorKey === candidate.successorKey)) current.push(candidate);
      proposals.set(predecessorKey, current);
    }
  }

  const decided = new Map<string, string>();
  for (const [predecessorKey, candidates] of proposals) {
    if (candidates.length === 1) {
      decided.set(predecessorKey, candidates[0]!.successorKey);
      continue;
    }
    const ordered = [...candidates].sort((a, b) => (b.createdAt ?? -Infinity) - (a.createdAt ?? -Infinity));
    const top = ordered[0];
    const second = ordered[1];
    if (!top || top.createdAt === null || candidates.some((candidate) => candidate.createdAt === null) || top.createdAt === second?.createdAt) {
      const predecessor = beads.find((bead) => bead.sourceRecordKey === predecessorKey);
      addDiagnostic({
        reason: 'successor-order-unresolved',
        relation: 'closes',
        targetNativeId: predecessor?.id ?? null,
        affectedSourceRecordKeys: [predecessorKey, ...candidates.map((candidate) => candidate.successorKey)],
      });
      continue;
    }
    decided.set(predecessorKey, top.successorKey);
  }

  // Every node has at most one outgoing edge. Walk each chain and remove complete cycles.
  const visited = new Set<string>();
  for (const start of decided.keys()) {
    if (visited.has(start)) continue;
    const path: string[] = [];
    const position = new Map<string, number>();
    let current: string | undefined = start;
    while (current && !visited.has(current)) {
      const cycleAt = position.get(current);
      if (cycleAt !== undefined) {
        const cycle = path.slice(cycleAt).sort();
        addDiagnostic({
          reason: 'relation-cycle',
          relation: 'closes',
          targetNativeId: null,
          affectedSourceRecordKeys: cycle,
        });
        for (const key of cycle) decided.delete(key);
        break;
      }
      position.set(current, path.length);
      path.push(current);
      current = decided.get(current);
    }
    for (const key of path) visited.add(key);
  }

  const uniqueDiagnostics = [...new Map(diagnostics.map((entry) => [diagnosticKey(entry), entry])).values()]
    .sort((a, b) => diagnosticKey(a).localeCompare(diagnosticKey(b)));
  return { decided, diagnostics: uniqueDiagnostics, affectedSourceRecordKeys: affected };
}

/** Compatibility helper for callers that need only the supported folds. */
export function deriveDecidedInFlight(beads: readonly DecidedBead[]): Map<string, string> {
  return resolveDecidedInFlight(beads).decided;
}
