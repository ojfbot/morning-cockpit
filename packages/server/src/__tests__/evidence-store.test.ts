import { describe, expect, it } from 'vitest';
import { emptyCockpitEvidence, type HandoffRecordEvidence } from '@cockpit/shared';
import { EvidenceStore } from '../evidence-store.js';
const record: HandoffRecordEvidence = { sourceRecordKey: 'opaque-key', sourceRecord: { kind: 'handoff-document-v1', source: 'handoff-bead', repository: 'alpha', nativeId: null, sourcePath: '.handoff/legacy.md' }, title: 'Before', literal: { type: 'brief', status: 'live', actor: null, to: null, respondingTo: null, refs: [], authoredCreatedAt: null }, collectedAt: '2026-10-13T00:00:00Z', observedModifiedAt: '2026-10-13T00:00:00Z', documentProduction: { status: 'legacy-unknown', reason: 'Not recorded.' } };
function evidence() { const result = emptyCockpitEvidence({ status: 'complete', repositoriesObserved: 1, skippedRecords: 0, unreadableRepositories: 0 }); result.records = [structuredClone(record)]; result.standaloneUnansweredBriefs = { name: 'standaloneUnansweredBriefs', total: 1, byRepository: [{ repository: 'alpha', count: 1 }], recordKeys: ['opaque-key'] }; return result; }
describe('pinned on-demand evidence reads', () => {
  it('summarizes without leaking the ledger, normalizes membership and preserves the captured observation', () => {
    const store = new EvidenceStore(); const input = evidence(); const summary = store.capture(input, record.collectedAt); input.records[0]!.title = 'After';
    expect(summary).not.toHaveProperty('records'); expect(summary.total).toBe(1);
    expect(store.index(summary.snapshotId)).toEqual({ status: 'ready', snapshotId: summary.snapshotId, records: [{ sourceRecordKey: record.sourceRecordKey, sourceRecord: record.sourceRecord, title: 'Before' }], populationRecordKeys: ['opaque-key'], unresolvedRelations: [] });
    const detail = store.record(summary.snapshotId, record.sourceRecordKey); expect(detail).toMatchObject({ status: 'ready', record: { title: 'Before', documentProduction: { status: 'legacy-unknown' } } });
    if (detail.status === 'ready') detail.record.title = 'Consumer edit';
    expect(store.record(summary.snapshotId, record.sourceRecordKey)).toMatchObject({ record: { title: 'Before' } });
    expect(store.record(summary.snapshotId, 'missing')).toEqual({ status: 'record-not-observed', snapshotId: summary.snapshotId, sourceRecordKey: 'missing' });
  });
  it('returns refresh-required at exact expiry, eviction and restart without substituting newer data', () => {
    let now = 0; const store = new EvidenceStore(100, 1, () => now); const first = store.capture(evidence(), record.collectedAt);
    now = 99; expect(store.index(first.snapshotId).status).toBe('ready'); now = 100; expect(store.index(first.snapshotId).status).toBe('refresh-required');
    const next = store.capture(evidence(), record.collectedAt); const final = store.capture(evidence(), record.collectedAt);
    expect(store.record(next.snapshotId, record.sourceRecordKey).status).toBe('refresh-required'); expect(store.index(final.snapshotId).status).toBe('ready'); expect(new EvidenceStore().index(final.snapshotId).status).toBe('refresh-required');
  });
  it('isolates retained coverage and repository totals from returned summary mutations', () => {
    const store = new EvidenceStore(100, 32, () => 0);
    const input = evidence();
    const original = structuredClone(input);
    const summary = store.capture(input, record.collectedAt);
    summary.coverage.status = 'partial';
    for (const entry of summary.byRepository) { entry.repository = 'consumer-edit'; entry.count = 99; }
    summary.byRepository.push({ repository: 'injected', count: 1 });
    // These summary fields have no public pinned read; inspect retained state to test aliasing.
    const snapshots: unknown = Reflect.get(store, 'snapshots');
    if (!(snapshots instanceof Map)) throw new Error('Retained observations must exist for this control.');
    const retained: unknown = snapshots.get(summary.snapshotId);
    expect(retained).toEqual({ capturedAt: 0, evidence: original });
    expect(store.record(summary.snapshotId, record.sourceRecordKey)).toMatchObject({ status: 'ready', record: { title: 'Before' } });
  });
});
