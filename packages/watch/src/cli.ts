/**
 * `pnpm watch:poll` — the Stage-1 pipeline, end to end.
 *
 *   feeds → dedup vs ledger → window → prefilter → fetch full text → score → shortlist → disk
 *
 * THE RELAY BOUNDARY (plan D4) IS THE LAST LINE OF THIS FILE. This process writes a staged
 * JSON shortlist and stops. Notion inbox writes, bead-provenance stamping, and brief
 * rendering belong to the chat session. There is deliberately no Notion client, no Notion
 * credential, and no @notionhq dependency anywhere in this package.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRegistry, sourcesFor } from './sources.js';
import { fetchFeeds } from './fetch.js';
import { fetchArticleText, MIN_ARTICLE_CHARS, type Extraction } from './extract.js';
import { loadVocabulary, prefilter } from './prefilter.js';
import { DEFAULT_SCORER, loadFleetProse, scoreCandidate } from './score.js';
import { shortlist, THRESHOLD, THIN_CEILING, MAX_ITEMS, type Ranked } from './rank.js';
import { Ledger, type RunRecord } from './ledger.js';
import type { FeedItem } from './fetch.js';

const here = dirname(fileURLToPath(import.meta.url));

interface Args {
  since: string;
  /** Upper bound on publish date. Lets a past day be replayed exactly. */
  until?: string;
  dryRun: boolean;
  limit: number;
  json: boolean;
  candidates: number;
  /** Overall wall-clock budget for the scoring loop, in minutes. */
  deadlineMins: number;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    if (i !== -1 && argv[i + 1] && !argv[i + 1]!.startsWith('--')) return argv[i + 1];
    const eq = argv.find((a) => a.startsWith(`--${name}=`));
    return eq ? eq.slice(name.length + 3) : undefined;
  };
  return {
    since: get('since') ?? '7d',
    until: get('until'),
    dryRun: argv.includes('--dry-run'),
    limit: Number(get('limit') ?? MAX_ITEMS),
    json: argv.includes('--json'),
    candidates: Number(get('candidates') ?? 25),
    deadlineMins: Number(get('deadline-mins') ?? 25),
  };
}

/** `7d` / `30d` / `48h` / an ISO date. */
export function resolveSince(spec: string, now: Date): Date {
  const rel = /^(\d+)([dh])$/i.exec(spec.trim());
  if (rel) {
    const n = Number(rel[1]);
    const ms = rel[2]!.toLowerCase() === 'd' ? n * 86_400_000 : n * 3_600_000;
    return new Date(now.getTime() - ms);
  }
  const parsed = Date.parse(spec);
  if (Number.isNaN(parsed)) throw new Error(`--since: cannot parse "${spec}" (use 7d, 48h, or an ISO date)`);
  return new Date(parsed);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const now = new Date();
  const since = resolveSince(args.since, now);
  // `--until` replays a past day: recency ranking is computed as of that moment, so a run can
  // be reproduced exactly as it would have looked then. Without it, "would this have caught
  // the post on the day it shipped?" is not a question the tool can answer.
  const until = args.until ? resolveSince(args.until, now) : undefined;
  const asOf = until ?? now;
  const startedAt = now.toISOString();

  const registry = loadRegistry();
  const sources = sourcesFor(registry, 'watch');
  const vocab = loadVocabulary();
  const fleet = loadFleetProse();

  // --dry-run touches nothing persistent, including the run ledger: a dry run is a rehearsal,
  // and recording it as a run would make the `runs` table lie about what the scheduler did.
  const ledger = new Ledger();
  if (!args.dryRun) ledger.startRun(startedAt);
  const run: RunRecord = {
    startedAt,
    status: 'started',
    feedsOk: 0,
    feedsFailed: 0,
    itemsNew: 0,
    itemsStaged: 0,
  };

  try {
    const results = await fetchFeeds(sources, {
      userAgent: registry.defaults.userAgent,
      timeoutMs: registry.defaults.fetchTimeoutMs,
    });
    run.feedsOk = results.filter((r) => !r.error).length;
    run.feedsFailed = results.filter((r) => r.error).length;

    for (const r of results) {
      if (r.error) process.stderr.write(`  ! ${r.source.id}: ${r.error}\n`);
    }

    // In-window, then not-already-seen. Dedup within the batch too — the same story can
    // arrive from more than one mirror in a single run.
    const inWindow = results.flatMap((r) => r.items).filter((i) => {
      if (!i.publishedAt) return false;
      const t = Date.parse(i.publishedAt);
      return t >= since.getTime() && (until ? t <= until.getTime() : true);
    });

    const byId = new Map<string, FeedItem>();
    for (const i of inWindow) if (!byId.has(i.id)) byId.set(i.id, i);

    const seen = ledger.seenIds([...byId.keys()]);
    const fresh = [...byId.values()].filter((i) => !seen.has(i.id));
    run.itemsNew = fresh.length;

    process.stderr.write(
      `feeds ${run.feedsOk}/${sources.length} ok · ${inWindow.length} in window ${since.toISOString().slice(0, 10)}${until ? `..${until.toISOString().slice(0, 10)}` : ''} · ${fresh.length} new\n`,
    );

    const candidates = prefilter(fresh, vocab, asOf, args.candidates);
    if (candidates.length < fresh.length) {
      // Never a silent cap.
      process.stderr.write(
        `prefilter: scoring top ${candidates.length} of ${fresh.length} (${fresh.length - candidates.length} not scored)\n`,
      );
    }

    const ranked: Ranked<{ item: FeedItem; extraction: Extraction }>[] = [];
    let degraded = 0;
    let thin = 0;

    /**
     * Own our own deadline rather than letting the launchd wrapper's watchdog SIGKILL us.
     *
     * The wrapper is a backstop, and a backstop kill is destructive here: it skips the
     * `finally` that closes the run row, so `runs` is left stuck at 'started', no shortlist is
     * staged, and — worst — the items already scored are committed to `seen_items`, so they
     * are no longer "new" tomorrow and never reach a brief at all. Scoring 25 candidates at
     * the 300s per-item timeout can exceed any sane watchdog, so we stop early on our own
     * terms and still produce a brief from what we have.
     */
    const deadline = Date.now() + args.deadlineMins * 60_000;
    let abandoned = 0;

    for (const c of candidates) {
      if (Date.now() > deadline) {
        abandoned = candidates.length - ranked.length;
        break;
      }
      // `quality` describes how much text we actually have, NOT which code path produced it.
      // A changelog entry whose feed carries the whole release note is not "thin"; a commit
      // subject line is, however we got it.
      const extraction: Extraction = c.item.fetchFullText
        ? await fetchArticleText(c.item.url, c.item.summary, {
            userAgent: registry.defaults.userAgent,
            timeoutMs: registry.defaults.fetchTimeoutMs * 3,
          })
        : {
            text: c.item.summary,
            quality: c.item.summary.length >= MIN_ARTICLE_CHARS ? 'full' : 'thin',
            chars: c.item.summary.length,
          };

      const { score, provider } = await scoreCandidate(c, extraction, fleet, DEFAULT_SCORER);
      ranked.push({ item: { item: c.item, extraction }, score });
      if (provider === 'deterministic') degraded++;
      if (score.textQuality === 'thin') thin++;

      if (!args.dryRun) {
        ledger.record({
          id: c.item.id,
          source: c.item.sourceId,
          url: c.item.url,
          title: c.item.title,
          publishedAt: c.item.publishedAt,
          firstSeen: startedAt,
          score: score.composite,
          stagedToNotion: false,
        });
        ledger.recordScore(c.item.id, score, { provider, scoredAt: new Date().toISOString() });
      }
    }

    const top = shortlist(ranked, args.limit);
    run.itemsStaged = top.length;

    if (abandoned > 0) {
      // Never a silent cap — an abandoned tail is indistinguishable from "nothing else
      // qualified" unless it is stated.
      process.stderr.write(
        `! deadline (${args.deadlineMins}m) reached — ${abandoned} candidate(s) never scored.\n` +
          `  They stay unrecorded, so they are still 'new' on the next run. Raise --deadline-mins\n` +
          `  or lower --candidates if this recurs.\n`,
      );
    }

    // A run where the local model was unreachable degrades to the deterministic floor and
    // produces a thin, low-scoring brief that looks exactly like a quiet news day. Say so.
    if (degraded > 0) {
      process.stderr.write(
        `! ${degraded}/${ranked.length} scored by the DETERMINISTIC FLOOR (local model unavailable or unparseable).\n` +
          `  Scores are blunt and the brief may be empty for that reason, not because nothing shipped.\n`,
      );
    }
    if (thin > 0) {
      process.stderr.write(
        `! ${thin}/${ranked.length} scored from feed metadata only — capped at ${THIN_CEILING} (see ADR-0017)\n`,
      );
    }

    // Every scored item, not just the survivors. A shortlist alone cannot tell you whether
    // something you expected to see was missed or merely ranked low, and that distinction is
    // the whole debugging surface of a ranker.
    process.stderr.write(`\n--- all ${ranked.length} scored ---\n`);
    for (const r of [...ranked].sort((a, b) => b.score.composite - a.score.composite)) {
      const s = r.score;
      const flags = [s.flooredUp ? 'floor' : '', s.thinCapped ? 'thin-cap' : '']
        .filter(Boolean)
        .join(',');
      process.stderr.write(
        `  ${s.composite.toFixed(2)}  r${s.relevance.toFixed(1)} a${s.actionability.toFixed(1)} n${s.novelty.toFixed(1)} A${s.authority.toFixed(1)}  ${s.textQuality.padEnd(4)} ${flags.padEnd(9)} ${r.item.item.title.slice(0, 64)}\n`,
      );
    }
    process.stderr.write('\n');

    const payload = {
      generatedAt: startedAt,
      since: since.toISOString(),
      rubricThreshold: THRESHOLD,
      feedsOk: run.feedsOk,
      feedsFailed: run.feedsFailed,
      itemsNew: run.itemsNew,
      itemsScored: ranked.length,
      items: top.map((r) => ({
        id: r.item.item.id,
        title: r.item.item.title,
        url: r.item.item.url,
        source: r.item.item.sourceTitle,
        publishedAt: r.item.item.publishedAt,
        why: r.score.why,
        score: Number(r.score.composite.toFixed(3)),
        dimensions: {
          relevance: r.score.relevance,
          actionability: r.score.actionability,
          novelty: r.score.novelty,
          authority: r.score.authority,
        },
        flooredUp: r.score.flooredUp,
        textQuality: r.score.textQuality,
        rubricVersion: r.score.rubricVersion,
      })),
    };

    if (args.json) {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    } else {
      process.stdout.write(`\n${top.length} item${top.length === 1 ? '' : 's'} above ${THRESHOLD}:\n\n`);
      for (const [n, r] of top.entries()) {
        const s = r.score;
        process.stdout.write(`${n + 1}. ${r.item.item.title}\n`);
        process.stdout.write(`   ${r.item.item.sourceTitle} · ${r.item.item.publishedAt?.slice(0, 10) ?? 'undated'} · ${r.item.item.url}\n`);
        process.stdout.write(`   ${s.why}\n`);
        process.stdout.write(
          `   score ${s.composite.toFixed(2)}  (rel ${s.relevance.toFixed(2)} · act ${s.actionability.toFixed(2)} · nov ${s.novelty.toFixed(2)} · auth ${s.authority.toFixed(2)})${s.flooredUp ? '  [actionability floor]' : ''}  text: ${s.textQuality}\n\n`,
        );
      }
      if (top.length === 0) process.stdout.write('  (nothing cleared the threshold)\n\n');
    }

    // ---- RELAY BOUNDARY: staged to disk, and that is where this process stops. ----
    if (!args.dryRun) {
      const dir = resolve(here, '../.data/staged');
      mkdirSync(dir, { recursive: true });
      const out = resolve(dir, `${startedAt.slice(0, 10)}-shortlist.json`);
      writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
      process.stderr.write(`staged → ${out}\n`);
    }

    run.status = run.feedsOk === 0 ? 'failed' : top.length === 0 ? 'empty' : 'ok';
    return run.feedsOk === 0 ? 1 : 0;
  } catch (err) {
    run.status = 'failed';
    process.stderr.write(`watch: ${err instanceof Error ? err.message : String(err)}\n`);
    return 1;
  } finally {
    if (!args.dryRun) ledger.finishRun(run);
    ledger.close();
  }
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`watch: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  },
);
