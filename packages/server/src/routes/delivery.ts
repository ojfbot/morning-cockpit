import { Router } from 'express';
import type { DeliverySnapshot } from '@cockpit/shared';
import { TtlCache } from '../cache.js';
import { config } from '../config.js';
import { buildDeliverySnapshot } from '../adapters/delivery.js';

/**
 * Delivery (03) read-model — the northstar→roadmap→dispatch pipeline (roadmap S5).
 * A separate endpoint beside /api/cockpit: the snapshot contract and the GraphQL facade
 * (ADR-0013 drift gate) are untouched. Read-only; per-source degradation lives in the
 * adapter, so this route only caches and serves.
 */
export const deliveryRouter: Router = Router();

const cache = new TtlCache<DeliverySnapshot>();

/**
 * The cached delivery snapshot. Exported so the Northstar chat tab (roadmap S9) grounds on the
 * SAME cache the Delivery pane serves — one read of core's registry per TTL, not two.
 */
export async function getDelivery(now: number): Promise<DeliverySnapshot> {
  const hit = cache.get('delivery', now);
  if (hit) return hit;
  const snap = await buildDeliverySnapshot(new Date(now));
  cache.set('delivery', snap, config.delivery.ttlMs, now);
  return snap;
}

deliveryRouter.get('/api/delivery', async (_req, res) => {
  try {
    res.json(await getDelivery(Date.now()));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
