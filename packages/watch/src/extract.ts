/**
 * Full-text extraction — the load-bearing step (plan D1, p_revise 0.8).
 *
 * WHY THIS EXISTS AT ALL: the acceptance-test item's feed <description> is 54 bytes — the
 * title, repeated. Scoring or summarizing from that is scoring from the title, which the
 * Stage-1 handoff names as a failure mode that both misses and fabricates. So the body must
 * be fetched.
 *
 * WHY IT IS A TAG-STRIPPER AND NOT A BROWSER: claude.com articles are server-rendered plain
 * HTML (~28k chars, no __NEXT_DATA__, no app-router flight payload). A headless browser
 * would be a large dependency bought for nothing.
 *
 * The hard part is not fetching, it is discarding the site chrome: raw text off a claude.com
 * page opens with the whole product nav ("Claude by Anthropic Meet Claude Products …"). If
 * that leaks into the model's context it reads as content and pollutes every dimension.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export type TextQuality = 'full' | 'thin';

export interface Extraction {
  text: string;
  quality: TextQuality;
  chars: number;
}

/** Below this, an extraction is chrome or an error page, not an article. */
export const MIN_ARTICLE_CHARS = 400;

const DROP_ELEMENTS = ['script', 'style', 'noscript', 'template', 'svg', 'nav', 'header', 'footer', 'aside', 'form'];

function stripElements(html: string): string {
  let out = html;
  for (const tag of DROP_ELEMENTS) {
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), ' ');
    // Unclosed/self-closing variants.
    out = out.replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), ' ');
  }
  return out.replace(/<!--[\s\S]*?-->/g, ' ');
}

/** Prefer the semantic content container when the page offers one. */
function mainRegion(html: string): string {
  for (const tag of ['article', 'main']) {
    const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(html);
    // Guard against an empty shell <main> on a JS-rendered page.
    if (m?.[1] && m[1].length > 500) return m[1];
  }
  return html;
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–',
  hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
};

function unescapeHtml(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

/**
 * HTML → article prose. Block-level tags become newlines so paragraph structure survives,
 * which matters: the model reads this and a single 20k-char run-on is much worse context.
 */
export function extractText(html: string): string {
  let s = stripElements(html);
  s = mainRegion(s);
  s = s.replace(/<\/(p|div|section|h[1-6]|li|tr|blockquote|pre)>/gi, '\n');
  s = s.replace(/<(br|hr)\b[^>]*\/?>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = unescapeHtml(s);
  s = s.replace(/[ \t ]+/g, ' ');
  s = s.replace(/\n\s*\n\s*\n+/g, '\n\n');
  return s
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .trim();
}

function cachePath(url: string): string {
  const sha = createHash('sha1').update(url).digest('hex');
  return resolve(here, '../.data/text', `${sha}.txt`);
}

/**
 * Fetch and extract an article body, caching on disk so re-scoring never refetches.
 *
 * Degrades rather than throws: a fetch failure or a too-short extraction falls back to the
 * feed's own summary and is flagged `thin`, so the scorer knows it is reasoning from
 * metadata and can be judged accordingly.
 */
export async function fetchArticleText(
  url: string,
  fallback: string,
  opts: { userAgent: string; timeoutMs: number; useCache?: boolean },
): Promise<Extraction> {
  const thin = (): Extraction => {
    const t = fallback.trim();
    return { text: t, quality: 'thin', chars: t.length };
  };
  if (!url) return thin();

  const cache = cachePath(url);
  if (opts.useCache !== false) {
    try {
      const cached = readFileSync(cache, 'utf8');
      if (cached.length >= MIN_ARTICLE_CHARS) {
        return { text: cached, quality: 'full', chars: cached.length };
      }
    } catch {
      /* cold cache — fetch below */
    }
  }

  let html: string;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        redirect: 'follow',
        headers: { 'User-Agent': opts.userAgent, Accept: 'text/html,application/xhtml+xml' },
      });
      if (!res.ok) return thin();
      const ctype = res.headers.get('content-type') ?? '';
      if (!/html|xml|text\/plain/i.test(ctype)) return thin();
      html = await res.text();
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return thin();
  }

  const text = extractText(html);
  if (text.length < MIN_ARTICLE_CHARS) return thin();

  try {
    mkdirSync(dirname(cache), { recursive: true });
    writeFileSync(cache, text, 'utf8');
  } catch {
    /* cache is an optimization, never a requirement */
  }
  return { text, quality: 'full', chars: text.length };
}
