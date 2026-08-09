import { describe, it, expect } from 'vitest';
import {
  buildNorthstarPreload,
  buildNorthstarSystemPrompt,
  chatThreadKey,
  isChatTab,
  northstarFallbackText,
} from '../chat.js';
import type {
  DeliveryHealth,
  DeliveryNorthstar,
  DeliveryRoadmap,
  DeliverySlice,
  DeliverySnapshot,
  Movement,
} from '../delivery.js';

/**
 * Northstar tab grounding (roadmap S9). The load-bearing property is HONESTY: every number in
 * the preload must be traceable to the snapshot, and a unit with no registered northstar must
 * produce a truthful empty state rather than an invented compass.
 */

const health: DeliveryHealth = {
  files: { source: 'files', ok: true, count: 0 },
  movement: { source: 'movement', ok: true, count: 0 },
  queue: { source: 'queue', ok: true, count: 0 },
} as unknown as DeliveryHealth;

const slice = (over: Partial<DeliverySlice>): DeliverySlice => ({
  id: 'S1',
  ref: 'rm:rm-l1-demo#S1',
  phase: 'PH1',
  title: 'Do the thing',
  advances: 'ns:l1-demo#P1',
  moves_from: 40,
  moves_to: 55,
  autonomy: 'gate-0',
  status: 'ready',
  fileStatus: 'ready',
  ...over,
});

const northstar: DeliveryNorthstar = {
  slug: 'l1-demo',
  tier: 'L1',
  app: 'demo',
  properties: [
    { id: 'P1', name: 'The thing is legible', current: 40, target: 'One glance answers it' },
    { id: 'P2', name: 'Coordination is real', current: 72, target: 'Live over the spine' },
  ],
};

const roadmap: DeliveryRoadmap = {
  slug: 'rm-l1-demo',
  northstar: 'l1-demo',
  status: 'active',
  phases: [
    { id: 'PH1', name: 'Producers' },
    { id: 'PH2', name: 'Empty phase' },
  ],
  slices: [slice({}), slice({ id: 'S2', ref: 'rm:rm-l1-demo#S2', repo: 'core', status: 'merged' })],
};

const movement: Movement = {
  date: '2026-07-17',
  northstar: 'l1-demo',
  property: 'P1',
  from: 33,
  to: 40,
  source: 'pr-verified',
};

function snap(over: Partial<DeliverySnapshot> = {}): DeliverySnapshot {
  return {
    generatedAt: '2026-08-01T09:00:00Z',
    northstars: [northstar],
    roadmaps: [roadmap],
    movements: [movement],
    health,
    ...over,
  } as DeliverySnapshot;
}

describe('chat tab identity', () => {
  it('keys Leo globally and Northstar per unit, so threads never collide', () => {
    expect(chatThreadKey('leo')).toBe('leo');
    expect(chatThreadKey('leo', 'demo')).toBe('leo'); // Leo ignores focus by design
    expect(chatThreadKey('northstar', 'demo')).toBe('northstar:demo');
    expect(chatThreadKey('northstar', 'other')).not.toBe(chatThreadKey('northstar', 'demo'));
  });

  it('rejects unknown tab values rather than coercing them', () => {
    expect(isChatTab('leo')).toBe(true);
    expect(isChatTab('northstar')).toBe(true);
    expect(isChatTab('Northstar')).toBe(false);
    expect(isChatTab(undefined)).toBe(false);
  });
});

describe('buildNorthstarPreload — grounded unit', () => {
  const p = buildNorthstarPreload(snap(), 'demo');

  it('reports the registered northstar and carries its generatedAt through', () => {
    expect(p.grounded).toBe(true);
    expect(p.northstar).toBe('l1-demo');
    expect(p.unit).toBe('demo');
    expect(p.generatedAt).toBe('2026-08-01T09:00:00Z');
  });

  it('states each current verbatim and derives the gap from it', () => {
    expect(p.compass).toContain('P1 "The thing is legible" — current 40 · gap 60');
    expect(p.compass).toContain('P2 "Coordination is real" — current 72 · gap 28');
    expect(p.compass).toContain('target: One glance answers it');
  });

  it('renders slices under their phase with the file ladder intact', () => {
    expect(p.ladder).toContain('### PH1 — Producers');
    expect(p.ladder).toContain('S1 "Do the thing" → ns:l1-demo#P1 · 40→55 · ready');
  });

  it('names the repo a slice lands in when it differs', () => {
    expect(p.ladder).toContain('S2 "Do the thing" → ns:l1-demo#P1 · 40→55 · merged [lands in core]');
  });

  it('marks a phase with no slices instead of rendering it as complete', () => {
    expect(p.ladder).toContain('### PH2 — Empty phase (no slices)');
  });

  it('lists recorded movement from status.jsonl', () => {
    expect(p.ladder).toContain('2026-07-17 P1 33→40 · pr-verified');
  });

  it('says so plainly when a northstar has never moved', () => {
    const p2 = buildNorthstarPreload(snap({ movements: [] }), 'demo');
    expect(p2.ladder).toContain('never moved in status.jsonl');
  });

  it('only counts movement belonging to this northstar', () => {
    const other: Movement = { ...movement, northstar: 'l1-elsewhere', to: 99 };
    const p2 = buildNorthstarPreload(snap({ movements: [other] }), 'demo');
    expect(p2.ladder).not.toContain('99');
  });
});

describe('buildNorthstarPreload — unsurfaced unit (truthful empty state)', () => {
  const p = buildNorthstarPreload(snap(), 'not-surfaced');

  it('reports ungrounded rather than falling back to another unit', () => {
    expect(p.grounded).toBe(false);
    expect(p.northstar).toBeUndefined();
    expect(p.unit).toBe('not-surfaced');
  });

  it('invents no properties and no roadmap', () => {
    expect(p.compass).not.toContain('P1');
    expect(p.ladder).not.toContain('S1');
  });

  /**
   * The delivery snapshot only surfaces northstar+ROADMAP pairs (its own health note counts the
   * registry northstars without one). Claiming "no northstar registered" would therefore be a
   * fabricated negative for every app whose northstar has no roadmap yet.
   */
  it('does not claim the unit is unregistered — it only reports what was checked', () => {
    expect(p.compass).not.toMatch(/no northstar registered/i);
    expect(p.compass).toContain('no northstar with a registered roadmap was found');
    expect(p.compass).toContain('does NOT prove');
    expect(p.compass).toContain('Do not assert either way.');
    expect(p.compass).toContain('core/decisions/northstar/README.md');
  });
});

describe('buildNorthstarPreload — registered but incomplete', () => {
  it('distinguishes "no properties" from "no northstar"', () => {
    const bare: DeliveryNorthstar = { slug: 'l1-bare', tier: 'L1', app: 'bare', properties: [] };
    const p = buildNorthstarPreload(snap({ northstars: [bare], roadmaps: [] }), 'bare');
    expect(p.grounded).toBe(true);
    expect(p.compass).toContain('declares no properties');
    expect(p.ladder).toContain('no roadmap registered for l1-bare');
  });
});

describe('buildNorthstarSystemPrompt', () => {
  const prompt = buildNorthstarSystemPrompt(buildNorthstarPreload(snap(), 'demo'));

  it('embeds the compass and ladder verbatim so the disclosure is the whole truth', () => {
    const p = buildNorthstarPreload(snap(), 'demo');
    expect(prompt).toContain(p.compass);
    expect(prompt).toContain(p.ladder);
  });

  it('names the focused unit', () => {
    expect(prompt).toContain('focused on "demo"');
  });

  it('forbids authoring the gate fields (operator ruling D5)', () => {
    expect(prompt).toContain('may NOT author `moves_to`, `entrance`, `success`, or `check:`');
    expect(prompt).toContain('day-runner');
  });

  it('forbids touching current: and status.jsonl (movement contract)', () => {
    expect(prompt).toContain('never touch `current:`');
    expect(prompt).toContain('never append to status.jsonl');
  });
});

describe('northstarFallbackText', () => {
  it('degrades to the deterministic compass, never to another provider', () => {
    const p = buildNorthstarPreload(snap(), 'demo');
    const text = northstarFallbackText(p);
    expect(text).toContain('Model unavailable');
    expect(text).toContain(p.compass);
    expect(text).toContain(p.ladder);
  });
});
