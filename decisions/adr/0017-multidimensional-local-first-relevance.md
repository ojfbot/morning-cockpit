# ADR-0017 — A multi-dimensional, local-first relevance rubric with an actionability floor

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0003 (local-first synthesis, no automatic cloud cascade)
- **Source:** the Anthropic-watch Stage-1 build

## Context

The poller must reduce ~150 new items in a backfill window to a brief of at most three. The
requirement that shaped everything: **a quiet API deprecation must be able to outscore an
exciting blog post.** The operator's failure mode is not missing the interesting thing — the
creator ecosystem relays that within a week. It is missing the dull thing that breaks a build.

Single-score LLM judges are unreliable and correlate poorly with human ranking; multi-dimension
rubrics do measurably better. But a multi-dimension rubric collapsed by a weighted mean cannot
express the requirement above, and that turned out to be provable rather than a matter of taste
(see below).

ADR-0003 constrains the provider: local-first, cloud opt-in, and **no automatic cascade** — a
local failure degrades to a deterministic floor, never silently to the network. `selfco-box`,
paused after a ~$260/day cloud-agent incident, is the standing reminder of why.

## Decision

### Four dimensions, three of them model-scored

`relevance_to_fleet`, `actionability`, `novelty` — scored 0–1 by Ollama `qwen2.5:7b` against
**fetched article text**, never the title.

`source_authority` is **deterministic**, read from `authority` in `sources.yaml`. Asking a 7b
model to rate the authority of its own inputs is a self-grading loop with no ground truth, and
it would let a confident blog post claim first-party weight.

### The composite, and the floor

```
mean = 0.35·relevance + 0.30·actionability + 0.20·novelty + 0.15·authority

if actionability >= 0.9 and authority >= 0.8:
    composite = max(mean, 0.70)
```

Threshold 0.6, hard cap 3 items.

**The floor is the whole point, and it is load-bearing rather than decorative.** A deprecation
notice scoring relevance 0.3 / actionability 0.95 / novelty 0.1 / authority 1.0 has a weighted
mean of **0.56** — below the 0.6 threshold. Without the floor the stated requirement is
literally unmet: the boring, authoritative, must-act item does not make the brief. This exact
case is a test (`rank.test.ts`), asserting both halves — that the mean falls short, and that
the floor rescues it.

The `authority >= 0.8` condition prevents the obvious abuse: a low-authority source asserting
urgency cannot floor itself into the brief. Also a test.

### The thin-text ceiling — confidence, not just content

"Never summarize from titles alone" is a rule about **how much a title-only judgement is
worth**, not only about fetching. The first live acceptance run made that concrete: a commit
titled *"Fix lychee.toml for lychee 0.23: headers field was renamed"* scored relevance 1.00 /
actionability 1.00 off that subject line and **took the top slot at 0.88**, with a `why` that
restated the title. A link-checker config fix in a cookbook repo.

The model was not malfunctioning. A bare imperative subject line *sounds* actionable — that is
what imperative subject lines are. So:

- `textQuality` means **how much text we actually have**, not which code path produced it. A
  changelog entry whose feed carries the whole release note is `full`; a commit subject is
  `thin` however it arrived.
- `THIN_CEILING = 0.55` caps any thin-text composite **below the 0.6 threshold**, and thin
  items are denied the actionability floor. Read it, or rank it lower.
- Commit-feed authority dropped 0.9 → 0.6. Commits are *activity*, not announcements;
  `releases.atom` is the right granularity and is Stage-2 work.

Every score carries `rubric_version`, stored per row, so a re-tune is detectable rather than
silent.

### Local-only, with a deterministic floor

Ollama, one JSON-repair retry, then a deterministic score derived from prefilter evidence and
labelled `provider: 'deterministic'`. There is no cloud client and no API key in this package —
a property of the code, not a configuration choice. The deterministic path pins actionability
at 0.3, below `FLOOR.actionability`, so it can never trip the floor by accident.

### The prefilter ranks, it does not judge

Scoring every item is too expensive, so a free deterministic pass cuts the field first. It
selects who gets *read*; it never contributes to the score.

**It is deliberately split into two pools, because keyword ranking is only meaningful where
there are keywords.** Measured 2026-07-28 over a 30-day window: Claude blog summaries average
65 characters, Anthropic news 51, Anthropic research 66, the Claude Code changelog **0**. Only
Simon Willison (4290) ships real summaries. 88 of 136 high-authority items were effectively
blank.

Ranking those by vocabulary hits is ranking noise — and it failed concretely: the
acceptance-test article scored **zero** vocabulary hits and sorted **118th of 162**. The one
source this poller was built to catch was the one the prefilter was blindest to.

So: high-authority items with under 120 characters of summary are **unjudgeable**, admitted by
recency into 60% of the candidate budget, with the decision deferred to the scorer, which has
actually read them. Items carrying real text are ranked on it. `admittedBy` records which path
each took.

The principle worth keeping: **absence of evidence is not evidence of irrelevance.** When the
cheap signal is structurally missing, spend the expensive one rather than reading the silence
as a "no".

## Consequences

**Good.** Boring-but-important can win, and there is a test proving it. Authority cannot be
claimed by an eager model. The near-empty first-party feeds — the highest-value sources — are
no longer invisible to the cheap pass. Zero marginal cost per run, and no key to leak.

**Costs.** A 7b model's judgment is coarse; the rubric is calibrated by inspection, not against
a gold set. The floor's constants are asserted, not derived — they are a stated policy, and
`rubric_version` is what makes changing them visible. The unjudgeable reserve spends reads on
items that often turn out not to matter; that is the deliberate trade.

**Watch for.** If the brief starts surfacing more than ~5 candidates a day, tighten the
threshold rather than widening the cap — the goal is a shortlist, not a digest. Building a
small gold set of hand-scored items is the obvious Stage-2 upgrade, and would let the weights
be fitted instead of chosen.
