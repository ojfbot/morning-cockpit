import { Router } from 'express';
import type { BriefingArtifact, BriefingSnapshot } from '@cockpit/shared';
import { buildSnapshot } from './../aggregate.js';
import { emitArtifact } from '../handoff-emit.js';
import { generateBriefing } from '../briefing-generate.js';

/**
 * Briefing console (ADR-0007). GET /api/briefing = the Chief-of-Staff read-model (LLM-generated,
 * deterministic fallback); POST /api/briefing/emit = the deliver-branch write, reusing the gated
 * handoff path. The generator only proposes — every emit is still human-approved.
 */
export const briefingRouter: Router = Router();

/** Cache the generated briefing by snapshot content (the LLM pass is slow + the input rarely moves). */
function snapshotKey(snap: { lanes: { pickup: { id: string }[]; available: { id: string; status: string }[] } }): string {
  const pick = snap.lanes.pickup.map((i) => i.id).join(',');
  const avail = snap.lanes.available.map((i) => `${i.id}:${i.status}`).join(',');
  return `${pick}|${avail}`;
}
let cache: { key: string; snapshot: BriefingSnapshot } | null = null;

// The Chief-of-Staff read-model. force=1 regenerates; otherwise cached by snapshot content.
briefingRouter.get('/api/briefing', async (req, res) => {
  try {
    const snapshot = await buildSnapshot();
    const key = snapshotKey(snapshot);
    const force = req.query.force === '1';
    if (!force && cache?.key === key) {
      res.json({ ...cache.snapshot, cached: true });
      return;
    }
    const briefing = await generateBriefing(snapshot, snapshot.generatedAt);
    cache = { key, snapshot: briefing };
    res.json({ ...briefing, cached: false });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

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
