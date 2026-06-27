import type { CockpitSnapshot, Liveness, RepoCard, WorkItem } from '@cockpit/shared';
import { REPO_META } from './fleet-config.js';

/**
 * Fleet repo-card derivation — extracted from `routes/fleet.ts` so the REST route AND the GraphQL
 * `fleet` resolver call ONE code path (G1). Parity between REST and GraphQL is therefore structural,
 * not just test-asserted. Pure + clock-injected.
 */

const DAY = 86_400_000;

export function livenessOf(lastActivity: string | null, now: number): Liveness {
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

export function deriveFleet(snap: CockpitSnapshot, now: number): RepoCard[] {
  const items = allItems(snap);
  return REPO_META.map((meta) => {
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
}

export function fleetTotals(repos: RepoCard[]): {
  repos: number;
  openBeads: number;
  live: number;
  stale: number;
  dark: number;
} {
  return {
    repos: repos.length,
    openBeads: repos.reduce((n, r) => n + r.openCount, 0),
    live: repos.filter((r) => r.liveness === 'live').length,
    stale: repos.filter((r) => r.liveness === 'stale').length,
    dark: repos.filter((r) => r.liveness === 'dark').length,
  };
}
