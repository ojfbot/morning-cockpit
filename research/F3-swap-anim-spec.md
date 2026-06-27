# Spec — F3: Animated Section-00 swap

Feature spec for Slice **F3** (Track F, Flow 01). Decision of record: **ADR-0012 #5** (the selection
swap is animated as a deliberate transition). Entrance gate: **F2** (real content to swap) ✅.
Renderer + CSS only. Plan only — execute via `/tdd`.

## Problem statement

F2 swaps Section 00's Briefing per selected repo, but the change is an **instant content replace** —
it reads as a flash, not a deliberate transition. F3 makes the swap **animated** (a brief fade + rise
on the incoming content) so toggling across the fleet feels like turning pages, and it **respects
`prefers-reduced-motion`** (no a11y/vestibular cost) — which the app currently honors nowhere.

**Assumptions:**
1. **Enter-animation, not a full exit/enter choreography.** Pure CSS, no animation library. On repo
   change the content area remounts (`key={repo}`) and plays an entrance keyframe. The Section frame
   (index/kicker/title) **persists**; only the content swaps. The "out" is the existing instant clear
   during F2's loading state — adding a library for a true exit is out of scope/over-weight.
2. **Tokens, not magic numbers.** Use `--gt-duration` (220ms) + `--gt-ease`; consistent with the
   existing GroupThink motion language.
3. **No layout jank.** The animation is transform/opacity only (compositor-friendly), no width/height
   reflow.

## Proposed solution

**CSS (`packages/renderer/src/styles/app.css`):**
```css
@keyframes briefing-enter {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.briefing-swap { animation: briefing-enter var(--gt-duration) var(--gt-ease); }
@media (prefers-reduced-motion: reduce) {
  .briefing-swap { animation: none; }   /* instant — honor the user preference */
}
```

**Renderer (`Briefing.tsx`):** add `key={repo}` + the `briefing-swap` class to the content container
in BOTH returns (the populated `.briefing` and the empty `.briefing--empty`). On `selectedRepo`
change the container remounts and the entrance animation plays once; the same key across the
loading→loaded transition means it doesn't re-fire mid-load.

## Acceptance criteria (C0 → C1)
1. **C0 (design, Verif):** transition recorded — direction (rise+fade in), what persists (Section
   frame) vs swaps (content), reduced-motion = instant. (This spec.)
2. **C1 (transition, Valid):** changing the selected repo plays the entrance animation on the new
   content; **`prefers-reduced-motion: reduce` disables it** (instant); no layout jank
   (transform/opacity only). **Pass = animated swap on change AND reduced-motion honored — both.**
3. `pnpm build && pnpm test && pnpm typecheck` green. Renderer suite stays green; a component test
   asserts the swap container carries `briefing-swap` and is keyed by repo.
4. **Browser verify:** toggle ≥2 tiles → the content visibly animates in; with reduced-motion the
   swap is instant (no animation).

## Test matrix
| # | Scenario | Input | Expected | Type |
|---|----------|-------|----------|------|
| T1 | swap container present | render Briefing (populated) | a `.briefing-swap` element keyed by repo | component |
| T2 | empty state animates too | render Briefing (quiet repo) | `.briefing-swap` present on the empty First Move | component |
| T3 | re-keys on repo change | rerender with new selectedRepo | the swap container remounts (key changes) | component |
| T4 | reduced-motion (visual) | emulate `prefers-reduced-motion: reduce` | no animation; instant swap | Playwright |
| T5 | no jank (visual) | toggle tiles | transform/opacity only; no reflow flash | Playwright |

## Open questions
- **Q1 (animate empty too?):** yes — the empty First Move also uses `briefing-swap` so a quiet repo
  swaps with the same motion (consistent). Recommend yes.
- **Q2 (exit animation later?):** a true out→in choreography needs a transition library; deferred. F3
  ships enter-only, which already removes the flash. Note for a later polish slice if desired.

## ADR note
Executes ADR-0012 #5. No new ADR. F4 (designed empty) composes with the `briefing-swap` wrapper.
