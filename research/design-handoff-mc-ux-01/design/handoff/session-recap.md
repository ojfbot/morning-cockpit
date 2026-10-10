# Session recap — MC-UX-01 (reconstructed 2026-10-08)

The chat that produced this project was deleted. This recap is rebuilt from `github.md`, `handoff/decisions.md`, `handoff/open-questions.md`, `handoff/roadmap.md` and `handoff/index.json`. Treat those as the source of truth; this is the thread.

## What the session was
A UX discovery + experimental redesign of **Morning Cockpit** (`ojfbot/morning-cockpit@main`), answering the brief at `uploads/morning-cockpit-ux-discovery-and-experimental-redesign.md` (deliverables A–G). Secondary source: `ojfbot/lego-village-pipeline` (`docs/design/H-01-R1/`, `apps/drafting-table/`).

## How it unfolded (inferred order)
1. **Intake form, round 1** — ruled: markdown + HTML dossier as deliverable; build concepts C/D/E, spec A/B; OS-following theme; v2 handoff is challengeable prior art; Leo = conversational navigation hypothesis; recreate the full current page as baseline.
2. **Form round 2** — Work Graph scope (fleet structure + live work on repo nodes); adaptive trigger = clock + declared intent; take from LEGO work plain-words copy + consequence-explaining controls + evidence badges (not rust/slate/offset shadows/grid paper); prototype both overnight-lane treatments.
3. **Operator ruled in chat: ignore the bound Industry DS.** Derive `ds/cockpit.css` from cockpit `tokens.css` + Fleet Navigator + LEGO `dt/tokens.css`.
4. **Built** `Current State` (renderer recreation), `Work Graph` (C), `Adaptive Workspace` (D), `Open Loops` (E), `Dossier`, `Design System`; `data/snapshot.js` with an `origin` on every block.
5. **Iteration from inline comments / chat:**
   - Repo chips encode cluster hue · registration · liveness · waiting count · phase; agents carry state + type.
   - Navigable hover cards on the Drafting Table overlay model → `ds/refs.js`.
   - "Agents moved" is rows (agent · type · task · repo), not a count.
   - Leo persistent right rail in every room of D, scoped by room.
   - Room names: First Light · The Desk · Last Light · Night Watch (naming round still wanted, Q11).
   - Text inputs are correspondence fields → `ds/correspond.js` (speech-act detection, lego-pipe-memo/v2 frontmatter, routed requests, approve → memo, delivery → receipt).
   - Chips open on click only (hover = native tooltip).
   - Summary cards: lists expanded as rows; NORMAL / EXPAND modes.
6. **Last sync** 2026-10-08T23:28Z — correspondence fields, click-only chips, card modes, D rail + memo-draft review.

7. **Dedicated Work Graph session (2026-10-08, later)** — `Work Graph v2.dc.html`: Fleet › Cluster › Repo zoom levels (hash-addressable, ESC/UP, breadcrumb); cluster view draws goal-ladder lines only for registered repos plus hand-read intra-cluster links with stubs to other clusters; repo view = Sessions (parented harness › process › session) · Track (properties with proposed-movement segments, phases, slices) · Owned artifacts (grouped; only files read) · Links. Inspector rail inspects any sub-item; artifact chip/card added to `ds/refs.js` via `extend`. v1 kept as `Work Graph.dc.html`.

## Where it was left
- User was viewing `Open Loops.dc.html` when the chat was lost.
- Nothing is authorised for production; all prototypes read the snapshot, write nothing (localStorage only).
- 14 open questions (`open-questions.md`). Operator-owned ones most likely next: **Q2** shell (rooms vs one page), **Q3** report-emission write, **Q11** room naming, **Q13/Q14** which correspondence contract + recipient vocabulary.
- Roadmap Phase 0 (selectors, last-viewed timestamp, evidence badges, red discipline) is the first implementation step in `morning-cockpit`.

## Standing rules (do not re-ask)
Industry DS ignored · red = human decision needed, only · one selector per count · registry membership, never REPO_META · nothing simulated presented as wired · deliverable is markdown first, HTML for reading.
