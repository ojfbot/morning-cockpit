/**
 * Fleet (01) + Critical Path (02) coordination read-models (decisions/adr/0007 redesign).
 * (The Delivery (03) read-model moved to delivery.ts when it went roadmap-driven.)
 *
 * Fleet repo metadata (role, phase) is editorial config the server owns; the live signals
 * (openCount, lastActivity, liveness) are derived from the CockpitSnapshot. Repo liveness is
 * event-derived freshness — `bead_events` now flows (S1) and `activityAt` prefers event time;
 * agent liveness is derived per-actor (`deriveAgentLiveness`, S2). See ADR-0008.
 */

export type Liveness = 'live' | 'stale' | 'dark';

export interface RepoCard {
  name: string;
  /** One-line role description (editorial). */
  role: string;
  /** Phase tag: P1…P9, EXP, SHIP. */
  phase: string;
  openCount: number;
  /** ISO of the most recent bead activity in this repo, or null if none seen. */
  lastActivity: string | null;
  liveness: Liveness;
  /** The "you are here" card (morning-cockpit). */
  here?: boolean;
}

export interface FleetSnapshot {
  generatedAt: string;
  repos: RepoCard[];
  totals: { repos: number; openBeads: number; live: number; stale: number; dark: number };
}

export type Severity = 'critical' | 'high' | 'blocked' | 'decision';

export interface CriticalChain {
  id: string;
  severity: Severity;
  title: string;
  /** "BLOCKS" or "GATES". */
  relation: string;
  /** Downstream items this blocks/gates. */
  blocks: string[];
  /** Impact count line, e.g. "6 / beads · 3 repos" or "gates all". */
  impact: string;
  /** Greyed note, e.g. "waits on bead_events". */
  waitsOn?: string;
  /** Briefing thread id this jumps to (best-effort; null = no brief, e.g. the ADR decision). */
  briefId?: string;
  /** CTA label: "Brief ↑" (jump) or "Settle first" (no jump). */
  cta: string;
}

export interface CriticalPathSnapshot {
  generatedAt: string;
  intro: string;
  chains: CriticalChain[];
  /** True while chains are hand-read (not yet derived from live repo-deps + bead refs). */
  seeded: boolean;
  note: string;
}
