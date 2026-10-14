import { randomUUID } from 'node:crypto';
import type { CockpitEvidence, EvidenceIndexResult, EvidenceRecordResult, EvidenceSummary } from '@cockpit/shared';

/** Bounded process-local observations; IDs expire on age, eviction or server restart. */
export class EvidenceStore {
  private readonly snapshots = new Map<string, { capturedAt: number; evidence: CockpitEvidence }>();
  constructor(private readonly maxAgeMs = 300_000, private readonly maxSnapshots = 32, private readonly now = Date.now) {}

  capture(evidence: CockpitEvidence, generatedAt: string): EvidenceSummary {
    const capturedAt = this.now();
    this.prune(capturedAt);
    const snapshotId = randomUUID();
    const observation = structuredClone(evidence);
    this.snapshots.set(snapshotId, { capturedAt, evidence: observation });
    while (this.snapshots.size > this.maxSnapshots) {
      const oldest = this.snapshots.keys().next().value;
      if (oldest === undefined) break;
      this.snapshots.delete(oldest);
    }
    return structuredClone({ snapshotId, generatedAt, coverage: observation.coverage, total: observation.standaloneUnansweredBriefs.total, byRepository: observation.standaloneUnansweredBriefs.byRepository, unresolvedCount: observation.unresolvedRelations.length });
  }
  index(snapshotId: string): EvidenceIndexResult {
    const evidence = this.get(snapshotId);
    if (!evidence) return { status: 'refresh-required', snapshotId, reason: 'Observation expired or is unavailable after restart. Refresh evidence.' };
    return { status: 'ready', snapshotId, records: evidence.records.map(({ sourceRecordKey, sourceRecord, title }) => ({ sourceRecordKey, sourceRecord, title })), populationRecordKeys: evidence.standaloneUnansweredBriefs.recordKeys, unresolvedRelations: evidence.unresolvedRelations };
  }
  record(snapshotId: string, sourceRecordKey: string): EvidenceRecordResult {
    const evidence = this.get(snapshotId);
    if (!evidence) return { status: 'refresh-required', snapshotId, reason: 'Observation expired or is unavailable after restart. Refresh evidence.' };
    const record = evidence.records.find(entry => entry.sourceRecordKey === sourceRecordKey);
    return record ? { status: 'ready', snapshotId, record } : { status: 'record-not-observed', snapshotId, sourceRecordKey };
  }
  private get(snapshotId: string): CockpitEvidence | undefined {
    this.prune(this.now());
    const observed = this.snapshots.get(snapshotId);
    return observed ? structuredClone(observed.evidence) : undefined;
  }
  private prune(now: number): void {
    for (const [key, value] of this.snapshots) if (now - value.capturedAt >= this.maxAgeMs) this.snapshots.delete(key);
  }
}
export const evidenceStore = new EvidenceStore();
