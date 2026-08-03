/**
 * Lane assignment + staleness — the load-bearing pure logic of the cockpit.
 *
 * Lanes, in priority order: overnight > pickup > available. An item that qualifies for
 * more than one lands in the highest-priority one. Classification is timestamp-driven for
 * "overnight" (we never trust agent_status — observed permanently 'active'). Items that
 * qualify for no lane return null and are dropped (e.g. long-closed beads).
 */

import type { WorkItem, WorkItemLane, WorkItemKind, WorkItemSource, WorkItemStatus } from './work-item.js';

export interface LaneContext {
  /** Reference "now". Injected for testability. */
  now: Date;
  /** Start of the overnight window (ISO). Items active since here count as overnight. */
  overnightSince: string;
  /** Open items older than this many days are marked stale. */
  staleThresholdDays: number;
}

/** Normalized inputs lane classification needs — a projection of WorkItem + source hints. */
export interface LaneInput {
  source: WorkItemSource;
  kind: WorkItemKind;
  status: WorkItemStatus;
  activityAt: string;
  /** handoff brief: is it an unanswered open hook? */
  openHook?: boolean;
  /** dolt task: does it have a hook assigned (i.e. claimed)? */
  hookAssigned?: boolean;
  /** standup priority level */
  priorityLevel?: 'P0' | 'P1' | 'P2';
  /** PR draft flag */
  draft?: boolean;
}

/**
 * The most recent local `boundaryHour`:00 that is at or before `now`.
 * For a 7am cockpit with boundaryHour=18, this is yesterday 18:00.
 */
export function overnightWindowStart(now: Date, boundaryHour = 18): Date {
  const start = new Date(now);
  start.setHours(boundaryHour, 0, 0, 0);
  if (start.getTime() > now.getTime()) {
    start.setDate(start.getDate() - 1);
  }
  return start;
}

/** Whole days between an ISO timestamp and `now` (floored, never negative). */
export function computeStaleDays(iso: string | undefined, now: Date): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  const ms = now.getTime() - t;
  if (ms < 0) return 0;
  return Math.floor(ms / 86_400_000);
}

/**
 * Age buckets for queue legibility (rm:rm-l1-morning-cockpit bead-lanes slice). One
 * definition shared by badge, lane header, and briefing ranking so every surface agrees
 * on what "old" means. "Rotten" is deliberately uncomfortable — the label should make
 * the operator want the queue empty.
 */
export type AgeBucket = 'fresh' | 'aging' | 'rotten';

export function ageBucket(staleDays: number | undefined): AgeBucket {
  if (staleDays === undefined || staleDays < 7) return 'fresh';
  if (staleDays <= 30) return 'aging';
  return 'rotten';
}

function isWithinOvernight(activityAt: string, ctx: LaneContext): boolean {
  const t = Date.parse(activityAt);
  const since = Date.parse(ctx.overnightSince);
  if (Number.isNaN(t) || Number.isNaN(since)) return false;
  return t >= since && t <= ctx.now.getTime();
}

/**
 * Assign a lane, or null if the item should not surface.
 * Priority: overnight > pickup > available.
 */
export function classifyLane(input: LaneInput, ctx: LaneContext): WorkItemLane | null {
  const { kind, status } = input;

  // ── OVERNIGHT: activity demonstrably within the window ──
  // "running" alone is NOT trusted — Dolt 'live'/'active' status is permanently stale, so a
  // 57-day-old "live" session is not credibly running. We require the activity timestamp to fall
  // inside the window; stale-running items are dropped (and counted in the adapter health note)
  // rather than faked into the overnight lane.
  if (isWithinOvernight(input.activityAt, ctx)) {
    if (status === 'running' || status === 'done' || status === 'failed') return 'overnight';
  }

  // ── PICKUP: a human should act on this today ──
  if (kind === 'brief' && input.openHook) return 'pickup';
  if (kind === 'priority' && (input.priorityLevel === 'P0' || input.priorityLevel === 'P1')) return 'pickup';
  if (kind === 'pull_request' && status === 'open' && !input.draft) return 'pickup';

  // ── AVAILABLE: open / unclaimed / pickable ──
  const openish = status === 'open' || status === 'stale';
  if (openish) {
    if (kind === 'issue') return 'available';
    if (kind === 'brief') return 'available'; // open brief not yet picked up
    if (kind === 'task' && !input.hookAssigned) return 'available';
    if (kind === 'priority' && input.priorityLevel === 'P2') return 'available';
  }

  return null;
}

/**
 * Finalize a batch: drop unlaneable items, mark stale ones in the available lane,
 * compute staleDays, then dedupe by nativeId (keeping the highest-priority lane).
 */
const LANE_PRIORITY: Record<WorkItemLane, number> = { overnight: 0, pickup: 1, available: 2 };

export function finalizeItems(items: WorkItem[], ctx: LaneContext): WorkItem[] {
  const byNative = new Map<string, WorkItem>();

  for (const item of items) {
    const staleDays = computeStaleDays(item.createdAt ?? item.activityAt, ctx.now);
    const finalized: WorkItem = { ...item, staleDays };

    // An open item past the threshold becomes 'stale' (status decoration only, applied
    // AFTER lane assignment — never a demotion). Was gated to 'available' only, which
    // made pickup-lane briefs un-stale-markable: an open brief always classifies to
    // 'pickup' first, so a May brief could sit invisible for months (TD-006's display
    // half). Overnight stays exempt — fresh activity isn't rot.
    if (finalized.lane !== 'overnight' && staleDays !== undefined && staleDays >= ctx.staleThresholdDays) {
      finalized.status = 'stale';
    }

    const existing = byNative.get(finalized.nativeId);
    if (!existing || LANE_PRIORITY[finalized.lane] < LANE_PRIORITY[existing.lane]) {
      byNative.set(finalized.nativeId, finalized);
    }
  }

  return [...byNative.values()];
}

/** Split a finalized list into the three lanes. Overnight sorts by recency; the two
 *  actionable lanes sort by staleness (most stale first) so rot floats up — pickup used
 *  to sort by recency, which sank the oldest, most-neglected brief to the bottom and
 *  disagreed with the briefing fallback's stale-first ranking. */
export function splitLanes(items: WorkItem[]): Record<WorkItemLane, WorkItem[]> {
  const lanes: Record<WorkItemLane, WorkItem[]> = { overnight: [], pickup: [], available: [] };
  for (const item of items) lanes[item.lane].push(item);
  const byActivityDesc = (a: WorkItem, b: WorkItem) => Date.parse(b.activityAt) - Date.parse(a.activityAt);
  const byRotDesc = (a: WorkItem, b: WorkItem) => (b.staleDays ?? 0) - (a.staleDays ?? 0);
  lanes.overnight.sort(byActivityDesc);
  lanes.pickup.sort(byRotDesc);
  lanes.available.sort(byRotDesc);
  return lanes;
}
