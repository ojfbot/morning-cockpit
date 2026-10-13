# Morning Cockpit — UX discovery & experimental redesign (handoff MC-UX-01)

**From:** Claude Design session · **Date:** 2026-10-08 · **To:** James (@jfo, operator); Claude Code in `ojfbot/morning-cockpit`; reviewing agents
**Status:** exploration — nothing here is authorised for production. Ruled items live in `decisions.md`; everything else is a hypothesis with its evidence named.
**Brief answered:** `uploads/morning-cockpit-ux-discovery-and-experimental-redesign.md` (§10 deliverables A–G).

This bundle follows the shape of `lego-village-pipeline/docs/design/H-01-R1/`: a dated decision ledger, open questions with owners, per-sheet specs, a machine-readable index, and prototypes that are the reference for *behaviour*, never code to copy.

## How to read this
1. `decisions.md` — what the operator ruled before and during this pass (dated). Constraints, not suggestions.
2. `audit.md` — **Deliverable A.** Current-state audit against the running renderer (`packages/renderer@main`), severity-tagged, each finding pointing at a file.
3. `information-model.md` — **Deliverable B.** What the app *knows* vs what it *shows*; the eight information types; the clusters that answer a human question; the honesty vocabulary.
4. `terminology.md` — the jargon audit (§4 of the brief): every string in the renderer that leaks the architecture, with a plain-words replacement.
5. `concepts.md` — **Deliverable C.** Five directions (A–E) with philosophy and trade-offs; three built (C, D, E).
6. `specs/` — one page per built prototype: purpose, behaviour, states, copy rules, what is simulated.
7. `habit-model.md` — **Deliverable E.** The daily / weekly rhythm and how each prototype serves the flywheel.
8. `evaluation.md` — **Deliverable F.** The seven tasks from §9 scored across concepts; what to combine.
9. `roadmap.md` — **Deliverable G.** Phased, reversible, no production surface replaced.
10. `open-questions.md` — unresolved items with an owner type.
11. `index.json` — manifest: prototypes ↔ specs ↔ decisions ↔ data origin.

## The prototypes (Deliverable D) — open in the project root
| File | Concept | Status |
|---|---|---|
| `Current State.dc.html` | Faithful recreation of today's renderer (baseline) | built · data labelled |
| `Work Graph.dc.html` | C · relationship canvas with live work on repo nodes | built · interactive |
| `Adaptive Workspace.dc.html` | D · four clock rooms + READ by declared intent | built · interactive |
| `Open Loops.dc.html` | E · data-derived: the app as a ledger of promises | built · interactive |
| `Reading Room.dc.html` | D · fifth room (READ): news + learning channels sized to a sitting; spec `specs/D2-reading-room.md` | built · interactive · added 2026-10-09 |
| `Dossier.dc.html` | this bundle as a readable page | built |
| `Design System.dc.html` | the derived token sheet, rendered | built |

**Data.** `data/snapshot.js` is a hand-compiled snapshot with an `origin` on every block (repo file / audit screenshot / derived / simulated). No Dolt, RSS or HF data was reachable; those surfaces are summarised and say so. Replace the snapshot with `/api/*` reads before any evaluation session — the prototypes are shaped to accept the real `CockpitSnapshot`, `FleetSnapshot`, `DeliverySnapshot`, `LoopSnapshot`.

## Design system (`ds/cockpit.css` + `ds/refs.js` + `ds/correspond.js`)
Derived from three sources, per operator instruction (Industry DS ignored):
- **morning-cockpit `tokens.css`** — the base: paper/ink, Helvetica Neue 800 + JetBrains Mono, 8px grid, zero radius, 3px ink rules, light default + dark.
- **Fleet Navigator + v2 handoff** — cluster hues, dashed = unregistered, filter dims (never removes), selection is an ink stroke, **red has one job: a human decision is needed**.
- **LEGO Drafting Table (H-01-R1 `dt/tokens.css`, `dt/overlay.js`)** — a contrast contract on every text token; **evidence axes as visible tokens** (`--ev-derived / --ev-asserted / --ev-synth / --ev-simulated`); plain-words-first copy and controls that say their consequence; and the **navigable hover card** (`ds/refs.js`: reference chips for repo · brief · agent · cluster · ref · evidence; hover previews, click pins, chips inside push a page with BACK + breadcrumb, every page ends in WHERE THIS CAME FROM). Not taken: rust accent, slate ink, offset shadows, grid-paper ground.
- **Correspondence contracts (fleet-runner profile + lego-pipe-memo/v2)** — `ds/correspond.js`: text fields detect the speech act, read frontmatter, lift refs to chips, and route requests to a named recipient; approve prepares a memo, delivery is a receipt.

## Standing rules carried into every prototype
Read-only with the ADR-0005 carve-out · no cloud cascade (ADR-0003) · deterministic floor always renders · registry-generated membership, never a fifth hand list · every count derives from one selector (v1 defect class) · nothing simulated is presented as wired.
