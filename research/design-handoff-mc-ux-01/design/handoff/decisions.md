# Decisions (dated ledger)

Rulings in force for this exploration. Only the operator overturns one; a new dated line records it.

| Date | Decision | Source | Touches |
|---|---|---|---|
| 2026-08-03 | The cockpit shows, the vault keeps — canon diagrams live in `~/selfco/diagrams/` | operator ruling (RFI response) | C: no diagram pane |
| 2026-08-08 | Red = a human decision is needed; its only job | v2 audit §S2-B, accepted | `ds/cockpit.css --decision`; every prototype |
| 2026-08-08 | One selector per count; no surface hardcodes a number | v2 punch-list | all prototypes read `data/snapshot.js` |
| 2026-08-08 | Membership joins to the registry, never REPO_META; render disagreement | v2 handoff (TD-007) | C legend `[judgment]`; info model §5 |
| 2026-10-08 | Industry design system ignored; derive from cockpit tokens + Fleet Navigator UX + LEGO pipeline work | operator (chat) | `ds/cockpit.css` |
| 2026-10-08 | Deliverable = markdown source of truth + HTML for reading | form Q1 | `handoff/`, `Dossier.dc.html` |
| 2026-10-08 | Build C, D, E this round; A, B specified only | form Q2 | `concepts.md` |
| 2026-10-08 | Default theme follows the OS | form Q3 | `ds/cockpit.css` `prefers-color-scheme` + `[data-theme]` override |
| 2026-10-08 | v2 handoff is prior exploration — free to challenge, cite where useful | form Q4 | `audit.md` cites; C re-opens the popover-vs-rail call in the rail's favour |
| 2026-10-08 | Leo hypothesis: conversational navigation (ask → jump to a structured view) | form Q6 | C verbs, D scoped Leo, E asks |
| 2026-10-08 | Recreate the full current page as baseline | form Q7 | `Current State.dc.html` |
| 2026-10-08 | Work Graph scope: fleet structure + live work (briefs, agents) on repo nodes; conversations/artifacts not nodes | form R2 Q1 | C |
| 2026-10-08 | Adaptive trigger: both clock and declared intent (operator skipped; design call) | form R2 Q2 (null) | D intent chips override clock |
| 2026-10-08 | From the LEGO work take: plain-words-first copy + consequence-explaining controls; evidence axes as badges. Not: rust accent, slate ink, offset shadows, grid paper | form R2 Q3 | `ds/cockpit.css`, `terminology.md` |
| 2026-10-08 | Overnight lane: prototype both — D keeps day-phase lane; E uses since-you-last-looked | form R2 Q4 | D Orient §3; E diff strip |
| 2026-10-08 | No fabricated feed/paper/Dolt content; unreachable sources are summarised and labelled | brief §7 + operator | `Current State`, E intake |
| 2026-10-08 | Labels carry more than a name: the repo chip encodes cluster hue · registration · liveness · waiting count · phase; agents carry state + type | operator (chat) | `ds/refs.js` chips, all prototypes |
| 2026-10-08 | Navigable detail cards throughout, on the Drafting Table overlay model (DEC-032/033/035): one card page-wide, hover previews, click pins, chips inside push a page, BACK + breadcrumb, ESC, every page ends in WHERE THIS CAME FROM | operator (chat) → LEGO `dt/overlay.js` | `ds/refs.js` |
| 2026-10-08 | "Agents moved" lists rows — agent · type · task title · repo — not a count with badges | operator (inline comment) | E diff strip; `AGENTS[].type/task` |
| 2026-10-08 | Leo stays available in every room of D — persistent right rail, scoped by room | operator (chat) | D |
| 2026-10-08 | Do not repeat "Cockpit" per time of day. App = Morning Cockpit; rooms = First Light · The Desk · Last Light · Night Watch (hypothesis, Q11) | operator (chat) | D wordmarks |
| 2026-10-08 | Text inputs are correspondence fields, not blank boxes: they expect pasted output from other sessions, detect the speech act (fleet-runner profile: observation · claim · report · request · decision · disposition), read lego-pipe-memo/v2 frontmatter, lift refs/findings/repos/agents to chips, and refuse an unrouted request (D2). Approve prepares a memo; delivery is a separate receipt (D6) | operator (chat) → core decisions/fleet-runner/skill-observation-correspondence.md, lego-village-pipeline tools/schemas/lego-pipe-memo.v2.schema.json, CORR-LEGO-PIPE-021 | `ds/correspond.js`; D Review + Desk notes |
| 2026-10-08 | Chips open the card on click only; hover shows the native tooltip. Dense chip lists were stacking cards | operator (inline comment) | `ds/refs.js` |
| 2026-10-08 | Summary cards carry their lists expanded (rows, not badges) and have NORMAL / EXPAND modes — one card can take the width while the others step back to a count | operator (inline comment + chat) | E diff strip |
| 2026-10-08 | "Asked by" must name the process, not the tool: harness › named process › role › session › host (Gas Town names its workers; Leo is the named runner here). Top level stays quiet (mark + name); detail on hover in a peek layer; click opens the card. Hover peek is allowed for `who` chips only, under the overlap rules in ISSUE-001 — other chips keep the click-only ruling. Files upward to fleet-runner | operator (chat) | `ds/refs.js` who chip + peek; `data/snapshot.js WHO`; `handoff/issues/ISSUE-001` |
| 2026-10-08 | Work Graph becomes a navigable surface with three zoom levels — Fleet › Cluster › Repo — addressable by URL hash. Repo level drills to **parented sessions** (harness › process › session), **owned artifacts** (only files actually read; absence is said in words) and the **northstar → roadmap track**. Refines R2 Q1: artifacts and sessions are still not nodes on the map; they are what a repo opens into | operator (chat) | `Work Graph v2.dc.html`; `data/snapshot.js ARTIFACTS, LINKS` |
| 2026-10-08 | Repo-to-repo links are hand-read from REPO_META role text and badged HAND-READ; registration is drawn as the presence or absence of a line to the venture goal | design call under the evidence rule | `Work Graph v2.dc.html` cluster view; `LINKS` |
| 2026-10-08 | Package all work as handoff bundle MC-UX-01 for a PR to morning-cockpit at `research/design-handoff-mc-ux-01/`, for coding agents to build from and review | operator (chat) | `design_handoff_mc_ux_01/` |
| 2026-10-09 | Add a **Reading Room** — news + learning resources for start of day and breaks; its shelves are the future home of textbook and newline AI Accelerator integrations. Entered from D's header; Leo rail scoped `thread: reading`; nothing in it is red | operator (chat) | `Reading Room.dc.html`; `data/snapshot.js READING` |
| 2026-10-09 | Reading Room shelves carry wiring status (WIRED · DEGRADED · NOT WIRED) and origin; course + textbook shelves are specified slots with no content until an adapter exists. Items arrive by hand (local only) meanwhile; the stack is sized to the sitting (20 / 10 / 30 min) | design call under the evidence rule | `Reading Room.dc.html` |
| 2026-10-09 | Reading Room becomes a fifth room of D — **READ** intent, never chosen by the clock; D's Leo rail scopes to `thread: reading`. Standalone file kept, embeddable via `embedded` | operator (Q18) | `Adaptive Workspace.dc.html`, `Reading Room.dc.html` |
| 2026-10-09 | newline course + textbooks: wired later, out of this design scope — shelves stay as LATER, hand-added items only | operator (Q16, Q17) | Reading Room |
| 2026-10-09 | Reading Room is a high-level aggregator of channels — News (RSS) · Papers (HF + arXiv) · Podcasts (Practical AI, Changelog, Life with Machines) · Community (Reddit + X as a digest; the operator never uses their interfaces) · Course · Textbooks. Each channel has a mode (READ / LISTEN / SCAN) and a curated source list; suggestions are labelled and need Keep. Fleshing out adapters is out of scope | operator (chat) | `data/snapshot.js READING.channels`; Reading Room |
| 2026-10-09 | Integrate the Reading Room (spec D2, screenshots) into handoff bundle MC-UX-01 | operator (chat) | `design_handoff_mc_ux_01/` |
