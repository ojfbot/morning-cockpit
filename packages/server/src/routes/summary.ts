import { createHash } from 'node:crypto';
import { Router } from 'express';
import type { LaneSummary, WorkItem, WorkItemLane } from '@cockpit/shared';
import { buildSnapshot } from '../aggregate.js';
import { disabledReason, summaryEnabled, synthesizeLane } from '../llm.js';

const LANES: WorkItemLane[] = ['overnight', 'pickup', 'available'];

/** Content hash of a lane's items — cache key so polls don't re-bill while data is unchanged. */
function laneHash(lane: WorkItemLane, items: WorkItem[]): string {
  const sig = items
    .map((i) => `${i.nativeId}:${i.status}:${i.staleDays ?? ''}`)
    .sort()
    .join('|');
  return `${lane}:${createHash('sha1').update(sig).digest('hex').slice(0, 12)}`;
}

// Keyed on lane:contentHash → never goes stale incorrectly; a changed item set is a new key.
const cache = new Map<string, LaneSummary>();

export const summaryRouter: Router = Router();

summaryRouter.get('/api/summary', async (req, res) => {
  const lane = String(req.query.lane ?? '') as WorkItemLane;
  const force = req.query.force === '1';
  if (!LANES.includes(lane)) {
    return res.status(400).json({ error: `lane must be one of ${LANES.join(', ')}` });
  }

  const snapshot = await buildSnapshot();
  const items = snapshot.lanes[lane];
  const deterministic = snapshot.summaries[lane];

  // Synthesis unavailable → return the deterministic summary, flagged disabled with a reason.
  if (!summaryEnabled()) {
    return res.json({ lane, summary: deterministic, cached: false, disabled: true, reason: disabledReason() });
  }

  const key = laneHash(lane, items);
  if (!force) {
    const hit = cache.get(key);
    if (hit) return res.json({ lane, summary: hit, cached: true });
  }

  try {
    const summary = await synthesizeLane(lane, items, deterministic);
    cache.set(key, summary);
    return res.json({ lane, summary, cached: false });
  } catch (err) {
    // Graceful fallback: deterministic summary + the error for the health-curious.
    return res.json({
      lane,
      summary: deterministic,
      cached: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
