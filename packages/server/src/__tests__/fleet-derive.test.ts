import { describe, expect, it } from 'vitest';
import type { CockpitSnapshot, WorkItem } from '@cockpit/shared';
import { deriveFleet, fleetTotals, livenessOf } from '../fleet-derive.js';

const DAY = 86_400_000;
const NOW = Date.parse('2026-08-01T12:00:00Z');
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

function item(repo: string, activityAt: string): WorkItem {
  return { id: `${repo}-1`, repo, activityAt, status: 'open' } as unknown as WorkItem;
}

function snapshot(items: WorkItem[]): CockpitSnapshot {
  return {
    lanes: { overnight: items, pickup: [], available: [] },
  } as unknown as CockpitSnapshot;
}

describe('livenessOf', () => {
  it('ages real timestamps', () => {
    expect(livenessOf(ago(0.5), NOW)).toBe('live');
    expect(livenessOf(ago(10), NOW)).toBe('stale');
    expect(livenessOf(ago(90), NOW)).toBe('dark');
  });

  it('falls through to dark when there is no timestamp at all', () => {
    expect(livenessOf(null, NOW)).toBe('dark');
  });
});

describe('deriveFleet — liveness basis', () => {
  const repos = deriveFleet(snapshot([item('core', ago(0.5)), item('daily-logger', ago(90))]), NOW);
  const byName = (n: string) => repos.find((r) => r.name === n)!;

  it('marks repos with real activity as activity-based', () => {
    expect(byName('core').liveness).toBe('live');
    expect(byName('core').basis).toBe('activity');
  });

  it('marks a genuinely aged repo dark WITH an activity basis', () => {
    // This one really is dark: we have evidence, and the evidence is old.
    expect(byName('daily-logger').liveness).toBe('dark');
    expect(byName('daily-logger').basis).toBe('activity');
  });

  it('distinguishes a repo with NO beads from one whose beads went cold', () => {
    // Both read `dark`. Only one of them is evidence of anything.
    const noBeads = byName('purefoy');
    expect(noBeads.liveness).toBe('dark');
    expect(noBeads.basis).toBe('no-data');
    expect(noBeads.lastActivity).toBeNull();
  });
});

describe('fleetTotals', () => {
  it('reports noData as a subset of dark, so absence of signal is not read as death', () => {
    const repos = deriveFleet(snapshot([item('core', ago(0.5)), item('daily-logger', ago(90))]), NOW);
    const t = fleetTotals(repos);

    expect(t.live).toBe(1);
    expect(t.noData).toBeGreaterThan(0);
    // noData counts within dark, never alongside it — the two must not double-count.
    expect(t.dark).toBeGreaterThanOrEqual(t.noData);
    expect(t.dark).toBe(repos.filter((r) => r.liveness === 'dark').length);
    expect(t.live + t.stale + t.dark).toBe(t.repos);
  });

  it('reports zero noData when every repo has activity', () => {
    const t = fleetTotals(
      deriveFleet(snapshot([]), NOW).map((r) => ({ ...r, basis: 'activity' as const })),
    );
    expect(t.noData).toBe(0);
  });
});
