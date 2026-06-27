# Spec — F4: Truthful empty First Move (designed)

Feature spec for Slice **F4** (Track F, Flow 01). Decision of record: **ADR-0012 #4** (a quiet repo
shows a truthful empty First Move, never a fabricated thread). Entrance gate: **F2** (briefing shape) ✅.
Renderer + a guarantee test. Plan only — execute via `/tdd`.

## Problem statement

F2 already makes a quiet repo render an honest empty (`threads: []`, "nothing to fabricate") and the
server never fabricates (empty scope → deterministic floor, LLM constrained to the scoped repo). But:
1. The empty state is a **bare `<p>`** with no dedicated styling, and **loading and quiet share the
   same markup** — a quiet repo and a still-loading one look identical.
2. The **fabricated-thread = 0** honesty guarantee (ADR-0012 #4) is implied by F2's tests but not a
   first-class, regression-locking gate.

F4 ships the **designed** empty state (distinguishing loading from quiet) and the **explicit honesty
gate**. It does **NOT** build the *suggested-entrypoints* empty state (new threads / audits /
integrations) — that is an operator design-review item, captured in
`research/empty-state-design-followup.md`, and likely its own later slice.

## Proposed solution

**Contract (C0):** the empty shape is already `BriefingSnapshot { repo, threads: [], source }` — no new
SDL field. The design is renderer-side; the honesty guarantee rides the existing shape.

**Renderer (`Briefing.tsx`):** split the single `!active` return into two distinct, designed states:
- **Loading** (`source === 'loading'`): an intentional "reading the scan…" state (subtle pulse), so a
  toggle never reads as "empty" while the floor is still in flight.
- **Quiet** (loaded, no threads): a designed empty First Move — calm editorial treatment: a headline
  ("All quiet"), a **truthful** subline naming the repo and *why* it's empty (no pickup/stale work
  waiting on a decision), and an honest footnote. No fabricated thread, no fake affordance. (The
  suggested-entrypoints affordances are deferred — a comment points to the design-review note.)

**CSS (`styles/app.css`):** a dedicated `.briefing--empty` / `.briefing--loading` treatment (centered,
muted, editorial), reusing GroupThink tokens; keeps the `.briefing-swap` F3 animation.

## Acceptance criteria (C0 → C1)
1. **C0 (contract, Verif):** the empty state renders from `threads: []` on the existing contract; no
   new SDL field; loading and quiet are visually + structurally distinct.
2. **C1 (honesty, Valid) — TPM = 0 fabricated threads:** a **no-activity repo renders the designed
   empty First Move and ZERO threads** — never the previous repo's threads, never a fabricated/mock
   thread. **Pass = fabricated-thread count on quiet repos = 0**, asserted across several repos +
   across a swap from a populated repo to a quiet one.
3. `pnpm build && pnpm test && pnpm typecheck` green; renderer suite + the server honesty tests stay
   green. Renderer-only; no server/shared/contract change; no write path.
4. **Browser verify:** a quiet repo (e.g. lean-canvas) shows the designed empty First Move; a loading
   toggle shows the loading state, not a false "empty".

## Test matrix
| # | Scenario | Input | Expected | Type |
|---|----------|-------|----------|------|
| T1 | quiet repo → designed empty | stream yields `threads: []` | empty First Move; 0 `.thread`; "All quiet"-style copy naming the repo | component |
| T2 | loading ≠ empty | source still `loading` | loading treatment shown, NOT the quiet/empty copy | component |
| T3 | swap populated → quiet (no leak) | render core (threads) → rerender quiet repo | 0 threads after swap; no core thread leaks | component |
| T4 | fabricated-thread = 0 (gate) | several quiet repos | every one renders empty with 0 threads | component (parametric) |
| T5 | visual | Playwright | designed empty card on a quiet repo; loading state distinct | Playwright |

## Open questions
- **Q1 (richness):** F4 ships the *plain designed* empty (headline + truthful subline). The
  **suggested-entrypoints** version (new-thread / audit / integration affordances) is **out of F4** —
  design-review item per `empty-state-design-followup.md`. Recommend: keep F4 honest-and-calm; the
  entrypoints become a later slice once the design review picks contents + maps them to real verbs.
- **Q2 (surface why-empty data?):** could the subline show the repo's last-activity / liveness (real
  fleet data) to make "quiet" informative? That needs the fleet metadata in the Briefing (new prop).
  Recommend **defer** — keep F4 renderer-local; richer context belongs with the entrypoints redesign.

## ADR note
Executes ADR-0012 #4. No new ADR. Composes with F3's `.briefing-swap` and the F2 contract.
