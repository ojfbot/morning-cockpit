---
id: 20260808-2150-brief-cockpit-v2-instrument-shell-and-fleet-navigator
type: brief
title: "Cockpit v2: instrument shell + Fleet Navigator integration (cockpit side of the v2 design pass)"
actor: claude-design-session
to: code-claude
session_id: 2026-08-08T21:50:00Z
refs:
  - file:research/fleet-navigator-rfi-response.md
  - adr:0005
  - adr:0012
  - bead:20260808-2150-brief-canon-wayfinder-closeouts-and-token-vocabulary
status: live
created_at: 2026-08-08T21:50:00Z
labels:
  - cockpit-v2
  - fleet-navigator
  - design-handoff
---

# Brief — pick up: Cockpit v2 instrument shell + Fleet Navigator integration

## Context

The operator ran a design pass over the cockpit + the fleet-navigator prototype
(`prototype/fleet-navigator` @ 0e7ab49, `research/fleet-navigator/`). Decisions are RULED,
not open: three modes in one Fleet section; collapse + spine; strip the periodical, keep the
voice; per-repo chat threads PLUS global with context sharing; dynamic day-phase identity
(the rename lands as MORNING/MIDDAY/EVENING COCKPIT / NIGHT WATCH). The full audit and the
navigator RFI exchange are in the package.

## Proposed slices (operator asserts entrance:/check: — not this session)

- **S-a · registry adapter + `/api/fleet-structure`** (read-only). Sources per RFI response
  A9/C15: registry frontmatter (`northstar-fm.mjs` semantics — import, never reimplement),
  roadmap `status:` tallies across sibling repos, wayfinder frontmatter, `~/selfco/wiki`
  counts (precedent: `adapters/loop.ts`). Badges: DERIVED tallies, [JUDGMENT] cluster
  assignment, AUTHORED prose. Membership joins to the REGISTRY, never REPO_META — render
  disagreement (TD-007 made visible). REST endpoint; not via the G1 facade (RFI C16).
- **S-b · Fleet section, three modes** — port the prototype canvas (~200-line SVG component,
  zero deps), grid restructure (signal cards / dormant cluster rows), filter = dim + brighten
  + match pill, selection binds ADR-0012 for repo nodes, no-op for non-repo (RFI D22 ruling).
- **S-c · thread keying** — keyed threads in `chat-store.ts` (`{scope: 'global' | repo}`),
  migration for the existing global history, share-context toggle, scoped seed message. This
  implements core wayfinder #340's recommended answer; record the decision there.
- **S-d · instrument shell** — meta bar, phase hero + day dial, spine nav with derived state
  summaries, last-viewed timestamp for "since you last looked", hero collapse-on-scroll.
- **S-e · Leo color coding + command tokens** — chip row: `/explain` `/ladder` `/gap`
  `/open` `/draft-handoff`; tokens are UI-executed verbs (deterministic), never free text to
  the model; `/draft-handoff` enters the existing ADR-0005 gated flow. Thread accents by
  scope (README "Chat" section has the palette).
- **S-f · derived-truth selectors** — one selector for decision counts; emit propagates to
  hero/dial/spine/chips. No hardcoded counts anywhere (v1 defect class).
- **S-g · Newline pane** — course ops from vault notes + open briefs; DERIVED badge; NEXT
  SITTING card navigates to the matching briefing thread.
- **S-h · Canon pane** — consumes core's regenerated D5 + authored D6–D8, dark-theme native.

Suggested order: S-a → S-f → S-b → S-c → S-d, then S-e/S-g/S-h in any order. S-a+S-b is the
this-week seam the RFI response scoped (~2 sessions); the rest is the condensation program.

## Measured / tested / documented (the ask, explicitly)

- Vitest: adapter parsers, pure layout fns (masonry/polar/arc), truth selectors.
- Playwright recorded run, beats verbatim from RFI response G40 (load → live adapter →
  `ready` → click f1-substrate → inspector + focus-follow → Leo Q → answer in sidebar thread).
- Mode telemetry (grid/tiers/constellation) to settle the grid-deletion question with data.
- ADR: nav-pane integration + thread keying. README + screen map refresh. Northstar P3
  verification notes at merge; no session writes `current:`.

## Hard rules (from standing rulings — do not re-open)

Read-only + ADR-0005 single carve-out · no cloud cascade (ADR-0003) · deterministic floor
always renders · registry-generated membership, never a fifth hand list · mermaid canon is
the store, canvas is a viewer · pnpm · no new runtime deps · no routing library.

## Acceptance

The Playwright run above recorded and green; zero hardcoded counts (grep for the v1
literals); emit visibly moves every decision surface; a11y pass on SVG nodes (tab stops +
focus ring); docs landed.
