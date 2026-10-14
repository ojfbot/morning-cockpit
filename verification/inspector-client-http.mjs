import assert from 'node:assert/strict';
import { fetchEvidenceSummary, fetchEvidenceIndex, fetchEvidenceRecord } from '../packages/renderer/src/api.ts';
const base = new URL(process.argv[2]);
assert(['127.0.0.1', 'localhost'].includes(base.hostname), 'Use a controlled local fixture server');
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => originalFetch(typeof input === 'string' && input.startsWith('/') ? new URL(input, base) : input, init);
try {
  const summary = await fetchEvidenceSummary();
  const index = await fetchEvidenceIndex(summary.snapshotId);
  assert.equal(index.status, 'ready');
  assert.equal(index.snapshotId, summary.snapshotId);
  assert.equal(index.populationRecordKeys.length, summary.total);
  assert(index.unresolvedRelations.some(diagnostic => diagnostic.reason === 'relation-cycle'));
  const detail = await fetchEvidenceRecord(index.snapshotId, index.populationRecordKeys[0]);
  assert.equal(detail.status, 'ready');
  assert.equal(detail.snapshotId, summary.snapshotId);
  assert.equal(detail.record.documentProduction.status, 'legacy-unknown');
  assert.equal((await fetchEvidenceIndex('expired')).status, 'refresh-required');
  console.log('Actual renderer client through controlled HTTP/GraphQL: pinned index/detail, role/cycle fragments, legacy state and expiry passed.');
} finally { globalThis.fetch = originalFetch; }
