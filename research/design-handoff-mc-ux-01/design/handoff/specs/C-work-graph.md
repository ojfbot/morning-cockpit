# Spec · C — Work Graph

**File:** `Work Graph.dc.html` · **Status:** built, interactive · **Data:** `data/snapshot.js` (labelled)

## Purpose
Show the fleet's shape and hang the live work on it: which repos exist, which cluster they serve, which have a goal on record, where briefs wait on you, where agents are working — and let a question to Leo move the map.

## Behaviour
- Canvas: cluster boxes (3 columns, stacked by registry order), 186×40 repo nodes inside; one bundled bezier per cluster to the L2 apex. Drag to pan, +/− zoom, RESET.
- Node encoding: cluster hue tab · solid border = registered / dashed = unregistered · red count badge = briefs waiting on you · green dot = an agent is live here · sub-line = slice counts or "no goal on record".
- Filter: input + chips (`WAITING ON YOU · AGENTS WORKING · THE GAP · F1 · PLAY-WELL`). Matches brighten, non-matches dim to .14 — never removed. Match count shown.
- Selection: click a node → ink stroke (never red) → inspector. ESC clears. Drives fleet selection (ADR-0012) in the real app.
- Inspector pages: *what this is (ASSERTED) · cluster (chip) · waiting on you (brief chips) · who's working here (agent chips) · how far it's come · why it exists (ladder chips) · where this came from*.
- Leo: words + verbs. `/waiting` `/gap` `/explain [repo]` `/open <repo>` `/draft-handoff`. Verbs are executed by the UI; free text gets a simulated reply.
- Reference chips everywhere (`ds/refs.js`): hover previews, click pins, chips inside the card push a page (breadcrumb + BACK).

## States
no selection · selected · filtered (dim) · zoomed/panned · Leo log empty/with turns.

## Copy rules
"goal on record" not "northstar" in first position; "waiting on you" not "pickup"; red count only for human decisions.

## Simulated
Leo replies; `/draft-handoff`; cluster membership for unregistered repos is a `[judgment]` call (badged).

## Follow-ups
Keyboard navigation between nodes (tab stops exist, arrows don't); clamp pan to world; constellation mode from Navigator not ported (Tiers only).
