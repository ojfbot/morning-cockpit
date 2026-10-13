repo: ojfbot/morning-cockpit
branch: main

## Last sync
date: 2026-10-08T23:58:00Z
### Updated in this project
- `Work Graph v2.dc.html` — Fleet › Cluster › Repo drill-through; repo level shows sessions, track, owned artifacts, links
- `data/snapshot.js` gained `LINKS` (hand-read from REPO_META role text) and `ARTIFACTS` (files read in this project, origin-labelled)

## Sync history
### 2026-10-08T23:28:15Z
### Updated in this project
- `ds/correspond.js` — correspondence fields derived from core `decisions/fleet-runner/skill-observation-correspondence.md` and lego-village-pipeline `tools/schemas/lego-pipe-memo.v2.schema.json` + `CORR-LEGO-PIPE-021`
- Reference chips open on click only; summary cards gained expanded rows + NORMAL/EXPAND modes
- Adaptive Workspace: persistent Leo rail, room names, memo-draft review

### 2026-10-08T23:20:00Z
### Updated in this project
- Recreated the full renderer page (`Current State.dc.html`) from `packages/renderer` source + `fleet-config.ts` data
- Derived `ds/cockpit.css` from `tokens.css`, the fleet-navigator prototype and the v2 handoff (plus lego-village-pipeline `dt/tokens.css` evidence axes)
- Ported the Drafting Table hover-card lifecycle as `ds/refs.js` (reference chips + navigable card)
- Wrote the MC-UX-01 discovery bundle under `handoff/` and three concept prototypes

## Screen map
| Project screen | Repo files |
|---|---|
| Current State.dc.html | packages/renderer/src/App.tsx, components/Masthead.tsx, Section.tsx, Lane.tsx, WorkItemCard.tsx, LaneSummaryPanel.tsx, SummaryView.tsx, StalenessBadge.tsx, HealthBar.tsx, ThemeToggle.tsx, briefing/Briefing.tsx, briefing/HandoffArtifactCard.tsx, FleetSection.tsx, RepoCardView.tsx, CriticalPathSection.tsx, DeliverySection.tsx, ReadingSection.tsx, PapersSection.tsx, LoopSection.tsx, chat/ChatSidebar.tsx, chat/ChatComposer.tsx, chat/ChatContextDisclosure.tsx, styles/app.css, styles/tokens.css; packages/server/src/fleet-config.ts |
| data/snapshot.js | packages/server/src/fleet-config.ts, adapters/handoff.ts, briefing-generate.ts, .handoff/*.md, research/fleet-navigator/fleet-navigator.template.html, CLAUDE.md |
| ds/cockpit.css | packages/renderer/src/styles/tokens.css, research/fleet-navigator/fleet-navigator.template.html, research/design-handoff-cockpit-v2/README.md; lego-village-pipeline docs/design/H-01-R1/dt/tokens.css |
| ds/refs.js | lego-village-pipeline docs/design/H-01-R1/dt/overlay.js, dt/landing.js, decisions.md (DEC-032/033/035) |
| ds/correspond.js | core decisions/fleet-runner/skill-observation-correspondence.md; lego-village-pipeline tools/schemas/lego-pipe-memo.v2.schema.json, docs/correspondence/CORR-LEGO-PIPE-021-correspondence-protocol.md, ROUTING-2026-09-17.md |
| Work Graph v2.dc.html | research/fleet-navigator/*, packages/server/src/fleet-config.ts (REPO_META role text → LINKS), .claude/northstar.md + .claude/roadmap.md (as quoted in .handoff/20260628-2015), decisions/adr/*; lego-village-pipeline docs/design/H-01-R1/, tools/schemas/, docs/correspondence/ |
| Work Graph.dc.html | research/fleet-navigator/*, research/design-handoff-cockpit-v2/design/Cockpit Fleet v2.dc.html, audit-cockpit-fleet-navigator.md |
| Reading Room.dc.html | packages/renderer/src/components/ReadingSection.tsx, PapersSection.tsx (sources, reader profile, adapters); course + textbook shelves have no repo source yet |
| Adaptive Workspace.dc.html, Open Loops.dc.html | data/snapshot.js sources above; research/design-handoff-cockpit-v2/README.md (phases, since-you-last-looked) |
| handoff/*.md | all of the above; uploads/morning-cockpit-ux-discovery-and-experimental-redesign.md |

## Secondary sources
- ojfbot/lego-village-pipeline@main — docs/design/H-01-R1/ (handoff bundle shape, tokens, overlay), apps/drafting-table/
