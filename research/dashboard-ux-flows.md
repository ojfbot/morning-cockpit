# Dashboard UX flows — captured brainstorm (2026-06-25)

UX-research capture from a low-fi "off the dome" session: the operator narrated cursor
movements and desired interactions against the live cockpit (LOCAL EDITION No. 21,
Wed 24 Jun 2026, ~05:34). **Most of what follows is not built** — this records *intent and
desired behavior*, not current code. Selfco-bound knowledge artifact; the buildable
decomposition lives in `research/dashboard-ux-rollout-gated-slices.md`, and the decisions
in `decisions/adr/0010` + `decisions/adr/0011`.

> Method note: the operator described interactions verbally (mouse not visible beyond the
> screenshot), scrolled and reported position, and did not navigate off the home page. So
> these are *captured wishes*, anchored to one screen state — treat them as requirements
> input, not observed behavior.

## Baseline state captured

- **Masthead** — "MORNING COCKPIT", LOCAL EDITION No. 21. Subhead: *"Quiet night. Sixteen
  briefs want a decision, and four tasks are going stale while you sleep."*
- **00 · Briefing → "The First Move"** — Chief-of-Staff console. A card on *bead-emit.mjs
  lifecycle tests* (74 days stale); the local Chief-of-Staff model was unavailable so it is
  the **deterministic brief read straight from bare data** (ADR-0003 floor held). Decision
  prompt *"How do you want to move…?"* with branches (Pick it up now / Defer 7 days), an
  expanded "Pick up…" panel with acceptance-criteria bullets and a **Confirm & emit**
  affordance, plus a re-frame composer.
- **01 · Fleet** — repo-card grid (shell, core, morning-cockpit [highlighted "you are
  here"], daily-logger, cv-builder, gastown-pilot, GroupThink, TripPlanner, …), each card
  showing role, phase, open count, liveness dot, last activity. Most read "no activity".
- **Right rail — Cockpit Chat** — grounded sidebar, draft-handoff, doc-grounded Q&A.

The load-bearing observation the operator made: **00 (Briefing) and 01 (Fleet) are not
independent**. morning-cockpit is the highlighted Fleet tile, and the First Move on screen
is morning-cockpit's. The coupling is already implied by the design — it just isn't wired.

---

## Flow 01 — Fleet tile selection drives the Briefing

**Mental model.** Fleet is a **selector**; the Briefing is the **detail view** that responds
to it. The active/highlighted Fleet tile *is* the repo whose First Move + seated threads
fill Section 00.

**Interaction.**
1. Operator clicks a different Fleet tile (cv-builder, daily-logger, gastown-pilot, any).
2. The active highlight moves to that tile (off morning-cockpit).
3. Section 00 **animates a swap** — the current First Move card and seated threads transition
   out; the selected repo's First Move + seated threads transition in.

**Why.** You start the day parked on morning-cockpit (home base — "what's my first move
here"), then **toggle across the fleet** to triage each app: what's its first move, what
threads are seated under it. Fleet becomes a horizontal morning scan of "where does each
project need me."

**Truths this exposes (honest-gaps discipline).**
- Today the Briefing is **global** — one `fetchBriefing()` set of seeded threads, UI state in
  `cockpitState.ts` (`activeId`/`chosen`/`approved`), threads still a typed mock until the
  generator is wired (ADR-0007 / Briefing Slice 3). Per-repo scoping is **new data work**:
  every repo needs its own First Move + seated threads computed, not just morning-cockpit.
- Most tiles read "no activity". A quiet repo must show a **truthful empty** First Move, not
  a fabricated one (consistent with CLAUDE.md "show truthful empty states").
- **Default-on-load = morning-cockpit selected.** Open question: fixed home, or "most-active
  repo"? Captured as fixed-home unless decided otherwise.
- The **animated transition** is a real design artifact: direction, what persists vs. swaps,
  what the empty state looks like.

## Flow 02 — Fleet tile as a launch surface + hover/focus popover

**Nav-away actions on every tile.**
- **→ GitHub repo** for that application.
- **→ the application itself**, wherever it lives — local dev server if running, or its
  deployed home (`*.gym.software`, or wherever else hosted).
- **Room for more links** — open-ended per tile; model as a flexible list, not two hardcoded
  buttons.

**Hover / focus popover.**
- Tiles get a popover **on hover *or* focus** — explicitly keyboard-reachable, not
  mouse-only. So it is part of the interaction/a11y model (dismiss + persist behavior to
  design), not decoration.
- **Contents are deliberately TBD** — the operator left this as its own brainstorm.

**Truths this exposes.**
- "Is the app running locally / where is it deployed" is a **live-state question**: the tile
  must know each app's runtime location and whether the local link is valid right now.
- The popover-contents brainstorm is a **design spike**, parked below.

---

## Parked / open placeholders

1. **Popover contents** — open brainstorm. Candidate fills to explore later (not decided):
   latest commit/PR, liveness detail, open-bead summary, last handoff, deploy status,
   "what an agent would pick up next". Output of the spike is a contents spec.
2. **Full per-tile link set** — beyond GitHub + app: deploy dashboard, CI, docs, logs? Keep
   the contract extensible.
3. **Default selection policy** — fixed morning-cockpit vs. most-active.
4. **Transition design** — direction/persistence/empty-state for the Section-00 swap.

## Parked workstream — schema & interface (not a UX flow)

The operator was explicit: every flow here rides a **rock-solid core schema** that this UI
work must *refine, never drift*, read through a **data-adapter layer — a GraphQL interface**
that serves **human and agentic readers identically** (same view, same contract — "I need
human and agents to be able to read it together"). This is a foundational spin-off workstream,
captured as **ADR-0011** and **Track G** in the rollout. The infrastructure to fan this work
across linked, worktree-isolated, phase-gated sessions is the operator's separate framework
(a later task) — referenced here only for context planning, not built in this session.

**Architectural invariant to preserve:** none of these flows add a write path. Selection,
launch links, popovers, and repo-scoped briefings are all **read-only** (ADR-0001); the sole
upstream write remains Handoff Emission (ADR-0005). State this in every slice so it stays true.
