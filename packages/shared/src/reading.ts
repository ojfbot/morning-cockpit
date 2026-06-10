/**
 * Reading context — curated RSS feeds surfaced as a distinct cockpit section.
 * Read-only v1: "new since a cutoff" via published timestamps; no read/unread state.
 */

import type { AdapterHealth, SynthSummary } from './work-item.js';

export interface ReadingItem {
  /** `${source}:${url}` — stable id. */
  id: string;
  title: string;
  url: string;
  /** Source title (e.g. "Simon Willison"). */
  source: string;
  author?: string;
  publishedAt?: string;
  /** Published within the freshness window. */
  isNew: boolean;
}

export interface ReadingSource {
  title: string;
  feedUrl: string;
  siteUrl?: string;
  tier?: string;
  items: ReadingItem[];
  /** Set if this feed failed to fetch/parse — the section still renders the rest. */
  error?: string;
}

export interface ReadingSnapshot {
  generatedAt: string;
  /** ISO cutoff: items at/after this are flagged new. */
  since: string;
  sources: ReadingSource[];
  health: AdapterHealth[];
  /** Deterministic digest floor; the LLM digest is fetched separately (like lane summaries). */
  digest: SynthSummary;
}

/** Cutoff for "new" — `now - sinceHours`. Pure, for testability. */
export function readingCutoff(now: Date, sinceHours: number): string {
  return new Date(now.getTime() - sinceHours * 3_600_000).toISOString();
}

/** Whether an item's publish time is at/after the cutoff. Missing/garbage dates → not new. */
export function isNewSince(publishedAt: string | undefined, cutoffIso: string): boolean {
  if (!publishedAt) return false;
  const t = Date.parse(publishedAt);
  const c = Date.parse(cutoffIso);
  if (Number.isNaN(t) || Number.isNaN(c)) return false;
  return t >= c;
}

/** Deterministic digest floor — always available, no model required. */
export function readingDigestFloor(sources: ReadingSource[]): SynthSummary {
  const withItems = sources.filter((s) => s.items.length > 0);
  const newItems = sources.flatMap((s) => s.items.filter((i) => i.isNew));
  const failed = sources.filter((s) => s.error);

  if (newItems.length === 0) {
    return {
      source: 'deterministic',
      headline: 'No new posts in the window.',
      bullets: [
        `${withItems.length} feeds checked${failed.length ? ` · ${failed.length} unreachable` : ''}.`,
      ],
      action: 'Nothing fresh to read right now.',
    };
  }

  const bySource = new Map<string, number>();
  for (const i of newItems) bySource.set(i.source, (bySource.get(i.source) ?? 0) + 1);
  const top = [...bySource.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const freshest = [...newItems].sort(
    (a, b) => Date.parse(b.publishedAt ?? '') - Date.parse(a.publishedAt ?? ''),
  )[0];

  return {
    source: 'deterministic',
    headline: `${newItems.length} new post${newItems.length === 1 ? '' : 's'} across ${bySource.size} source${bySource.size === 1 ? '' : 's'}.`,
    bullets: [
      ...top.map(([src, n]) => `${src}: ${n}`),
      ...(freshest ? [`freshest: "${freshest.title}" (${freshest.source})`] : []),
      ...(failed.length ? [`${failed.length} feed${failed.length === 1 ? '' : 's'} unreachable`] : []),
    ],
    action: freshest ? `Start with "${freshest.title}".` : 'Skim the newest first.',
  };
}
