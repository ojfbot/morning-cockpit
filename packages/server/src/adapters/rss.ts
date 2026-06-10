import Parser from 'rss-parser';
import {
  isNewSince,
  readingCutoff,
  type AdapterHealth,
  type ReadingItem,
  type ReadingSource,
} from '@cockpit/shared';
import { config } from '../config.js';

/**
 * Read-only RSS adapter. Fetches each curated feed with a timeout + User-Agent, fanning out
 * with Promise.allSettled so one bad feed degrades to a per-source error instead of crashing
 * the section. Items are normalized and flagged new within the freshness window.
 */

const parser = new Parser({
  timeout: config.reading.fetchTimeoutMs,
  headers: { 'User-Agent': 'morning-cockpit/0.1 (+local read-model)' },
});

interface FeedConfig {
  title: string;
  feedUrl: string;
  siteUrl?: string;
  tier?: string;
}

async function fetchOne(feed: FeedConfig, cutoff: string): Promise<ReadingSource> {
  try {
    const parsed = await parser.parseURL(feed.feedUrl);
    const items: ReadingItem[] = (parsed.items ?? [])
      .map((it) => {
        const url = it.link ?? '';
        const publishedAt = it.isoDate ?? (it.pubDate ? new Date(it.pubDate).toISOString() : undefined);
        return {
          id: `${feed.title}:${url || it.guid || it.title || ''}`,
          title: it.title ?? '(untitled)',
          url,
          source: feed.title,
          author: it.creator ?? (it as { author?: string }).author,
          publishedAt,
          isNew: isNewSince(publishedAt, cutoff),
        } satisfies ReadingItem;
      })
      .sort((a, b) => Date.parse(b.publishedAt ?? '') - Date.parse(a.publishedAt ?? ''))
      .slice(0, config.reading.perSource);
    return { title: feed.title, feedUrl: feed.feedUrl, siteUrl: feed.siteUrl, tier: feed.tier, items };
  } catch (err) {
    return {
      title: feed.title,
      feedUrl: feed.feedUrl,
      siteUrl: feed.siteUrl,
      tier: feed.tier,
      items: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function fetchReading(
  now = new Date(),
): Promise<{ since: string; sources: ReadingSource[]; health: AdapterHealth }> {
  const cutoff = readingCutoff(now, config.reading.sinceHours);
  const settled = await Promise.allSettled(config.reading.feeds.map((f) => fetchOne(f, cutoff)));

  const sources: ReadingSource[] = settled.map((s, i) => {
    if (s.status === 'fulfilled') return s.value;
    const f = config.reading.feeds[i]!;
    return { title: f.title, feedUrl: f.feedUrl, siteUrl: f.siteUrl, tier: f.tier, items: [], error: String(s.reason) };
  });

  const failed = sources.filter((s) => s.error).length;
  const newCount = sources.reduce((n, s) => n + s.items.filter((i) => i.isNew).length, 0);
  const health: AdapterHealth = {
    name: 'reading',
    status: failed === 0 ? 'up' : failed === sources.length ? 'down' : 'degraded',
    itemCount: newCount,
    note: `${sources.length} feeds · ${newCount} new in ${config.reading.sinceHours}h${failed ? ` · ${failed} unreachable` : ''}`,
  };
  return { since: cutoff, sources, health };
}
