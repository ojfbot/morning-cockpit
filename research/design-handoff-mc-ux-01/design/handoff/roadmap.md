# G · Implementation roadmap (phased, reversible)

Constraints honoured: read-only + ADR-0005 carve-out · no cloud cascade · deterministic floor · no new runtime deps · no routing library unless the shell decision (Q2) rules otherwise · prototypes isolated under a route or flag, production `App.tsx` untouched until Phase 3.

## Phase 0 — truth first (no UI change)  ·  ~2 sessions
- **Selectors** in `@cockpit/shared`: `deriveLoops(snapshot)` (brief + no report → loop; `to:` → waitingOn; `closes:` → in-flight), `sinceLastLooked(snapshot, ts)`, `deferrals`. Pure, tested with the real 8-bead fixture.
- **Last-viewed timestamp** in `mc.cockpit.v1` (+ `I'VE LOOKED` handler). The one new field the whole return-to posture needs.
- **Evidence badges** as one component `<Evidence kind="derived|asserted|synth|simulated">` and tokens in `tokens.css` (`--ev-*`). Replace `EDITORIAL`, `synth`, `auto/✨` spellings.
- **Red discipline**: `--decision` replaces `--red` in `.gap-bar-fill`, `.loop-funnel-fill`, `.repo-open`, `.summary-btn`, `.section-kicker`, `.lane-count`. Visual only; zero behaviour change.
- **Lane summaries** grounded on `listKnownRepos()` and suppressed when a lane is empty (S2-2).
*Reversible:* all additive; a flag `COCKPIT_UI_V3=0` leaves today's render untouched.

## Phase 1 — isolated prototype routes  ·  ~3 sessions
- `/#/loops` (E) and `/#/rooms` (D) as sibling roots mounted by a hash switch in `main.tsx` — not a router, one `switch`. Reads the same `/api/*`; writes nothing.
- Port `Work Graph` as `FleetCanvas` (plain SVG, ~250 lines) behind `/#/graph`; node satellites from `deriveLoops`; inspector in the rail. Selection → `selectedRepo` (ADR-0012).
- **Telemetry:** mode overrides, `I'VE LOOKED` stamps, which grouping is used in E — to a local jsonl, read by Loop.
*Reversible:* delete the three files and the switch.

## Phase 2 — the capture write (operator decision Q3)  ·  ~2 sessions + ADR
- ADR: "Report emission" — the Review room's `Approve & write report →` writes `‹repo›/.handoff/‹date›-report-‹slug›.md` with `responding_to:`; same gate shape as ADR-0005 (`validateBriefDraft` sibling). Alternatively route through core's bead verb if it exists by then.
- Leo `draft handoff` and Review share the draft→approve→write component.
*Reversible:* the report file is additive; removing the ADR removes the button.

## Phase 3 — the shell  ·  ~3 sessions, after Q2
- If **rooms**: `App.tsx` becomes the clock-proposed room switch; `Sections` 00–07 become the content of rooms (Briefing → Orient §1; Beads → Work; Delivery/Loop → Review; Reading/Research → folded intake).
- If **one page**: E becomes `App.tsx`'s body; Fleet canvas and Briefing are sections beneath the loops ledger.
- Either way: `01 Fleet` → `FleetCanvas` (v2 ruling), masthead → phase wordmark + lede derived from selectors, no edition number.
- Thread keying (#340) lands here or earlier — Leo verbs need a scoped thread.

## Phase 4 — practice
- Weekly reports/briefs ratio in Review; re-brief detection; deferral counts.
- Mode telemetry decides the clock boundaries; grid-vs-graph telemetry settles the v2 grid question.

## Tests / docs per phase (the operator's standing ask)
Vitest on every selector with the real fixture · Playwright: arrive → `I'VE LOOKED` → open a loop → `Decide →` → Briefing scoped to it; Review → three lines → report file exists · ADRs: evidence vocabulary, report emission, shell decision · README screen map refresh · `.claude/northstar.md` verification notes at merge (never `current:` from a session).

## What is explicitly not in scope
Replacing production surfaces before Phase 3 · any write beyond brief and report emission · a canon-diagram host (vault keeps them) · a second data store.
