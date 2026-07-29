/**
 * The seen-items ledger (ADR-0016) — better-sqlite3, matching the house convention in
 * selfco-box. This is the repo's first persistent store; it holds only what cannot be
 * regenerated from the feeds, namely "have I already surfaced this".
 */

import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScoreBreakdown } from './rank.js';

export interface SeenItem {
  id: string;
  source: string;
  url: string;
  title: string;
  publishedAt?: string;
  firstSeen: string;
  score?: number;
  stagedToNotion: boolean;
}

export interface RunRecord {
  startedAt: string;
  finishedAt?: string;
  status: 'started' | 'ok' | 'empty' | 'failed';
  feedsOk: number;
  feedsFailed: number;
  itemsNew: number;
  itemsStaged: number;
}

const here = dirname(fileURLToPath(import.meta.url));

export function defaultDbPath(): string {
  return resolve(here, '../.data/watch.sqlite');
}

export class Ledger {
  private db: Database.Database;

  constructor(path = defaultDbPath()) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(readFileSync(resolve(here, '../schema.sql'), 'utf8'));
  }

  /** Which of these ids the ledger has already recorded. */
  seenIds(ids: string[]): Set<string> {
    if (ids.length === 0) return new Set();
    const out = new Set<string>();
    // Chunked to stay clear of SQLite's variable limit on a large first backfill.
    for (let i = 0; i < ids.length; i += 500) {
      const chunk = ids.slice(i, i + 500);
      const placeholders = chunk.map(() => '?').join(',');
      const rows = this.db
        .prepare(`SELECT id FROM seen_items WHERE id IN (${placeholders})`)
        .all(...chunk) as { id: string }[];
      for (const r of rows) out.add(r.id);
    }
    return out;
  }

  record(item: SeenItem): void {
    this.db
      .prepare(
        `INSERT INTO seen_items (id, source, url, title, published_at, first_seen, score, staged_to_notion)
         VALUES (@id, @source, @url, @title, @publishedAt, @firstSeen, @score, @stagedToNotion)
         ON CONFLICT(id) DO UPDATE SET score = COALESCE(excluded.score, seen_items.score)`,
      )
      .run({
        id: item.id,
        source: item.source,
        url: item.url,
        title: item.title,
        publishedAt: item.publishedAt ?? null,
        firstSeen: item.firstSeen,
        score: item.score ?? null,
        stagedToNotion: item.stagedToNotion ? 1 : 0,
      });
  }

  recordScore(itemId: string, s: ScoreBreakdown, meta: { provider: string; scoredAt: string }): void {
    this.db
      .prepare(
        `INSERT INTO scores (item_id, relevance, actionability, novelty, authority, composite,
                             rubric_version, provider, scored_at, why, text_quality)
         VALUES (@itemId, @relevance, @actionability, @novelty, @authority, @composite,
                 @rubricVersion, @provider, @scoredAt, @why, @textQuality)
         ON CONFLICT(item_id) DO UPDATE SET
           relevance = excluded.relevance, actionability = excluded.actionability,
           novelty = excluded.novelty, authority = excluded.authority,
           composite = excluded.composite, rubric_version = excluded.rubric_version,
           provider = excluded.provider, scored_at = excluded.scored_at,
           why = excluded.why, text_quality = excluded.text_quality`,
      )
      .run({
        itemId,
        relevance: s.relevance,
        actionability: s.actionability,
        novelty: s.novelty,
        authority: s.authority,
        composite: s.composite,
        rubricVersion: s.rubricVersion,
        provider: meta.provider,
        scoredAt: meta.scoredAt,
        why: s.why,
        textQuality: s.textQuality,
      });
  }

  startRun(startedAt: string): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO runs (started_at, status, feeds_ok, feeds_failed, items_new, items_staged)
         VALUES (?, 'started', 0, 0, 0, 0)`,
      )
      .run(startedAt);
  }

  finishRun(r: RunRecord): void {
    this.db
      .prepare(
        `UPDATE runs SET finished_at = @finishedAt, status = @status, feeds_ok = @feedsOk,
                         feeds_failed = @feedsFailed, items_new = @itemsNew, items_staged = @itemsStaged
         WHERE started_at = @startedAt`,
      )
      .run({
        startedAt: r.startedAt,
        finishedAt: r.finishedAt ?? new Date().toISOString(),
        status: r.status,
        feedsOk: r.feedsOk,
        feedsFailed: r.feedsFailed,
        itemsNew: r.itemsNew,
        itemsStaged: r.itemsStaged,
      });
  }

  close(): void {
    this.db.close();
  }
}
