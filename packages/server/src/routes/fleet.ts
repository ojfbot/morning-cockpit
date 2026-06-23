import { Router } from 'express';
import type { CockpitSnapshot, Liveness, RepoCard, WorkItem } from '@cockpit/shared';
import { buildSnapshot } from '../aggregate.js';
import {
  CRITICAL_CHAINS,
  CRITICAL_INTRO,
  CRITICAL_NOTE,
  DELIVERY_MILESTONES,
  DELIVERY_PROGRESS,
  NEXT_MOVES,
  REPO_META,
} from '../fleet-config.js';

/**
 * Fleet (01) + Delivery (03) read-models. Fleet merges editorial repo metadata with live signals
 * derived from the snapshot; liveness is a last-activity fallback (bead_events is empty — §0).
 */
export const fleetRouter: Router = Router();

const DAY = 86_400_000;

function livenessOf(lastActivity: string | null, now: number): Liveness {
  if (!lastActivity) return 'dark';
  const age = now - Date.parse(lastActivity);
  if (Number.isNaN(age)) return 'dark';
  if (age < DAY) return 'live';
  if (age < 30 * DAY) return 'stale';
  return 'dark';
}

function allItems(snap: CockpitSnapshot): WorkItem[] {
  return [...snap.lanes.overnight, ...snap.lanes.pickup, ...snap.lanes.available];
}

fleetRouter.get('/api/fleet', async (_req, res) => {
  try {
    const snap = await buildSnapshot();
    const now = Date.parse(snap.generatedAt) || Date.now();
    const items = allItems(snap);

    const repos: RepoCard[] = REPO_META.map((meta) => {
      const mine = items.filter((i) => i.repo === meta.name);
      const open = mine.filter((i) => i.status !== 'done');
      const lastActivity = mine.reduce<string | null>(
        (max, i) => (!max || i.activityAt > max ? i.activityAt : max),
        null,
      );
      return {
        name: meta.name,
        role: meta.role,
        phase: meta.phase,
        openCount: open.length,
        lastActivity,
        liveness: livenessOf(lastActivity, now),
        here: meta.name === 'morning-cockpit' || undefined,
      };
    });

    const totals = {
      repos: repos.length,
      openBeads: repos.reduce((n, r) => n + r.openCount, 0),
      live: repos.filter((r) => r.liveness === 'live').length,
      stale: repos.filter((r) => r.liveness === 'stale').length,
      dark: repos.filter((r) => r.liveness === 'dark').length,
    };

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

fleetRouter.get('/api/delivery', (_req, res) => {
  res.json({
    generatedAt: new Date().toISOString(),
    progress: DELIVERY_PROGRESS,
    milestones: DELIVERY_MILESTONES,
    nextMoves: NEXT_MOVES,
  });
});
