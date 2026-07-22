import type { CriticalChain } from '@cockpit/shared';

/**
 * Editorial coordination config (ADR-0007 owns it). Repo role/phase is hand-maintained metadata;
 * the live counts/liveness are derived from the snapshot at request time. (The old seeded Delivery
 * phase track + next-moves were replaced by the roadmap-driven /api/delivery — adapters/delivery.ts.)
 */

export interface RepoMeta {
  name: string;
  role: string;
  phase: string;
}

/** The fleet, ordered as the design lists it. morning-cockpit is the "you are here" card. */
export const REPO_META: RepoMeta[] = [
  { name: 'shell', role: 'Frame OS — MF host + agent gateway', phase: 'P1' },
  { name: 'core', role: 'Workflow engine — 30+ skills + bead store', phase: 'P2' },
  { name: 'morning-cockpit', role: 'You are here — this command deck', phase: 'EXP' },
  { name: 'daily-logger', role: 'Dev blog — cross-repo sweep → Claude', phase: 'P9' },
  { name: 'cv-builder', role: 'Resume builder — multi-agent, visual-reg CI', phase: 'P6' },
  { name: 'gastown-pilot', role: 'Coordination dash — reads the bead store', phase: 'P4' },
  { name: 'BlogEngine', role: 'Blog platform — daily-logger publishes here', phase: 'P5' },
  { name: 'TripPlanner', role: 'Trip planner — 11-phase pipeline', phase: 'P3' },
  { name: 'GroupThink', role: 'Tab grouping — LLM semantic treemap', phase: 'SHIP' },
  { name: 'purefoy', role: 'Deakins KB — cinematography corpus', phase: 'P2' },
  { name: 'lean-canvas', role: 'Lean canvas — business-model tool', phase: 'P1' },
  { name: 'seh-study', role: 'SEH study — NASA spaced repetition', phase: 'P2' },
  { name: 'core-reader', role: 'Docs viewer — renders core framework', phase: 'P3' },
  { name: 'frame-ui-components', role: 'UI library — shared Carbon DS', phase: 'P2' },
  { name: 'gcgcca', role: 'Type bridge — Pydantic ⇄ TypeScript', phase: 'P1' },
  { name: 'asset-foundry', role: 'Asset pipeline — parametric 3D foundry', phase: 'EXP' },
  // Added 2026-07-22: portfolio-first gap-closers (operator sitting; core#249).
  { name: 'dive-briefing', role: 'Dive RAG service — cited answers, tiered corpora', phase: 'EXP' },
  { name: 'switchboard', role: 'LLM gateway — budgets, failover, observability', phase: 'EXP' },
  { name: 'agent-anatomy', role: 'Orchestration atlas — article companion', phase: 'EXP' },
];

/**
 * Critical-path chains, hand-read from coordination-design.md §6 (the footer marks this seeded
 * state). The real work is deriving these from live repo-deps + bead refs — until then briefId
 * is a best-effort jump target into the Briefing (which may be on generated threads).
 */
export const CRITICAL_INTRO =
  'Three blockers stand between you and the coordination layer. The chokepoint is {the core keep/discard metric} — three downstream beads wait on it.';

// The "bead_events writer" chain was removed 2026-07-04: it resolved when S1 shipped (the event
// log flows; this repo's dolt adapter reads it). Fewer honest entries beat padded stale ones.
export const CRITICAL_CHAINS: CriticalChain[] = [
  {
    id: 'metric',
    severity: 'high',
    title: 'core keep/discard metric',
    relation: 'BLOCKS',
    blocks: ['renumber ADR', 'resolve catalog', 'liveness binding'],
    impact: '3 / beads · core',
    briefId: 'metric',
    cta: 'Brief ↑',
  },
  {
    id: 'queue-verbs',
    severity: 'blocked',
    title: 'queue-post + queue-claim verbs',
    relation: 'BLOCKS',
    blocks: ['Available real source', 'Claim → dispatch', 'gastown WantedBoard'],
    impact: '3 / beads · 2 repos',
    // waitsOn 'bead_events' dropped 2026-07-04 — that dependency resolved when S1 shipped.
    briefId: 'events',
    cta: 'Brief ↑',
  },
  {
    id: 'adr-0002',
    severity: 'decision',
    title: 'ADR-0002 — human-pull vs. autonomous',
    relation: 'GATES',
    blocks: ['claim strictness', 'convergence direction', 'the whole layer'],
    impact: 'gates all',
    cta: 'Settle first',
  },
];

export const CRITICAL_NOTE =
  'Chains hand-read from coordination-design.md — wire live repo deps + bead refs to make this auto-update.';
