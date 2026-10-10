import { describe, expect, it, vi } from 'vitest';

vi.mock('../adapters/dolt.js', () => ({
  fetchDolt: vi.fn().mockResolvedValue({
    items: [],
    health: { name: 'dolt-bead', status: 'up', itemCount: 0 },
  }),
}));
vi.mock('../adapters/handoff.js', () => ({
  fetchHandoff: vi.fn().mockRejectedValue(new Error('fixture collection failed')),
}));

import { buildSnapshot } from '../aggregate.js';

describe('aggregate evidence fallback', () => {
  it('fails evidence coverage closed when the handoff adapter throws unexpectedly', async () => {
    const snapshot = await buildSnapshot(new Date('2026-10-10T12:00:00.000Z'));

    expect(snapshot.evidence?.coverage).toEqual({
      status: 'unavailable',
      repositoriesObserved: 0,
      skippedRecords: 0,
      unreadableRepositories: 0,
      reason: 'fixture collection failed',
    });
    expect(snapshot.health).toContainEqual(expect.objectContaining({
      name: 'handoff-bead',
      status: 'down',
      lastError: 'fixture collection failed',
    }));
  });
});
