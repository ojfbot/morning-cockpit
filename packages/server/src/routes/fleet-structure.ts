import { Router } from 'express';
import type { FleetStructureSnapshot } from '@cockpit/shared';
import { TtlCache } from '../cache.js';
import { config } from '../config.js';
import { buildFleetStructureSnapshot } from '../adapters/fleet-structure.js';

/**
 * Fleet-structure read-model (roadmap S10) — the strategy layer: northstar ladder, slice
 * tallies, wayfinder frontier, vault layers, census/registry disagreement. A separate REST
 * endpoint beside the aggregate (RFI C16: NOT the G1 facade — that is a contract change
 * with CI consequences, not to be smuggled): the /api/cockpit snapshot contract and the
 * GraphQL drift gate are untouched. Read-only; per-source degradation lives in the adapter,
 * so this route only caches and serves.
 */
export const fleetStructureRouter: Router = Router();

const cache = new TtlCache<FleetStructureSnapshot>();

fleetStructureRouter.get('/api/fleet-structure', (_req, res) => {
  try {
    const now = Date.now();
    let snap = cache.get('fleet-structure', now);
    if (!snap) {
      snap = buildFleetStructureSnapshot({ now: new Date(now) });
      cache.set('fleet-structure', snap, config.fleetStructure.ttlMs, now);
    }
    res.json(snap);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
