/**
 * Feed fetching. Mirrors the fan-out discipline in packages/server/src/adapters/rss.ts:
 * Promise.allSettled so one bad feed degrades to a per-source error instead of taking down
 * the run, and errors are captured as data rather than thrown.
 */

import Parser from 'rss-parser';
import type { Source } from './sources.js';
import { itemId } from './canonical.js';

export interface FeedItem {
  /** Ledger dedup key. */
  id: string;
  title: string;
  url: string;
  sourceId: string;
  sourceTitle: string;
  authority: number;
  sourceClass: string;
  fetchFullText: boolean;
  author?: string;
  publishedAt?: string;
  /** Feed-provided summary. Often useless — 54 bytes on the acceptance item. */
  summary: string;
}

export interface FeedResult {
  source: Source;
  items: FeedItem[];
  error?: string;
}

export async function fetchFeeds(
  sources: Source[],
  opts: { userAgent: string; timeoutMs: number },
): Promise<FeedResult[]> {
  const parser = new Parser({
    timeout: opts.timeoutMs,
    headers: { 'User-Agent': opts.userAgent },
  });

  const settled = await Promise.allSettled(
    sources.map(async (source): Promise<FeedResult> => {
      try {
        const parsed = await parser.parseURL(source.feedUrl);
        const items: FeedItem[] = (parsed.items ?? []).flatMap((it) => {
          const url = it.link ?? '';
          const id = itemId(url, it.guid);
          if (!id) return [];
          const publishedAt =
            it.isoDate ?? (it.pubDate ? new Date(it.pubDate).toISOString() : undefined);
          return [
            {
              id,
              title: (it.title ?? '(untitled)').trim(),
              url,
              sourceId: source.id,
              sourceTitle: source.title,
              authority: source.authority,
              sourceClass: source.class,
              fetchFullText: source.fetchFullText,
              author: it.creator ?? (it as { author?: string }).author,
              publishedAt,
              summary: (it.contentSnippet ?? it.content ?? it.summary ?? '').trim(),
            },
          ];
        });
        return { source, items };
      } catch (err) {
        return { source, items: [], error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  return settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : { source: sources[i]!, items: [], error: String(s.reason) },
  );
}
