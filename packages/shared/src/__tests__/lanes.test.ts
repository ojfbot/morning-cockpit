import { describe, it, expect } from 'vitest';
import {
  overnightWindowStart,
  computeStaleDays,
  classifyLane,
  finalizeItems,
  splitLanes,
  type LaneContext,
  type LaneInput,
} from '../lanes.js';
import type { WorkItem } from '../work-item.js';

const MORNING = new Date('2026-06-07T07:00:00');
const ctx: LaneContext = {
  now: MORNING,
  overnightSince: overnightWindowStart(MORNING).toISOString(),
  staleThresholdDays: 14,
};

const baseInput = (over: Partial<LaneInput>): LaneInput => ({
  source: 'dolt-bead',
  kind: 'task',
  status: 'open',
  activityAt: MORNING.toISOString(),
  ...over,
});

describe('overnightWindowStart', () => {
  it('returns yesterday 18:00 when called in the morning', () => {
    const start = overnightWindowStart(MORNING);
    expect(start.getDate()).toBe(6);
    expect(start.getHours()).toBe(18);
  });

  it('returns today 18:00 when called late evening', () => {
    const evening = new Date('2026-06-07T22:30:00');
    const start = overnightWindowStart(evening);
    expect(start.getDate()).toBe(7);
    expect(start.getHours()).toBe(18);
  });
});

describe('computeStaleDays', () => {
  it('floors whole days since the timestamp', () => {
    expect(computeStaleDays('2026-06-01T07:00:00', MORNING)).toBe(6);
  });
  it('clamps future timestamps to 0', () => {
    expect(computeStaleDays('2026-06-09T07:00:00', MORNING)).toBe(0);
  });
  it('returns undefined for missing/garbage', () => {
    expect(computeStaleDays(undefined, MORNING)).toBeUndefined();
    expect(computeStaleDays('not-a-date', MORNING)).toBeUndefined();
  });
});

describe('classifyLane — overnight', () => {
  it('running items inside the window are overnight (in-flight)', () => {
    const inWindow = new Date('2026-06-07T02:00:00').toISOString();
    expect(classifyLane(baseInput({ kind: 'convoy', status: 'running', activityAt: inWindow }), ctx)).toBe('overnight');
  });
  it('stale "running" items (last touched before the window) are NOT trusted as overnight', () => {
    const old = new Date('2026-04-11T02:00:00').toISOString();
    expect(classifyLane(baseInput({ kind: 'session', status: 'running', activityAt: old }), ctx)).toBeNull();
  });
  it('done items inside the window are overnight', () => {
    const inWindow = new Date('2026-06-07T02:00:00').toISOString();
    expect(classifyLane(baseInput({ kind: 'pr', status: 'done', activityAt: inWindow }), ctx)).toBe('overnight');
  });
  it('done items OUTSIDE the window do not surface', () => {
    const old = new Date('2026-06-01T02:00:00').toISOString();
    expect(classifyLane(baseInput({ kind: 'pr', status: 'done', activityAt: old }), ctx)).toBeNull();
  });
});

describe('classifyLane — pickup', () => {
  it('open brief with an open hook is pickup', () => {
    expect(classifyLane(baseInput({ kind: 'brief', status: 'open', openHook: true }), ctx)).toBe('pickup');
  });
  it('P0/P1 priorities are pickup', () => {
    expect(classifyLane(baseInput({ kind: 'priority', status: 'open', priorityLevel: 'P1' }), ctx)).toBe('pickup');
  });
  it('open non-draft PR is pickup', () => {
    expect(classifyLane(baseInput({ kind: 'pull_request', status: 'open', draft: false }), ctx)).toBe('pickup');
  });
  it('draft PR does not surface in pickup', () => {
    expect(classifyLane(baseInput({ kind: 'pull_request', status: 'open', draft: true }), ctx)).toBeNull();
  });
});

describe('classifyLane — available', () => {
  it('open issue is available', () => {
    expect(classifyLane(baseInput({ kind: 'issue', status: 'open' }), ctx)).toBe('available');
  });
  it('open brief WITHOUT an open hook falls to available', () => {
    expect(classifyLane(baseInput({ kind: 'brief', status: 'open', openHook: false }), ctx)).toBe('available');
  });
  it('unclaimed live task is available', () => {
    expect(classifyLane(baseInput({ kind: 'task', status: 'open', hookAssigned: false }), ctx)).toBe('available');
  });
  it('claimed (hooked) task is NOT available (and not running) → drops', () => {
    expect(classifyLane(baseInput({ kind: 'task', status: 'open', hookAssigned: true }), ctx)).toBeNull();
  });
});

describe('finalizeItems', () => {
  const mk = (over: Partial<WorkItem>): WorkItem => ({
    id: 'dolt-bead:x',
    nativeId: 'x',
    source: 'dolt-bead',
    kind: 'issue',
    status: 'open',
    lane: 'available',
    title: 't',
    activityAt: '2026-05-01T00:00:00', // ~37 days old
    detail: { kind: 'generic' },
    provenance: {},
    ...over,
  });

  it('marks old available items stale and computes staleDays', () => {
    const [out] = finalizeItems([mk({ createdAt: '2026-05-01T00:00:00' })], ctx);
    expect(out!.status).toBe('stale');
    expect(out!.staleDays).toBeGreaterThanOrEqual(14);
  });

  it('does not mark a fresh available item stale', () => {
    const fresh = mk({ createdAt: '2026-06-06T00:00:00', activityAt: '2026-06-06T00:00:00' });
    const [out] = finalizeItems([fresh], ctx);
    expect(out!.status).toBe('open');
  });

  it('dedupes by nativeId keeping the higher-priority lane', () => {
    const overnight = mk({ id: 'a:x', nativeId: 'x', lane: 'overnight' });
    const available = mk({ id: 'b:x', nativeId: 'x', lane: 'available' });
    const out = finalizeItems([available, overnight], ctx);
    expect(out).toHaveLength(1);
    expect(out[0]!.lane).toBe('overnight');
  });
});

describe('splitLanes', () => {
  const mk = (lane: WorkItem['lane'], activityAt: string, staleDays?: number): WorkItem => ({
    id: `i:${activityAt}`,
    nativeId: activityAt,
    source: 'dolt-bead',
    kind: 'issue',
    status: 'open',
    lane,
    title: 't',
    activityAt,
    staleDays,
    detail: { kind: 'generic' },
    provenance: {},
  });

  it('sorts overnight/pickup by activity descending and available by staleness', () => {
    const lanes = splitLanes([
      mk('overnight', '2026-06-07T01:00:00'),
      mk('overnight', '2026-06-07T05:00:00'),
      mk('available', '2026-06-01T00:00:00', 6),
      mk('available', '2026-05-01T00:00:00', 37),
    ]);
    expect(lanes.overnight[0]!.activityAt).toBe('2026-06-07T05:00:00');
    expect(lanes.available[0]!.staleDays).toBe(37);
  });
});
