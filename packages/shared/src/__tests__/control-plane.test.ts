import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CADENCE_BUDGETS,
  deriveControlPlane,
  deriveLoopRow,
  hasRealVerifier,
  isWatched,
  parseLoopsRegistry,
  sortRows,
  type LoopEntry,
  type LoopEvidence,
} from '../control-plane.js';

const DAY = 86_400_000;
const NOW = Date.parse('2026-08-01T12:00:00Z');
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

function entry(over: Partial<LoopEntry> = {}): LoopEntry {
  return {
    slug: 'a-loop',
    trigger: 'launchd',
    cadence: 'daily',
    status: 'live',
    evidenceRef: 'file:~/thing.jsonl',
    verifier: 'a real verifier',
    stopRule: 'single daily fire',
    ...over,
  };
}

const REGISTRY = `---
type: loops-registry
version: 1
loops:
  - slug: dolt-beads
    purpose: "Always-on bead store"
    trigger: launchd
    trigger_ref: scripts/dolt-beads-launchd.plist
    cadence: always-on
    verifier: "none today — T4 names the gap"
    stop_rule: "KeepAlive restarts on exit"
    evidence_ref: "dolt:bead_events"
    owner: operator
    status: live
    repo: core
  - slug: sync-telemetry
    trigger: launchd
    cadence: daily
    verifier: "consumers fail visibly"
    stop_rule: "single daily fire"
    evidence_ref: "git-branch:telemetry/daily"
    status: live
    repo: core
  - slug: hook-log-skill
    trigger: hook
    cadence: event
    evidence_ref: "file:~/.claude/skill-telemetry.jsonl"
    status: live
    repo: core
  - slug: selfco-hot-list
    trigger: manual
    cadence: weekly
    evidence_ref: "file:~/selfco/wiki/_hot.md"
    status: disabled
    repo: selfco
---

# Loops registry

Body prose that must not be parsed.
`;

describe('parseLoopsRegistry', () => {
  it('parses every entry with its scalars', () => {
    const { loops, skipped } = parseLoopsRegistry(REGISTRY);
    expect(loops).toHaveLength(4);
    expect(skipped).toBe(0);
    const dolt = loops[0]!;
    expect(dolt.slug).toBe('dolt-beads');
    expect(dolt.cadence).toBe('always-on');
    expect(dolt.evidenceRef).toBe('dolt:bead_events');
    expect(dolt.triggerRef).toBe('scripts/dolt-beads-launchd.plist');
    expect(dolt.repo).toBe('core');
  });

  it('does not treat registry-level keys as loops', () => {
    const { loops } = parseLoopsRegistry(REGISTRY);
    expect(loops.map((l) => l.slug)).not.toContain('loops-registry');
  });

  it('returns empty rather than throwing on a file with no frontmatter', () => {
    expect(parseLoopsRegistry('# just prose')).toEqual({ loops: [], skipped: 0 });
  });

  it('counts slugless entries as skipped instead of dropping them silently', () => {
    const { loops, skipped } = parseLoopsRegistry(
      `---\nloops:\n  - trigger: hook\n    cadence: event\n  - slug: real\n    cadence: daily\n---\n`,
    );
    expect(loops).toHaveLength(1);
    expect(skipped).toBe(1);
  });
});

describe('hasRealVerifier', () => {
  it('rejects absent and "none"-prefixed verifiers', () => {
    expect(hasRealVerifier(undefined)).toBe(false);
    expect(hasRealVerifier('none')).toBe(false);
    // The registry writes self-documenting gaps; counting them as coverage would launder
    // the very gap they describe.
    expect(hasRealVerifier('none today — T4 names the gap')).toBe(false);
  });

  it('accepts a real one', () => {
    expect(hasRealVerifier('scripts/hooks/__tests__/x.test.mjs')).toBe(true);
  });
});

describe('isWatched', () => {
  it.each([
    ['always-on', 'live', true],
    ['daily', 'live', true],
    ['weekly', 'live', true],
    ['event', 'live', false],
    ['manual', 'live', false],
    ['daily', 'disabled', false],
  ])('cadence %s + status %s → watched %s', (cadence, status, expected) => {
    expect(isWatched(entry({ cadence, status }))).toBe(expected);
  });
});

describe('deriveLoopRow', () => {
  it('reads ok inside the cadence budget', () => {
    const row = deriveLoopRow(entry(), { at: ago(1) }, NOW);
    expect(row.verdict).toBe('ok');
    expect(row.ageDays).toBeCloseTo(1, 5);
  });

  it('reads stale past the budget, and says by how much', () => {
    const row = deriveLoopRow(entry(), { at: ago(5) }, NOW);
    expect(row.verdict).toBe('stale');
    expect(row.why).toContain('5d ago');
    expect(row.why).toContain('allows 2d');
  });

  it('gives weekly loops a longer budget than daily', () => {
    const at = ago(5);
    expect(deriveLoopRow(entry({ cadence: 'daily' }), { at }, NOW).verdict).toBe('stale');
    expect(deriveLoopRow(entry({ cadence: 'weekly' }), { at }, NOW).verdict).toBe('ok');
  });

  it('separates unverifiable from down and keeps the reason', () => {
    const row = deriveLoopRow(entry(), { at: null, reason: 'not present on this host' }, NOW);
    expect(row.verdict).toBe('unverifiable');
    expect(row.verdict).not.toBe('down');
    expect(row.why).toBe('not present on this host');
  });

  it('treats an unreachable always-on probe as down, not stale', () => {
    const row = deriveLoopRow(
      entry({ cadence: 'always-on' }),
      { at: null, reason: 'sql-server unreachable on 127.0.0.1:3307' },
      NOW,
    );
    expect(row.verdict).toBe('down');
    expect(row.why).toContain('3307');
  });

  it('excludes event and manual cadences with a stated reason', () => {
    for (const cadence of ['event', 'manual']) {
      const row = deriveLoopRow(entry({ cadence }), undefined, NOW);
      expect(row.verdict).toBe('excluded');
      expect(row.why).toContain('no schedule to breach');
      expect(row.watched).toBe(false);
    }
  });

  it('excludes deliberately parked loops even when cadenced', () => {
    const row = deriveLoopRow(entry({ status: 'disabled' }), { at: ago(400) }, NOW);
    expect(row.verdict).toBe('excluded');
    expect(row.why).toBe('deliberately parked');
  });

  it('never reads ok when evidence is missing entirely', () => {
    expect(deriveLoopRow(entry(), undefined, NOW).verdict).toBe('unverifiable');
  });

  it('does not crash or read ok on an unparseable timestamp', () => {
    const row = deriveLoopRow(entry(), { at: 'not-a-date' }, NOW);
    expect(row.verdict).toBe('unverifiable');
    expect(row.ageDays).toBeNull();
  });

  it('respects injected budgets', () => {
    const tight = { ...DEFAULT_CADENCE_BUDGETS, daily: 0.5 * DAY };
    expect(deriveLoopRow(entry(), { at: ago(1) }, NOW, tight).verdict).toBe('stale');
  });
});

describe('deriveControlPlane', () => {
  const entries = parseLoopsRegistry(REGISTRY).loops;
  const evidence: Record<string, LoopEvidence> = {
    'dolt-beads': { at: null, reason: 'sql-server unreachable on 127.0.0.1:3307' },
    'sync-telemetry': { at: ago(6) },
    'hook-log-skill': { at: ago(0.2) },
    'selfco-hot-list': { at: ago(60) },
  };

  it('counts watched vs unwatched — the pane\'s headline coverage number', () => {
    const { totals } = deriveControlPlane(entries, evidence, NOW);
    // Only dolt-beads (always-on) + sync-telemetry (daily) are live AND cadenced.
    expect(totals.watched).toBe(2);
    expect(totals.unwatched).toBe(2);
    expect(totals.loops).toBe(4);
  });

  it('tallies verdicts and triggers', () => {
    const { totals } = deriveControlPlane(entries, evidence, NOW);
    expect(totals.byVerdict).toEqual({ ok: 0, stale: 1, down: 1, unverifiable: 0, excluded: 2 });
    expect(totals.byTrigger).toEqual({ launchd: 2, hook: 1, manual: 1 });
  });

  it('counts loops with no real verifier and no stop rule', () => {
    const { totals } = deriveControlPlane(entries, evidence, NOW);
    // dolt-beads' "none today" verifier does not count; two entries declare none at all.
    expect(totals.withoutVerifier).toBe(3);
    expect(totals.withoutStopRule).toBe(2);
  });

  it('surfaces parseSkipped rather than defaulting it to a comfortable zero', () => {
    const { totals } = deriveControlPlane(entries, evidence, NOW, { parseSkipped: 3 });
    expect(totals.parseSkipped).toBe(3);
  });

  it('an unresolved evidence key yields unverifiable, never ok', () => {
    const { rows } = deriveControlPlane(entries, {}, NOW);
    const sync = rows.find((r) => r.slug === 'sync-telemetry')!;
    expect(sync.verdict).toBe('unverifiable');
  });
});

describe('sortRows', () => {
  it('puts problems first and parked last', () => {
    const entries = parseLoopsRegistry(REGISTRY).loops;
    const rows = deriveControlPlane(entries, {
      'dolt-beads': { at: null, reason: 'unreachable' },
      'sync-telemetry': { at: ago(6) },
      'hook-log-skill': { at: ago(0.2) },
      'selfco-hot-list': { at: ago(60) },
    }, NOW).rows;
    expect(sortRows(rows).map((r) => r.verdict)).toEqual(['down', 'stale', 'excluded', 'excluded']);
  });
});
