import type { CriticalChain, DeliveryMilestone, NextMove } from '@cockpit/shared';

/**
 * Editorial coordination config (ADR-0007 owns it). Repo role/phase is hand-maintained metadata;
 * the live counts/liveness are derived from the snapshot at request time. The Delivery phase track
 * + next-moves are seeded from coordination-design.md §6 (held here rather than parsed — the doc is
 * prose, not data; the footer in the UI marks this as the seeded source).
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
];

export const DELIVERY_PROGRESS = 0.58;

export const DELIVERY_MILESTONES: DeliveryMilestone[] = [
  { marker: 'PHASE 1', title: 'Shell + gateway', status: 'shipped', state: 'shipped' },
  { marker: 'PHASE 2', title: 'Core engine + skills', status: 'shipped', state: 'shipped' },
  { marker: 'NOW', title: 'App fleet — 16 repos', status: 'in flight', state: 'now' },
  { marker: 'NEXT', title: 'Coordination layer', status: 'designing', state: 'next' },
  { marker: 'LATER', title: 'Autonomous fleet', status: 'gated', state: 'later' },
];

/** Prioritized work from coordination-design.md §6 (effort S/M/L). */
export const NEXT_MOVES: NextMove[] = [
  { index: 1, title: 'Stand up the bead_events writer', unblocks: 'agent liveness · "did it run overnight"', effort: 'S', repo: 'core' },
  { index: 2, title: 'queue-post + reserved-label doc', unblocks: 'the unassigned / Wanted lane', effort: 'S', repo: 'core' },
  { index: 3, title: 'queue-claim — atomic compare-and-swap', unblocks: "the cockpit's first Claim → dispatch", effort: 'S', repo: 'core' },
  { index: 4, title: 'Liveness derivation query + cockpit binding', unblocks: 'replaces the lying agent_status flag', effort: 'M', repo: 'morning-cockpit' },
  { index: 5, title: 'seed-create verb', unblocks: 'capture pre-project chat ideas', effort: 'S', repo: 'core' },
  { index: 6, title: 'gastown reads the queue + liveness', unblocks: 'un-stubs WantedBoard + AgentTree', effort: 'M', repo: 'gastown-pilot' },
];

/**
 * Critical-path chains, hand-read from coordination-design.md §6 (the footer marks this seeded
 * state). The real work is deriving these from live repo-deps + bead refs — until then briefId
 * is a best-effort jump target into the Briefing (which may be on generated threads).
 */
export const CRITICAL_INTRO =
  'Four blockers stand between you and the coordination layer. Clearing the top one — {an empty event log} — frees six downstream beads at once.';

export const CRITICAL_CHAINS: CriticalChain[] = [
  {
    id: 'bead-events',
    severity: 'critical',
    title: 'bead_events writer — the empty log',
    relation: 'BLOCKS',
    blocks: ['agent liveness', 'overnight panel', 'Wanted queue', 'gastown AgentTree'],
    impact: '6 / beads · 3 repos',
    briefId: 'events',
    cta: 'Brief ↑',
  },
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
    waitsOn: 'waits on bead_events',
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
