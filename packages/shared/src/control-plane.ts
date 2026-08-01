/**
 * Control plane (08) read-model — the fleet's *loops*, not its repos.
 *
 * Fills a gap the other two panes only look like they cover:
 *
 * - **Fleet (01)** derives repo liveness from bead activity over a hand-maintained roster.
 *   It answers "which repos have bead traffic" — a repo with healthy loops and no beads
 *   still reads `dark`.
 * - **Loop (07)** reads skill-disposition telemetry: the OPAV capture funnel, nothing else.
 *
 * Neither reads `core/decisions/loops/loops.md` — the registry that declares every loop in
 * the cluster with its trigger, cadence, verifier, stop rule and last-run evidence pointer.
 * This module derives health from that registry.
 *
 * Pure + clock-injected: no `Date.now`, no fs, no network. The adapter resolves
 * `evidence_ref:` (the only I/O) and hands the results in, so every verdict here is
 * table-testable.
 *
 * ## Two honesty rules, both learned from a prototype that got them wrong first
 *
 * 1. **No consumption column.** The prototype tried scoring each loop by how many files
 *    reference its output artifact, as a proxy for "does anyone read this". It reported 7
 *    orphans, then 0 after two search bugs were fixed — i.e. the proxy cannot discriminate.
 *    In a documentation-dense cluster everything is named somewhere, and naming is not
 *    reading. Consumption needs a consumer-written signal; until one exists this model
 *    stays silent about it rather than shipping a number that means nothing.
 *
 * 2. **`unverifiable` is not `down`.** Evidence that cannot be read *from where the probe
 *    ran* says nothing about the loop. Every unverifiable row carries its reason and the
 *    snapshot carries its vantage, so "we cannot see it from here" can never be rendered
 *    as "it is broken".
 */
import type { AdapterHealth } from './work-item.js';
import { parseFrontmatter, type FrontmatterItem } from './delivery.js';

/** The registry's `trigger:` values — a labeled adapter, never the loop's identity. */
export type LoopTrigger = 'launchd' | 'gh-actions' | 'hook' | 'watchpath' | 'manual';
export type LoopCadence = 'always-on' | 'daily' | 'weekly' | 'event' | 'manual';
export type LoopStatus = 'live' | 'disabled';

export type LoopVerdict =
  /** Fired inside the budget its cadence allows. */
  | 'ok'
  /** Evidence is older than the cadence permits. */
  | 'stale'
  /** An `always-on` loop whose liveness probe failed. */
  | 'down'
  /** Evidence could not be read from this vantage — says nothing about the loop. */
  | 'unverifiable'
  /** Nothing to breach: `event`/`manual` cadence, or a deliberately parked entry. */
  | 'excluded';

/** One row of the registry, normalized. Mirrors `core/decisions/loops/loops.md`. */
export interface LoopEntry {
  slug: string;
  purpose?: string;
  trigger: LoopTrigger | string;
  triggerRef?: string;
  installedRef?: string;
  cadence: LoopCadence | string;
  stateSpine?: string;
  verifier?: string;
  stopRule?: string;
  evidenceRef?: string;
  owner?: string;
  status: LoopStatus | string;
  repo?: string;
}

/**
 * Adapter-resolved last-run evidence for one loop. `at` is null whenever the scheme could
 * not be read here — `reason` then says why, and is surfaced verbatim in the UI.
 */
export interface LoopEvidence {
  /** ISO timestamp of the last run, or null if unresolved. */
  at: string | null;
  /** Why `at` is null. Required whenever it is. */
  reason?: string;
  /** The concrete thing the evidence points at (path, branch, table). */
  artifact?: string;
  /** `file` | `git-branch` | `gh` | `dolt` | `script` | `none` | unknown. */
  scheme?: string;
}

export interface LoopRow extends LoopEntry {
  verdict: LoopVerdict;
  /** Human-readable justification for the verdict. Always populated. */
  why: string;
  lastRun: string | null;
  ageDays: number | null;
  /**
   * Whether liveness can evaluate this loop at all (cadenced + live). The complement is the
   * pane's most important number: an `event` hook that silently stops is invisible to every
   * mechanism the cluster currently has.
   */
  watched: boolean;
  hasVerifier: boolean;
  hasStopRule: boolean;
  evidenceReason?: string;
  artifact?: string;
}

export interface ControlPlaneTotals {
  loops: number;
  /** Cadenced + live — the subset liveness can actually evaluate. */
  watched: number;
  /** Everything else. Not "healthy": unobserved. */
  unwatched: number;
  byVerdict: Record<LoopVerdict, number>;
  byTrigger: Record<string, number>;
  /** Loops declaring no verifier — they cannot be checked even in principle. */
  withoutVerifier: number;
  /** Loops declaring no stop rule. */
  withoutStopRule: number;
  /** Registry lines the parser did not understand. Never silently zero. */
  parseSkipped: number;
}

export interface ControlPlaneSnapshot {
  generatedAt: string;
  /** Where the probe ran. Qualifies every `unverifiable` in `rows`. */
  vantage: string;
  /** Registry path this was derived from. */
  source: string;
  rows: LoopRow[];
  totals: ControlPlaneTotals;
  health: AdapterHealth[];
}

/** How stale a loop's evidence may be, per cadence, before it reads `stale`. */
export interface CadenceBudgets {
  daily: number;
  weekly: number;
  /** Fallback for an unrecognized cadence that is nonetheless watched. */
  other: number;
}

const DAY = 86_400_000;

/**
 * Deliberately generous: a daily loop firing at 03:30 must not read stale to a probe that
 * runs at 09:00 the next morning, and a weekly loop needs room for one missed fire before
 * anyone is told. Tightening these should follow evidence about real jitter, not taste.
 */
export const DEFAULT_CADENCE_BUDGETS: CadenceBudgets = {
  daily: 2 * DAY,
  weekly: 10 * DAY,
  other: 10 * DAY,
};

const WATCHED_CADENCES = new Set(['always-on', 'daily', 'weekly']);

const str = (v: unknown): string | undefined => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
};

/**
 * Parse the loops registry. Reuses `parseFrontmatter` (northstar-fm style) — the registry is
 * the same shape, so there is exactly one frontmatter parser in this package.
 *
 * Entries missing a `slug` are counted in `skipped` rather than dropped silently: a registry
 * row this model cannot see is precisely the kind of invisibility the pane exists to end.
 */
export function parseLoopsRegistry(text: string): { loops: LoopEntry[]; skipped: number } {
  const fm = parseFrontmatter(text);
  const raw = fm?.loops;
  if (!Array.isArray(raw)) return { loops: [], skipped: 0 };

  const loops: LoopEntry[] = [];
  let skipped = 0;
  for (const item of raw as FrontmatterItem[]) {
    const slug = str(item.slug);
    if (!slug) {
      skipped++;
      continue;
    }
    loops.push({
      slug,
      purpose: str(item.purpose),
      trigger: str(item.trigger) ?? 'unknown',
      triggerRef: str(item.trigger_ref),
      installedRef: str(item.installed_ref),
      cadence: str(item.cadence) ?? 'unknown',
      stateSpine: str(item.state_spine),
      verifier: str(item.verifier),
      stopRule: str(item.stop_rule),
      evidenceRef: str(item.evidence_ref),
      owner: str(item.owner),
      status: str(item.status) ?? 'unknown',
      repo: str(item.repo),
    });
  }
  return { loops, skipped };
}

/**
 * A `verifier:` of "none", or one whose text opens by admitting there is none, is not a
 * verifier. The registry writes both forms, so both are treated as absent — counting
 * "none — T4 names the gap" as coverage would launder the exact gap it documents.
 */
export function hasRealVerifier(verifier?: string): boolean {
  if (!verifier) return false;
  return !/^none\b/i.test(verifier.trim());
}

export function isWatched(entry: LoopEntry): boolean {
  return entry.status === 'live' && WATCHED_CADENCES.has(entry.cadence);
}

/** Derive one loop's verdict. Pure; `now` is injected. */
export function deriveLoopRow(
  entry: LoopEntry,
  evidence: LoopEvidence | undefined,
  now: number,
  budgets: CadenceBudgets = DEFAULT_CADENCE_BUDGETS,
): LoopRow {
  const base: LoopRow = {
    ...entry,
    verdict: 'excluded',
    why: '',
    lastRun: evidence?.at ?? null,
    ageDays: null,
    watched: isWatched(entry),
    hasVerifier: hasRealVerifier(entry.verifier),
    hasStopRule: !!entry.stopRule,
    evidenceReason: evidence?.reason,
    artifact: evidence?.artifact,
  };

  if (entry.status === 'disabled') {
    return { ...base, verdict: 'excluded', why: 'deliberately parked' };
  }
  if (!base.watched) {
    return {
      ...base,
      verdict: 'excluded',
      why: `cadence ${entry.cadence} — no schedule to breach`,
    };
  }

  // always-on loops are probed, not aged: the adapter reports reachability as `at`.
  if (entry.cadence === 'always-on') {
    return evidence?.at
      ? { ...base, verdict: 'ok', why: 'probe reachable' }
      : { ...base, verdict: 'down', why: evidence?.reason ?? 'probe failed' };
  }

  if (!evidence?.at) {
    return {
      ...base,
      verdict: 'unverifiable',
      why: evidence?.reason ?? 'no readable last-run evidence',
    };
  }

  const parsed = Date.parse(evidence.at);
  if (Number.isNaN(parsed)) {
    return { ...base, verdict: 'unverifiable', why: `unparseable evidence timestamp "${evidence.at}"` };
  }

  const ageMs = now - parsed;
  const budget =
    entry.cadence === 'daily' ? budgets.daily : entry.cadence === 'weekly' ? budgets.weekly : budgets.other;
  const ageDays = ageMs / DAY;

  return ageMs > budget
    ? {
        ...base,
        ageDays,
        verdict: 'stale',
        why: `last ran ${ageDays.toFixed(0)}d ago; ${entry.cadence} allows ${(budget / DAY).toFixed(0)}d`,
      }
    : { ...base, ageDays, verdict: 'ok', why: `ran ${ageDays.toFixed(1)}d ago` };
}

const EMPTY_VERDICTS: Record<LoopVerdict, number> = {
  ok: 0,
  stale: 0,
  down: 0,
  unverifiable: 0,
  excluded: 0,
};

/** Derive the whole pane. `evidence` is keyed by slug; a missing key is an unresolved read. */
export function deriveControlPlane(
  entries: LoopEntry[],
  evidence: Record<string, LoopEvidence>,
  now: number,
  opts: { parseSkipped?: number; budgets?: CadenceBudgets } = {},
): { rows: LoopRow[]; totals: ControlPlaneTotals } {
  const budgets = opts.budgets ?? DEFAULT_CADENCE_BUDGETS;
  const rows = entries.map((e) => deriveLoopRow(e, evidence[e.slug], now, budgets));

  const byVerdict = { ...EMPTY_VERDICTS };
  const byTrigger: Record<string, number> = {};
  for (const r of rows) {
    byVerdict[r.verdict]++;
    byTrigger[r.trigger] = (byTrigger[r.trigger] ?? 0) + 1;
  }

  const watched = rows.filter((r) => r.watched).length;
  return {
    rows,
    totals: {
      loops: rows.length,
      watched,
      unwatched: rows.length - watched,
      byVerdict,
      byTrigger,
      withoutVerifier: rows.filter((r) => !r.hasVerifier).length,
      withoutStopRule: rows.filter((r) => !r.hasStopRule).length,
      parseSkipped: opts.parseSkipped ?? 0,
    },
  };
}

/** Sort order for display: problems first, parked last. */
export const VERDICT_ORDER: Record<LoopVerdict, number> = {
  down: 0,
  stale: 1,
  unverifiable: 2,
  ok: 3,
  excluded: 4,
};

export function sortRows(rows: LoopRow[]): LoopRow[] {
  return [...rows].sort(
    (a, b) => VERDICT_ORDER[a.verdict] - VERDICT_ORDER[b.verdict] || a.slug.localeCompare(b.slug),
  );
}
