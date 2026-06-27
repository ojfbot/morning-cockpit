# Spec — F1: Fleet selection state (+ RepoCardView extraction)

Feature spec for Slice **F1** of the dashboard-UX rollout (Track F, Flow 01). Decision of record:
**ADR-0012** (Fleet selection drives a repo-scoped Briefing — decisions 1–5). Renderer-only, smallest
blast radius. Plan only — execute via `/plan-feature` → `/tdd`.

## Problem statement

Today the Fleet (`FleetSection.tsx`) renders read-only repo cards with a **static** highlight driven by
the server `repo.here` flag (always morning-cockpit). There is no selection: clicking a tile does
nothing, and `cockpitState.ts` (`mc.cockpit.v1`) has no `selectedRepo`. ADR-0012 makes Fleet a
**selector** — clicking a tile sets the selection and moves the highlight; selection persists across
reload. F1 ships *only the selection* (the Briefing content does **not** change yet — that is F2). F1
also extracts `RepoCardView` into its own file so the later tile-links (L1) and popover (L3) slices
graft onto a stable seam instead of three-way-conflicting on `FleetSection.tsx` (the worktree-hygiene
note in the rollout).

**Assumptions made explicit:**
1. **Selection lives in UI state**, not the read-model — `selectedRepo` joins `mc.cockpit.v1`
   (`cockpitState.ts`), persisted wholesale like the other axes. Read-only (ADR-0001); no write path.
2. **Default = morning-cockpit** (fixed home, ADR-0012 #3). At load the highlight is where it is today.
3. **Highlight follows selection**, not `repo.here`. `repo.here` remains the "★ home base" marker;
   the active border (`repo-card--here` style, reused) follows `selectedRepo === repo.name`.
4. **Briefing is untouched.** `Briefing` keeps reading the global briefing; F2 will read `selectedRepo`.

## Proposed solution

**State (`cockpitState.ts`):** add `selectedRepo: string` to `CockpitUiState` + `DEFAULTS`
(`'morning-cockpit'`). `loadState`/`saveState` already persist the whole object — no other change; a
pre-existing persisted blob without the key falls back to the default via the `DEFAULTS` spread.

**Wiring (`App.tsx` → `FleetSection`):** pass `selectedRepo={ui.selectedRepo}` +
`onSelectRepo={(name) => setUi((s) => ({ ...s, selectedRepo: name }))}` to `<FleetSection>`. App's
existing `useEffect([ui])` persists it. (Same `ui`/`setUi` pattern already used for `Briefing`.)

**Extraction (`components/RepoCardView.tsx`):** move the nested `RepoCardView` out of
`FleetSection.tsx` into its own file. New props: `{ repo, selected, onSelect, relativeTime }`. The card
becomes **interactive + accessible**: `role="button"`, `tabIndex={0}`, `aria-pressed={selected}`,
`onClick={() => onSelect(repo.name)}`, and `onKeyDown` for Enter/Space. The highlight class is driven
by `selected`. `FleetSection` imports it and passes `selected={selectedRepo === r.name}`.

**Renderer test infra (first in this package):** the renderer has no tests yet. Add `jsdom` +
`@testing-library/react` + `@testing-library/user-event` (devDeps) and a `vitest.config.ts` with
`environment: 'jsdom'`. This is the foundation F3/F4/L1/L3 also need.

## Acceptance criteria (Control Gates C0 → C1)
1. **C0 (state, Verif):** `selectedRepo` is in `mc.cockpit.v1` with default `'morning-cockpit'`;
   `loadState()` returns it; a persisted blob missing the key still yields the default.
2. **C1 (wiring, Valid) — TPM 100%:** clicking any `RepoCardView` calls `onSelect(name)`; the selected
   card carries the highlight + `aria-pressed=true`; selection **persists across reload** (written to
   `localStorage`). **Pass = every tile selectable + the choice survives a reload.** The Briefing
   content is unchanged by selection (guard).
3. `pnpm build && pnpm test && pnpm typecheck` green; the new renderer tests run under jsdom. No
   server/shared change. No new write path. The G0/G1 server suites stay green (untouched).

## Test matrix
| # | Scenario | Input / state | Expected | Type |
|---|----------|---------------|----------|------|
| T1 | default selection | fresh `loadState()` | `selectedRepo === 'morning-cockpit'` | unit |
| T2 | persisted-blob migration | stored `mc.cockpit.v1` without `selectedRepo` | falls back to default | unit |
| T3 | persistence round-trip | `saveState({…selectedRepo:'core'})` → `loadState()` | `'core'` | unit |
| T4 | card click selects | render `RepoCardView`, click | `onSelect('<name>')` called once | component (jsdom) |
| T5 | keyboard select | focus card, press Enter/Space | `onSelect` called (keyboard-reachable) | component |
| T6 | selected styling | `selected={true}` | highlight class + `aria-pressed="true"` | component |
| T7 | highlight follows selection | FleetSection, select a non-home tile | highlight moves off morning-cockpit | component |
| T8 | briefing untouched | select a repo | Briefing render output unchanged (no F2 yet) | component/guard |

## Open questions (settle at `/plan-feature`)
- **Q1 (highlight vs home marker):** reuse `repo-card--here` for the selected highlight (no CSS change)
  vs add a `repo-card--selected` class? Recommend **reuse** for F1 (minimal); a distinct home-vs-selected
  visual can come with F3's transition design.
- **Q2 (test infra):** `@testing-library/react` + jsdom (recommend — durable unit/component tests) vs a
  Playwright browser check only? Recommend testing-library now (F3/F4/L1/L3 reuse it); a Playwright
  smoke can still verify the full flow.
- **Q3 (selection of a quiet repo):** selecting a repo with no activity is fine in F1 (no briefing change);
  the truthful-empty concern is **F4**, not here. No action.

## ADR note
Executes ADR-0012 (#1–#5). No new ADR. The `RepoCardView` extraction path is reported to L1/L3 as their
graft seam.
