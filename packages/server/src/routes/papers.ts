import { createHash } from 'node:crypto';
import { Router } from 'express';
import {
  paperExplainerFloor,
  type PaperExplainer,
  type PaperItem,
  type PapersSnapshot,
  type ReaderProfile,
} from '@cockpit/shared';
import { config } from '../config.js';
import { TtlCache } from '../cache.js';
import { fetchPapers } from '../adapters/papers.js';
import { fetchProfile } from '../adapters/profile.js';
import {
  deepDiveEnabled,
  deepDivePaper,
  disabledReason,
  explainPaper,
  summaryEnabled,
} from '../llm.js';
import { dismissSuggestion, listSuggestions, stageSuggestion } from '../store.js';

export const papersRouter: Router = Router();

const snapshotCache = new TtlCache<{ papers: PaperItem[]; profile: ReaderProfile; snapshot: PapersSnapshot }>();
const explainerCache = new Map<string, PaperExplainer>(); // local explainers, keyed id+profileSig
const deepDiveCache = new Map<string, PaperExplainer>(); // Claude deep-dives, keyed id+profileSig

/** Stable signature of the profile's meaningful inputs (NOT generatedAt) so caches survive refreshes. */
function profileSig(profile: ReaderProfile): string {
  const parts = [...profile.strengths, ...profile.learning, ...profile.domains].map(
    (n) => `${n.key}:${n.recent ? 1 : 0}`,
  );
  return createHash('sha1').update(parts.sort().join('|')).digest('hex').slice(0, 8);
}

/** Cached snapshot WITHOUT fetching — for the chat preload's no-new-fetches discipline. */
export function peekPapers(now: number): PapersSnapshot | undefined {
  return snapshotCache.get('papers', now)?.snapshot;
}

export async function getPapers(now: number) {
  const cached = snapshotCache.get('papers', now);
  if (cached) return cached;
  const [papersRes, profileRes] = await Promise.all([fetchPapers(), fetchProfile(new Date(now))]);
  const snapshot: PapersSnapshot = {
    generatedAt: new Date(now).toISOString(),
    papers: papersRes.papers,
    profile: profileRes.profile,
    health: [papersRes.health, profileRes.health],
  };
  const value = { papers: papersRes.papers, profile: profileRes.profile, snapshot };
  snapshotCache.set('papers', value, config.papers.ttlMs, now);
  return value;
}

// Fast: papers + reader profile + adapter health.
papersRouter.get('/api/papers', async (_req, res) => {
  try {
    const { snapshot } = await getPapers(Date.now());
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Lazy: local abstract-level explainer for one paper (mirrors /api/reading/digest).
papersRouter.get('/api/papers/explainer', async (req, res) => {
  const id = String(req.query.id ?? '');
  const force = req.query.force === '1';
  const { papers, profile } = await getPapers(Date.now());
  const paper = papers.find((p) => p.id === id);
  if (!paper) return res.status(404).json({ error: `unknown paper id: ${id}` });
  const floor = paperExplainerFloor(paper);

  if (!summaryEnabled()) {
    return res.json({ explainer: floor, cached: false, disabled: true, reason: disabledReason() });
  }
  const key = `${id}:${profileSig(profile)}`;
  if (!force) {
    const hit = explainerCache.get(key);
    if (hit) return res.json({ explainer: hit, cached: true });
  }
  try {
    const explainer = await explainPaper(paper, profile);
    explainerCache.set(key, explainer);
    return res.json({ explainer, cached: false });
  } catch (err) {
    return res.json({ explainer: floor, cached: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Lazy + opt-in: full-PDF Claude Sonnet deep-dive for one paper.
papersRouter.get('/api/papers/deepdive', async (req, res) => {
  const id = String(req.query.id ?? '');
  const force = req.query.force === '1';
  const { papers, profile } = await getPapers(Date.now());
  const paper = papers.find((p) => p.id === id);
  if (!paper) return res.status(404).json({ error: `unknown paper id: ${id}` });
  const floor = paperExplainerFloor(paper);

  if (!deepDiveEnabled()) {
    return res.json({ explainer: floor, cached: false, disabled: true, reason: 'ANTHROPIC_API_KEY not set' });
  }
  const key = `${id}:${profileSig(profile)}`;
  if (!force) {
    const hit = deepDiveCache.get(key);
    if (hit) return res.json({ explainer: hit, cached: true });
  }
  try {
    const explainer = await deepDivePaper(paper, profile);
    deepDiveCache.set(key, explainer);
    return res.json({ explainer, cached: false });
  } catch (err) {
    return res.json({ explainer: floor, cached: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// Cockpit-local staged cross-link suggestions (NOT written to the vault — see ADR-0004).
papersRouter.get('/api/papers/suggestions', async (_req, res) => {
  try {
    res.json({ suggestions: await listSuggestions() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

papersRouter.post('/api/papers/suggestions', async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  if (typeof b.paperId !== 'string' || typeof b.nodeKey !== 'string') {
    return res.status(400).json({ error: 'paperId and nodeKey are required' });
  }
  try {
    const suggestion = await stageSuggestion({
      paperId: b.paperId,
      paperTitle: typeof b.paperTitle === 'string' ? b.paperTitle : b.paperId,
      nodeKey: b.nodeKey,
      nodeLabel: typeof b.nodeLabel === 'string' ? b.nodeLabel : b.nodeKey,
      vaultPath: typeof b.vaultPath === 'string' ? b.vaultPath : undefined,
      rationale: typeof b.rationale === 'string' ? b.rationale : undefined,
    });
    res.json({ suggestion });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

papersRouter.delete('/api/papers/suggestions/:id', async (req, res) => {
  try {
    const ok = await dismissSuggestion(req.params.id);
    res.json({ dismissed: ok });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
