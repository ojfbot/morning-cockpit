import { describe, expect, it } from 'vitest';
import {
  emptyCockpitEvidence,
  sourceRecordKey,
  type CapturedEvidence,
  type HandoffRecordEvidence,
} from '@cockpit/shared';
import { EvidenceStore } from '../evidence-store.js';
const ref = {
  kind: 'handoff-document-v1',
  source: 'handoff-bead',
  repository: 'alpha',
  nativeId: null,
  sourcePath: '.handoff/legacy.md',
} as const;
const record: HandoffRecordEvidence = {
  sourceRecordKey: sourceRecordKey(ref),
  sourceRecord: ref,
  title: 'Before',
  literal: {
    type: 'brief',
    status: 'live',
    actor: null,
    to: null,
    respondingTo: null,
    refs: [],
    authoredCreatedAt: null,
  },
  collectedAt: '2026-10-13T00:00:00Z',
  observedModifiedAt: '2026-10-13T00:00:00Z',
  documentProduction: { status: 'legacy-unknown', reason: 'Not recorded.' },
  declaredLinks: [],
};
function evidence(): CapturedEvidence {
  const handoff = emptyCockpitEvidence({
    status: 'complete',
    repositoriesObserved: 1,
    skippedRecords: 0,
    unreadableRepositories: 0,
    reason: null,
  });
  handoff.records = [structuredClone(record)];
  handoff.standaloneUnansweredBriefs = {
    name: 'standaloneUnansweredBriefs',
    total: 1,
    byRepository: [{ repository: 'alpha', count: 1 }],
    recordKeys: [record.sourceRecordKey],
  };
  return {
    dolt: {
      status: 'unavailable',
      source: 'dolt-bead',
      scope: 'Fixture scope',
      reason: 'Fixture absent',
    },
    handoff,
    handoffCollectedAt: record.collectedAt,
  };
}
describe('pinned on-demand evidence reads', () => {
  it('summarizes without leaking the ledger and preserves captured metadata', () => {
    const store = new EvidenceStore();
    const input = evidence();
    const summary = store.capture(input, record.collectedAt);
    input.handoff.records[0]!.title = 'After';
    expect(summary).not.toHaveProperty('records');
    expect(summary.handoff.populationCount).toBe(1);
    expect(summary.dolt.total).toBeNull();
    expect(store.index(summary.snapshotId)).toMatchObject({
      status: 'ready',
      snapshotId: summary.snapshotId,
      handoff: {
        records: [
          {
            sourceRecordKey: record.sourceRecordKey,
            sourceRecord: record.sourceRecord,
            title: 'Before',
          },
        ],
        populationRecordKeys: [record.sourceRecordKey],
        unresolvedRelations: [],
      },
    });
    const detail = store.record(summary.snapshotId, record.sourceRecordKey);
    expect(detail).toMatchObject({
      status: 'ready',
      record: {
        title: 'Before',
        documentProduction: { status: 'legacy-unknown' },
      },
    });
    if (detail.status === 'ready') detail.record.title = 'Consumer edit';
    expect(
      store.record(summary.snapshotId, record.sourceRecordKey),
    ).toMatchObject({ record: { title: 'Before' } });
    expect(store.record(summary.snapshotId, 'missing').status).toBe(
      'invalid-reference',
    );
    expect(
      store.record(
        summary.snapshotId,
        sourceRecordKey({ ...ref, sourcePath: '.handoff/missing.md' }),
      ).status,
    ).toBe('record-not-observed');
  });
  it('returns refresh-required at exact expiry, eviction and restart', () => {
    let now = 0;
    const store = new EvidenceStore(100, 1, () => now);
    const first = store.capture(evidence(), record.collectedAt);
    now = 99;
    expect(store.index(first.snapshotId).status).toBe('ready');
    now = 100;
    expect(store.index(first.snapshotId).status).toBe('refresh-required');
    const next = store.capture(evidence(), record.collectedAt);
    const final = store.capture(evidence(), record.collectedAt);
    expect(store.record(next.snapshotId, record.sourceRecordKey).status).toBe(
      'refresh-required',
    );
    expect(store.index(final.snapshotId).status).toBe('ready');
    expect(new EvidenceStore().index(final.snapshotId).status).toBe(
      'refresh-required',
    );
  });
  it('isolates retained collections from returned summary and index mutations', () => {
    const store = new EvidenceStore(100, 32, () => 0);
    const input = evidence();
    const summary = store.capture(input, record.collectedAt);
    summary.handoff.inventory.coverage.status = 'partial';
    summary.handoff.inventory.byRepository.push({
      repository: 'injected',
      count: 99,
    });
    const index = store.index(summary.snapshotId);
    if (index.status === 'ready' && index.handoff.status === 'observed') {
      index.handoff.records[0]!.title = 'Edit';
      index.handoff.coverage.status = 'partial';
    }
    expect(store.index(summary.snapshotId)).toMatchObject({
      handoff: {
        coverage: { status: 'complete' },
        records: [{ title: 'Before' }],
      },
    });
    expect(
      store.record(summary.snapshotId, record.sourceRecordKey),
    ).toMatchObject({ status: 'ready', record: { title: 'Before' } });
  });
});
