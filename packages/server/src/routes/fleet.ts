import { Router } from 'express';
import { buildSnapshot } from '../aggregate.js';
import { deriveFleet, fleetTotals } from '../fleet-derive.js';
import { CRITICAL_CHAINS, CRITICAL_INTRO, CRITICAL_NOTE } from '../fleet-config.js';

/**
 * Fleet (01) + Critical Path (02) read-models. Fleet merges editorial repo metadata with live signals
 * derived from the snapshot; repo liveness is event-derived freshness (bead_events flows — S1/S2).
 * The repo-card derivation is shared with the GraphQL `fleet` resolver via `deriveFleet` (G1), so
 * REST and GraphQL cannot diverge.
 */
export const fleetRouter: Router = Router();

fleetRouter.get('/api/fleet', async (_req, res) => {
  try {
    const snap = await buildSnapshot();
    const now = Date.parse(snap.generatedAt) || Date.now();
    const repos = deriveFleet(snap, now);
    const totals = fleetTotals(repos);
    res.json({ generatedAt: snap.generatedAt, repos, totals });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

fleetRouter.get('/api/critical-path', (_req, res) => {
  res.json({
    generatedAt: new Date().toISOString(),
    intro: CRITICAL_INTRO,
    chains: CRITICAL_CHAINS,
    seeded: true,
    note: CRITICAL_NOTE,
  });
});
