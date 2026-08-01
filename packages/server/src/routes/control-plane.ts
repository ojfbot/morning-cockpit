import { Router } from 'express';
import type { ControlPlaneSnapshot } from '@cockpit/shared';
import { TtlCache } from '../cache.js';
import { config } from '../config.js';
import { buildControlPlaneSnapshot } from '../adapters/loops.js';

/**
 * Control plane (08) read-model — loop health from core's registry.
 *
 * A separate endpoint beside /api/cockpit: the snapshot contract and the GraphQL facade
 * (ADR-0013 drift gate) are untouched. Read-only; per-source degradation lives in the
 * adapter, so this route only caches and serves — same shape as /api/loop.
 */
export const controlPlaneRouter: Router = Router();

const cache = new TtlCache<ControlPlaneSnapshot>();

controlPlaneRouter.get('/api/control-plane', async (_req, res) => {
  try {
    const now = Date.now();
    let snap = cache.get('control-plane', now);
    if (!snap) {
      snap = await buildControlPlaneSnapshot(new Date(now));
      cache.set('control-plane', snap, config.controlPlane.ttlMs, now);
    }
    res.json(snap);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
