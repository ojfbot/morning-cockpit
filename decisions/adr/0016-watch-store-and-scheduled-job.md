# ADR-0016 — The watch package gets a persistent store and a scheduled job; the relay boundary holds

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0001 (read-only posture), ADR-0005 (the single write-path carve-out)
- **Source:** the Anthropic-watch Stage-1 build

## Context

`CLAUDE.md` says this repo is read-only with exactly one carve-out: the chat sidebar may write
a brief bead into a target repo's `.handoff/` after per-emission approval (ADR-0005). It says,
in as many words, not to add another write path.

The watch poller needs two things that posture does not currently allow:

1. **State.** "Have I already surfaced this?" cannot be recomputed from the feeds. Everything
   else in the cockpit is ephemeral — fetch, cache in a TTL map, discard.
2. **A scheduler.** The repo has no background process. All refresh is pull-driven: the
   browser polls, a TTL gate decides whether to refetch. Catching a post on day one means
   something runs when no browser is open.

## Decision

**Both are permitted, scoped to `@cockpit/watch`, and neither weakens the read-only posture as
it applies to fleet state.**

The distinction that makes this consistent rather than a loophole: ADR-0001's read-only rule is
about **not writing to systems of record** — Dolt, `gh`, other repos. The watch ledger writes
only to a file inside its own package describing its own past behaviour. It is not fleet state;
nothing else reads it; deleting it loses only "have I seen this" and the next run refills.

### The store

`packages/watch/.data/watch.sqlite`, `better-sqlite3`, matching the house convention in
`selfco-box`. `.data/` is already gitignored. Schema in `packages/watch/schema.sql`:
`seen_items` (a **superset** of the columns the Stage-1 handoff specified, so the contract is
additive), `scores` (per-dimension, with `rubric_version`), and `runs`.

`runs` exists because of `.handoff/20260618-brief-launchd-processes-panel.md`: *a job can be
loaded, exit 0, and do nothing.* A run that fetched zero feeds must be distinguishable from a
run that found nothing new, and an exit code cannot tell you which happened.

Dedup is URL canonicalization — drop tracking params and fragments, key GitHub commits on the
sha, arXiv on the paper id. **No embeddings.** Stage 1 defers near-duplicate detection.

### The job

`launchd/com.ojfbot.morning-cockpit-watch.plist`, 06:15 daily, committed in-repo and installed
by `cp` + `launchctl load -w` — the pattern from `core/scripts/*-launchd.plist`. It is
**committed but not installed** until two operator-triggered runs pass, the house ritual from
`trace-triager-launchd.plist`.

**It does not run `claude -p`.** The Stage-1 handoff specified a LaunchAgent firing headless
Claude. Once scoring was settled as local Ollama (ADR-0017), every step of this job became
deterministic, and an agent loop would have added cost, nondeterminism, and an API key in the
launchd environment for no gain. `claude -p` remains right for scheduled *agentic* work; this
is not that. Logged as Deviation #1.

### The relay boundary

**The poller writes a staged JSON shortlist to disk and stops.** Notion inbox writes,
bead-provenance stamping, and brief rendering stay with the chat session.

This is enforced structurally, not by convention: there is no Notion client, no Notion
credential, and no `@notionhq` dependency in this package. Adding one is the thing to refuse.

Worth recording plainly: `selfco-box`, the promoter that drains the Notion inbox to the vault,
has been **paused since 2026-06-11** after a cloud-agent cost incident (~$260 in a day). Rows
staged to Notion today sit unprocessed. Stage 1 stops before Notion so this does not block it,
but nothing here should be described as "filed to the vault."

## Consequences

**Good.** The poller can tell new from seen across restarts. The run ledger makes a silently
useless scheduled job detectable. The read-only posture keeps its precise meaning instead of
being quietly widened.

**Costs.** `better-sqlite3` is a native module — it compiles on install and adds a toolchain
dependency to CI. The repo now has a background process, which is a new class of thing to
operate; the `runs` table and `~/.claude/morning-cockpit-watch.jsonl` exist to make that
tractable. The unbuilt launchd Processes panel (`.handoff/20260618-*`) would now have a second
job worth watching.

**Watch for.** If a second package wants a store, do not let `.data/` become an ad-hoc database
directory — that is the point to design a real one.
