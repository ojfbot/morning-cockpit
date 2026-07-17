import { describe, it, expect } from 'vitest';
import {
  parseDispositionLines,
  buildCaptureHealth,
  countDispositions,
  buildSkillBreakdown,
  buildOdometerFreshness,
  buildPopulationFunnels,
  populationOf,
  type DispositionEvent,
} from '../loop.js';
import type { Movement } from '../delivery.js';

const NOW = new Date('2026-07-16T09:00:00Z');

// Real-shaped lines (schema as emitted by core's shadow-mode hooks).
const LINE = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    ts: '2026-07-13T20:31:01.605Z',
    event: 'skill:disposition',
    mode: 'shadow',
    suggestion_id: '1209ED57-4021-4520-BBAD-C078BA55DB18',
    skill: 'summarize',
    session_id: '3eef8b02-50c6-4a4d-8e60-90e87c1e8b2a',
    suggested_at: '2026-07-13T20:30:24Z',
    disposition: 'ignored',
    engaged: false,
    acted: false,
    artifact_exists: false,
    ...over,
  });

describe('parseDispositionLines', () => {
  it('round-trips valid lines and skips blanks silently', () => {
    const text = `${LINE()}\n\n${LINE({ skill: 'init', disposition: 'engaged_no_act', engaged: true })}\n`;
    const { events, skipped } = parseDispositionLines(text);
    expect(skipped).toBe(0);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      ts: '2026-07-13T20:31:01.605Z',
      skill: 'summarize',
      disposition: 'ignored',
      engaged: false,
      acted: false,
      artifactExists: false,
      mode: 'shadow',
    });
    expect(events[1]).toMatchObject({ skill: 'init', disposition: 'engaged_no_act', engaged: true });
  });

  it('counts malformed JSON and lines missing required fields as skipped, never fatal', () => {
    const text = [
      'not json at all',
      '{"ts":"2026-07-13T00:00:00Z","skill":"x"}', // missing disposition
      '{"skill":"x","disposition":"ignored"}', // missing ts
      LINE(),
    ].join('\n');
    const { events, skipped } = parseDispositionLines(text);
    expect(events).toHaveLength(1);
    expect(skipped).toBe(3);
  });

  it('preserves unknown disposition strings raw', () => {
    const { events } = parseDispositionLines(LINE({ disposition: 'weird_new_state' }));
    expect(events[0]!.disposition).toBe('weird_new_state');
  });
});

describe('buildCaptureHealth', () => {
  it('computes totals, the 7-day window, and days-since-newest', () => {
    const events = parseDispositionLines(
      [
        LINE({ ts: '2026-06-18T21:09:15Z' }), // old
        LINE({ ts: '2026-07-10T00:00:00Z' }), // inside 7d (Jul 9 floor)
        LINE({ ts: '2026-07-13T20:31:01Z' }), // newest
      ].join('\n'),
    ).events;
    const health = buildCaptureHealth(events, NOW, 3);
    expect(health.total).toBe(3);
    expect(health.last7d).toBe(2);
    expect(health.newestTs).toBe('2026-07-13T20:31:01Z');
    expect(health.daysSinceLast).toBe(2); // 2026-07-13T20:31 → 2026-07-16T09:00 = 2.5d, floored
  });

  it('flags stale exactly at the threshold, not below it', () => {
    const at = (ts: string) => parseDispositionLines(LINE({ ts })).events;
    // 3 whole days quiet, threshold 3 → stale
    expect(buildCaptureHealth(at('2026-07-13T08:00:00Z'), NOW, 3).stale).toBe(true);
    // 2 whole days quiet, threshold 3 → fresh
    expect(buildCaptureHealth(at('2026-07-13T20:00:00Z'), NOW, 3).stale).toBe(false);
  });

  it('treats no events as stale with undefined recency', () => {
    const health = buildCaptureHealth([], NOW, 3);
    expect(health).toEqual({ total: 0, last7d: 0, newestTs: undefined, daysSinceLast: undefined, stale: true });
  });
});

describe('countDispositions', () => {
  const events = parseDispositionLines(
    [
      LINE({ ts: '2026-06-18T00:00:00Z' }),
      LINE({ ts: '2026-07-02T09:00:00Z', disposition: 'engaged_no_act', engaged: true }),
      LINE({ ts: '2026-07-13T00:00:00Z' }),
      LINE({ ts: '2026-07-13T01:00:00Z', disposition: 'mystery' }),
      LINE({ ts: '2026-07-14T00:00:00Z', disposition: 'followed', engaged: true, acted: true }),
      LINE({ ts: '2026-07-15T00:00:00Z', disposition: 'capture_miss', engaged: true, artifact_exists: true }),
      LINE({ ts: '2026-07-15T01:00:00Z', disposition: 'acted', engaged: true, acted: true }),
    ].join('\n'),
  ).events;

  it('buckets by disposition string and counts acted from the boolean', () => {
    const all = countDispositions(events);
    // The 'acted'-string row is owned by the acted boolean — it must NOT leak into other.
    expect(all).toEqual({ ignored: 2, engaged_no_act: 1, followed: 1, capture_miss: 1, acted: 2, other: 1, total: 7 });
  });

  it('windows on since — an event exactly at the boundary is included', () => {
    const since = new Date('2026-07-02T09:00:00Z'); // exactly the engaged_no_act event
    const windowed = countDispositions(events, since);
    expect(windowed.total).toBe(6);
    expect(windowed.ignored).toBe(1);
    expect(windowed.engaged_no_act).toBe(1);
    expect(windowed.capture_miss).toBe(1);
  });

  it('reports an explicit zero for followed on a real-shaped all-ignored feed', () => {
    const ignoredOnly = parseDispositionLines(`${LINE()}\n${LINE({ skill: 'init' })}`).events;
    const counts = countDispositions(ignoredOnly);
    expect(counts.followed).toBe(0);
    expect(counts.acted).toBe(0);
    expect(counts.total).toBe(2);
  });
});

describe('buildSkillBreakdown', () => {
  const mk = (skill: string, n: number, extra: Record<string, unknown> = {}): DispositionEvent[] =>
    parseDispositionLines(
      Array.from({ length: n }, () => LINE({ skill, ...extra })).join('\n'),
    ).events;

  it('sorts by total desc with alpha tiebreak and truncates to topN', () => {
    const events = [...mk('summarize', 3), ...mk('init', 2), ...mk('adr', 2), ...mk('vault', 1)];
    const rows = buildSkillBreakdown(events, 3);
    expect(rows.map((r) => r.skill)).toEqual(['summarize', 'adr', 'init']);
  });

  it('computes follow/engaged counts and a zero followRate without dividing by zero', () => {
    const events = [
      ...mk('summarize', 4),
      ...mk('tdd', 1, { disposition: 'followed', engaged: true }),
      ...mk('tdd', 1, { disposition: 'engaged_no_act', engaged: true }),
    ];
    const rows = buildSkillBreakdown(events, 8);
    const summarize = rows.find((r) => r.skill === 'summarize')!;
    const tdd = rows.find((r) => r.skill === 'tdd')!;
    expect(summarize).toMatchObject({ total: 4, followed: 0, engaged: 0, followRate: 0 });
    expect(tdd).toMatchObject({ total: 2, followed: 1, engaged: 2, followRate: 0.5 });
    expect(buildSkillBreakdown([], 8)).toEqual([]);
  });
});

describe('populations (rm:rm-l1-core#S7) — eras never blended', () => {
  const events = parseDispositionLines(
    [
      LINE({ ts: '2026-06-20T00:00:00Z' }), // legacy: no population field
      LINE({ ts: '2026-07-17T00:00:00Z', population: 'installed', disposition: 'engaged_no_act', engaged: true }),
      LINE({ ts: '2026-07-17T01:00:00Z', population: 'installed' }),
      LINE({ ts: '2026-07-17T02:00:00Z', population: 'uninstalled' }),
      LINE({ ts: '2026-07-17T03:00:00Z', population: 'weird-future-tag' }), // unknown → legacy
    ].join('\n'),
  ).events;

  it('parses the population field and buckets unknown/absent tags as legacy', () => {
    expect(populationOf(events[0]!)).toBe('legacy');
    expect(populationOf(events[1]!)).toBe('installed');
    expect(populationOf(events[3]!)).toBe('uninstalled');
    expect(populationOf(events[4]!)).toBe('legacy');
  });

  it('always returns all three populations in fixed order with explicit zeros', () => {
    const funnels = buildPopulationFunnels(events, NOW);
    expect(funnels.map((f) => f.population)).toEqual(['installed', 'uninstalled', 'legacy']);
    const [installed, uninstalled, legacy] = funnels;
    expect(installed!.allTime).toMatchObject({ total: 2, engaged_no_act: 1, ignored: 1 });
    expect(uninstalled!.allTime).toMatchObject({ total: 1, ignored: 1 });
    expect(legacy!.allTime.total).toBe(2); // the no-field row + the unknown-tag row
    expect(installed!.allTime.followed).toBe(0); // zero stays explicit
  });

  it('windows each population independently', () => {
    const funnels = buildPopulationFunnels(events, NOW);
    const legacy = funnels.find((f) => f.population === 'legacy')!;
    expect(legacy.allTime.total).toBe(2);
    expect(legacy.last14d.total).toBe(1); // only the Jul-17 unknown-tag row is inside 14d of NOW
  });

  it('returns zero-total funnels for an empty ledger (never omits a population)', () => {
    const funnels = buildPopulationFunnels([], NOW);
    expect(funnels).toHaveLength(3);
    for (const f of funnels) expect(f.allTime.total).toBe(0);
  });
});

describe('buildOdometerFreshness', () => {
  it('reads the most-recent-first head and parses bare dates', () => {
    const movements: Movement[] = [
      { date: '2026-07-13', northstar: 'l1-morning-cockpit', property: 'P1', from: 60, to: 66 },
      { date: '2026-07-03', northstar: 'l2-ojfbot', property: 'P1', from: 75, to: 78 },
    ];
    const fresh = buildOdometerFreshness(movements, NOW);
    expect(fresh.movementCount).toBe(2);
    expect(fresh.lastMovementDate).toBe('2026-07-13');
    expect(fresh.daysSince).toBe(3); // bare date parses as UTC midnight
  });

  it('is honest about an empty odometer', () => {
    expect(buildOdometerFreshness([], NOW)).toEqual({
      movementCount: 0,
      lastMovementDate: undefined,
      daysSince: undefined,
    });
  });
});
