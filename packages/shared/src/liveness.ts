/**
 * Agent liveness derivation (S2 — coordination rollout).
 *
 * `agent_status` is a permanent lie: every agent bead reads 'active' forever. Now that S1
 * writes bead_events and S2a keys agent-* events with `actor = <agent-id>`, real liveness is
 * derivable: group agent-* events by actor, take the most-recent, and classify by recency +
 * whether that last event was an explicit `agent-idle`.
 *
 * Pure + clock-injected (no Date.now, no DB) so it is fully table-testable. The cockpit's Dolt
 * adapter feeds it agent-* rows; `livenessForAgents` fills 'dark' for agents with no events.
 */
import type { BeadEventRow } from './dolt-bead.js';

export type AgentLivenessState = 'live' | 'idle' | 'dark';

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
}

/** Agents idle in minutes-to-hours, so windows are far tighter than the repo freshness windows. */
export const DEFAULT_LIVENESS_WINDOWS: LivenessWindows = {
  liveMs: 2 * 60 * 60 * 1000, // 2h
  idleMs: 24 * 60 * 60 * 1000, // 24h
};

function classify(eventType: string, ageMs: number, w: LivenessWindows): AgentLivenessState {
  // An explicit agent-idle is never "live" — it's the signal the agent stood down (the case
  // agent_status lies about). It stays 'idle' until it ages past the dark window.
  if (eventType === 'agent-idle') return ageMs <= w.idleMs ? 'idle' : 'dark';
  if (ageMs <= w.liveMs) return 'live';
  if (ageMs <= w.idleMs) return 'idle';
  return 'dark';
}

/**
 * Derive liveness for every agent that has at least one `agent-*` event.
 * Agents with no events are absent from the result (use `livenessForAgents` to default them dark).
 */
export function deriveAgentLiveness(
  events: BeadEventRow[],
  now: number,
  windows: LivenessWindows = DEFAULT_LIVENESS_WINDOWS,
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
    out.push({
      agentId,
      state: classify(e.event_type, ageMs, windows),
      lastEventAt: e.timestamp,
      lastEventType: e.event_type,
    });
  }
  return out;
}

/**
 * Liveness state for a known roster of agent ids — agents with no `agent-*` events default to
 * 'dark' (we've literally never seen them act). This is the adapter-facing entry point.
 */
export function livenessForAgents(
  agentIds: string[],
  events: BeadEventRow[],
  now: number,
  windows: LivenessWindows = DEFAULT_LIVENESS_WINDOWS,
): Map<string, AgentLivenessState> {
  const derived = new Map(deriveAgentLiveness(events, now, windows).map((a) => [a.agentId, a.state]));
  const result = new Map<string, AgentLivenessState>();
  for (const id of agentIds) result.set(id, derived.get(id) ?? 'dark');
  return result;
}
