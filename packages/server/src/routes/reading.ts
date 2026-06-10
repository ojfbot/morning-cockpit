import { createHash } from 'node:crypto';
import { Router } from 'express';
import {
  readingDigestFloor,
  type ReadingSnapshot,
  type ReadingSource,
  type SynthSummary,
} from '@cockpit/shared';
import { config } from '../config.js';
import { TtlCache } from '../cache.js';
import { fetchReading } from '../adapters/rss.js';
import { disabledReason, summaryEnabled, synthesizeReadingDigest } from '../llm.js';

export const readingRouter: Router = Router();

const snapshotCache = new TtlCache<{ since: string; sources: ReadingSource[]; snapshot: ReadingSnapshot }>();
const digestCache = new Map<string, SynthSummary>(); // keyed on new-item-set hash

async function getReading(now: number): Promise<{ since: string; sources: ReadingSource[]; snapshot: ReadingSnapshot }> {
  const cached = snapshotCache.get('reading', now);
  if (cached) return cached;
  const { since, sources, health } = await fetchReading();
  const snapshot: ReadingSnapshot = {
    generatedAt: new Date(now).toISOString(),
    since,
    sources,
    health: [health],
    digest: readingDigestFloor(sources),
  };
  const value = { since, sources, snapshot };
  snapshotCache.set('reading', value, config.reading.ttlMs, now);
  return value;
}

// Fast: feeds + per-source items + deterministic digest floor.
readingRouter.get('/api/reading', async (_req, res) => {
  try {
    const { snapshot } = await getReading(Date.now());
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Lazy: local-model digest of the new items, cached by item-set (mirrors /api/summary).
readingRouter.get('/api/reading/digest', async (req, res) => {
  const force = req.query.force === '1';
  const { sources, snapshot } = await getReading(Date.now());
  const newItems = sources.flatMap((s) => s.items.filter((i) => i.isNew));
  const floor = snapshot.digest;

  if (!summaryEnabled()) {
    return res.json({ digest: floor, cached: false, disabled: true, reason: disabledReason() });
  }
  if (newItems.length === 0) {
    return res.json({ digest: floor, cached: false }); // nothing to synthesize
  }

  const key = createHash('sha1').update(newItems.map((i) => i.id).sort().join('|')).digest('hex').slice(0, 12);
  if (!force) {
    const hit = digestCache.get(key);
    if (hit) return res.json({ digest: hit, cached: true });
  }
  try {
    const digest = await synthesizeReadingDigest(newItems, floor);
    digestCache.set(key, digest);
    return res.json({ digest, cached: false });
  } catch (err) {
    return res.json({ digest: floor, cached: false, error: err instanceof Error ? err.message : String(err) });
  }
});
