/**
 * Deterministic per-lane summaries — pure, offline, free. Computed from the structured
 * WorkItems so the cockpit always has a useful summary even with no LLM configured.
 * The Claude synthesis (server-side) returns the SAME LaneSummary shape with source:'claude'.
 */

import type { LaneSummary, WorkItem, WorkItemLane } from './work-item.js';

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function countBy<T>(items: T[], key: (t: T) => string | undefined): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** "core (3), shell (2), asset-foundry (1)" — top repos by count. */
function repoBreakdown(items: WorkItem[], limit = 4): string[] {
  const byRepo = [...countBy(items, (i) => i.repo).entries()].sort((a, b) => b[1] - a[1]);
  return byRepo.slice(0, limit).map(([repo, n]) => `${repo}: ${n}`);
}

function stalest(items: WorkItem[]): WorkItem | undefined {
  return [...items].sort((a, b) => (b.staleDays ?? 0) - (a.staleDays ?? 0))[0];
}

const EMPTY: Record<WorkItemLane, Omit<LaneSummary, 'lane' | 'source'>> = {
  overnight: {
    headline: 'Quiet night — no fresh activity.',
    bullets: ['No PRs merged, no convoys or sessions ran in the window.'],
    action: 'Nothing to rescue. Move to Pickup.',
  },
  pickup: {
    headline: 'Nothing flagged for pickup.',
    bullets: ['No open briefs, priorities, or review-ready PRs.'],
    action: 'Check the Available queue for something to start.',
  },
  available: {
    headline: 'The queue is empty.',
    bullets: ['No unclaimed work surfaced (no real unassigned pool exists yet — see ADR-0002).'],
    action: 'Nothing to claim. File work as briefs or issues to populate this lane.',
  },
};

export function summarizeLane(lane: WorkItemLane, items: WorkItem[]): LaneSummary {
  const base = { lane, source: 'deterministic' as const };
  if (items.length === 0) return { ...base, ...EMPTY[lane] };

  const repos = repoBreakdown(items);
  const top = stalest(items);
  const staleCount = items.filter((i) => i.status === 'stale').length;

  if (lane === 'overnight') {
    const byKind = countBy(items, (i) => i.kind);
    const failed = items.filter((i) => i.status === 'failed').length;
    const running = items.filter((i) => i.status === 'running').length;
    const bullets = [...byKind.entries()].map(([kind, n]) => plural(n, kind.replace('_', ' ')));
    if (failed) bullets.unshift(`⚠ ${plural(failed, 'item')} failed`);
    bullets.push(`across ${repos.join(', ')}`);
    const action = failed
      ? 'Investigate the failed work first, then skim the rest.'
      : running
        ? 'Check in on the running work; the completed items are informational.'
        : 'Informational — skim what landed, then move to Pickup.';
    return { ...base, headline: `${plural(items.length, 'item')} active or completed since last evening.`, bullets, action };
  }

  if (lane === 'pickup') {
    const briefs = items.filter((i) => i.kind === 'brief').length;
    const prs = items.filter((i) => i.kind === 'pull_request').length;
    const bullets: string[] = [];
    if (briefs) bullets.push(`${plural(briefs, 'open brief')} awaiting a response`);
    if (prs) bullets.push(`${plural(prs, 'PR')} ready for review`);
    bullets.push(`by repo — ${repos.join(', ')}`);
    if (top) bullets.push(`oldest: "${top.title}"${top.staleDays ? ` (${top.staleDays}d)` : ''}`);
    const action =
      top && (top.staleDays ?? 0) >= 14
        ? `Clear the ${top.staleDays}d-old item before it rots; then take the freshest brief.`
        : 'Start with the freshest brief and work down.';
    return { ...base, headline: `${plural(items.length, 'item')} need your attention today.`, bullets, action };
  }

  // available
  const bullets = [`by repo — ${repos.join(', ')}`];
  if (top) bullets.push(`oldest: "${top.title}"${top.staleDays ? ` (${top.staleDays}d stale)` : ''}`);
  const allStale = staleCount === items.length;
  const action = allStale
    ? `All ${items.length} are past the staleness threshold — triage or close to clear the queue.`
    : staleCount
      ? `${plural(staleCount, 'item')} stale — triage those; the rest are pickable.`
      : 'Pick the freshest item and claim it.';
  const headline = `${plural(items.length, 'unclaimed item')}${staleCount ? `, ${staleCount} stale` : ''}.`;
  return { ...base, headline, bullets, action };
}
