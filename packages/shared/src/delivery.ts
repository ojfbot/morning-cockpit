/**
 * Delivery read-model — the northstar → roadmap → dispatch-queue pipeline, read-only.
 *
 * Pure pieces only (no fs/net): the constrained-frontmatter parser, the movement-feed
 * JSONL parser, and the file-status × queue-label slice-state merge. The server adapter
 * (packages/server/src/adapters/delivery.ts) does the file/Dolt reads and calls these.
 *
 * Schema source of truth: core/decisions/northstar/{schema.md,roadmap-schema.md}.
 * Per ADR-0001 we mirror, never import core.
 */

import type { AdapterHealth } from './work-item.js';

// ── Constrained frontmatter parser ──────────────────────────────────────────
// Mirrors core/scripts/lib/northstar-fm.mjs (parseFM + scalar) @ 2026-07-02.
// The northstar/roadmap/registry frontmatter is deliberately regular — top-level
// scalars plus flat lists of maps — which is what makes a no-YAML-lib parse safe.

export type FrontmatterScalar = string | number | boolean | null;
export type FrontmatterItem = Record<string, FrontmatterScalar>;
export type Frontmatter = Record<string, FrontmatterScalar | FrontmatterItem[]>;

const LIST_KEYS = new Set(['properties', 'registry', 'roadmaps', 'phases', 'slices']);

function scalar(v: string | undefined | null): FrontmatterScalar {
  if (v == null) return null;
  let s = String(v).trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  return s;
}

/** Parse a `---`-delimited frontmatter block into an object. Returns null if absent. */
export function parseFrontmatter(text: string): Frontmatter | null {
  const m = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!m) return null;
  const root: Frontmatter = {};
  let list: FrontmatterItem[] | null = null; // the array currently being filled
  let cur: FrontmatterItem | null = null; // the current item map within that array
  for (const rawLine of m[1]!.split('\n')) {
    if (!rawLine.trim() || /^\s*#/.test(rawLine)) continue; // blank or comment
    const indent = (rawLine.match(/^\s*/) || [''])[0]!.length;
    const line = rawLine.trim();
    const itemMatch = /^-\s*(.*)$/.exec(line);
    if (indent === 0) {
      list = null;
      cur = null;
      const kv = /^([\w-]+):\s*(.*)$/.exec(line);
      if (!kv) continue;
      const [, k, v] = kv;
      if (v === '' && LIST_KEYS.has(k!)) {
        const arr: FrontmatterItem[] = [];
        root[k!] = arr;
        list = arr;
      } else {
        root[k!] = scalar(v);
      }
    } else if (itemMatch && list) {
      cur = {};
      list.push(cur);
      const kv = /^([\w-]+):\s*(.*)$/.exec(itemMatch[1]!);
      if (kv) cur[kv[1]!] = scalar(kv[2]);
    } else if (cur) {
      const kv = /^([\w-]+):\s*(.*)$/.exec(line);
      if (kv) cur[kv[1]!] = scalar(kv[2]);
    }
  }
  return root;
}

// ── Delivery snapshot types (the GET /api/delivery payload) ─────────────────

/** One northstar property with its honest current % and target prose. */
export interface NorthstarProperty {
  id: string; // "P1"
  name: string;
  current: number; // 0–100
  target: string;
}

export interface DeliveryNorthstar {
  slug: string;
  tier: string; // "L1" | "L2" | "L3"
  app?: string;
  properties: NorthstarProperty[];
}

export interface RoadmapPhase {
  id: string; // "PH1"
  name: string;
  goal?: string;
}

/** Slice delivery lifecycle as written in the roadmap file (roadmap-schema.md v1). */
export type SliceFileStatus = 'queued' | 'ready' | 'dispatched' | 'delivered' | 'merged' | 'dropped';

/** Queue label of the compiled bead projection (mirrors dolt-bead.ts reserved labels). */
export type SliceQueueState = 'available' | 'claimed' | 'expired';

/** The single displayed pipeline state — file status and queue label merged. */
export type SliceDisplayState =
  | 'queued'
  | 'ready'
  | 'available'
  | 'claimed'
  | 'delivered'
  | 'merged'
  | 'dropped';

export interface DeliverySlice {
  id: string; // "S1"
  ref: string; // "rm:<roadmap-slug>#S1"
  phase: string; // "PH1"
  title: string;
  advances: string; // "ns:<slug>#P1"
  moves_from: number;
  moves_to: number;
  autonomy: string; // merge gate: "gate-0" | "gate-1" | "gate-2"
  /** Derived displayed state (file + queue merged). */
  status: SliceDisplayState;
  /** Raw lifecycle status as written in the roadmap file. */
  fileStatus: SliceFileStatus;
  /** Queue label of the compiled bead, when one exists in Dolt. */
  queueState?: SliceQueueState;
  beadId?: string;
  /** Set when the file status and the queue projection disagree. */
  drift?: string;
  repo?: string;
  depends_on?: string;
}

export interface DeliveryRoadmap {
  slug: string;
  northstar: string;
  status: string; // roadmap status: active | paused | done
  phases: RoadmapPhase[];
  slices: DeliverySlice[];
}

/** One status.jsonl line — a movement recorded at merge (the odometer). */
export interface Movement {
  date: string;
  northstar: string;
  property: string;
  from: number;
  to: number;
  evidence?: string;
  actor?: string;
  source?: string;
}

export interface DeliveryHealth {
  /** Registry + northstar/roadmap file reads. */
  files: AdapterHealth;
  /** status.jsonl movement feed (absent file → up with 0 items, truthfully labeled). */
  movement: AdapterHealth;
  /** Read-only Dolt query for compiled queue beads. */
  queue: AdapterHealth;
}

export interface DeliverySnapshot {
  generatedAt: string;
  northstars: DeliveryNorthstar[];
  roadmaps: DeliveryRoadmap[];
  /** Most recent first. */
  movements: Movement[];
  health: DeliveryHealth;
}

// ── Slice state derivation (file + queue merge) ─────────────────────────────

export interface QueueProjection {
  beadId: string;
  queueState: SliceQueueState;
}

/** Queue labels a given file status may legitimately coexist with ('none' = no bead). */
const EXPECTED_QUEUE: Record<SliceFileStatus, ReadonlyArray<SliceQueueState | 'none'>> = {
  queued: ['none'], // compiler only compiles ready slices
  ready: ['none', 'available'], // posted-but-unclaimed is the normal ready projection
  dispatched: ['claimed'], // dispatched = a claim lease exists
  delivered: ['none', 'claimed'], // lease may persist until merge closes the bead
  merged: ['none'],
  dropped: ['none'],
};

/**
 * Merge the roadmap file's lifecycle status with the compiled bead's queue label into
 * one displayed pipeline state, flagging file-vs-queue drift instead of papering over it.
 * Terminal file states (merged/delivered/dropped) win; otherwise the queue is fresher.
 */
export function deriveSliceState(
  fileStatus: SliceFileStatus,
  queue?: QueueProjection,
): { state: SliceDisplayState; drift?: string } {
  const actual: SliceQueueState | 'none' = queue?.queueState ?? 'none';
  const drift = EXPECTED_QUEUE[fileStatus].includes(actual)
    ? undefined
    : `file=${fileStatus} queue=${actual}`;

  let state: SliceDisplayState;
  if (fileStatus === 'merged' || fileStatus === 'delivered' || fileStatus === 'dropped') {
    state = fileStatus;
  } else if (actual === 'claimed') {
    state = 'claimed';
  } else if (actual === 'available') {
    state = 'available';
  } else if (fileStatus === 'dispatched') {
    // File says a claim happened but no live queue projection backs it — trust the
    // file for display; the drift flag (set above) reports the disagreement.
    state = 'claimed';
  } else {
    state = fileStatus; // queued | ready (expired lease also falls back to the file)
  }
  return drift ? { state, drift } : { state };
}

// ── Movement feed (status.jsonl) ────────────────────────────────────────────

/**
 * Parse the append-only status.jsonl movement feed. Malformed lines are skipped and
 * counted, never fatal — the feed is truthful about what it could read.
 */
export function parseMovementLines(text: string): { movements: Movement[]; skipped: number } {
  const movements: Movement[] = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as Record<string, unknown>;
      if (
        typeof row.date !== 'string' ||
        typeof row.northstar !== 'string' ||
        typeof row.property !== 'string' ||
        typeof row.from !== 'number' ||
        typeof row.to !== 'number'
      ) {
        skipped++;
        continue;
      }
      movements.push({
        date: row.date,
        northstar: row.northstar,
        property: row.property,
        from: row.from,
        to: row.to,
        evidence: typeof row.evidence === 'string' ? row.evidence : undefined,
        actor: typeof row.actor === 'string' ? row.actor : undefined,
        source: typeof row.source === 'string' ? row.source : undefined,
      });
    } catch {
      skipped++;
    }
  }
  // Most recent first (stable for same-date lines: later append wins the top slot).
  movements.reverse();
  return { movements, skipped };
}
