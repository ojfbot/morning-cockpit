# Dashboard UX rollout — Control-Gated Slices (ADR-0010 + ADR-0011)

Buildable decomposition of the 2026-06-25 UX brainstorm. Source of truth:
`research/dashboard-ux-flows.md` (Flows 01 + 02), `decisions/adr/0010` (Fleet→Briefing
coupling + tile launch surface), `decisions/adr/0011` (GraphQL read-model contract).
Plan only — slices execute via `/plan-feature` → `/tdd`; each slice's C0 gate is its
feature spec (the `research/<slice>-spec.md` artifact), authored by the session that owns it.

**Restatement:** Make Fleet a selector that swaps a **repo-scoped** Briefing in with an
animated transition, turn each tile into a **launch surface** (GitHub + running/deployed app +
extensible links) with a keyboard-reachable popover, and stand up the **GraphQL read-model
contract** (one typed shape for human UI + agent readers) that the repo-scoped data lands on
without schema drift.

**Warrants Control-Gated Slices: yes** — too big for one PR, spans three packages (shared
contract + server read-model + renderer interaction), introduces a foundational contract layer,
and must be distributable across linked, worktree-isolated sessions. **But note the load-bearing
honesty:** unlike the coordination rollout, this introduces **NO action-taking control** — every
slice is read-only (ADR-0001); nav-away is navigation, not a write; Handoff Emission (ADR-0005)
stays the sole write path. So **no slice needs a shadow stage** — all gates are Verification
(meets spec) or Validation (behaves right), none are Brassboard.

> Harness terms reused from `coordination-rollout-gated-slices.md`: **vertical slice** and the
> C0…Cn **Control Gates** (MOE → MOP → TPM with thresholds; V&V = Verification / Validation).

## Tracks & slices (vertical, value-first / contract-first)

Three tracks. **Track G** (contract) gates the data-bearing slices; **Track F** (Flow 01,
Fleet→Briefing) and **Track L** (Flow 02, launch surface + popover) hang off it.

| # | Slice | Layers traversed | Observable value shipped |
|---|-------|------------------|--------------------------|
| G0 | **Schema audit + read-model contract spec** | core shapes review → SDL draft → `@cockpit/shared` parity plan | the typed contract exists; drift becomes a build failure, not a hope |
| G1 | **GraphQL read facade (parity)** | server resolvers → existing aggregate → SDL | fleet + briefing served over one typed query; an agent can read the same shape the UI does |
| F1 | **Selection state** | `cockpitState.ts` → App → Fleet/Briefing | clicking a tile moves the highlight; selection persists (no briefing change yet) |
| F2 | **Repo-scoped Briefing** | GraphQL `briefing(repo:)` → `briefing-generate` → shared | Section 00 content changes per selected repo — the core of Flow 01 |
| F3 | **Animated swap** | renderer transition + CSS | the First Move + threads animate out/in on selection change |
| F4 | **Truthful empty First Move** | shared empty-state contract → renderer | a quiet repo shows an honest empty brief, not a fabricated thread |
| L1 | **Tile link set** | `fleet-config.ts` + SDL → renderer | tiles launch to GitHub + the app (extensible link list) |
| L2 | **Live-state app probe** | server runtime probe (read-only) → SDL → renderer | the local-app link is valid only when the app is actually running |
| L3 | **Popover shell (a11y)** | renderer popover + CSS | hover-OR-focus popover, keyboard-reachable, defined dismiss — placeholder contents |
| L3s | **Popover contents spike** | design exploration → contents spec | decides what the popover says (feeds a later L4 build) |

Contract-first is **forced**: F2, L1, and L2 all surface new shapes — they must land on the G0
contract, or they drift exactly the way ADR-0011 exists to prevent.

## Track G — Schema & interface contract (ADR-0011)

### Slice G0: Schema audit + contract spec — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 audit | ADR-0011 Proposed; `dolt-bead.ts` mirror current | one-shot: which core shapes are stable enough to pin; churn risks named | Verif |
| C1 SDL draft | C0 | MOE: one contract covers the UX surface → MOP: SDL types for repo card, repo-scoped briefing, links, liveness, popover payload → **TPM: UX fields with an SDL type / total; pass = 100%** | Verif |
| C2 parity discipline | C1 | MOE: SDL and `@cockpit/shared` can't diverge silently → MOP: codegen or parity test chosen + wired → **TPM: SDL↔type mismatch fails the build; pass = a deliberate drift breaks CI** | Verif |

Read-only invariant recorded at C0: the schema is **query-only**; no mutation type. (ADR-0011 #4.)

### Slice G1: GraphQL read facade (parity) — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 endpoint | G0 C2 | one-shot: GraphQL server stands up beside REST; resolves against existing `aggregate` | Verif |
| C1 parity | C0 | MOE: same data, one typed shape → MOP: fleet + briefing fields match the REST snapshot → **TPM: fields at parity / total vs REST baseline; pass = 100%, no data-only-in-REST** | Valid |
| C2 read-only proof | C1 | MOE: the facade never writes → MOP: resolver write-surface → **TPM: resolvers that touch Dolt/`gh` with side effects; pass = 0 (asserted by test)** | Verif |

## Track F — Flow 01: Fleet selection drives the Briefing (ADR-0010)

### Slice F1: Selection state — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 state | none (renderer-only) | one-shot: `selectedRepo` added to `mc.cockpit.v1`; default = morning-cockpit | Verif |
| C1 wiring | C0 | MOE: Fleet acts as a selector → MOP: tile click sets `selectedRepo`, highlight follows, persists across reload → **TPM: highlight tracks selection; pass = 100% of tiles selectable + persisted** | Valid |

No data dependency — F1 ships against the current global briefing (highlight moves, content
unchanged) so it can land before F2. Renderer-only; smallest blast radius.

### Slice F2: Repo-scoped Briefing — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 query | G1 C1 (facade serves briefing); F1 (selection exists) | one-shot: `briefing(repo:)` arg + per-repo generation shape recorded | Verif |
| C1 scoping | C0 | MOE: the brief matches the selected repo → MOP: First Move + seated threads computed per repo → **TPM: brief.repo == selectedRepo on a labelled set; pass = 100%** | Valid |
| C2 swap-on-select | C1 | MOE: toggling triages each app → MOP: changing selection refetches/rebinds Section 00 → **TPM: content changes for N repos; pass = each selected repo yields its own brief or honest empty (F4)** | Valid |

### Slice F3: Animated swap — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 design | F2 C1 (real content to swap) | one-shot: transition direction, what persists vs. swaps, empty-state motion | Verif |
| C1 transition | C0 | MOE: the swap reads as deliberate, not a flash → MOP: out/in animation on selection change, reduced-motion respected → **TPM: no layout jank + `prefers-reduced-motion` honored; pass = both** | Valid |

### Slice F4: Truthful empty First Move — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 contract | F2 C0 (briefing shape) | one-shot: empty-state shape (a repo with no threads) defined in the SDL | Verif |
| C1 honesty | C0 | MOE: a quiet repo doesn't lie → MOP: no-activity repo renders honest empty, not a fabricated thread → **TPM: fabricated-thread rate on quiet repos; pass = 0** | Valid |

## Track L — Flow 02: Launch surface + popover (ADR-0010)

### Slice L1: Tile link set — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 links | G0 C1 (link type in SDL) | one-shot: per-repo links in `fleet-config.ts` (github, app, extensible); shape recorded | Verif |
| C1 launch | C0 | MOE: tiles become launchers → MOP: GitHub + app links render + open correctly → **TPM: tiles with a working GitHub + app link / total; pass = 100% where a URL exists, honest absence otherwise** | Valid |

### Slice L2: Live-state app probe — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 probe | L1; G1 (field on the SDL) | one-shot: read-only runtime probe (is local app up? deployed URL?) defined; no side effects | Verif |
| C1 validity | C0 | MOE: the local link is never a dead link → MOP: local link enabled only when the app responds, else deployed/disabled → **TPM: misleading local links; pass = 0** | Valid |

### Slice L3: Popover shell (a11y) — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 shell | F1 (tiles interactive) | one-shot: trigger model (hover OR focus), dismiss/persist behavior recorded | Verif |
| C1 a11y | C0 | MOE: keyboard users get the popover → MOP: focus-trigger + Esc-dismiss + ARIA → **TPM: keyboard-reachable + screen-reader-announced; pass = both, no mouse-only path** | Valid |

### Slice L3s: Popover contents spike (design)
Not a build gate — a design exploration. Output: a contents spec (candidate fills from
`research/dashboard-ux-flows.md` placeholder 1: latest commit/PR, liveness detail, open-bead
summary, last handoff, deploy status, "what an agent would pick up next"). Feeds a later L4 build
slice once the contents are chosen. **Do not build popover contents before this spike resolves.**

## Dependency DAG & worktree distribution

```
G0 ──► G1 ──► F2 ──► F3
 │      │      └────► F4
 │      └────► L2
 ├────► L1 ──► L2
 └────► (F1 needs nothing; L3 needs F1; L3s is standalone)

F1 ──► L3
```

**Critical path:** G0 → G1 → F2 → F3 (the contract gates the whole repo-scoped Briefing).

**Parallelizable sets (separate worktrees, minimal file collision):**
- **Wave 1 (parallel):** `G0` (server+shared contract), `F1` (renderer/`cockpitState`,
  `App`, `FleetSection`, `Briefing` selection wiring), `L3s` (design doc only). F1 and G0 touch
  disjoint packages; L3s touches none.
- **Wave 2 (after G1):** `F2` (server `briefing-generate` + resolver + shared) ∥ `L1`
  (`fleet-config` + renderer Fleet links). **Collision note:** F1, L1, L3 all edit
  `FleetSection.tsx` — serialize the renderer edits or split the component first (extract
  `RepoCardView` into its own file in F1 so L1/L3 attach cleanly without three-way conflicts).
- **Wave 3:** `F3`, `F4`, `L2`, `L3` — each narrow; F3/F4 are renderer+shared, L2 is server, L3
  is renderer. L2 ∥ (F3/F4) cleanly (server vs renderer).

**Worktree hygiene for the linked sessions:** the renderer is the shared-edge package — extract
`RepoCardView` and lift selection state **first (F1)** so later tiles/popover slices graft onto
stable seams instead of fighting over `FleetSection.tsx`. The contract (G0/G1) is the other
shared edge — pin the SDL before F2/L1/L2 so the data slices don't each invent a shape.

## Cross-slice notes
- **Write boundary:** none. Every slice is read-only (ADR-0001); nav-away is navigation; Handoff
  Emission (ADR-0005) remains the only write. No shadow stage anywhere — this is the key contrast
  with `coordination-rollout-gated-slices.md`, whose S6 was an action-taking control.
- **Contract is the spine:** G0/G1 exist so F2/L1/L2 land one typed shape for human + agent
  readers. Skipping them re-creates the per-route drift ADR-0011 is written to kill.
- **Honesty carries through:** F4 (truthful empty) and L2 (no dead local links) are the
  honest-gaps discipline applied to the new surface — don't paper over a quiet repo or a
  not-running app.
- **Open spikes feeding later work:** L3s (popover contents), F3 C0 (transition design), and the
  default-selection policy (ADR-0010 #3, settled as fixed-home unless revisited).

**Next:** hand **G0 (schema audit + contract spec)** and **F1 (selection state)** to
`/plan-feature` → `/tdd` as the two Wave-1 sessions; queue G0 as the gating artifact since F2/L1/L2
all wait on it. L3s can start in parallel as a pure design doc.
