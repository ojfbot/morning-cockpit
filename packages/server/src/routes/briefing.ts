import { Router } from 'express';
import type { BriefingArtifact } from '@cockpit/shared';
import { emitArtifact } from '../handoff-emit.js';

/**
 * Briefing console (ADR-0007). Slice 2 wires only the deliver-branch write — "Approve & emit"
 * routes here and reuses the gated handoff write path. The read side (GET /api/briefing, the
 * Chief-of-Staff generator) lands in Slice 3.
 */
export const briefingRouter: Router = Router();

// The deliver-branch upstream write. The artifact is pre-reviewed in the decision tree; the
// explicit Approve click is the ADR-0005 per-emission human gate. Validates + path-guards + writes.
briefingRouter.post('/api/briefing/emit', async (req, res) => {
  const artifact = req.body?.artifact as BriefingArtifact | undefined;
  if (!artifact || typeof artifact.title !== 'string' || typeof artifact.target !== 'string') {
    res.status(400).json({ error: 'artifact { title, target, closes, align, task, criteria[] } is required' });
    return;
  }
  try {
    const result = await emitArtifact(artifact);
    if (result.status === 'ok') {
      res.json({ written: true, path: result.path, beadId: result.beadId });
    } else {
      res.status(422).json({ written: false, errors: result.errors });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
