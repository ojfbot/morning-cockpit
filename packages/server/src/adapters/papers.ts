import { normalizeHfDaily, type AdapterHealth, type PaperItem } from '@cockpit/shared';
import { config } from '../config.js';

/**
 * Read-only adapter over Hugging Face Daily Papers — community-curated, upvote-ranked trending
 * papers (abstracts included). One network call; failure degrades to an empty list + 'down'
 * health, never crashes the section (mirrors adapters/rss.ts).
 */
export async function fetchPapers(): Promise<{ papers: PaperItem[]; health: AdapterHealth }> {
  try {
    const res = await fetch(config.papers.hfDailyUrl, {
      headers: { 'User-Agent': 'morning-cockpit/0.1 (+local read-model)', Accept: 'application/json' },
      signal: AbortSignal.timeout(config.papers.fetchTimeoutMs),
    });
    if (!res.ok) throw new Error(`HF daily_papers HTTP ${res.status}`);
    const json: unknown = await res.json();
    const papers = normalizeHfDaily(json, config.papers.count);
    return {
      papers,
      health: {
        name: 'papers',
        status: papers.length > 0 ? 'up' : 'degraded',
        itemCount: papers.length,
        note: `HF Daily Papers · top ${papers.length} by upvotes`,
      },
    };
  } catch (err) {
    return {
      papers: [],
      health: {
        name: 'papers',
        status: 'down',
        itemCount: 0,
        lastError: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
