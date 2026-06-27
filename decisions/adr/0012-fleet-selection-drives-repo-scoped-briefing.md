# ADR-0012 — Fleet selection drives a repo-scoped Briefing; tiles become launch surfaces

- **Status:** Proposed (captured from the 2026-06-25 UX brainstorm; accept after Track G C0)
- **Date:** 2026-06-25
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0001 (standalone read-only), ADR-0007 (Briefing console + generated threads), ADR-0008 (derived liveness)
- **Depends on:** ADR-0011 (GraphQL read-model contract) for the repo-scoped data shape
- **Source:** `research/dashboard-ux-flows.md` (Flows 01 + 02)

## Context

Today Section 00 (Briefing) and Section 01 (Fleet) are independent components. The Briefing
fetches **one global** set of seeded threads (`fetchBriefing()`, UI state in
`cockpitState.ts`); Fleet polls `fetchFleet()` and renders read-only repo cards with a static
`here` flag on morning-cockpit. The card grid carries no selection, no links, no popover.

The UX brainstorm surfaced that the design *already implies* a coupling: the highlighted Fleet
tile is morning-cockpit, and the First Move on screen is morning-cockpit's. The operator wants
that coupling made real — Fleet as a **selector**, the Briefing as the **detail view** — so the
morning ritual is "start on home, then toggle across the fleet to triage each app's first move."
Separately, every tile should become a **launch surface** (GitHub + the running/deployed app +
extensible links) with a keyboard-reachable popover.

## Decision

1. **Fleet is the selector; the Briefing is its detail view.** A single `selectedRepo` lives in
   UI state (`cockpitState.ts`, `mc.cockpit.v1`). Clicking a tile sets it and moves the
   highlight; Section 00 renders the First Move + seated threads **for the selected repo**.
2. **The Briefing read-model becomes repo-scoped.** Briefing generation takes a `repo` argument;
   threads are computed per repo, not globally. The data contract is defined in ADR-0011 (Track
   G) so the same shape serves the human UI and agent readers.
3. **Default selection = morning-cockpit (fixed home).** Open at home base; toggling is
   explicit. ("Most-active repo" is rejected for v1 — a moving home is disorienting at 05:34.)
4. **Quiet repos show a truthful empty First Move.** A repo with no activity renders an honest
   empty state (no fabricated thread), per CLAUDE.md's truthful-empty-states rule.
5. **The selection swap is animated** as a deliberate transition (direction/persistence/empty
   handled in the design slice), not an instant content replace.
6. **Tiles carry an extensible link set** — at minimum GitHub repo and the application itself
   (local dev server when live, else deployed home, e.g. `*.gym.software`). Modeled as a list,
   not two fixed buttons. Local-app links are gated on a **live-state** signal of whether the
   app is actually running.
7. **A hover/focus popover** is added per tile — triggered on hover **or** focus
   (keyboard-reachable), with a defined dismiss/persist model. **Contents are deferred** to a
   design spike (`research/dashboard-ux-flows.md` placeholder 1); this ADR commits to the shell
   and a11y model, not the contents.
8. **Read-only is preserved.** Selection, scoping, links, and popovers add **no write path**.
   The only upstream write remains Handoff Emission (ADR-0005). Nav-away is navigation, not a
   mutation.

## Consequences

- Per-repo Briefing is the real cost: every repo needs a First Move + seated threads, where most
  repos currently read "no activity". This forces the empty-state contract (#4) and leans on the
  generated-threads work (ADR-0007) plus liveness (ADR-0008).
- The selection state must be lifted so both Fleet and Briefing read it (App-level, persisted).
- "Is the app running locally / where is it deployed" introduces a new **runtime/live-state**
  read the adapter layer must surface — still read-only.
- The popover-contents and transition designs are explicitly **out of this ADR** and tracked as
  spikes feeding follow-on slices.
- This ADR is **Proposed**, not Accepted: it should be ratified after Track G's contract spec
  (ADR-0011 C0) confirms the repo-scoped read shape, so the UI and the schema land without drift.
