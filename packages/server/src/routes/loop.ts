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
let inFlight: Promise<LoopSnapshot> | undefined;

loopRouter.get('/api/loop', async (_req, res) => {
  try {
    const now = Date.now();
    let snap = cache.get('loop', now);
    if (!snap) {
      if (!inFlight) {
        inFlight = buildLoopSnapshot(new Date(now))
          .then((result) => {
            cache.set('loop', result, config.loop.ttlMs, Date.now());
            return result;
          })
          .finally(() => { inFlight = undefined; });
      }
      snap = await inFlight;
    }
    res.json(snap);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
