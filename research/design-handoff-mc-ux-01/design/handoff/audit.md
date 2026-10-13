# A · Current-state audit — morning-cockpit renderer @ main (2026-10-08)

Read from source (`packages/renderer/src/**`, `packages/server/src/fleet-config.ts`, `adapters/handoff.ts`, `briefing-generate.ts`), the eight beads in `.handoff/`, and the 2026-08-08 v2 audit's screenshots of the running app (edition no. 42). Severity: **S1** structural · **S2** costs the user every session · **S3** worth fixing. Where the v2 audit already made a finding I cite it rather than restate it; what is new here is marked **NEW**.

## What the app is today
One page. `App.tsx` stacks eight numbered `Section`s (00 Briefing → 07 Loop) in a fixed order inside `<main class="sections">`, with a collapsible chat rail (`ChatSidebar`) and a health footer. Each section fetches its own read-model on its own poll (60s · 5m · 30m). UI state is one localStorage blob (`mc.cockpit.v1`: theme, density, accent, selected repo, active thread, chosen/approved branches, chat tab).

## Findings

### S1-1 · The page is a read-through, the job is return-to *(v2 §thesis, confirmed)*
Eight sections, no index, no collapse, no memory of where you were. The masthead sentence ("Quiet night. N briefs want a decision…") is the only cross-section prioritisation and it is decorative — nothing opens, closes or reorders because of it. `Masthead.tsx` derives it; nothing consumes it.

### S1-2 · NEW · The app has promises but no record of answering them
`adapters/handoff.ts` defines an *open hook* as "brief with status: live and no report responding_to it". In `morning-cockpit/.handoff/` there are **8 briefs and 0 reports**. Ages at audit: 61, 71, 83, 83, 102, 112, 121, 123 days. Two briefs *re-brief* an earlier one (20260717-1717 → 20260729-1233 both "Pick up: …"), and S8's `closes:` chain exists precisely because emission kept generating successors without anything closing predecessors. **The capture side of the flywheel has no UI at all** — there is no way to write a report from the cockpit, so loops only ever open. This is the single most consequential finding; Concept E is built from it.

### S1-3 · Space is inverted relative to information *(v2 §S1-C, confirmed)*
`04 Beads` gives three equal columns to Overnight 0 · Pickup N · Available 0, and each empty lane still renders a dashed empty state **plus** a multi-paragraph `LaneSummaryPanel`. The lane with every real item gets one third of the width, unsorted beyond age, ungrouped.

### S1-4 · Fleet is 42 uniform cards *(v2 §S1-D, confirmed; count updated)*
`REPO_META` now lists 42 repos (play-well cluster added 2026-09-24). `RepoCardView` renders `openCount` in red on every card — on ~34 cards that number is `0`. The most common, least urgent state in the fleet is styled as alarm.

### S1-5 · NEW · Two fleets, no join
`REPO_META` (hand-maintained, `fleet-config.ts`) and the registry (core's northstar README, read by `adapters/fleet-structure.ts`) disagree on membership and cluster. The v2 handoff ruled "join both sides to the registry and render disagreement (TD-007)"; the renderer still shows only `REPO_META`. `lego-village-pipeline` is in `REPO_META` and nowhere in the registry.

### S2-1 · Red has at least eight jobs *(v2 §S2-B, confirmed)*
Section numbers · masthead emphasis · `0 open` · `DECISION NEEDED` · `RECOMMENDED` · every `✨ Synthesize` button · Delivery gap bars · Loop funnel fills · `HIGH` chip · `Brief ↑` CTA. In `app.css`: `.gap-bar-fill`, `.loop-funnel-fill`, `.summary-btn`, `.repo-open`, `.section-kicker`, `.lane-count` all resolve to `var(--red)`. The derived system gives red one job.

### S2-2 · A synthesis once invented repositories *(v2 §S2-A)*
Not re-verifiable from source, but the mechanism is: `summarizeLane` → Ollama 7B with no repo allow-list. `briefing-generate.ts` *does* gate on `listKnownRepos()`; the lane summaries don't. Fix is in the server, but every prototype here badges model output `SYNTH` and caps it.

### S2-3 · NEW · Three honesty vocabularies
`EDITORIAL` chip (Critical Path, `.crit-editorial`), `rates unverified` badge (Loop, `.loop-stale-badge`), `synth` chip (cards, `.card-queue--synth`), `deterministic · ↻` (Briefing caption), `auto` / `✨ ollama` (SummaryView). Five spellings of three ideas: *hand-written*, *computed*, *model-written*. Delivery's `current:` percentages — hand-asserted frontmatter the northstar brief itself calls "first-cut" — carry no badge. The Drafting Table's evidence axes give one vocabulary: **ASSERTED · DERIVED · SYNTH · SIMULATED**.

### S2-4 · NEW · Leo is three rooms
`ChatSidebar` has `Leo` (global) and `Northstar · <repo>` tabs; the Briefing has its own disabled composer ("wiring lands with the chat rail"); the Navigator prototype POSTs to Leo's global thread with a `[fleet-navigator]` string prefix (core #340). Three entry points to one model, none of which can *move the UI* — every conversation ends in prose, never in a selection or a view.

### S2-5 · Lane semantics are a time of day *(v2 §5)*
`OVERNIGHT · ran or running since last evening` encodes the visit hour into the data model. No last-viewed timestamp exists. Operator asked to prototype both: D keeps the lane; E replaces it with "since you last looked".

### S3 · Smaller
- `Masthead` nameplate is `clamp(48px, 9.5vw, 142px)` — the least informative element is the largest.
- Research profile chips truncate mid-word (`.profile-chip` max-width 240px).
- `Section` captions are mono 11px right-aligned two-liners — the one place per-section *state* could live, used for static labels ("across all projects").
- Collapsed chat rail is vertical text (`writing-mode: vertical-rl`).
- `DENSE` / `DARK` toggles are two axes rendered as equals.

## What is good — keep *(v2 §1, confirmed from source)*
The typographic voice (`tokens.css`, ADR-0007). The honesty apparatus wherever it exists (`.crit-editorial`, Loop's never-blended populations, the `synth` chip). The best empty state in the fleet (`Lane.tsx`: "Queue is empty (no real unassigned pool exists yet — see ADR-0002)"). The decision card's shape (question → two branches → one RECOMMENDED → an artifact). `ChatContextDisclosure` showing the model's system prompt verbatim. The S8 `decided → in flight` fold — the one place the app already reasons about a loop closing.

## Evidence index
| Finding | Source read |
|---|---|
| S1-1 | `App.tsx`, `Section.tsx`, `Masthead.tsx` |
| S1-2 | `adapters/handoff.ts`, `.handoff/*.md` (8 files), `HandoffArtifactCard.tsx`, CLAUDE.md "Honest gaps" |
| S1-3 | `App.tsx` lanes grid, `Lane.tsx`, `LaneSummaryPanel.tsx`, `app.css .lanes` |
| S1-4 | `fleet-config.ts REPO_META`, `RepoCardView.tsx`, `app.css .repo-open` |
| S1-5 | `fleet-config.ts`, server tree (`adapters/fleet-structure.ts` exists; renderer has no consumer) |
| S2-1 | `app.css` (grep `var(--red)`) |
| S2-3 | `CriticalPathSection.tsx`, `LoopSection.tsx`, `WorkItemCard.tsx`, `SummaryView.tsx`, `DeliverySection.tsx` |
| S2-4 | `ChatSidebar.tsx`, `Briefing.tsx` composer, `fleet-navigator.template.html` footer |
