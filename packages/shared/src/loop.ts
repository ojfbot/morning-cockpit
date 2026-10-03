/**
 * Loop read-model — the self-improvement telemetry loop, read-only.
 *
 * Pure pieces only (no fs/net): the skill-disposition JSONL parser and the
 * capture-health / funnel / per-skill / odometer-freshness derivations. The server
 * adapter (packages/server/src/adapters/loop.ts) does the file reads and calls these.
 *
 * Schema source of truth: core's OPAV instrumentation (ADR-0095) writing
 * ~/selfco/tracking/skill-dispositions.jsonl. Per ADR-0001 we mirror, never import core.
 */

import type { AdapterHealth } from './work-item.js';
import { computeStaleDays } from './lanes.js';
import type { Movement } from './delivery.js';

// ── Disposition events (skill-dispositions.jsonl) ───────────────────────────

/** One skill:disposition line as emitted by core's shadow-mode session hooks. */
export interface DispositionEvent {
  ts: string;
  skill: string;
  /** Raw disposition string — unknown values are preserved and bucketed as 'other'. */
  disposition: string;
  engaged: boolean;
  acted: boolean;
  artifactExists: boolean;
  suggestionId?: string;
  sessionId?: string;
  suggestedAt?: string;
  mode?: string;
  /**
   * Era/population tag (core rm:rm-l1-core#S3): 'installed' | 'uninstalled'.
   * Absent on legacy rows written before the 2026-07-17 pipeline fixes — those
   * rows were scored by a predicate blind to Skill-tool follows and must never
   * be blended with post-fix rows.
   */
  population?: string;
}

/** Display population: the two scored denominators plus the pre-fix legacy era. */
export type LoopPopulation = 'installed' | 'uninstalled' | 'legacy';

export interface PopulationFunnel {
  population: LoopPopulation;
  allTime: DispositionCounts;
  last14d: DispositionCounts;
}

/** Funnel counts. `acted` comes from the boolean flag, not the disposition string. */
export interface DispositionCounts {
  ignored: number;
  engaged_no_act: number;
  followed: number;
  /** Work done in-session but never self-reported — the real capture failure (ADR-0095). */
  capture_miss: number;
  acted: number;
  other: number;
  total: number;
}

export interface CaptureHealth {
  total: number;
  last7d: number;
  newestTs?: string;
  daysSinceLast?: number;
  stale: boolean;
}

export interface SkillRow {
  skill: string;
  total: number;
  followed: number;
  engaged: number;
  /** followed / total, 0 when total is 0. */
  followRate: number;
}

export interface OdometerFreshness {
  movementCount: number;
  lastMovementDate?: string;
  daysSince?: number;
}

export interface LoopHealth {
  /** skill-dispositions.jsonl read (absent file → up with 0 items, truthfully labeled). */
  dispositions: AdapterHealth;
  /** status.jsonl movement odometer, read independently of the delivery pane. */
  odometer: AdapterHealth;
  /** Weekly skill-architecture-audit output — mtime probe only. */
  audit: AdapterHealth;
  /** Core's read-only Codex automation CLI. */
  hygiene: AdapterHealth;
}

export type HygieneFiring =
  | { kind: 'never-fired' }
  | { kind: 'missed'; nextRunAt: string }
  | { kind: 'succeeded' | 'failed'; observedAt: string; status: string }
  | { kind: 'running'; observedAt: string }
  | { kind: 'unknown'; reason: string };

export type HygieneStatus =
  | { kind: 'unavailable' | 'disabled'; reason: string }
  | {
      kind: 'configured';
      scheduler: 'Codex';
      scheduleRule: string;
      nextRunAt?: string;
      firing: HygieneFiring;
      output: 'unverified';
    };

export interface LoopSnapshot {
  generatedAt: string;
  /** External Selfco heartbeat, read from core's registry and Codex run database. */
  hygiene: HygieneStatus;
  capture: CaptureHealth;
  funnel: { allTime: DispositionCounts; last14d: DispositionCounts };
  /** Per-population funnels (rm:rm-l1-core#S7): installed / uninstalled / legacy, eras never blended. */
  populations: PopulationFunnel[];
  /**
   * True only when the S6 capture-quality artifact exists on disk (ADR-0095: no rate
   * is publishable before the gold-set verification is green). While false, consumers
   * must show counts, never rates.
   */
  rateVerified: boolean;
  skills: SkillRow[];
  odometer: OdometerFreshness;
  audit: { mtime?: string; daysSince?: number };
  health: LoopHealth;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}

function parseReceipt(value: unknown): { observedAt: string; status: string } {
  if (!isRecord(value) || typeof value.threadId !== 'string' || !value.threadId ||
      typeof value.status !== 'string' || !value.status || !isIsoDate(value.observedAt) ||
      !isIsoDate(value.updatedAt) || value.updatedAt < value.observedAt) {
    throw new Error('invalid Codex run receipt');
  }
  return { observedAt: value.observedAt, status: value.status };
}

/** Mirrors core scripts/codex-automation-status.mjs at b062d96. Private IDs stop here. */
export function parseCodexHygiene(raw: unknown): HygieneStatus {
  if (!isRecord(raw) || raw.id !== 'selfco-vault-hygiene' || raw.scheduler !== 'codex') {
    throw new Error('invalid Codex automation identity');
  }
  if (raw.configured === 'disabled' && raw.firing === 'disabled') {
    return { kind: 'disabled', reason: 'Codex automation is disabled' };
  }
  if (raw.configured === 'missing' || raw.configured === 'mismatch' || raw.configured === 'unverifiable') {
    if (raw.firing !== 'unknown') throw new Error('inconsistent Codex configuration state');
    return { kind: 'unavailable', reason: `Codex automation ${raw.configured}` };
  }
  if (raw.configured !== 'configured' || !isRecord(raw.schedule) ||
      typeof raw.schedule.rrule !== 'string' || !raw.schedule.rrule ||
      typeof raw.schedule.targetThreadId !== 'string' || !raw.schedule.targetThreadId ||
      (raw.schedule.nextRunAt !== undefined && !isIsoDate(raw.schedule.nextRunAt))) {
    throw new Error('invalid Codex schedule');
  }
  if (raw.output !== undefined && raw.output !== 'unverified') {
    throw new Error('invalid Codex output state');
  }
  if (raw.warning !== undefined && (typeof raw.warning !== 'string' || !raw.warning)) {
    throw new Error('invalid Codex warning');
  }
  const nextRunAt = raw.schedule.nextRunAt;
  let firing: HygieneFiring;
  switch (raw.firing) {
    case 'never-fired':
      if (raw.receipt !== undefined || raw.output !== undefined) throw new Error('unexpected Codex run receipt');
      firing = raw.warning === undefined ? { kind: 'never-fired' } : {
        kind: 'unknown',
        reason: 'No run history after the declared cadence; prior pauses and retention are unknown',
      };
      break;
    case 'missed':
      if (!nextRunAt || raw.receipt !== undefined || raw.output !== undefined) throw new Error('invalid missed run');
      firing = { kind: 'missed', nextRunAt };
      break;
    case 'succeeded':
    case 'failed':
    case 'running': {
      if (raw.output !== 'unverified') throw new Error('invalid Codex output state');
      const receipt = parseReceipt(raw.receipt);
      firing = raw.firing === 'running'
        ? { kind: 'running', observedAt: receipt.observedAt }
        : { kind: raw.firing, observedAt: receipt.observedAt, status: receipt.status };
      break;
    }
    case 'unknown':
      if (raw.output !== 'unverified') throw new Error('invalid Codex output state');
      parseReceipt(raw.receipt);
      firing = { kind: 'unknown', reason: 'Codex run status is unknown' };
      break;
    default:
      throw new Error('invalid Codex firing state');
  }
  return { kind: 'configured', scheduler: 'Codex', scheduleRule: raw.schedule.rrule,
    nextRunAt, firing, output: 'unverified' };
}

/**
 * Parse the append-only skill-dispositions.jsonl feed. Malformed lines are skipped and
 * counted, never fatal — the feed is truthful about what it could read.
 */
export function parseDispositionLines(text: string): { events: DispositionEvent[]; skipped: number } {
  const events: DispositionEvent[] = [];
  let skipped = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = JSON.parse(trimmed) as Record<string, unknown>;
      if (
        typeof row.ts !== 'string' ||
        typeof row.skill !== 'string' ||
        typeof row.disposition !== 'string'
      ) {
        skipped++;
        continue;
      }
      events.push({
        ts: row.ts,
        skill: row.skill,
        disposition: row.disposition,
        engaged: row.engaged === true,
        acted: row.acted === true,
        artifactExists: row.artifact_exists === true,
        suggestionId: typeof row.suggestion_id === 'string' ? row.suggestion_id : undefined,
        sessionId: typeof row.session_id === 'string' ? row.session_id : undefined,
        suggestedAt: typeof row.suggested_at === 'string' ? row.suggested_at : undefined,
        mode: typeof row.mode === 'string' ? row.mode : undefined,
        population: typeof row.population === 'string' ? row.population : undefined,
      });
    } catch {
      skipped++;
    }
  }
  return { events, skipped };
}

/** Capture health: is the shadow-mode hook still writing? Stale when quiet ≥ threshold days. */
export function buildCaptureHealth(
  events: DispositionEvent[],
  now: Date,
  staleThresholdDays: number,
): CaptureHealth {
  let newestTs: string | undefined;
  let newestMs = -Infinity;
  let last7d = 0;
  const weekAgo = now.getTime() - 7 * 86_400_000;
  for (const e of events) {
    const t = Date.parse(e.ts);
    if (Number.isNaN(t)) continue;
    if (t > newestMs) {
      newestMs = t;
      newestTs = e.ts;
    }
    if (t >= weekAgo) last7d++;
  }
  const daysSinceLast = computeStaleDays(newestTs, now);
  return {
    total: events.length,
    last7d,
    newestTs,
    daysSinceLast,
    stale: daysSinceLast === undefined || daysSinceLast >= staleThresholdDays,
  };
}

/** Count dispositions, optionally windowed to events at/after `since`. */
export function countDispositions(events: DispositionEvent[], since?: Date): DispositionCounts {
  const counts: DispositionCounts = {
    ignored: 0,
    engaged_no_act: 0,
    followed: 0,
    capture_miss: 0,
    acted: 0,
    other: 0,
    total: 0,
  };
  const floor = since?.getTime();
  for (const e of events) {
    if (floor !== undefined) {
      const t = Date.parse(e.ts);
      if (Number.isNaN(t) || t < floor) continue;
    }
    counts.total++;
    if (e.disposition === 'ignored') counts.ignored++;
    else if (e.disposition === 'engaged_no_act') counts.engaged_no_act++;
    else if (e.disposition === 'followed') counts.followed++;
    else if (e.disposition === 'capture_miss') counts.capture_miss++;
    else if (e.disposition !== 'acted') counts.other++; // 'acted' string: the boolean below owns it
    if (e.acted) counts.acted++;
  }
  return counts;
}

/** Bucket an event into its display population; unknown tags fold into legacy. */
export function populationOf(e: DispositionEvent): LoopPopulation {
  return e.population === 'installed' || e.population === 'uninstalled' ? e.population : 'legacy';
}

/**
 * Per-population funnels, eras never blended. All three populations are always
 * returned (zeros explicit) in fixed order: installed, uninstalled, legacy.
 */
export function buildPopulationFunnels(events: DispositionEvent[], now: Date): PopulationFunnel[] {
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86_400_000);
  const order: LoopPopulation[] = ['installed', 'uninstalled', 'legacy'];
  return order.map((population) => {
    const subset = events.filter((e) => populationOf(e) === population);
    return {
      population,
      allTime: countDispositions(subset),
      last14d: countDispositions(subset, fourteenDaysAgo),
    };
  });
}

/** Top-N skills by suggestion volume (desc), skill-name asc on ties. */
export function buildSkillBreakdown(events: DispositionEvent[], topN: number): SkillRow[] {
  const bySkill = new Map<string, SkillRow>();
  for (const e of events) {
    let row = bySkill.get(e.skill);
    if (!row) {
      row = { skill: e.skill, total: 0, followed: 0, engaged: 0, followRate: 0 };
      bySkill.set(e.skill, row);
    }
    row.total++;
    if (e.disposition === 'followed') row.followed++;
    if (e.engaged) row.engaged++;
  }
  const rows = [...bySkill.values()];
  for (const row of rows) {
    row.followRate = row.total > 0 ? row.followed / row.total : 0;
  }
  rows.sort((a, b) => b.total - a.total || a.skill.localeCompare(b.skill));
  return rows.slice(0, Math.max(0, topN));
}

/** Odometer freshness from parsed movements (most-recent-first, per parseMovementLines). */
export function buildOdometerFreshness(movements: Movement[], now: Date): OdometerFreshness {
  const last = movements[0];
  return {
    movementCount: movements.length,
    lastMovementDate: last?.date,
    daysSince: computeStaleDays(last?.date, now),
  };
}
