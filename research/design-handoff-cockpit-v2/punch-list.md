# Punch list — known defects & incompleteness in the v2 prototype

Honest inventory so nobody recreates a bug faithfully. Ordered by user-visible impact.

## Wiring (the "looks unwired" class — mostly fixed, pattern must carry over)
- Decision counts now derive from one selector (emit propagates: dial, hero, spine, chips).
  **Still hardcoded:** 42 pickups, loop 80/7d + 3-events-since, beads-scanned, stat rails,
  sinceGap ("2H"/"4H"), reading/research/newline contents. Implementation rule: no surface
  hardcodes a number — everything through the snapshot selectors.
- "Since you last looked" has no stored last-viewed timestamp yet (needs one; new).
- Leo replies are canned (500ms setTimeout); share-to-global toggle is UI-only; threads don't
  persist. Real path: `/api/chat` + keyed store (see core brief re #340).
- "Open briefing ↗" re-scopes the briefing pane but doesn't select a matching thread when one
  exists for that repo (should).

## Day dial
- Center is underfilled at a glance (operator flag). Add ONE: next-anchor ETA, loop-events
  count-up, or phase glyph.
- Event dots are mock hours; needle-less design means "now" is just a dot — consider a thin
  radius line at low opacity.
- No tooltip/legend for arc segments; dial is silent for screen readers (needs role=img +
  label).

## Canon diagrams
- D5/D6 only; D7–D8 absent (vault-only). D5 is simplified (no per-cluster NS counts on
  edges); D6 lacks arrowheads and the dotted return edge needs a label leader line.
- Prototype vol.3's mermaid rendered white-on-dark — the implementation must theme mermaid
  dark-native (or render via the D5 generator) — never embed light-theme SVGs.

## Canvas
- Edge bundling is cluster-level only; constellation labels can collide near vertical angles;
  pan is unbounded (can lose the world — clamp to world rect + padding); zoom is buttons-only
  (wheel zoom deliberately omitted to avoid scroll hijack — revisit with modifier-key wheel).
- No keyboard navigation, no tab stops on SVG nodes, ESC/Enter only (RFI D27 acknowledged
  gap). Needs tabindex/role/focus-ring pass.
- Cluster assignment of unregistered repos is [JUDGMENT] — badge is in the legend, should
  also appear in the inspector for those nodes.

## Layout / rendering
- Hero (~340px) + meta bar leave <60% viewport for content at 900px-tall windows; spec a
  collapse-on-scroll (hero shrinks to a one-line strip with the dial as a 24px inline glyph).
- Grid SIGNAL cards don't show cluster; dormant dotted-underline (unregistered) is too subtle.
- Briefing question truncates titles at 52 chars mid-word.
- Newline unit titles are invented placeholders — replace with real unit names from vault
  notes at implementation.
- Rail at very short viewports: fixed (grid minmax clamps) — keep the constraint when porting.

## Content honesty
- Repos without authored prose fall back to "No explainer authored yet" — correct behavior,
  but the inspector should link "author it" to the vault entity page.
- Prototype stat "45 repos in census" traces to a 2026-07 operator-memory record (RFI A9) —
  badge as stale-capable wherever it renders.
