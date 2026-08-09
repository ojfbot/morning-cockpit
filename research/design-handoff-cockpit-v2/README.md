# Handoff: Cockpit v2 — instrument shell + Fleet Navigator integration

**From:** the Claude Design session (2026-08-08/09)
**To:** Claude Code sessions in `ojfbot/morning-cockpit` and `ojfbot/core`
**Operator decisions already made** — do not re-litigate: three modes in one Fleet section
(not a ninth section); collapse + spine; strip the periodical, keep the voice; per-repo
threads PLUS global with context sharing; rename in scope with day-phase dynamic identity.

## Overview

A redesign of morning-cockpit from "daily magazine" to "fleet control plane," integrating the
fleet-navigator prototype's three keeper patterns (cluster canvas, node inspector, canon
diagrams). Full reasoning in `audit-cockpit-fleet-navigator.md`; data/interaction ground truth
in `rfi/` (question set + the Code session's complete response).

## About the design files

`design/Cockpit Fleet v2.dc.html` is a **design reference built in HTML** — a prototype
showing intended look and behavior, NOT production code. The task is to **recreate it in the
cockpit's existing environment**: React + Vite renderer (`packages/renderer`), Express
read-model (`packages/server`), GroupThink tokens (`styles/tokens.css`), pnpm, Node ≥ 20.19,
no new runtime deps (the canvas needs none — it is plain SVG). The prototype's inline styles
should be re-expressed against `tokens.css`; where a value below disagrees with an existing
token, the token wins.

## Fidelity

- **Hi-fi** (recreate faithfully): the instrument shell (meta bar, hero + day dial, spine),
  Fleet section in all three modes, the right rail (widgets / inspector / threaded chat),
  Briefing pane structure, red-discipline color system.
- **Lo-fi** (structure and intent, restyle freely): Reading, Research, Newline, Canon panes —
  these show what content goes where and which honesty badges apply, not final layouts.
- **Simulated in the prototype, real in the implementation:** all counts (see State), Leo
  replies (real `/api/chat`), emit (real `handoff-emit.ts` path), loop events.

## Screens (single page, spine-navigated views)

### Shell (always present)
- **Meta bar** (40px): `FLEET CONTROL PLANE · <date>` left; loop pulse (`LOOP 80/7D`, green
  dot, `mcpulse` 2.4s, killed by `prefers-reduced-motion`), phase chip, clock right. Mono 10px,
  letter-spacing .12em.
- **Hero** (borders: 2px cream bottom): phase wordmark 84px/800/-.01em (`MORNING COCKPIT` /
  `MIDDAY COCKPIT` / `EVENING COCKPIT` / `NIGHT WATCH`; phases 5–11 / 11–17 / 17–22 / 22–5),
  focus sentence 29px/700 with red spans ONLY on decision counts, **day dial** right (see
  Widgets). Copy per phase is in the prototype's `heroMap` — including the zero-decisions
  variants ("Close the lid — tomorrow starts clean.").
- **Spine** (192px left rail): numbered rows `00–09`, each with a one-line state summary
  (derived, not decorative), red 6px dot = decision waiting, bright = live view, click
  navigates. Active row: 2px cream left border + `#1a1713` bg.
- **Right rail** (372px): INSPECTOR header (context breadcrumb) → widgets when nothing
  selected / node inspector when selected → threaded chat (see Chat). Grid rows
  `minmax(60px,1fr) minmax(120px,46%)` — both clamp, neither overlaps.

### 00 Briefing — "The First Move"
Seeded threads (270px col; `DECISION NEEDED` red chip → `✓ EMITTED` green after emit, card
dims .6) + Chief-of-Staff card: catch-up quote (2px left border), red `DECISION` label,
question 18px/700, options (`Pick it up now` + RECOMMENDED outline / `Defer 7 days`; 3px red
left border on selected), handoff-artifact draft (1px red border) with delivery task,
acceptance criteria, `Approve & emit →` (red bg — the one red action). After emit:
`✓ EMITTED → <repo>/.handoff/ · ADR-0005` green line. Defer shows a dashed no-write note.

### 01 Fleet — three modes, one selection
- **Grid (Operations):** SIGNAL band — cards for repos with open beads/recent activity
  (liveness dot green/amber/dim, open count cream bold, slice line mono right); DORMANT band —
  cluster-grouped compact name rows (unregistered = dotted underline).
- **Tiers (Structure):** SVG canvas (world 1680×~960): L2 nodes top (`l2-ojfbot` solid,
  `l2-selfco` dashed), 8 cluster boxes masonry-flowed in 4 columns, 186×46 node cards (3px
  cluster-hue tab, dashed border = unregistered, sub-line = slice counts / `UNREGISTERED — NO
  NORTHSTAR`), ONE bundled edge per cluster to its L2 (bezier, never per-node — the hairball
  was a named defect). Wayfinder + Vault boxes edge to `l2-selfco`.
- **Constellation:** polar around `l2-ojfbot` — registered r≈250–284 (7px hue dots),
  unregistered r≈430–466 (4.5px dashed rings), cluster-sector angles, faint edges.
- Shared: drag-pan, +/− zoom, RESET; filter input + chips (`READY WORK / GAPS / F1 / GOLF /
  VAULT`); filtering **dims non-matches to .14–.15 and brightens match borders** (never
  removes — spatial stability), match-count pill (cream bg) by canvas controls; selection =
  cream stroke (red is never selection); stat line per mode.
- Selection **drives cockpit fleet selection for repo nodes (ADR-0012 binding), no-op for
  non-repo nodes** — RFI response D22, recommended and accepted.

### 05 Reading / 06 Research (lo-fi)
Condensed per audit §3-A/§2-E: digest = headline + ≤3 bullets + ONE read-first line; sources
as columns; profile is a one-line summary with EDIT, never truncated chips; papers keep
provenance headers, prereqs, connects-to chips, deep-dive.

### 08 Newline — Course Ops (lo-fi, new)
Units table (id / title / modules `n/m` / status chip; hot row = red left border + red chip,
tied to the live brief), `DERIVED — VAULT NOTES` badge on the count; right stack: NEXT SITTING
card (red border, `Open in Briefing ↗` navigates + selects that brief), MINIPROJECTS,
VAULT backfill note.

### 09 Canon (lo-fi, new)
D5 + D6 as dark-theme-native figure cards: title, authored caption, box-and-edge SVG.
Provenance header `AUTHORED · canon: ~/selfco/diagrams/fleet-map.md · the cockpit shows, the
vault keeps`; staleness footer. D5 to be **regenerated from the registry** (core brief); D6–D8
stay authored.

## Widgets

- **Day dial** (hero, 190×190 viewBox): 24h ring (r74, track `#221d18` w9), four phase arcs
  (active `#c9b48c` w9 round caps, inactive `#2e2924` w5), cream now-marker dot, green loop-event
  dots at event hours, `00/06/12/18` labels at r88. Center: decision count (34px, red >0 /
  green at 0), `DECISIONS WAITING` / `ALL DECIDED`, beads·stale line, phase.
  **Known-incomplete (operator flag): the center needs one more element** — candidates:
  next-calendar-anchor ETA ("standup in 9h"), a count-up of loop events today, or the phase
  glyph; pick one, not all.
- **Rail widgets** (nothing selected): delivery pipeline stacked bar (merged cream / ready
  gold / queued `#3a342c`, DERIVED badge), registration-gap split bar (solid vs 45° striped
  `repeating-linear-gradient`, `SHOW THE GAP` link → Tiers + gaps filter), loop funnel rows
  (ignored/engaged/acted) with `RATES SUPPRESSED — NO CAPTURE-QUALITY ARTIFACT YET`.

## Chat (rail bottom) — threads, color coding, tokens

- **Threads:** `GLOBAL · LEO` tab + per-repo tabs opened via "Ask Leo ↓" (seeded with a
  grounded intro: authored prose + delivery counts). Scoped-thread header:
  `context → Global: ON/OFF` toggle. This is the #340 design — see core brief for the store.
- **Color coding (to implement):** thread accent by scope — GLOBAL cream `#efe8db`; scoped
  threads carry their repo's cluster hue on the tab underline + message left border; system/
  action confirmations green `#8fbd8f`; red appears inline ONLY when a message requires a
  decision.
- **Pre-scripted tokens (to implement):** a chip row above the composer; clicking inserts a
  structured command the UI executes deterministically (the model writes prose, the UI does
  verbs — tokens are never free text to the model):
  - `/explain <node>` (cream) — grounded explainer from authored prose + registry
  - `/ladder <node>` (cluster hue) — walk `ladders_up_to` to the apex, each hop linked
  - `/gap [cluster]` (gold) — list unregistered repos, filter the canvas to them
  - `/open <repo>` (green) — drive fleet selection + briefing scope (ADR-0012)
  - `/draft-handoff` (red outline) — start the gated ADR-0005 emit flow, never auto-sends
  - Tokens render in the transcript as colored chips; unknown tokens fall through as text.

## State management

**One derived truth, everywhere.** The prototype's rule: `decisions = openBriefs −
emittedBriefs`, and hero sentence, dial center, spine `00` row, meta line, and thread chips
ALL derive from it — emitting visibly propagates to every surface. Implement as one selector
over the snapshot; **no surface may hardcode a count** (the v1 defect class: dial said 1, hero
said two, spine said 3). Other state: `view` (spine), `mode`+`sel`+`q`+`chip`+viewBox per mode
(fleet), `briefSel/briefOpt/emittedIds` (briefing), threads keyed by scope, last-viewed
timestamp (new — powers "SINCE YOU LAST LOOKED"), phase from clock with manual override.

**Data:** everything in the prototype's `data()` is a hand-compiled 2026-08-08 snapshot. Real
sources per RFI response A9/C15: registry frontmatter, roadmap `status:` tallies, wayfinder
frontmatter, `~/selfco/wiki` counts — one new read-only adapter (`/api/fleet-structure`),
REST first, not smuggled into the G1 facade (RFI C16). Never join membership to `REPO_META`;
join both sides to the registry and render disagreement (TD-007).

## Design tokens (as used; defer to tokens.css where it disagrees)

Bg `#12100d` · panel `#14110e` / `#1a1713` · borders `#2e2924` / `#3a342c` / `#201c17` ·
text `#efe8db` · secondary `#b5aa99` · dim `#847a6c` · faint `#5d564c` ·
**red `#ff4b3e` = needs-a-human-decision, its ONLY job** · green `#8fbd8f` = live/confirmed ·
amber `#c9a35f` = stale/warn · gold `#c9b48c` = ready/phase.
Cluster hues (muted, categorical): spine `#c9b48c`, frame `#8fa8bd`, f1 `#c98f8f`, golf
`#9bbd8f`, dive `#8fbdb5`, story `#b09fc9`, corpus `#bda58f`, client `#c9c08f`.
Type: Helvetica Neue (display; 84/29/26/15/13/12) + ui-monospace/'SF Mono'/Menlo (labels,
9–11px, letter-spacing .08–.14em). No webfonts.

## Measure / test / document (the operator's explicit ask)

- **Vitest:** fleet-structure adapter parsers; canvas layout functions (pure — masonry, polar,
  arcs); the derived-truth selector (emit → every count moves).
- **Playwright recorded run** (RFI response G40, verbatim beats): load → navigator renders
  from the live adapter → type `ready` → click `f1-substrate` → popover/inspector opens AND
  fleet selection follows → ask Leo one question → answer streams → same exchange visible in
  the sidebar thread.
- **Mode telemetry:** log grid/tiers/constellation usage — this settles audit §7's
  grid-deletion question with data (E32 staging).
- **Docs:** ADR for the nav-pane integration + thread keying; README section update; refresh
  `.claude/northstar.md` P3 verification notes at merge (never `current:` from a session).

## Files

- `design/Cockpit Fleet v2.dc.html` — the full interactive prototype (needs its project
  runtime; treat as reference, read the template + logic class directly)
- `audit-cockpit-fleet-navigator.md` — findings, severity-tagged, + integration argument
- `rfi/RFI-fleet-navigator.md` + `rfi/rfi-response.md` — the data/interaction ground truth
- `briefs/` — repo-targeted pickup briefs (drop into each repo's `.handoff/`)
- `punch-list.md` — known defects and incompleteness in the prototype itself
