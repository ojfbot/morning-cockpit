import { Router } from 'express';
import { claimTask } from '../queue-claim.js';

/**
 * POST /api/claim — the cockpit's per-action human-gated claim (ADR-0010, coordination S4).
 * Body: { beadId }. Triggers core `queue-claim` (the cockpit never writes Dolt directly).
 * The button click IS the human gate, mirroring /api/briefing/emit. A lost claim (already
 * claimed / expired / ineligible) is a normal outcome → 409, not a 500.
 */
export const claimRouter: Router = Router();

claimRouter.post('/api/claim', async (req, res) => {
  const beadId = req.body?.beadId as string | undefined;
  if (!beadId || typeof beadId !== 'string') {
    res.status(400).json({ claimed: false, error: 'beadId is required' });
    return;
  }
  const result = await claimTask(beadId);
  if (result.status === 'ok') {
    res.json({ claimed: true, beadId: result.beadId, hook: result.hook, leaseUntil: result.leaseUntil });
  } else if (result.status === 'lost') {
    res.status(409).json({ claimed: false, reason: 'lost' });
  } else {
    res.status(500).json({ claimed: false, error: result.error });
  }
});
