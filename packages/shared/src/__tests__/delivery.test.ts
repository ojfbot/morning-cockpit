import { describe, it, expect } from 'vitest';
import {
  parseFrontmatter,
  deriveSliceState,
  parseMovementLines,
  type FrontmatterItem,
} from '../delivery.js';

// ── Frontmatter parse (mirrors core northstar-fm.mjs behaviour) ──────────────

const ROADMAP_FIXTURE = `---
type: roadmap
slug: rm-l1-example
northstar: l1-example
status: active
phases:
  - id: PH1
    name: "Ground-truth producers"
    goal: "No stubs."
  - id: PH2
    name: "Dispatch loop"
slices:
  - id: S1
    phase: PH1
    title: "Wire the adapter"
    advances: "ns:l1-example#P1"
    moves_from: 60
    moves_to: 67
    autonomy: gate-0
    status: ready
  - id: S2
    phase: PH2
    title: "First compiled dispatch"
    advances: "ns:l1-example#P2"
    moves_from: 58
    moves_to: 64
    autonomy: gate-0
    status: queued
    depends_on: "rm:rm-l1-example#S1"
---

# Roadmap — example

Body prose is ignored by the parser.
`;

describe('parseFrontmatter', () => {
  it('parses a roadmap fixture: scalars, flat lists of maps, quoted strings, ints', () => {
    const fm = parseFrontmatter(ROADMAP_FIXTURE);
    expect(fm).not.toBeNull();
    expect(fm!.type).toBe('roadmap');
    expect(fm!.slug).toBe('rm-l1-example');
    expect(fm!.northstar).toBe('l1-example');

    const phases = fm!.phases as FrontmatterItem[];
    expect(phases).toHaveLength(2);
    expect(phases[0]).toEqual({ id: 'PH1', name: 'Ground-truth producers', goal: 'No stubs.' });
    expect(phases[1]).toEqual({ id: 'PH2', name: 'Dispatch loop' });

    const slices = fm!.slices as FrontmatterItem[];
    expect(slices).toHaveLength(2);
    expect(slices[0]).toMatchObject({
      id: 'S1',
      phase: 'PH1',
      title: 'Wire the adapter',
      advances: 'ns:l1-example#P1',
      moves_from: 60, // ints, not strings
      moves_to: 67,
      autonomy: 'gate-0',
      status: 'ready',
    });
    expect(slices[1]).toMatchObject({ id: 'S2', depends_on: 'rm:rm-l1-example#S1' });
  });

  it('parses a registry-style list and skips comments and blank lines', () => {
    const fm = parseFrontmatter(
      '---\n# a comment\nregistry:\n  - slug: l2-ojfbot\n    tier: L2\n\n  - slug: l1-app\n    tier: L1\n    app: app\nroadmaps:\n  - slug: rm-l1-app\n    northstar: l1-app\n    path: ../app/.claude/roadmap.md\n---\nbody',
    );
    expect(fm!.registry).toEqual([
      { slug: 'l2-ojfbot', tier: 'L2' },
      { slug: 'l1-app', tier: 'L1', app: 'app' },
    ]);
    expect(fm!.roadmaps).toEqual([
      { slug: 'rm-l1-app', northstar: 'l1-app', path: '../app/.claude/roadmap.md' },
    ]);
  });

  it('handles null/boolean scalars and returns null when frontmatter is absent', () => {
    const fm = parseFrontmatter('---\nladders_up_to: null\nactive: true\n---\n');
    expect(fm!.ladders_up_to).toBeNull();
    expect(fm!.active).toBe(true);
    expect(parseFrontmatter('# no frontmatter here')).toBeNull();
  });
});

// ── Slice state derivation (file + queue merge) ───────────────────────────────

describe('deriveSliceState', () => {
  const q = (queueState: 'available' | 'claimed' | 'expired') => ({
    beadId: 'morn-task-1234',
    queueState,
  });

  it('ready + posted bead → available, no drift (the normal compiled projection)', () => {
    expect(deriveSliceState('ready', q('available'))).toEqual({ state: 'available' });
  });

  it('ready + no bead → ready, no drift (not yet compiled)', () => {
    expect(deriveSliceState('ready')).toEqual({ state: 'ready' });
  });

  it('dispatched + claimed bead → claimed, no drift', () => {
    expect(deriveSliceState('dispatched', q('claimed'))).toEqual({ state: 'claimed' });
  });

  it('dispatched + NO bead → claimed, drift flagged (file ahead of queue)', () => {
    expect(deriveSliceState('dispatched')).toEqual({
      state: 'claimed',
      drift: 'file=dispatched queue=none',
    });
  });

  it('queued + posted bead → available, drift flagged (compiler only compiles ready)', () => {
    expect(deriveSliceState('queued', q('available'))).toEqual({
      state: 'available',
      drift: 'file=queued queue=available',
    });
  });

  it('ready + claimed bead → claimed, drift flagged (file lagging the claim)', () => {
    expect(deriveSliceState('ready', q('claimed'))).toEqual({
      state: 'claimed',
      drift: 'file=ready queue=claimed',
    });
  });

  it('terminal file states win: merged stays merged even with a lingering bead', () => {
    expect(deriveSliceState('merged', q('claimed'))).toEqual({
      state: 'merged',
      drift: 'file=merged queue=claimed',
    });
    expect(deriveSliceState('merged')).toEqual({ state: 'merged' });
    expect(deriveSliceState('delivered', q('claimed'))).toEqual({ state: 'delivered' });
    expect(deriveSliceState('dropped')).toEqual({ state: 'dropped' });
  });

  it('expired lease falls back to the file status with drift flagged', () => {
    expect(deriveSliceState('ready', q('expired'))).toEqual({
      state: 'ready',
      drift: 'file=ready queue=expired',
    });
  });
});

// ── Movement feed (status.jsonl) ─────────────────────────────────────────────

describe('parseMovementLines', () => {
  const line = (over: Record<string, unknown> = {}) =>
    JSON.stringify({
      date: '2026-07-02',
      northstar: 'l1-morning-cockpit',
      property: 'P1',
      from: 60,
      to: 66,
      evidence: 'PR #23 merged',
      actor: 'yuri',
      source: 'record-movement.mjs',
      ...over,
    });

  it('parses valid JSONL, most recent (last appended) first', () => {
    const text = `${line({ date: '2026-07-01', to: 63 })}\n${line({ date: '2026-07-02', from: 63 })}\n`;
    const { movements, skipped } = parseMovementLines(text);
    expect(skipped).toBe(0);
    expect(movements).toHaveLength(2);
    expect(movements[0]).toMatchObject({ date: '2026-07-02', from: 63, to: 66 });
    expect(movements[1]).toMatchObject({ date: '2026-07-01', to: 63 });
  });

  it('empty text → empty feed, truthfully', () => {
    expect(parseMovementLines('')).toEqual({ movements: [], skipped: 0 });
    expect(parseMovementLines('\n\n')).toEqual({ movements: [], skipped: 0 });
  });

  it('skips malformed JSON and rows missing required fields, never throws', () => {
    const text = `not json at all\n${line()}\n${JSON.stringify({ date: '2026-07-02', from: 'sixty' })}\n`;
    const { movements, skipped } = parseMovementLines(text);
    expect(movements).toHaveLength(1);
    expect(skipped).toBe(2);
  });

  it('optional fields are dropped when non-string', () => {
    const { movements } = parseMovementLines(line({ evidence: 42, actor: null }));
    expect(movements[0]!.evidence).toBeUndefined();
    expect(movements[0]!.actor).toBeUndefined();
    expect(movements[0]!.source).toBe('record-movement.mjs');
  });
});
