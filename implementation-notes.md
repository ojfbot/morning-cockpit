# implementation-notes — Anthropic watch (Stage 1)

Working notes for the `@cockpit/watch` build. The `## Deviations` section is always on.

**Deviation count is a discovery rate, not a defect rate.** Nothing here is suppressed to keep
a number down. A deviation logged is the plan telling us what it didn't know.

## Deviations

- **#1 — launchd fires a deterministic Node script, not `claude -p`.**
  The plan (and the handoff before it) specified a LaunchAgent firing `claude -p`. Once the
  scorer was settled as Ollama-local, an agentic headless run buys nothing: it adds cost,
  nondeterminism, and an API key in the launchd environment for a job whose every step is
  deterministic. Took the conservative option — `scripts/watch-poll.sh` runs the CLI directly.
  The `claude -p` house pattern (`core/scripts/trace-triager.sh`) remains the right shape for
  *agentic* scheduled work; this job is not that.

- **#2 — SKILL.md lives at `.claude/skills/anthropic-watch/`, not repo root.**
  The handoff's deliverable tree put `SKILL.md` at the repo root. `name` must match the
  containing folder, so a root SKILL.md forces `name: morning-cockpit` — which names the repo
  rather than the capability, and weakens the `description` field that does all the trigger
  work. Took the conservative option — the folder is named for the skill.

- **#3 — ADRs go in `decisions/adr/`, not `docs/adr/`.**
  The handoff specified `docs/adr/0001-*.md`. This repo already has 14 ADRs under
  `decisions/adr/NNNN-slug.md`. Followed the repo's existing convention; next serial is 0015.

- **#4 — Gate 1's three questions were asked in one panel, not sequentially.**
  Gate 1 says "ask me one question at a time"; it also says "surface the top 3". The three
  questions were mutually independent — none of the answers would have changed the wording of
  the others — so three sequential round-trips would have been latency without information.
  Logged per the handoff's own instruction that harness friction is itself data.
  *Harness note:* `voi-interview` may want to say "sequential only when an answer changes a
  later question", which is the condition that actually justifies the cost.

- **#5 — The Anthropic YouTube feed is quarantined; the research doc's "VERIFIED" was wrong.**
  The plan assumed `videos.xml?channel_id=UCrDwWp7EBBv4NwvScIpBDOA` was live because the
  research doc marked the channel_id verified. The *ID* is correct — confirmed against
  `"externalId"` on youtube.com/@anthropic-ai — but the feed endpoint 404s under both a bot
  and a browser User-Agent. The doc verified the ID and inferred the feed. Conservative
  option: `quarantine:` with the failure recorded verbatim, no replacement URL invented.

- **#6 — The prefilter was structurally blind to the sources the build exists for.**
  The plan assumed a keyword prefilter over title + feed summary would rank candidates well
  enough to cut cost. The territory: the Anthropic first-party feeds ship almost no summary
  text. Measured over a 30-day window — Claude blog 65 chars average, Anthropic news 51,
  Anthropic research 66, Claude Code changelog **0**; 88 of 136 high-authority items
  effectively blank. The acceptance-test article scored **zero** vocabulary hits and sorted
  **118th of 162**. The one source this poller was built to catch was the one the cheap pass
  could not see at all.
  Conservative fix: split the prefilter into two pools. High-authority items with under 120
  chars of summary are `unjudgeable` and admitted by *recency* into 60% of the candidate
  budget, deferring the judgment to the scorer, which has read them. Items with real text are
  ranked on it as before. Principle: **absence of evidence is not evidence of irrelevance.**
  ADR-0017 records it.

- **#7 — The fleet profile never said what the fleet is built *with*, and the scorer took it
  literally.** With 14,293 chars of correctly-extracted article text, `qwen2.5:7b` scored the
  acceptance item 0/0/0: *"The article discusses Claude Fable, which is not related to
  `@ojfbot` or the fleet's work."* The profile listed Frame / Gas Town / Leo / selfco and the
  eight harnesses, so the model did exactly what it was asked and found no name match.
  Fix: a "The substrate" section at the top of `fleet-profile.md` stating that every repo is
  built with Claude Code and the Claude API, and that first-party guidance on working with the
  models is relevant *even when it names no repo* — plus a matching clause in the rubric's
  relevance definition telling the model not to require a literal name match.
  Worth keeping: the extraction was perfect and the scorer was well-formed; the failure was
  entirely in what the profile left unsaid. A rubric is only as good as the context it scores
  against.

- **#8 — Added `--until`, which the plan did not specify.**
  The acceptance test asks whether the run surfaces a 2026-07-06 post. Run today that is a
  28-day backfill of 166 items, where finding a 23-day-old item means scoring nearly all of
  them — there is no cheap signal that isolates it. But the question the test is really asking
  is *"would this have caught it on the day it shipped?"*, and that was unanswerable: the tool
  could only ever look backward from now.
  `--until` bounds the window's upper edge and computes recency as of that moment, so any past
  day can be replayed exactly. The acceptance test is now run both ways — as the day-one run it
  is meant to simulate, and as the literal full-window backfill.

- **#9 — "Stale" and "broken" are different facts; the plan's verification rule conflated
  them.** The plan said anything with a `lastBuildDate` older than 60 days goes to quarantine.
  Run against the real registry, that rule flagged `karpathy` (110d) and `chip-huyen` (560d) as
  failures. Both endpoints serve valid XML and would deliver the next post fine — the authors
  simply post rarely. Quarantining Karpathy for not blogging since April would have been wrong,
  and is the same category error as the YouTube entry: treating one fact as evidence for a
  different one.
  Conservative fix: three health tiers. `broken` (404 / non-XML / connection failure) fails the
  command and must be quarantined. `quiet` is reported with an explicit note that it is *not* a
  failure and is a human judgment call. Only broken feeds exit non-zero.
  Also added: two retries with a doubled timeout before believing a connection error.
  `anthropic-status` "failed" on the first pass purely because the machine was at load average
  24; on retry it returned 32kb of fresh XML. Without the retry, a healthy first-party feed
  would have been quarantined for a transient local condition.

- **#10 — `--dry-run` was writing to the `runs` ledger.**
  Small, but it made the table lie: a rehearsal was being recorded as a scheduled run, in the
  one table whose whole purpose is telling you what the scheduler actually did. Dry runs now
  touch nothing persistent.

- **#11 — The first live acceptance run failed, and what topped the brief was the finding.**
  The run surfaced **"Fix lychee.toml for lychee 0.23: headers field was renamed"** — a
  link-checker config commit in the cookbooks repo — at **0.88**, scored `relevance 1.00 /
  actionability 1.00` from the commit subject line alone, with a `why` that merely restated
  the title. The acceptance item did not clear 0.6.
  This is the handoff's named failure mode ("never summarize from titles alone") arriving in
  the top slot. The plan treated it as a *fetching* rule — fetch the body — and the fetching
  was fine. What it missed is that the rule is also about **confidence**: a model reading a
  bare imperative subject line will nearly always call it actionable, because that is what
  imperative subject lines sound like. Three fixes:
  1. `textQuality` now means *how much text we actually have*, not which code path ran. A
     changelog entry whose feed carries the whole release note is not thin; a commit subject
     is, however it arrived.
  2. `THIN_CEILING = 0.55` — an item judged without real text is capped below the threshold
     and cannot trip the actionability floor. Read it or rank it lower.
  3. GitHub commit-feed authority dropped 0.9 → 0.6, with the reason in `sources.yaml`.
     Commits are *activity*, not announcements; `releases.atom` is the right granularity and
     is Stage-2 work.
  Also added: the run now prints **every scored item** with its dimensions to stderr, not just
  the survivors. A shortlist alone cannot distinguish "this was missed" from "this ranked
  low," and that distinction is the entire debugging surface of a ranker. This diagnosis
  needed a throwaway probe script; the next one will not.

- **#12 — Prose in the fleet profile did not move the scorer; calibration anchors did.**
  After Deviation #7 added the substrate section, the field guide *still* scored relevance
  0.2. The whole-window table showed the pattern the single-item probe had hidden: **every**
  first-party Claude post was landing at r0.0–0.3, including "Choosing a Claude model and
  effort level in Claude Code" at r0.3/a0.2 — about as relevant and actionable as anything
  could be for this operator. The model was anchoring on the component list, which dominates
  the profile by volume; one more paragraph of prose could not outweigh it.
  Fix: seven worked examples in the rubric prompt, pinning both ends of each scale — a
  technique field guide at 0.9, a deprecation at actionability 1.0 with an explicit "never
  score a deprecation low just because it is boring", a case study at 0.2, funding at 0.0,
  linter churn at 0.1. Result: field guide relevance 0.2 → 0.8, composite 0.45 → **0.76**;
  the model-choice post → **0.91**; lychee commits → 0.15–0.55.
  Generalizable: when a local model misjudges a scale, anchor the scale. Describing the
  domain more thoroughly does not help, because the problem was never comprehension.
  `RUBRIC_VERSION` bumped to `watch-rubric-2` — this is exactly the re-tune it exists to make
  visible.

- **#13 — The Gate-4 quiz bank found two real defects before a single question was asked.**
  The merge-quiz subagent, given only the diff and `plan.md` and no session context, produced
  two questions whose model answers were bug reports:
  1. **The watchdog could destroy a healthy run.** `watch-poll.sh` killed the child at 20
     minutes, but scoring 25 candidates at the 300s per-item timeout can exceed that — and it
     did, repeatedly, on this machine. A SIGKILL skips `cli.ts`'s `finally`, so the `runs` row
     stays `started`, no shortlist is staged, *and* the items already scored are committed to
     `seen_items` — meaning they are no longer "new" tomorrow and never reach a brief. Silent
     partial data loss on a slow morning.
     Fixed: the CLI owns a `--deadline-mins` (default 25) budget, stops scoring on its own
     terms, still stages a brief and closes its run row, and reports the abandoned tail. The
     wrapper's watchdog went to 45 minutes and is now documented as a backstop — if it fires,
     something is wrong rather than merely slow.
  2. **`schema.sql` documented behaviour the code does not have.** The `score` comment claimed
     NULL meant "seen but never scored (did not survive the prefilter)", but `ledger.record`
     is called inside the candidate loop, so prefilter casualties are never written at all.
     Resolved in favour of the *code* — not recording them is right, since an item that was
     never read was never surfaced, and recording it would permanently bury anything that
     merely lost a budget race. The comment now says so, and names the two accepted costs.
  This is the gate working exactly as specified. Neither defect was reachable from the
  authoring context: one needed someone to multiply two constants in different files, the
  other needed someone to read a comment against the code without knowing what was intended.

## Log

- **2026-07-28** — Branched `feat/anthropic-watch-stage1` from `origin/main` (`cec5678`).
  Note: `feat/rm-l1-mc-s8-decided-in-flight` was still checked out from the prior session;
  its work is already in main.
- **2026-07-28** — Verified every `inferred` endpoint from the handoff before writing config.
  All 200 except YouTube (see Deviation #5). `feed_claude.xml` is live (`lastBuildDate`
  2026-07-29, 201 items back to 2023-08) and **contains the acceptance-test item**.
- **2026-07-28** — Discovered the acceptance item's `<description>` is 54 bytes (the title,
  repeated). Full-text fetch is therefore forced, not a design preference. Confirmed the
  article is server-rendered plain HTML (~28k chars, no `__NEXT_DATA__`), so no headless
  browser is needed.
