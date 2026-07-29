# morning-cockpit — Anthropic watch (Stage 1)

## Context

Thariq Shihipar's "A field guide to Claude Fable 5: Finding your unknowns" (claude.com/blog,
2026-07-06) reached the operator a week late, via an Instagram creator repackaging it. This
build watches Anthropic's technical output directly instead of waiting for the creator
ecosystem to relay it. Stage 1 only: verified feed polling, a seen-items ledger, a
multi-dimensional relevance scorer, a SKILL.md wrapper, launchd scheduling, and a merge quiz.

This is also the first live run of four harnesses — `voi-interview`, `revision-forecast`,
`deviation-log`, `merge-quiz`. Their artifacts (`actually_changed_plan` records, `p_revise`
tags, deviation entries, `quiz-log.jsonl`) are first-class deliverables, not paperwork.

**This file is the Gate-2 plan.** Step 1 of the build is to copy it to
`morning-cockpit/plan.md` and commit it, so the quiz subagent can be handed the same artifact
the operator approved.

---

## Gate 1 record — interview

Ten candidates generated, scored by expected architecture delta, top 3 surfaced. Everything
determinable by looking was looked up, not asked (repo exists and is pnpm/TS; Python 3.14.5;
Notion data_source_id `7b88b47f-cbc8-452d-ad03-c45006989db8`; existing `morning` and
`selfco-ingest` skills read).

| # | Question | Answer | `actually_changed_plan` |
|---|---|---|---|
| 1 | Python `scripts/poll.py` at root, vs a TS package in the existing pnpm monorepo, vs a new repo | TS package in the monorepo | **true** — replaces the handoff's entire deliverable tree and language |
| 2 | Does `sources.yaml` absorb the existing `config.ts` feeds + `reading.opml`, or stay parallel | Absorb — one source of truth | **true** — pulls the shipped Reading pod into scope and adds an ADR |
| 3 | Scorer provider: prefilter→Ollama, all-Ollama, or capped Claude | Prefilter, then Ollama | **true** — removes `claude -p` from the launchd job entirely |

Not asked (determinable, or answer would not have moved the architecture): ledger file
location (house convention is `.data/`, already gitignored); Node version (`.nvmrc` 24.11.1);
launchd key style (house pattern documented across four committed plists); whether the selfco
promoter is running (it is disabled, and Stage 1 stops at the disk boundary anyway).

---

## Source verification (done before planning)

Every `inferred` endpoint was fetched. **All returned 200 except one.**

**Acceptance test is winnable.** `feed_claude.xml` is live (`lastBuildDate` 2026-07-29, 201
items reaching back to 2023-08) and contains the target item:

```
title:   A field guide to Claude Fable 5: Finding your unknowns
link:    https://claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns
pubDate: Mon, 06 Jul 2026 00:00:00 +0000
```

Because the feed retains 201 items, the acceptance run is not window-constrained.

**Two findings that shape the build:**

1. **That item's `<description>` is 54 bytes — the title, repeated.** Full-text fetch is
   forced, not optional. Verified fetchable: the article is server-rendered plain HTML
   (~28k chars of text, no `__NEXT_DATA__`, no app-router flight data, no browser needed).
2. **The YouTube feed 404s.** `channel_id=UCrDwWp7EBBv4NwvScIpBDOA` is *correct* — confirmed
   against `"externalId"` on youtube.com/@anthropic-ai — but `videos.xml?channel_id=` returns
   404 under both a bot and a browser UA. The research doc verified the ID and inferred the
   feed. → `quarantine:`, with that reason recorded verbatim.

HN Algolia's exact query returns 200/360 hits but is noisy at `points>50` (top hits include
"Bento – an entire PowerPoint in one HTML file"). It ships **quarantined-by-default** with
`enabled: false` and a note; turning it on is a Stage-2 decision after the rubric is calibrated.

---

## Decisions (top of plan — most likely to be revised, first)

### D1 — Full-text extraction is the weakest link · `p_revise: 0.8`

The 28k chars fetched from a claude.com article include the whole site nav, footer, and
marketing chrome. Scoring quality depends entirely on stripping that down to article prose.

Approach: `packages/watch/src/extract.ts` — strip `<script>/<style>/<nav>/<header>/<footer>/<aside>`,
prefer `<article>` or `<main>` when present, then unescape and collapse whitespace; reject
extractions under 400 chars and fall back to feed `description` + title with the item flagged
`text_quality: 'thin'`. **No headless browser, no new heavy dependency.** Extracted text is
cached to `.data/text/<sha1>.txt` so re-scoring never refetches.

Golden test: the field-guide article must extract to ≥2,000 chars with the string
`Claude by Anthropic Meet Claude Products` (the nav run) **absent**.

### D2 — Rubric shape, and how boring-but-important wins · `p_revise: 0.6`

Four dimensions, each 0–1, scored by Ollama `qwen2.5:7b` against fetched text:
`relevance_to_fleet`, `actionability`, `novelty`, `source_authority`.

`source_authority` is **deterministic, not model-scored** — read from the source's `authority`
field in `sources.yaml`. Letting a 7b model rate the authority of its own inputs is a
self-grading loop with no ground truth.

Composite, weighted: `0.35·relevance + 0.30·actionability + 0.20·novelty + 0.15·authority`.

The handoff requires a quiet API deprecation to be able to outscore an exciting blog post.
Weighted-mean alone cannot do that — a deprecation scores low on novelty and often low on
relevance-to-fleet. So there is an explicit **actionability floor**:

```
if actionability >= 0.9 and authority >= 0.8:
    composite = max(composite, 0.7)
```

This is the most invented part of the build and gets a dedicated test: a synthetic
low-novelty/low-relevance/high-actionability item must clear the 0.6 threshold, and a
high-novelty/low-actionability item must not be able to reach 1.0.

Threshold `0.6`, hard cap **3** items. Rubric carries a `rubric_version` string, stored per
score row, so a re-tune is detectable rather than silent.

### D3 — `sources.yaml` schema, and how it absorbs the Reading pod · `p_revise: 0.4`

Repo root `sources.yaml`, one registry, with a `pods:` key as the absorb mechanism — each
surface selects the subset it consumes, so the shipped Reading pod keeps its exact behaviour
while stopping the drift.

```yaml
version: 1
defaults:
  user_agent: "morning-cockpit/0.1 (+local read-model)"
  fetch_timeout_ms: 8000
sources:
  - id: claude-blog
    title: Claude blog
    kind: rss
    feed_url: https://raw.githubusercontent.com/Olshansk/rss-feeds/main/feeds/feed_claude.xml
    site_url: https://claude.com/blog
    tier: anthropic-first-party
    authority: 1.0          # deterministic input to the rubric
    pods: [watch]
    fetch_full_text: true
    verified: 2026-07-28
  - id: simon-willison
    title: Simon Willison
    feed_url: https://simonwillison.net/atom/everything/
    tier: practitioner
    authority: 0.7
    pods: [watch, reading]  # consumed by BOTH surfaces — one entry, no drift
    verified: 2026-07-28
quarantine:
  - id: anthropic-youtube
    feed_url: https://www.youtube.com/feeds/videos.xml?channel_id=UCrDwWp7EBBv4NwvScIpBDOA
    reason: "HTTP 404 under bot and browser UA, 2026-07-28. channel_id is correct (confirmed
      via externalId on youtube.com/@anthropic-ai); the videos.xml endpoint does not serve
      this channel. No replacement URL invented."
    checked: 2026-07-28
  - id: hn-claude-code
    enabled: false
    reason: "Endpoint verified 200/360 hits, but points>50 returns off-topic stories.
      Precision problem, not availability. Enable in Stage 2 after rubric calibration."
```

`packages/server/src/config.ts` stops holding the hardcoded 12-feed array and reads
`pods: [reading]` from this file. `reading.opml` becomes **generated** —
`pnpm watch:opml` writes it — and its hand-maintained status ends.

*Follow the existing `config.ts` shape when mapping (`title`/`feedUrl`/`siteUrl`/`tier`) so
`adapters/rss.ts` and the Reading types need no change.*

### D4 — Relay boundary · `p_revise: 0.0`

This session's plane ends at disk. The poller writes
`packages/watch/.data/staged/<YYYY-MM-DD>-shortlist.json` and stops. **No Notion client, no
Notion credential, no `@notionhq` dependency enters this package.** Notion inbox writes,
bead-provenance stamping, and HTML brief rendering stay chat-side.

Worth stating plainly: the selfco promoter (`selfco-box`) is **disabled** — paused
2026-06-11 after a cloud-agent cost incident. Rows staged to Notion today will sit
unprocessed. That does not block Stage 1, which stops before Notion, but it means the
end-to-end "into the vault" story is not live and should not be described as if it were.

### D5 — Ledger schema · `p_revise: 0.2`

`packages/watch/.data/watch.sqlite` via `better-sqlite3` (house convention, matches
selfco-box; `.data/` is already gitignored). A **superset** of the handoff's specified
schema — `seen_items` keeps every specified column, including `score` as the composite.

```sql
CREATE TABLE IF NOT EXISTS seen_items (
  id               TEXT PRIMARY KEY,   -- canonical URL | arxiv:<id> | gh:<sha> | hn:<objectID>
  source           TEXT NOT NULL,
  url              TEXT NOT NULL,
  title            TEXT NOT NULL,
  published_at     TEXT,
  first_seen       TEXT NOT NULL,
  score            REAL,               -- composite
  staged_to_notion INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS scores (
  item_id     TEXT PRIMARY KEY REFERENCES seen_items(id),
  relevance REAL, actionability REAL, novelty REAL, authority REAL,
  composite REAL, rubric_version TEXT, provider TEXT, scored_at TEXT,
  why TEXT                              -- one line, grounded in fetched text
);
CREATE TABLE IF NOT EXISTS runs (
  started_at TEXT PRIMARY KEY, finished_at TEXT, status TEXT,
  feeds_ok INTEGER, feeds_failed INTEGER, items_new INTEGER, items_staged INTEGER
);
```

`runs` exists because of the lesson in `.handoff/20260618-brief-launchd-processes-panel.md`:
*a job can be loaded, exit 0, and do nothing.* A run that fetches zero feeds must be
distinguishable from one that found nothing new.

**Dedup** is URL canonicalization: lowercase host, drop `utm_*`/`ref`/`fbclid`, drop fragment,
strip trailing slash. `feed_claude.xml` sets `guid == link`, so URL is the right key. No
embeddings (explicitly deferred).

### D6 — Scheduling · `p_revise: 0.2`

`launchd/com.ojfbot.morning-cockpit-watch.plist`, committed in-repo, installed by `cp` +
`launchctl load -w` — the house pattern from `core/scripts/*-launchd.plist`.

**No `claude -p`.** Because scoring is Ollama-local, the job is a deterministic Node script;
an agentic headless run would add cost, nondeterminism, and an API key in the launchd env for
no gain. This deviates from the handoff's stated architecture and is logged as Deviation #1.

- `ProgramArguments`: `["/bin/bash", "/Users/yuri/ojfbot/morning-cockpit/scripts/watch-poll.sh"]`
- `StartCalendarInterval` **06:15 daily** — clear of 03:30 sync-telemetry, 03:45 audit,
  04:15 triager, 05:30 cultivate, and lands before the human morning
- No `RunAtLoad` (a reboot should not fire an extra run), no `KeepAlive`
- `WorkingDirectory` repo root; `StandardOutPath`/`StandardErrorPath` → `/tmp/morning-cockpit-watch.{log,err}`
- `EnvironmentVariables`: `PATH` + `HOME` only
- Wrapper resolves node via the fnm-alias rail (launchd's PATH is minimal), `set -euo pipefail`,
  every degradation path `exit 0`, and appends one JSON line per run to
  `~/.claude/morning-cockpit-watch.jsonl`

**Gate:** the plist is committed but **not installed** until two operator-triggered runs pass —
the house ritual from `trace-triager.sh`. A header comment says so.

### D7 — SKILL.md placement · `p_revise: 0.4`

`.claude/skills/anthropic-watch/SKILL.md`, not repo root. `name` must match the folder, and a
root SKILL.md would force `name: morning-cockpit` — which names the repo, not the skill, and
degrades the description field that does all the trigger work. Deviation #2.

`description` opens with "Use when…", states what it does and when to use it, no angle
brackets, body well under 500 lines.

### D8 — ADR placement · `p_revise: 0.2`

Repo convention is `decisions/adr/NNNN-slug.md` (14 existing, next is **0015**), not the
handoff's `docs/adr/`. Follow the repo. Deviation #3.

- `0015-sources-yaml-single-feed-registry.md`
- `0016-watch-store-and-scheduled-job.md` — the repo's first persistent store and first
  background process, an explicit carve-out to the read-only posture in CLAUDE.md that
  currently admits exactly one write path (ADR-0005)
- `0017-multidimensional-local-first-relevance.md`

---

## Build steps (mechanical)

1. Copy this file to `morning-cockpit/plan.md`; create `implementation-notes.md` with the
   three deviations above already logged; create `fleet-profile.md` (Frame, Gas Town, Leo,
   selfco, the eight harnesses, plus the fleet vocabulary the prefilter matches on).
2. Scaffold `packages/watch` (`@cockpit/watch`) — ESM TS, `tsx` + `vitest`, deps `rss-parser`,
   `yaml`, `better-sqlite3`. Add to `pnpm-workspace.yaml` (it already globs `packages/*`).
   Root scripts: `watch:poll`, `watch:verify-sources`, `watch:opml`.
3. `sources.yaml` + `src/sources.ts` (parse, validate, `pods` filter) + `schema.sql` + `src/ledger.ts`.
4. `src/fetch.ts` (feeds, `Promise.allSettled`, per-source errors never throw — mirror
   `adapters/rss.ts`) → `src/canonical.ts` → `src/extract.ts` (D1).
5. `src/prefilter.ts` (free pass, cuts to ≤25 candidates) → `src/score.ts` (Ollama, structured
   JSON with a validate-and-repair layer and a deterministic fallback — never a silent cloud
   cascade, per ADR-0003) → `src/rank.ts` (composite, actionability floor, threshold, cap 3).
6. `src/cli.ts` — `--since <7d|30d|ISO>`, `--dry-run`, `--limit`, `--json`. Writes the staged
   shortlist and stops (D4).
7. Repoint `packages/server/src/config.ts` at `sources.yaml` (`pods: [reading]`); add
   `watch:opml` generator; regenerate `reading.opml` and confirm the diff is title-only.
8. `scripts/watch-poll.sh` + `launchd/com.ojfbot.morning-cockpit-watch.plist` (uninstalled).
9. `.claude/skills/anthropic-watch/SKILL.md`; the three ADRs.
10. Gate 4 quiz (below), then `quiz-log.jsonl`.

---

## Gate 4 — merge quiz

Spawn a **fresh `Explore` subagent** — its tool set is *all tools except Agent/Write/Edit/
NotebookEdit*, which is exactly the required "no Write or Edit tools". Hand it **only two
inputs: the diff and `plan.md`.** No session context, no reasoning, no implementation notes.

It generates **15** questions across: sources config and what was quarantined and why; the
ledger and dedup logic; the rubric and its thresholds; launchd trigger mechanics; the relay
boundary. It samples **5**. Every question starts at FAIL and passes only when the operator
has answered and the subagent can point at the specific code or config confirming it.

No merge below 5/5. A miss means that area gets explained, then the subagent re-samples from
the **remaining** bank — never the same five. Append to `quiz-log.jsonl`:
`{question, answer, pass, subsystem, timestamp}`.

---

## Verification

```bash
cd /Users/yuri/ojfbot/morning-cockpit

# 1. Every endpoint in sources.yaml re-fetched; fails on 404, non-XML, or lastBuildDate >60d.
pnpm watch:verify-sources

# 2. Unit tests — the load-bearing three: extraction golden, actionability floor, dedup.
pnpm --filter @cockpit/watch test

# 3. THE ACCEPTANCE TEST — must surface the field guide.
pnpm watch:poll --since 2026-07-01 --dry-run

# 4. The demo.
pnpm watch:poll --since 7d

# 5. CI parity — the Reading-pod repoint must not break the shipped build.
pnpm typecheck && pnpm build && pnpm test
pnpm --filter @cockpit/server contract:check
```

**Step 3 is the gate.** It must print
`A field guide to Claude Fable 5: Finding your unknowns` with a why-it-matters line grounded
in the *fetched article text* — not the 54-byte description, and not the title. If the line
could have been written from the title alone, D1 has failed and the extraction is wrong.

Then, before installing the plist: two operator-triggered runs of `scripts/watch-poll.sh`,
confirming `~/.claude/morning-cockpit-watch.jsonl` gains a line with non-zero `feeds_ok` each
time. A green exit with `feeds_ok: 0` is a failure, not a pass.

## Out of scope (do not build)

changedetection.io watches · X/Twitter via Nitter or RSS-Bridge · self-hosted RSSHub ·
embeddings-based dedup · any cloud infrastructure · any Notion write path.
