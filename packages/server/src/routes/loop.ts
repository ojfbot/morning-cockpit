import { Router } from 'express';
import type { LoopSnapshot } from '@cockpit/shared';
import { TtlCache } from '../cache.js';
import { config } from '../config.js';
import { buildLoopSnapshot } from '../adapters/loop.js';

/**
 * Loop (07) read-model — the self-improvement telemetry loop (capture → funnel →
 * odometer). A separate endpoint beside /api/cockpit: the snapshot contract and the
 * GraphQL facade (ADR-0013 drift gate) are untouched. Read-only; per-source degradation
 * lives in the adapter, so this route only caches and serves.
 */
export const loopRouter: Router = Router();

const cache = new TtlCache<LoopSnapshot>();

loopRouter.get('/api/loop', (_req, res) => {
  try {
    const now = Date.now();
    let snap = cache.get('loop', now);
    if (!snap) {
      snap = buildLoopSnapshot(new Date(now));
      cache.set('loop', snap, config.loop.ttlMs, now);
    }
    res.json(snap);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
