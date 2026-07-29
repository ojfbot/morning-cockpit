# fleet-profile — scoring context for `@cockpit/watch`

What the `@ojfbot` fleet is building, so the scorer can tell "this changes how I work" from
"this is interesting." Read by `src/prefilter.ts` (the `## Vocabulary` lists, parsed
mechanically) and injected into the rubric prompt by `src/score.ts` (the prose, read by the
model).

Keep this file honest and current — it is the only thing standing between the brief and a
generic AI-news digest.

---

## The operator

Solo operator running ~45 discrete repos, never a monorepo. Works through a two-agent relay:
a chat session plans and writes Notion, a Claude Code session handles filesystem and git.
Decisions are ADR-driven. Work is decomposed into vertical slices behind control gates with
entrance/success criteria, promoted on data rather than vibes.

The operator is not looking for news. They are looking for **things that change a decision
already on the table**, and for **quiet changes that will break something** if unnoticed.

## The substrate — read this before judging relevance

**Every repo in this fleet is built with Claude Code and the Claude API.** They are not one
topic among many; they are the tools the operator uses every working hour, and the runtime
the fleet's own agents execute on.

So: first-party Anthropic guidance on *how to work with the models* — field guides, prompting
and context technique, model behaviour changes, new agent primitives — is **directly relevant
even when it names no repo in the list below**. A post about getting better results from a
Claude model is a post about how every one of these ~45 repos gets built.

Do not require a literal name match against the component list to call something relevant.
The component list says what the operator is building; the substrate says what they are
building it *with*, and changes to the substrate reach everything.

## Named components

- **Frame** — the experience plane. Module Federation remotes, Carbon Design System.
- **Gas Town** — the execution plane. Agent dispatch, convoys, worktree isolation.
- **Leo** — fleet-aware chief-of-staff agent.
- **Arcade** — the operating surface that fronts the fleet.
- **selfco** — an Obsidian vault fed by a Notion inbox and a local promoter, with
  bead-provenance stamping. *Currently paused* after a cloud-agent cost incident.
- **morning-cockpit** — this repo. The daily human-in-the-loop read surface.
- **beads** — the fleet's work-item primitive, stored in Dolt, emitted by session hooks.

## The eight harnesses

Instruments for measuring how the operator and the agent actually perform, not features.
Anything about agent evaluation, calibration, or self-report reliability lands here.

| Harness | What it measures |
|---|---|
| `blind-sweep` | Classifying unknowns into the four boxes via decorrelated sweeps |
| `four-directions` | Forcing decorrelated framings of one problem |
| `voi-interview` | Whether a question was worth asking (`actually_changed_plan`) |
| `semantic-transplant` | Moving a working pattern across domains without cargo-culting |
| `revision-forecast` | Calibration of `p_revise` — discrimination, not just Brier |
| `deviation-log` | Discovery rate of plan-vs-territory gaps |
| `handoff-doc` | Whether a handoff reconstructs context in a fresh session |
| `merge-quiz` | Whether the human actually understands the diff they are merging |

## What scores HIGH

- **Anything that changes a decision already on the table.** Agent Skills spec changes, a
  documented Claude Code scheduler (would replace the launchd plist in this very repo), Agent
  SDK primitives that replace hand-rolled fleet scaffolding.
- **Quiet breakage.** API deprecations, model retirement dates, default-behaviour changes,
  rate-limit changes, breaking SDK releases, changed tool semantics. *These are boring and
  they matter most* — this is precisely what the `actionability` dimension and its floor exist
  to rescue from a novelty-weighted ranking.
- **Evaluation and calibration methodology** — LLM-as-judge bias, multi-dimensional rubrics,
  self-consistency, agent-harness measurement. Directly feeds the eight harnesses.
- **Context and memory engineering** for long-running agents; multi-turn degradation.
- **First-party field guides on how to actually work with the models.** The acceptance-test
  item is one of these — that class is the reason this poller exists.

## What scores LOW

- Funding rounds, valuations, org charts, executive moves, partnership announcements.
- Benchmark leaderboard chatter with no method change behind it.
- Third-party recap and repackaging (explainx, daily.dev, "top 10 prompts") — this whole
  layer is the week-late relay the poller exists to bypass. Corroboration only, never signal.
- Consumer product launches with no API or agent surface.
- Anything the operator has demonstrably already seen — the ledger handles this, but a
  restatement of a known thing by a lower-authority source should also rank low on novelty.

---

## Vocabulary

Parsed by `src/prefilter.ts`. One term per line, lowercase, matched case-insensitively as
word-ish substrings against title + extracted text. Presence raises a candidate's prefilter
rank; it never decides the final score — that is the rubric's job.

### high-signal
agent skills
skill.md
progressive disclosure
subagent
agent sdk
claude code
claude agent sdk
mcp
model context protocol
tool use
computer use
prompt caching
context window
context engineering
memory
long-running agent
multi-turn
harness
scaffold
eval
evaluation
llm-as-a-judge
llm as judge
rubric
calibration
brier
self-consistency
interpretability
deprecat
breaking change
migration guide
end-of-life
sunset
retire
rate limit
pricing
token budget
structured output
tool calling
headless
scheduler
cron
launchd
hooks
worktree
provenance
observability
telemetry

### low-signal
funding
series a
series b
valuation
raises
acquisition
partnership
hiring
appoints
joins the board
leaderboard
benchmark score
top 10
best prompts
cheat sheet
roundup
weekly recap
newsletter digest
