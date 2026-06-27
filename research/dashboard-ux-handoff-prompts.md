# Dashboard UX rollout — local handoff prompts

Operator runbook for picking up the dashboard UX rollout
(`research/dashboard-ux-rollout-gated-slices.md`) as decomposed Claude Code sessions on
macOS, one worktree per slice. Copy a fenced prompt into a fresh `claude` session in that
slice's worktree.

Convention (matches the existing rollout): each slice's **C0 gate is its feature spec** —
the session writes `research/<slice>-spec.md` first (format = `research/S1-event-spine-spec.md`),
then executes via `/plan-feature` → `/tdd`. Invariants in every slice: **read-only**
(ADR-0001), **mirror-don't-import**, **truthful empty states**, the only write path stays
Handoff Emission (ADR-0005). No slice is an action-taking control → no shadow stage.

## 0 · Get the docs onto your Mac

```bash
cd ~/dev/morning-cockpit          # your local clone
git fetch origin claude/dashboard-ux-flows-gr6l4e
```

The ADRs (`0012`, `0011`) + the two research docs live on that branch. Base each slice
worktree off it so the docs travel with the worktree. (Or merge that branch to `main` first —
it's pure additive docs — and base the worktrees off `main`.)

## 1 · Worktree setup (pnpm monorepo — install per worktree)

Wave 1 can start immediately (no upstream dependency):

```bash
BASE=origin/claude/dashboard-ux-flows-gr6l4e
git worktree add -b claude/ux-g0-contract        ../mc-g0  $BASE
git worktree add -b claude/ux-l3s-popover-spike  ../mc-l3s $BASE
git worktree add -b claude/ux-f1-selection       ../mc-f1  $BASE
for d in ../mc-g0 ../mc-l3s ../mc-f1; do (cd "$d" && pnpm install); done
```

Then in each: `cd ../mc-g0 && claude`, and paste that slice's prompt.

**Dependency basing for later waves:** a slice that depends on another must be based on the
dependency's branch once it lands (or on `main` after it merges). E.g. base F2/L1/L2 off
`claude/ux-g1-graphql-facade` after G1 is pushed:
```bash
git worktree add -b claude/ux-f2-repo-briefing ../mc-f2 origin/claude/ux-g1-graphql-facade
```

**Critical path:** G0 → G1 → F2 → F3. Start G0 first; it gates F2/L1/L2.

---

## Wave 1 — start now (no upstream gate)

### G0 · Schema audit + GraphQL read-model contract spec  → `../mc-g0`

```text
You're picking up Slice G0 of the morning-cockpit dashboard UX rollout. This is the GATING
slice — F2, L1, and L2 all wait on the contract you produce, so correctness here matters most.

Read first, in this repo:
- CLAUDE.md and CONTEXT.md (standalone read-only posture + ubiquitous language)
- decisions/adr/0011-graphql-read-model-one-contract-human-and-agent.md (your decision of record)
- decisions/adr/0001-standalone-readmodel.md (mirror-don't-import, read-only carve-outs)
- research/dashboard-ux-rollout-gated-slices.md → "Track G" and "Slice G0" gates
- research/dashboard-ux-flows.md → "parked workstream — schema & interface"
- The read surface you're pinning a contract over: packages/shared/src/fleet.ts,
  packages/shared/src/dolt-bead.ts, packages/server/src/aggregate.ts,
  packages/server/src/routes/*.ts

Your slice (query-only; NO mutations — ADR-0001/0011):
1. (C0) Audit which core/mirrored shapes are stable enough to pin a contract on; name churn risks.
2. (C1) Draft the GraphQL SDL covering the dashboard UX surface: repo card, repo-scoped briefing,
   tile links, liveness, popover payload. Target: 100% of UX fields have an SDL type.
3. (C2) Decide AND wire the SDL↔@cockpit/shared parity mechanism (codegen or a parity test) so a
   deliberate drift breaks the build.

Deliverable order: write the C0 feature spec to research/G0-contract-spec.md FIRST (problem /
proposed SDL / acceptance criteria / test matrix / open questions / ADR note), matching
research/S1-event-spine-spec.md. Then execute via /plan-feature → /tdd.

Hard constraints: query-only schema; assert with a test that no resolver writes Dolt or gh;
mirror-don't-import. Stay in this worktree — do NOT edit the renderer or fleet-config.ts (other
slices own those). When done: commit to claude/ux-g0-contract, push, and report the final SDL +
the parity decision so the dependent sessions can base off your branch.
```

### F1 · Selection state  → `../mc-f1`

```text
You're picking up Slice F1 of the morning-cockpit dashboard UX rollout — make Fleet a selector.
Renderer-only, smallest blast radius. This slice also de-risks later worktrees by splitting the
shared component, so do the extraction cleanly.

Read first:
- CLAUDE.md, CONTEXT.md
- decisions/adr/0012-fleet-selection-drives-repo-scoped-briefing.md (decisions 1–5)
- research/dashboard-ux-rollout-gated-slices.md → "Slice F1" + the "worktree hygiene" note
- research/dashboard-ux-flows.md → "Flow 01"
- packages/renderer/src/cockpitState.ts, packages/renderer/src/App.tsx,
  packages/renderer/src/components/FleetSection.tsx,
  packages/renderer/src/components/briefing/Briefing.tsx

Your slice (read-only UI state):
1. (C0) Add `selectedRepo` to the mc.cockpit.v1 state in cockpitState.ts; default = morning-cockpit.
2. (C1) Clicking a Fleet tile sets selectedRepo and moves the highlight; persists across reload.
   The Briefing does NOT change content yet (that's F2) — only the selection/highlight moves.
3. Hygiene (load-bearing for L1/L3): extract RepoCardView out of FleetSection.tsx into its own
   file so the later tile-links (L1) and popover (L3) slices graft onto a stable seam instead of
   three-way-conflicting on FleetSection.tsx.

Deliverable order: write research/F1-selection-spec.md first (format = research/S1-event-spine-spec.md),
then /plan-feature → /tdd.

Constraints: read-only; no new write path; no server/shared changes beyond what selection needs.
Commit to claude/ux-f1-selection, push, and report the new seams (selectedRepo shape + the
extracted RepoCardView path) so L1/L3 can build on them.
```

### L3s · Popover contents spike (design)  → `../mc-l3s`

```text
You're picking up Slice L3s of the morning-cockpit dashboard UX rollout — a DESIGN SPIKE, not a
build. No app code. Output is a contents spec that a later L4 build slice will implement.

Read first:
- CLAUDE.md, CONTEXT.md
- research/dashboard-ux-flows.md → "Flow 02" + "open placeholders" (placeholder 1)
- research/dashboard-ux-rollout-gated-slices.md → "Slice L3s"
- decisions/adr/0012-...md (decision 7 — popover shell vs. contents deferred)
- For grounding on what data exists to surface: packages/shared/src/fleet.ts,
  packages/server/src/adapters/dolt.ts, packages/shared/src/liveness.ts

Your job: decide WHAT the per-tile hover/focus popover should say. Evaluate the candidate fills
(latest commit/PR, liveness detail, open-bead summary, last handoff, deploy status, "what an agent
would pick up next") against: is the data already in the read-model? is it legible at a glance? does
it earn the hover? Recommend a concrete contents set + layout, and flag any field that needs new
read-model work (hand that to a follow-on slice).

Deliverable: research/L3s-popover-contents-spec.md (recommended contents, layout sketch in prose,
data-availability per field, what's deferred). No /tdd — this is a doc. Commit to
claude/ux-l3s-popover-spike, push, report the recommendation.
```

---

## Wave 2 — after G1 lands

### G1 · GraphQL read facade (parity)  → `../mc-g1` (base off `claude/ux-g0-contract`)

```text
You're picking up Slice G1 of the morning-cockpit dashboard UX rollout — stand up the GraphQL read
facade beside the existing REST, at parity. Entrance gate: G0's SDL + parity mechanism (read
research/G0-contract-spec.md and the SDL it produced).

Read first: CLAUDE.md, CONTEXT.md, decisions/adr/0011-...md, research/G0-contract-spec.md,
research/dashboard-ux-rollout-gated-slices.md → "Slice G1", packages/server/src/aggregate.ts,
packages/server/src/index.ts, packages/server/src/routes/*.ts.

Your slice (query-only):
1. (C0) GraphQL server stands up alongside REST, resolving against the existing aggregate/adapters.
2. (C1) fleet + briefing fields at 100% parity with the REST snapshot — no data only-in-REST.
3. (C2) Assert with a test that zero resolvers write Dolt or gh (read-only proof).

Deliverable order: research/G1-facade-spec.md first, then /plan-feature → /tdd. Keep REST live (no
removal). Commit to claude/ux-g1-graphql-facade, push, report the endpoint + parity result so
F2/L1/L2 can base off your branch.
```

### F2 · Repo-scoped Briefing  → base off `claude/ux-g1-graphql-facade` (needs F1 too)

```text
You're picking up Slice F2 of the morning-cockpit dashboard UX rollout — THE core of Flow 01: make
the Briefing repo-scoped so Section 00 changes per selected repo. Entrance gates: G1 (facade serves
briefing) and F1 (selectedRepo exists). Read research/G1-facade-spec.md and research/F1-selection-spec.md.

Read first: CLAUDE.md, CONTEXT.md, decisions/adr/0012-...md (decisions 1,2,4), decisions/adr/0007,
research/dashboard-ux-rollout-gated-slices.md → "Slice F2", packages/server/src/briefing-generate.ts,
packages/server/src/routes/briefing.ts, packages/renderer/src/components/briefing/Briefing.tsx,
packages/shared/src/briefing.ts.

Your slice (read-only):
1. (C0) Add a `repo` argument to the briefing query + per-repo generation shape.
2. (C1) First Move + seated threads computed per repo; brief.repo == selectedRepo on a labelled set.
3. (C2) Changing the Fleet selection rebinds Section 00 to that repo's brief (or honest empty — F4).

Deliverable order: research/F2-repo-briefing-spec.md first, then /plan-feature → /tdd. Coordinate
the empty-repo shape with F4 (truthful empty). Commit to claude/ux-f2-repo-briefing, push.
```

### L1 · Tile link set  → base off `claude/ux-g1-graphql-facade`

```text
You're picking up Slice L1 of the morning-cockpit dashboard UX rollout — turn tiles into launchers.
Entrance gate: G0 (link type in the SDL). Depends on F1's RepoCardView extraction — build on that
file, don't re-fork FleetSection.tsx.

Read first: CLAUDE.md, CONTEXT.md, decisions/adr/0012-...md (decision 6),
research/dashboard-ux-rollout-gated-slices.md → "Slice L1", packages/server/src/fleet-config.ts,
packages/shared/src/fleet.ts, the extracted RepoCardView (path reported by F1).

Your slice (read-only; nav-away is navigation, not a write):
1. (C0) Add a per-repo extensible link list to fleet-config.ts (github, app, + room for more);
   reflect it on the SDL field from G0.
2. (C1) Tiles render + open GitHub and the app link correctly; 100% where a URL exists, honest
   absence where it doesn't (no dead/placeholder links).

Deliverable order: research/L1-tile-links-spec.md first, then /plan-feature → /tdd. Commit to
claude/ux-l1-tile-links, push.
```

---

## Wave 3 — narrow, late slices

### F3 · Animated swap  → base off `claude/ux-f2-repo-briefing`

```text
Slice F3 of the morning-cockpit dashboard UX rollout — animate the Section-00 swap when the Fleet
selection changes. Entrance gate: F2 (real content to swap). Read decisions/adr/0012 (decision 5),
research/dashboard-ux-rollout-gated-slices.md → "Slice F3", and research/L3s-popover-contents-spec.md
is NOT needed here. Design the transition (C0: direction, what persists vs. swaps, empty-state
motion), then implement (C1: deliberate out/in animation, no layout jank, prefers-reduced-motion
honored). Spec to research/F3-swap-anim-spec.md first, then /plan-feature → /tdd. Renderer + CSS
only (packages/renderer/src/styles/app.css). Commit to claude/ux-f3-swap-anim, push.
```

### F4 · Truthful empty First Move  → base off `claude/ux-f2-repo-briefing`

```text
Slice F4 of the morning-cockpit dashboard UX rollout — a quiet repo shows an honest empty First
Move, never a fabricated thread (CLAUDE.md truthful-empty-states rule). Entrance gate: F2's briefing
shape. Read decisions/adr/0012 (decision 4), research/dashboard-ux-rollout-gated-slices.md →
"Slice F4". C0: define the empty-state shape in the SDL/briefing contract. C1: no-activity repo
renders honest empty; fabricated-thread rate = 0. Spec to research/F4-empty-state-spec.md first,
then /plan-feature → /tdd. Coordinate the shape with F2. Commit to claude/ux-f4-empty-state, push.
```

### L2 · Live-state app probe  → base off `claude/ux-l1-tile-links`

```text
Slice L2 of the morning-cockpit dashboard UX rollout — the local-app link is valid only when the
app is actually running. Entrance gates: L1 (links exist) + G1 (SDL field). Read decisions/adr/0012
(decision 6), research/dashboard-ux-rollout-gated-slices.md → "Slice L2", packages/server/src/adapters/.
C0: define a READ-ONLY runtime probe (is the local app up? deployed URL?) with no side effects.
C1: local link enabled only when the app responds, else deployed/disabled; misleading local links = 0.
Spec to research/L2-live-probe-spec.md first, then /plan-feature → /tdd. Read-only — the probe must
not mutate anything. Commit to claude/ux-l2-live-probe, push.
```

---

## Merge order back up

Land in gate order so each base is real: **G0 → G1 → (F2 ∥ L1) → (F3, F4, L2)**; F1 and L3s can
merge any time (F1 ideally early — its RepoCardView split unblocks L1/L3 cleanly). Re-run
`pnpm build && pnpm test && pnpm typecheck` at each merge; the load-bearing test suite is
`packages/shared` lanes + the new G0 parity check.
