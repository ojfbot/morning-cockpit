/**
 * Fleet (01) + Delivery (03) coordination read-models (decisions/adr/0007 redesign).
 *
 * Fleet repo metadata (role, phase) is editorial config the server owns; the live signals
 * (openCount, lastActivity, liveness) are derived from the CockpitSnapshot. Liveness is a
 * **last-activity fallback** — `bead_events` is empty (coordination-design §0), so "live/stale/dark"
 * is a freshness heuristic, not a real liveness signal. The UI must label it as such.
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

export type Effort = 'S' | 'M' | 'L';

export interface DeliveryMilestone {
  /** PHASE 1 / PHASE 2 / NOW / NEXT / LATER */
  marker: string;
  title: string;
  status: string;
  state: 'shipped' | 'now' | 'next' | 'later';
}

export interface NextMove {
  index: number;
  title: string;
  unblocks: string;
  effort: Effort;
  repo: string;
}

export interface DeliverySnapshot {
  generatedAt: string;
  /** Progress fraction 0–1 for the red line on the phase track. */
  progress: number;
  milestones: DeliveryMilestone[];
  nextMoves: NextMove[];
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
