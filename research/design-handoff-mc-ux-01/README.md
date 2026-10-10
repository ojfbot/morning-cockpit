# Handoff: Morning Cockpit — UX discovery & experimental redesign (MC-UX-01)

**Target repo:** `ojfbot/morning-cockpit@main` · **Lands at:** `research/design-handoff-mc-ux-01/` (sibling of `research/design-handoff-cockpit-v2/`)
**Date:** 2026-10-08 · updated 2026-10-09 (Reading Room) · **Status:** exploration — nothing here is authorised for production.

## Overview
Answers the brief `design/uploads/morning-cockpit-ux-discovery-and-experimental-redesign.md` (§10 deliverables A–G): an audit of today's renderer, an information model, five concept directions (three built), a habit model, a scored evaluation, and a phased reversible roadmap. Plus a derived design system (`ds/`) and one upstream issue (ISSUE-001, asked-by provenance → fleet-runner).

## About the design files
Everything under `design/` is a **design reference built in HTML** — prototypes of intended look and behaviour, not code to copy. Recreate them in `packages/renderer` (React + `styles/tokens.css`) using its existing patterns. The `*.dc.html` files open directly in a browser (serve `design/` over any static server so `support.js`, `ds/` and `data/` resolve relatively).

## Fidelity
- `Current State.dc.html` — **recreation** of today's renderer (baseline; from `packages/renderer/src` + `fleet-config.ts`).
- `Work Graph`, `Work Graph v2`, `Adaptive Workspace`, `Open Loops` — **interactive prototypes, hi-fi for tokens/type/colour roles**, exploratory for layout. Use `ds/cockpit.css` values exactly; layout is a hypothesis pending Q2 (shell).
- `Dossier.dc.html` — renders `handoff/*.md`. `Design System.dc.html` — token reference.

## Read in this order
1. `design/handoff/decisions.md` — dated rulings. **Constraints, not suggestions. Do not re-open a ruled item.**
2. `design/handoff/open-questions.md` — Q1–Q15 with owners. Q1 (live data), Q4, Q10, Q12 are owned by Claude Code; Q20 (curated-list home) is shared.
3. `design/handoff/README.md` — bundle map (A audit · B info model + terminology · C concepts · D specs · E habit · F evaluation · G roadmap).
4. `design/handoff/specs/` — per-prototype behaviour, states, copy rules, what is simulated.
5. `design/handoff/index.json` — machine-readable manifest: sheets ↔ specs ↔ decisions ↔ data origin ↔ simulated list.
6. `design/handoff/issues/ISSUE-001-asked-by-provenance.md` — upstream to fleet-runner.
7. `design/github.md` — source repo files each screen was built from (screen map).

## Screens
| File | Concept | Spec |
|---|---|---|
| `Current State.dc.html` | Baseline recreation | — |
| `Work Graph.dc.html` | C · relationship canvas, live work on repo nodes | `specs/C-work-graph.md` |
| `Work Graph v2.dc.html` | C refined · Fleet › Cluster › Repo drill-through, URL-hash addressable; repo level = sessions, northstar→roadmap track, owned artifacts, links | `specs/C-work-graph.md` + decisions 2026-10-08 (last two rows) |
| `Adaptive Workspace.dc.html` | D · four clock rooms (First Light · The Desk · Last Light · Night Watch) + READ (embeds Reading Room) by declared intent; persistent Leo rail; correspondence fields | `specs/D-adaptive-workspace.md` |
| `Open Loops.dc.html` | E · the app as a ledger of promises; since-you-last-looked diff strip with NORMAL/EXPAND cards | `specs/E-open-loops.md` |
| `Reading Room.dc.html` | D · fifth room (READ intent, never clock-picked). News · Papers · Podcasts · Community · Course · Textbooks, each with mode + wiring status; stack sized to the sitting (20/10/30 min); nothing red; no item invented. Standalone or embedded in D | `specs/D2-reading-room.md` + decisions 2026-10-09 |

## Standing rules (apply to any implementation)
- **Red means "a human decision is needed"** and nothing else (`--decision`). Selection is an ink stroke; progress is `--progress`.
- **Every count derives from one selector** over the snapshot; no surface hardcodes a number.
- **Nothing simulated is presented as wired.** Every data block carries an `origin` (repo · audit · derived · simulated); render it via the evidence tokens.
- Read-only with the ADR-0005 carve-out · no cloud cascade (ADR-0003) · deterministic floor always renders · membership joins to the registry, never REPO_META.
- The Industry design system bound to the design project was **ignored by operator ruling**; style comes from `ds/cockpit.css` only.
- `handoff/*.md` is the source of truth; `Dossier.dc.html` only renders it.

## Shared modules (`design/ds/`)
- `cockpit.css` — tokens + base. Derived from `packages/renderer/src/styles/tokens.css`, Fleet Navigator, v2 handoff, and lego-village-pipeline `H-01-R1/dt/tokens.css`.
- `refs.js` — reference chips (repo · brief · agent · who · cluster · ref · evidence) + one page-wide navigable card: click pins (hover = native tooltip only; `who` chips get a hover peek per ISSUE-001), chips inside push a page, BACK + breadcrumb, ESC, every page ends in WHERE THIS CAME FROM. Ported from Drafting Table `dt/overlay.js` (DEC-032/033/035).
- `correspond.js` — correspondence text fields: detect speech act (observation · claim · report · request · decision · disposition), parse lego-pipe-memo/v2 frontmatter, lift refs to chips, refuse an unrouted request. Approve prepares a memo; delivery is a separate receipt.

## Design tokens (light; dark in `ds/cockpit.css` via `prefers-color-scheme` + `[data-theme]`)
- Ground/ink: `--paper #f2efe7` `--paper-2 #e8e4d8` `--card #fcfbf6` `--ink #17140f` `--ink-2 #574f44` `--ink-3 #7d7466`; rules `rgba(23,20,15,.16)` / `.62`.
- Signal: `--decision #e2231a` (text `--decision-ink #b81a12`) · `--live #2f7d5b` · `--warn #a8730f` · `--progress #574f44` · `--selection #17140f`.
- Evidence: `--ev-derived #2f6b86` · `--ev-asserted #8a5a0b` · `--ev-synth #6b5a8e` · `--ev-simulated #7d7466` (each ≥4.5:1 on paper).
- Clusters: platform `#4a6fa5` · apps `#8c7ea5` · f1 `#b3543f` · golf `#4f7d5b` · dive `#3f7d8c` · story `#7d5f9e` · client `#a8730f` · vault `#6d5f8e` · corpus `#6b7a5a` · play `#c9821c`. Dashed stroke = unregistered.
- Type: Helvetica Neue (800 display) + JetBrains Mono (labels). Spacing 4/8/12/16/24/32/48/64; zero radius; 3px ink rules.
- Motion: 110 / 240 / 400ms; `cubic-bezier(0,0,.38,.9)`, `cubic-bezier(0,0,.3,1)`; reduced-motion disables all.

## Screenshots (`screenshots/`)
- `screen-*.jpg` — default first view of each screen: current-state, work-graph, work-graph-v2, adaptive-workspace, open-loops, reading-room, design-system. `reading-room-community` / `reading-room-papers` show channel pages.
- Session captures (states mid-interaction): `*-adaptive-corr` (correspondence field), `*-adaptive-dispatch` / `*-dispatched` (route → receipt), `*-adaptive-v3` (rooms + Leo rail), `*-loops-card` (navigable card), `loops-expand` (EXPAND mode), `loops-rail`. `debug.jpg` is a working capture — ignore.
- Screenshots illustrate; the `.dc.html` files and specs are authoritative.

## Data
`design/data/snapshot.js` is hand-compiled; Dolt, RSS, HF papers and Ollama were unreachable and are summarised + labelled. Before any evaluation, replace it with `/api/cockpit`, `/api/fleet`, `/api/delivery`, `/api/loop` reads (prototypes are shaped to the real snapshot types). Simulated behaviours are listed in `index.json → simulated` (Leo replies, approve/emit, Not today, notes, I'VE LOOKED, Reading Room list/timer/sources/takeaway — all localStorage-only).

## Suggested first tasks for coding agents
1. Q1 — capture live `/api/*` JSON into `data/` and re-score `evaluation.md`.
2. Q4 — data check: does `to:` on a brief reliably name who owes it?
3. Q12 — decide where agent `type`/`task` are derived (dolt adapter vs `bead_events`).
4. Reading Room adapters (spec D2 → To build for real): arXiv, podcast RSS, subreddit RSS; blocked items wait on Q19/Q20.
5. Roadmap Phase 1 (`roadmap.md`) — terminology fixes + single-selector counts in the existing renderer; reversible, no surface replaced.
