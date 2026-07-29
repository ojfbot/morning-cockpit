---
name: anthropic-watch
description: Use when you want to know what Anthropic has shipped or published recently, when asked to "check the Anthropic watch", "what's new from Anthropic", "did I miss anything from Anthropic", "run the watch poller", or when triaging the staged shortlist into the selfco Notion inbox. Polls verified Anthropic feeds, scores new items against the fleet profile with a local model, and stages a ranked shortlist of at most three items to disk.
---

# Anthropic watch

Watches Anthropic's technical output directly instead of waiting for the creator ecosystem to
repackage it a week later. Polls a verified feed set, dedups against a SQLite ledger, fetches
article bodies, scores them on four dimensions with a local model, and stages the survivors.

## Run it

```bash
cd /Users/yuri/ojfbot/morning-cockpit
pnpm watch:poll -- --since 7d
```

Flags: `--since 7d|48h|2026-07-01` · `--dry-run` (no ledger write, no staged file) ·
`--limit N` (brief size, default 3) · `--candidates N` (how many items get scored, default 25)
· `--json`.

Output goes to `packages/watch/.data/staged/<date>-shortlist.json`.

## The boundary — read before staging to Notion

This package **stops at disk**. It has no Notion client, no Notion credential, and no
`@notionhq` dependency, by design (ADR-0016).

Writing the shortlist into the selfco Notion inbox is the **chat session's** job, via the
`selfco-ingest` skill. Read the staged JSON, then stage each item you want kept. Do not add a
Notion write path here.

Also true and worth saying out loud: the selfco promoter (`selfco-box`) has been **paused
since 2026-06-11** after a cloud-agent cost incident. Rows staged to Notion sit unprocessed
until it is re-enabled, so do not describe an item as "filed to the vault" when it is not.

## Reading the output

Each item carries a composite score and its four dimensions:

- `relevance` — does this touch the operator's tools, methods, or subject matter
- `actionability` — would this change something they do or must fix
- `novelty` — new information, or a restatement
- `authority` — **deterministic**, read from `sources.yaml`, never model-scored

`flooredUp: true` means the actionability floor lifted the item over the threshold: a boring
but authoritative and highly actionable item — a deprecation, a breaking change — that a
weighted mean alone would have buried. That is the rubric working, not a bug.

`textQuality: "thin"` means the score was formed from feed metadata rather than real article
text. Those items are **capped at 0.55 — below the 0.6 threshold — so they cannot reach the
brief**, and are denied the actionability floor (`thinCapped: true` marks a capped one). This
is deliberate: a model reading a bare imperative commit subject will call almost anything
actionable. The first live run put "Fix lychee.toml for lychee 0.23" at the top at 0.88 before
the cap existed.

The run also prints **every scored item** with its dimensions to stderr, not just the
survivors. Use that to tell "it was missed" from "it ranked low" — an empty brief with a full
scored list underneath is a very different situation from an empty scored list.

## Changing the source list

`sources.yaml` at the repo root is the single registry for both this poller and the cockpit's
Reading pod (ADR-0015). `pods: [watch]`, `pods: [reading]`, or both.

After editing, always:

```bash
pnpm watch:verify-sources   # re-fetches everything, fails on 404 / non-XML / >60d stale
pnpm watch:opml             # regenerates reading.opml, which is a derived file
```

**The rule on a failing endpoint:** move it to the `quarantine:` block *with the reason
recorded*. Never delete it silently, and never substitute a replacement URL you have not
fetched. A hallucinated feed URL in config is the most expensive failure mode here — it looks
exactly like a source that has stopped publishing. Three entries are quarantined today,
including the Anthropic YouTube feed; each says why.

Community mirrors are volunteer-maintained and die without announcement. `verify-sources` is
how that gets noticed.

## Scheduling

`launchd/com.ojfbot.morning-cockpit-watch.plist`, 06:15 daily. Committed but **not installed**
until two operator-triggered runs of `scripts/watch-poll.sh` have passed — the house ritual
for a new autonomous loop.

A green exit proves nothing: a scheduled job can load, exit 0, and do nothing. Check the
`runs` table in `packages/watch/.data/watch.sqlite` for a non-zero `feeds_ok`, or the run
ledger at `~/.claude/morning-cockpit-watch.jsonl`.

## What this is not

Stage 1 deliberately excludes changedetection.io watches, X/Twitter monitoring, self-hosted
RSSHub, embeddings-based dedup, and any cloud infrastructure. If a task seems to need one of
those, it is Stage 2 — say so rather than building it.
