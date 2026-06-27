import { describe, it, expect } from 'vitest';
import { scopeSnapshotToRepo } from '../briefing.js';
import type { CockpitSnapshot, WorkItem, WorkItemLane } from '../work-item.js';

function item(repo: string, lane: WorkItemLane, id: string): WorkItem {
  return {
    id: `dolt-bead:${id}`,
    nativeId: id,
    source: 'dolt-bead',
    kind: 'task',
    status: 'open',
    lane,
    title: `${repo} ${id}`,
    repo,
    activityAt: '2026-06-27T00:00:00.000Z',
    detail: { kind: 'generic' },
    provenance: {},
  };
}

function snap(): CockpitSnapshot {
  const empty = { headline: '', bullets: [] as string[] };
  return {
    generatedAt: '2026-06-27T05:00:00.000Z',
    overnightSince: '2026-06-26T22:00:00.000Z',
    lanes: {
      overnight: [item('core', 'overnight', 'o1'), item('cv-builder', 'overnight', 'o2')],
      pickup: [item('core', 'pickup', 'p1')],
      available: [item('daily-logger', 'available', 'a1'), item('core', 'available', 'a2')],
    },
    health: [],
    summaries: {
      overnight: { ...empty, source: 'deterministic', lane: 'overnight', action: '' },
      pickup: { ...empty, source: 'deterministic', lane: 'pickup', action: '' },
      available: { ...empty, source: 'deterministic', lane: 'available', action: '' },
    },
    meta: { totalItems: 5, skipped: 0 },
  };
}

describe('scopeSnapshotToRepo (F2)', () => {
  it('keeps only items whose repo matches, across every lane', () => {
    const scoped = scopeSnapshotToRepo(snap(), 'core');
    const all = [...scoped.lanes.overnight, ...scoped.lanes.pickup, ...scoped.lanes.available];
    expect(all.length).toBe(3); // o1, p1, a2
    expect(all.every((i) => i.repo === 'core')).toBe(true);
  });

  it('yields empty lanes for a repo with no items (honest empty)', () => {
    const scoped = scopeSnapshotToRepo(snap(), 'no-such-repo');
    expect(scoped.lanes.overnight).toHaveLength(0);
    expect(scoped.lanes.pickup).toHaveLength(0);
    expect(scoped.lanes.available).toHaveLength(0);
  });

  it('does not mutate the input snapshot (pure)', () => {
    const original = snap();
    scopeSnapshotToRepo(original, 'core');
    expect(original.lanes.overnight).toHaveLength(2);
  });
});
