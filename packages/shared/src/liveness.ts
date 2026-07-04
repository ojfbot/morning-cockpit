/**
 * Agent liveness derivation (S2 — coordination rollout; problems-view states F5).
 *
 * `agent_status` is a permanent lie: every agent bead reads 'active' forever. Now that S1
 * writes bead_events and S2a keys agent-* events with `actor = <agent-id>`, real liveness is
 * derivable: group agent-* events by actor, take the most-recent, and classify by recency +
 * whether that last event was an explicit `agent-idle`.
 *
 * The problems-view taxonomy (Gas Town) extends live/idle/dark with two derived trouble states:
 *
 * - `stalled` — the agent's most-recent agent-* event is an assignment (`agent-sling`), it never
 *   stood down (`agent-idle`), and it has been silent longer than the stall threshold. A slung
 *   agent that goes quiet is not "idle" — idle is a state you *declare*; this one is holding work
 *   and saying nothing.
 * - `zombie` — the store still asserts the agent is alive (an un-stood-down assignment as its
 *   newest event, or an open claim — a non-null `hook` on the agent bead, supplied by the caller
 *   from data it already fetched) but its newest event is older than the dark threshold. It reads
 *   as holding work while nothing has moved for over a day.
 *
 * Both are derived purely from the same inputs the S2 derivation already had (agent-* event rows)
 * plus one optional caller-supplied set (`openClaims` — agent ids whose bead row carries a
 * non-null `hook`). We deliberately do NOT treat `agent_status === 'active'` as an "alive"
 * assertion for zombie detection: that flag reads 'active' forever, so keying zombies off it
 * would re-launder the exact lie this module exists to kill (ADR-0008).
 *
 * Pure + clock-injected (no Date.now, no DB) so it is fully table-testable. The cockpit's Dolt
 * adapter feeds it agent-* rows; `livenessForAgents` fills 'dark' for agents with no events.
 */
import type { BeadEventRow } from './dolt-bead.js';

export type AgentLivenessState = 'live' | 'stalled' | 'idle' | 'zombie' | 'dark';

export interface AgentLiveness {
  agentId: string;
  state: AgentLivenessState;
  /** ISO timestamp of the agent's most-recent lifecycle event. */
  lastEventAt: string;
  lastEventType: string;
}

export interface LivenessWindows {
  /** A non-idle event newer than this ⇒ live. */
  liveMs: number;
  /** Older than this (or an idle older than this) ⇒ dark; between liveMs and idleMs ⇒ idle. */
  idleMs: number;
  /**
   * An assignment (`agent-sling`) with no agent-* event since, older than this ⇒ stalled
   * (older than idleMs ⇒ zombie — it still holds the assignment). Equal to liveMs today: a
   * slung agent gets the same grace as any other activity, but past it an un-stood-down
   * assignment reads 'stalled', never the softer 'idle'.
   */
  stallMs: number;
}

/** Agents idle in minutes-to-hours, so windows are far tighter than the repo freshness windows. */
export const DEFAULT_LIVENESS_WINDOWS: LivenessWindows = {
  liveMs: 2 * 60 * 60 * 1000, // 2h
  idleMs: 24 * 60 * 60 * 1000, // 24h
  stallMs: 2 * 60 * 60 * 1000, // 2h
};

/**
 * Event types that assign work to an agent (S1 taxonomy: agent-create/resume, agent-idle,
 * agent-sling). A sling as the newest event means the agent holds work it never stood down from.
 */
const ASSIGNMENT_EVENT_TYPES = new Set(['agent-sling']);

function classify(eventType: string, ageMs: number, w: LivenessWindows): AgentLivenessState {
  // An explicit agent-idle is never "live" — it's the signal the agent stood down (the case
  // agent_status lies about). It stays 'idle' until it ages past the dark window.
  if (eventType === 'agent-idle') return ageMs <= w.idleMs ? 'idle' : 'dark';
  // An assignment as the newest event = the agent holds work and has said nothing since.
  // Fresh ⇒ live (assume working); past the stall threshold ⇒ stalled; past the dark
  // threshold ⇒ zombie (still holding the claim, silent for over a day).
  if (ASSIGNMENT_EVENT_TYPES.has(eventType)) {
    if (ageMs <= w.stallMs) return 'live';
    return ageMs <= w.idleMs ? 'stalled' : 'zombie';
  }
  if (ageMs <= w.liveMs) return 'live';
  if (ageMs <= w.idleMs) return 'idle';
  return 'dark';
}

/**
 * Derive liveness for every agent that has at least one `agent-*` event.
 * Agents with no events are absent from the result (use `livenessForAgents` to default them dark).
 *
 * `openClaims` (optional) — agent ids whose bead row carries an open claim (non-null `hook`),
 * supplied by the caller from rows it already fetched. An agent that would read 'dark' but still
 * holds an open claim is a 'zombie': the store asserts it has work; the event log says it's gone.
 */
export function deriveAgentLiveness(
  events: BeadEventRow[],
  now: number,
  windows: LivenessWindows = DEFAULT_LIVENESS_WINDOWS,
  openClaims?: ReadonlySet<string>,
): AgentLiveness[] {
  const latest = new Map<string, BeadEventRow>();
  for (const e of events) {
    if (!e.actor) continue;
    if (!e.event_type.startsWith('agent-')) continue;
    const prev = latest.get(e.actor);
    if (!prev || Date.parse(e.timestamp) > Date.parse(prev.timestamp)) latest.set(e.actor, e);
  }

  const out: AgentLiveness[] = [];
  for (const [agentId, e] of latest) {
    const ageMs = now - Date.parse(e.timestamp);
    let state = classify(e.event_type, ageMs, windows);
    if (state === 'dark' && openClaims?.has(agentId)) state = 'zombie';
    out.push({
      agentId,
      state,
      lastEventAt: e.timestamp,
      lastEventType: e.event_type,
    });
  }
  return out;
}

/**
 * Liveness state for a known roster of agent ids — agents with no `agent-*` events default to
 * 'dark' (we've literally never seen them act), unless they hold an open claim (`openClaims`),
 * in which case they are 'zombie' — the store says they have work; the event log has never seen
 * them move. This is the adapter-facing entry point.
 */
export function livenessForAgents(
  agentIds: string[],
  events: BeadEventRow[],
  now: number,
  windows: LivenessWindows = DEFAULT_LIVENESS_WINDOWS,
  openClaims?: ReadonlySet<string>,
): Map<string, AgentLivenessState> {
  const derived = new Map(
    deriveAgentLiveness(events, now, windows, openClaims).map((a) => [a.agentId, a.state]),
  );
  const result = new Map<string, AgentLivenessState>();
  for (const id of agentIds)
    result.set(id, derived.get(id) ?? (openClaims?.has(id) ? 'zombie' : 'dark'));
  return result;
}
