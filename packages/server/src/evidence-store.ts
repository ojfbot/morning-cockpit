import { randomUUID } from 'node:crypto';
import {
  sourceRecordKey,
  type CapturedEvidence,
  type EvidenceIndexResult,
  type EvidenceRecordResult,
  type EvidenceSummary,
  type InspectionTarget,
  type SourceRecordRef,
  type TaskDocumentResolution,
  type WorkItem,
} from '@cockpit/shared';

function coordinate(key: string): SourceRecordRef | null {
  let value: unknown;
  try {
    value = JSON.parse(key);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length !== 4) return null;
  const [kind, repository, nativeId, sourcePath]: unknown[] = value;
  let ref: SourceRecordRef;
  if (
    kind === 'dolt-bead-v1' &&
    (repository === null || typeof repository === 'string') &&
    typeof nativeId === 'string' &&
    sourcePath === null
  )
    ref = { kind, source: 'dolt-bead', repository, nativeId, sourcePath };
  else if (
    kind === 'handoff-document-v1' &&
    typeof repository === 'string' &&
    (nativeId === null || typeof nativeId === 'string') &&
    typeof sourcePath === 'string'
  )
    ref = { kind, source: 'handoff-bead', repository, nativeId, sourcePath };
  else return null;
  try {
    return sourceRecordKey(ref) === key ? ref : null;
  } catch {
    return null;
  }
}
function counts(records: ReadonlyArray<{ sourceRecord: SourceRecordRef }>) {
  const count = new Map<string | null, number>();
  for (const record of records)
    count.set(
      record.sourceRecord.repository,
      (count.get(record.sourceRecord.repository) ?? 0) + 1,
    );
  return [...count]
    .sort(([a], [b]) => (a ?? '').localeCompare(b ?? ''))
    .map(([repository, count]) => ({ repository, count }));
}
function resolve(
  link: TaskDocumentResolution,
  evidence: CapturedEvidence,
): TaskDocumentResolution {
  if (link.status === 'invalid-declaration') return link;
  const { referrer, fieldPath, target } = link;
  const declaration = { referrer, fieldPath, target };
  if (target.source === 'dolt-bead') {
    if (evidence.dolt.status === 'unavailable')
      return { status: 'target-source-unavailable', ...declaration };
    const candidates = evidence.dolt.records.filter(
      (record) => record.sourceRecord.nativeId === target.nativeId,
    );
    if (!candidates.length)
      return { status: 'target-not-observed-in-scope', ...declaration };
    if (candidates.length > 1)
      return {
        status: 'target-ambiguous',
        ...declaration,
        candidates: candidates.map((record) => record.sourceRecord),
      };
    const task = candidates[0];
    if (!task)
      return { status: 'target-not-observed-in-scope', ...declaration };
    if (task.native.type !== 'task')
      return {
        status: 'target-kind-incompatible',
        ...declaration,
        observed: task.sourceRecord,
        nativeType: task.native.type,
      };
    if (referrer.source !== 'handoff-bead')
      return {
        status: 'invalid-declaration',
        referrer,
        fieldPath,
        reason: 'A task target requires a document origin',
      };
    return {
      status: 'resolved',
      ...declaration,
      task: task.sourceRecord,
      taskRecordKey: task.sourceRecordKey,
      document: referrer,
      documentRecordKey: sourceRecordKey(referrer),
    };
  }
  if (evidence.handoff.coverage.status === 'unavailable')
    return { status: 'target-source-unavailable', ...declaration };
  const candidates = evidence.handoff.records.filter(
    (record) =>
      record.sourceRecord.repository === target.repository &&
      record.sourceRecord.sourcePath === target.sourcePath,
  );
  if (!candidates.length)
    return { status: 'target-not-observed-in-scope', ...declaration };
  if (candidates.length > 1)
    return {
      status: 'target-ambiguous',
      ...declaration,
      candidates: candidates.map((record) => record.sourceRecord),
    };
  const document = candidates[0];
  if (!document)
    return { status: 'target-not-observed-in-scope', ...declaration };
  if (referrer.source !== 'dolt-bead')
    return {
      status: 'invalid-declaration',
      referrer,
      fieldPath,
      reason: 'A document target requires a task origin',
    };
  return {
    status: 'resolved',
    ...declaration,
    task: referrer,
    taskRecordKey: sourceRecordKey(referrer),
    document: document.sourceRecord,
    documentRecordKey: document.sourceRecordKey,
  };
}
/** One immutable product of native collections. Index projections never become an inventory. */
export class EvidenceStore {
  private readonly snapshots = new Map<
    string,
    { capturedAt: number; generatedAt: string; evidence: CapturedEvidence }
  >();
  constructor(
    private readonly maxAgeMs = 300_000,
    private readonly maxSnapshots = 32,
    private readonly now = Date.now,
  ) {}
  capture(evidence: CapturedEvidence, generatedAt: string): EvidenceSummary {
    const capturedAt = this.now();
    this.prune(capturedAt);
    const snapshotId = randomUUID();
    const observation = structuredClone(evidence);
    if (observation.dolt.status === 'observed')
      for (const record of observation.dolt.records)
        record.declaredLinks = record.declaredLinks.map((link) =>
          resolve(link, observation),
        );
    for (const record of observation.handoff.records)
      record.declaredLinks = record.declaredLinks.map((link) =>
        resolve(link, observation),
      );
    this.snapshots.set(snapshotId, {
      capturedAt,
      generatedAt,
      evidence: observation,
    });
    while (this.snapshots.size > this.maxSnapshots) {
      const oldest = this.snapshots.keys().next().value;
      if (oldest === undefined) break;
      this.snapshots.delete(oldest);
    }
    const dolt = observation.dolt;
    const handoff = observation.handoff;
    return structuredClone({
      snapshotId,
      generatedAt,
      expiresAt: new Date(capturedAt + this.maxAgeMs).toISOString(),
      dolt:
        dolt.status === 'observed'
          ? {
              source: dolt.source,
              scope: dolt.scope,
              collectedAt: dolt.collectedAt,
              coverage: dolt.coverage,
              total: dolt.records.length,
              byRepository: counts(dolt.records),
            }
          : {
              source: dolt.source,
              scope: dolt.scope,
              collectedAt: null,
              coverage: {
                status: 'unavailable',
                repositoriesObserved: 0,
                skippedRecords: 0,
                unreadableRepositories: 0,
                reason: dolt.reason,
              },
              total: null,
              byRepository: [],
            },
      handoff: {
        inventory: {
          source: 'handoff-bead',
          scope: 'Configured repositories: supported .handoff/*.md frontmatter',
          collectedAt:
            handoff.coverage.status === 'unavailable'
              ? null
              : observation.handoffCollectedAt,
          coverage: handoff.coverage,
          total:
            handoff.coverage.status === 'unavailable'
              ? null
              : handoff.records.length,
          byRepository: counts(handoff.records),
        },
        populationCount:
          handoff.coverage.status === 'unavailable'
            ? null
            : handoff.standaloneUnansweredBriefs.total,
        populationByRepository: handoff.standaloneUnansweredBriefs.byRepository,
      },
      unresolvedCount:
        handoff.unresolvedRelations.length +
        handoff.records
          .flatMap((record) => record.declaredLinks)
          .filter((link) => link.status !== 'resolved').length +
        (dolt.status === 'observed'
          ? dolt.records
              .flatMap((record) => record.declaredLinks)
              .filter((link) => link.status !== 'resolved').length
          : 0),
    });
  }
  target(snapshotId: string, item: WorkItem): InspectionTarget {
    const evidence = this.get(snapshotId);
    const key = item.sourceRecordKey;
    const ref = item.sourceRecord;
    if (!evidence || !key || !ref)
      return { reason: 'This item has no observation-bound source reference' };
    const records =
      ref.source === 'dolt-bead'
        ? evidence.dolt.status === 'observed'
          ? evidence.dolt.records
          : []
        : evidence.handoff.records;
    const record = records.find((record) => record.sourceRecordKey === key);
    if (!record || sourceRecordKey(ref) !== key)
      return { reason: 'Item source was not observed in this capture' };
    const capture = this.snapshots.get(snapshotId);
    if (!capture) return { reason: 'Observation is unavailable' };
    return {
      snapshotId,
      generatedAt: capture.generatedAt,
      expiresAt: new Date(capture.capturedAt + this.maxAgeMs).toISOString(),
      sourceRecordKey: record.sourceRecordKey,
      sourceRecord: record.sourceRecord,
    };
  }
  index(snapshotId: string): EvidenceIndexResult {
    const evidence = this.get(snapshotId);
    if (!evidence) return this.expired(snapshotId);
    const dolt = evidence.dolt;
    const handoff = evidence.handoff;
    return {
      status: 'ready',
      snapshotId,
      dolt:
        dolt.status === 'unavailable'
          ? dolt
          : {
              ...dolt,
              records: dolt.records.map(
                ({ sourceRecordKey, sourceRecord, title }) => ({
                  sourceRecordKey,
                  sourceRecord,
                  title,
                }),
              ),
            },
      handoff:
        handoff.coverage.status === 'unavailable'
          ? {
              status: 'unavailable',
              source: 'handoff-bead',
              scope:
                'Configured repositories: supported .handoff/*.md frontmatter',
              reason: handoff.coverage.reason ?? 'Handoff source unavailable',
            }
          : {
              status: 'observed',
              source: 'handoff-bead',
              scope:
                'Configured repositories: supported .handoff/*.md frontmatter',
              collectedAt: evidence.handoffCollectedAt,
              coverage: handoff.coverage,
              records: handoff.records.map(
                ({ sourceRecordKey, sourceRecord, title }) => ({
                  sourceRecordKey,
                  sourceRecord,
                  title,
                }),
              ),
              populationRecordKeys:
                handoff.standaloneUnansweredBriefs.recordKeys,
              unresolvedRelations: handoff.unresolvedRelations,
            },
    };
  }
  record(snapshotId: string, key: string): EvidenceRecordResult {
    const evidence = this.get(snapshotId);
    if (!evidence) return this.expired(snapshotId);
    const ref = coordinate(key);
    if (!ref)
      return {
        status: 'invalid-reference',
        snapshotId,
        sourceRecordKey: key,
        reason: 'Invalid existing-source coordinate key',
      };
    if (ref.source === 'dolt-bead') {
      if (evidence.dolt.status === 'unavailable')
        return {
          status: 'source-unavailable',
          snapshotId,
          source: ref.source,
          reason: evidence.dolt.reason,
        };
      const record = evidence.dolt.records.find(
        (entry) => entry.sourceRecordKey === key,
      );
      return record
        ? { status: 'ready', snapshotId, record }
        : {
            status: 'record-not-observed',
            snapshotId,
            sourceRecordKey: key,
            source: ref.source,
            scope: evidence.dolt.scope,
          };
    }
    if (evidence.handoff.coverage.status === 'unavailable')
      return {
        status: 'source-unavailable',
        snapshotId,
        source: ref.source,
        reason:
          evidence.handoff.coverage.reason ?? 'Handoff source unavailable',
      };
    const record = evidence.handoff.records.find(
      (entry) => entry.sourceRecordKey === key,
    );
    return record
      ? { status: 'ready', snapshotId, record }
      : {
          status: 'record-not-observed',
          snapshotId,
          sourceRecordKey: key,
          source: ref.source,
          scope: 'Configured repositories: supported .handoff/*.md frontmatter',
        };
  }
  private expired(
    snapshotId: string,
  ): Extract<EvidenceIndexResult, { status: 'refresh-required' }> {
    return {
      status: 'refresh-required',
      snapshotId,
      reason:
        'Observation expired or is unavailable after restart. Refresh evidence.',
    };
  }
  private get(snapshotId: string): CapturedEvidence | undefined {
    this.prune(this.now());
    const observed = this.snapshots.get(snapshotId);
    return observed ? structuredClone(observed.evidence) : undefined;
  }
  private prune(now: number): void {
    for (const [key, value] of this.snapshots)
      if (now - value.capturedAt >= this.maxAgeMs) this.snapshots.delete(key);
  }
}
export const evidenceStore = new EvidenceStore();
