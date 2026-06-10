/**
 * Read-only projection of the Frame bead types.
 *
 * Mirrors core/packages/workflows/src/types/{bead.ts,agent-bead.ts,convoy.ts} @ 2026-06-07.
 * We deliberately do NOT import @core/workflows (no workspace spans ~/ojfbot, it only
 * exports built dist/, and DoltBeadStore is a read-write engine). See ADR-0001.
 *
 * These shapes describe rows of the Dolt `beads` table (dolt-schema.sql). Treat every
 * field as untrusted: labels JSON may be partial or malformed, so adapters parse defensively.
 */

// Mirrors bead.ts BeadType — kept loose; unknown values map to a 'generic' WorkItem.
export type BeadType =
  | 'adr' | 'okr' | 'roadmap' | 'command' | 'draft' | 'cv'
  | 'task' | 'agent' | 'hook' | 'mail' | 'molecule'
  | 'convoy' | 'session' | 'pr';

// Mirrors bead.ts BeadStatus.
export type BeadStatus = 'created' | 'live' | 'closed' | 'archived';

/** Mirrors bead.ts FrameBead — one row of the `beads` table. */
export interface FrameBead {
  id: string;
  type: BeadType;
  status: BeadStatus;
  title: string;
  body: string;
  labels: Record<string, string>;
  actor: string;
  hook?: string;
  molecule?: string;
  refs: string[];
  created_at: string;
  updated_at: string;
  closed_at?: string;
}

/** Mirrors agent-bead.ts AgentStatus. NOTE: observed unreliable (all agents read 'active'). */
export type AgentStatus = 'active' | 'idle' | 'suspended' | 'error';
export type AgentRole = 'mayor' | 'witness' | 'worker' | 'crew';

/** Mirrors convoy.ts ConvoySlot — element of the JSON-encoded labels.slots array. */
export interface ConvoySlot {
  beadId: string;
  agentId?: string;
  status: 'pending' | 'active' | 'done' | 'failed';
}

export type ConvoyStatus = 'forming' | 'active' | 'completed' | 'failed';

/** Mirrors bead_events rows (dolt-schema.sql) — the append-only liveness/activity log. */
export interface BeadEventRow {
  event_type: string;
  bead_id: string | null;
  actor: string | null;
  summary: string | null;
  timestamp: string;
}

// Mirrors bead.ts BEAD_PREFIX_MAP / beadPrefix().
const BEAD_PREFIX_MAP: Record<string, string> = {
  core: 'core', cv: 'cv', blog: 'blog', trip: 'trip', pure: 'pure',
  seh: 'seh', lean: 'lean', gt: 'gt', hq: 'hq',
};

/** Extract the rig prefix from a bead id (segment before the first '-'). */
export function beadPrefix(id: string): string {
  const seg = id.split('-')[0] ?? id;
  return BEAD_PREFIX_MAP[seg] ?? seg;
}

/** Parse a JSON labels/refs/slots column defensively — never throws. */
export function parseJsonColumn<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T; // mysql2 may pre-parse JSON columns
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
