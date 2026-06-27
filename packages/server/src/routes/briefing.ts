import { Router } from 'express';
import type { BriefingArtifact, BriefingSnapshot } from '@cockpit/shared';
import { buildSnapshot } from './../aggregate.js';
import { emitArtifact } from '../handoff-emit.js';
import { briefingFrames, generateBriefing } from '../briefing-generate.js';
import { sseEnd, sseInit, sseSend } from '../sse.js';

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
// Cache per repo (F2) — keyed by `repo` (or '__global__'), so toggling Fleet tiles doesn't thrash
// a single cache cell. Each entry is invalidated by snapshot content like before.
const cache = new Map<string, { key: string; snapshot: BriefingSnapshot }>();

// The Chief-of-Staff read-model. `?repo=` scopes it to one repo (F2); force=1 regenerates.
briefingRouter.get('/api/briefing', async (req, res) => {
  try {
    const repo = typeof req.query.repo === 'string' && req.query.repo ? req.query.repo : undefined;
    const snapshot = await buildSnapshot();
    const key = snapshotKey(snapshot);
    const force = req.query.force === '1';
    const cacheKey = repo ?? '__global__';
    const hit = cache.get(cacheKey);
    if (!force && hit?.key === key) {
      res.json({ ...hit.snapshot, cached: true });
      return;
    }
    const briefing = await generateBriefing(snapshot, snapshot.generatedAt, repo);
    cache.set(cacheKey, { key, snapshot: briefing });
    res.json({ ...briefing, cached: false });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Deterministic-first + async upgrade over SSE (ADR-0014 mitigation). Sends the deterministic floor
// IMMEDIATELY (never blocks on the model — ADR-0003), then the LLM upgrade when ready. `?repo=` scopes
// it (F2); `?force=1` bypasses the per-repo cache. The non-stream GET above stays for agents / the
// GraphQL facade.
briefingRouter.get('/api/briefing/stream', async (req, res) => {
  const repo = typeof req.query.repo === 'string' && req.query.repo ? req.query.repo : undefined;
  const force = req.query.force === '1';
  const cacheKey = repo ?? '__global__';
  sseInit(res);
  try {
    const snapshot = await buildSnapshot();
    const key = snapshotKey(snapshot);

    // Fresh cached briefing → send it instantly, done (still a single frame, instant).
    const hit = cache.get(cacheKey);
    if (!force && hit?.key === key) {
      sseSend(res, 'briefing', hit.snapshot);
      sseEnd(res);
      return;
    }

    // Cold: stream the deterministic floor first, then the LLM upgrade; cache the best (last) frame.
    let last: BriefingSnapshot | undefined;
    for await (const frame of briefingFrames(snapshot, snapshot.generatedAt, repo)) {
      sseSend(res, 'briefing', frame);
      last = frame;
    }
    if (last) cache.set(cacheKey, { key, snapshot: last });
    sseEnd(res);
  } catch (err) {
    sseSend(res, 'error', { message: err instanceof Error ? err.message : String(err) });
    sseEnd(res);
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
