/**
 * The free pass. Cuts the candidate set before any model runs, so a first backfill (201 items
 * in feed_claude.xml alone) does not turn into 201 local LLM calls.
 *
 * This is a RANKER, not a judge — it decides who gets scored, never what the score is. The
 * vocabulary lists live in fleet-profile.md so the operator can tune them without touching
 * code, and so the file that explains the fleet to the model is the same file that filters
 * for it.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FeedItem } from './fetch.js';
import { repoRoot } from './sources.js';

export interface Vocabulary {
  highSignal: string[];
  lowSignal: string[];
}

/** Read the `### high-signal` / `### low-signal` lists out of fleet-profile.md. */
export function parseVocabulary(markdown: string): Vocabulary {
  const section = (name: string): string[] => {
    const re = new RegExp(`###\\s+${name}\\s*\\n([\\s\\S]*?)(?=\\n#{2,3}\\s|$)`, 'i');
    const body = re.exec(markdown)?.[1] ?? '';
    return body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('<!--'))
      .map((l) => l.toLowerCase());
  };
  return { highSignal: section('high-signal'), lowSignal: section('low-signal') };
}

export function loadVocabulary(path = resolve(repoRoot(), 'fleet-profile.md')): Vocabulary {
  return parseVocabulary(readFileSync(path, 'utf8'));
}

export interface Candidate {
  item: FeedItem;
  prefilterRank: number;
  hits: string[];
  /**
   * Why it made the cut. 'rank' = keyword/authority merit. 'unjudgeable' = admitted by the
   * reserve because there was no text to judge it on.
   */
  admittedBy: 'rank' | 'unjudgeable';
}

/**
 * A feed summary shorter than this carries no judgeable information.
 *
 * MEASURED, not guessed (2026-07-28, 30-day window): Claude blog averages 65 summary chars,
 * Anthropic news 51, Anthropic research 66, and the Claude Code changelog exactly 0. Only
 * Simon Willison (4290) ships real summaries. 88 of 136 high-authority items in a 30-day
 * window are effectively blank.
 */
export const BLIND_SUMMARY_CHARS = 120;

/** Authority at or above which a blind item is worth spending a read on. */
export const RESERVE_AUTHORITY = 0.9;

/** Share of the candidate budget reserved for unjudgeable high-authority items. */
export const RESERVE_SHARE = 0.6;

/**
 * Rank a haystack of items. Scoring inputs, in order of weight:
 *   - source authority (an Anthropic first-party post outranks a practitioner blog)
 *   - high-signal vocabulary hits in the title (title hits count double — a term in the
 *     headline is a stronger claim about the subject than one buried in the body)
 *   - low-signal hits, which subtract
 *   - recency, as a mild tiebreak
 */
export function prefilter(
  items: FeedItem[],
  vocab: Vocabulary,
  now: Date,
  limit: number,
): Candidate[] {
  const scored = items.map((item) => {
    const title = item.title.toLowerCase();
    const body = `${title} ${item.summary.toLowerCase()}`;

    const hits: string[] = [];
    let signal = 0;
    for (const term of vocab.highSignal) {
      if (title.includes(term)) {
        signal += 2;
        hits.push(term);
      } else if (body.includes(term)) {
        signal += 1;
        hits.push(term);
      }
    }
    for (const term of vocab.lowSignal) {
      if (body.includes(term)) signal -= 2;
    }

    const ageDays = item.publishedAt
      ? Math.max(0, (now.getTime() - Date.parse(item.publishedAt)) / 86_400_000)
      : 30;
    const recency = Number.isFinite(ageDays) ? Math.max(0, 1 - ageDays / 30) : 0;

    const prefilterRank = item.authority * 3 + signal + recency;
    const candidate: Candidate = {
      item,
      prefilterRank,
      hits: [...new Set(hits)],
      admittedBy: 'rank',
    };
    return candidate;
  });

  const byRank = (a: Candidate, b: Candidate): number => b.prefilterRank - a.prefilterRank;
  const byRecency = (a: Candidate, b: Candidate): number =>
    Date.parse(b.item.publishedAt ?? '') - Date.parse(a.item.publishedAt ?? '');

  /**
   * Two pools, because keyword ranking is only meaningful where there are keywords to rank.
   *
   * The Anthropic first-party feeds ship near-empty summaries, so a vocabulary score over
   * title+summary is close to noise for exactly the sources this poller exists to watch. The
   * acceptance-test article scored ZERO hits and sorted 118th of 162 — invisible.
   *
   * Absence of evidence is not evidence of irrelevance. So high-authority items with no
   * judgeable text are admitted by RECENCY into reserved capacity, and the decision about
   * whether they matter is deferred to the scorer, which has actually read them. Items that
   * do carry text are ranked on it as before.
   */
  const isUnjudgeable = (c: Candidate): boolean =>
    c.item.authority >= RESERVE_AUTHORITY && c.item.summary.trim().length < BLIND_SUMMARY_CHARS;

  const reserveSlots = Math.min(limit, Math.ceil(limit * RESERVE_SHARE));
  const reserved = scored.filter(isUnjudgeable).sort(byRecency).slice(0, reserveSlots);
  for (const c of reserved) c.admittedBy = 'unjudgeable';

  const reservedIds = new Set(reserved.map((c) => c.item.id));
  const judgeable = scored.filter((c) => !reservedIds.has(c.item.id)).sort(byRank);
  const filled = judgeable.slice(0, limit - reserved.length);

  return [...reserved, ...filled].sort(byRank);
}
