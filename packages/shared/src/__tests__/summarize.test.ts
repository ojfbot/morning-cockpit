import { describe, it, expect } from 'vitest';
import { summarizeLane } from '../summarize.js';
import type { WorkItem } from '../work-item.js';

const mk = (over: Partial<WorkItem>): WorkItem => ({
  id: 'x',
  nativeId: 'x',
  source: 'dolt-bead',
  kind: 'task',
  status: 'open',
  lane: 'available',
  title: 't',
  activityAt: '2026-06-07T00:00:00Z',
  detail: { kind: 'generic' },
  provenance: {},
  ...over,
});

describe('summarizeLane', () => {
  it('produces a lane-specific empty summary with an action', () => {
    const s = summarizeLane('available', []);
    expect(s.source).toBe('deterministic');
    expect(s.headline).toMatch(/empty/i);
    expect(s.action).toBeTruthy();
  });

  it('overnight: recommends investigating failures first', () => {
    const s = summarizeLane('overnight', [
      mk({ kind: 'pr', status: 'failed', repo: 'core' }),
      mk({ kind: 'session', status: 'running', repo: 'shell' }),
    ]);
    expect(s.action).toMatch(/failed/i);
    expect(s.bullets.join(' ')).toMatch(/core|shell/);
  });

  it('available: flags all-stale and tells you to triage/close', () => {
    const s = summarizeLane('available', [
      mk({ status: 'stale', staleDays: 57, repo: 'core', title: 'old task A' }),
      mk({ status: 'stale', staleDays: 40, repo: 'shell', title: 'old task B' }),
    ]);
    expect(s.headline).toMatch(/stale/);
    expect(s.action).toMatch(/triage|close/i);
    expect(s.bullets.some((b) => b.includes('old task A'))).toBe(true);
  });

  it('pickup: surfaces brief count and the oldest item', () => {
    const s = summarizeLane('pickup', [
      mk({ kind: 'brief', status: 'open', repo: 'core', title: 'fresh', staleDays: 0 }),
      mk({ kind: 'brief', status: 'open', repo: 'core', title: 'ancient', staleDays: 39 }),
    ]);
    expect(s.bullets.join(' ')).toMatch(/open brief/);
    expect(s.bullets.join(' ')).toContain('ancient');
    expect(s.action).toMatch(/39d/);
  });

  it('keeps summaries well under 500 words', () => {
    const items = Array.from({ length: 20 }, (_, i) => mk({ nativeId: `t${i}`, repo: `repo${i % 5}`, staleDays: i }));
    const s = summarizeLane('available', items);
    const words = [s.headline, ...s.bullets, s.action].join(' ').split(/\s+/).length;
    expect(words).toBeLessThan(500);
  });
});
