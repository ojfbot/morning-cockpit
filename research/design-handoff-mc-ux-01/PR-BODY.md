## What
Design handoff bundle MC-UX-01 under `research/design-handoff-mc-ux-01/`. Research only — no change to `packages/`.

## Contents
- `README.md` — entry point for implementing/reviewing agents
- `design/handoff/` — audit (A), information model + terminology (B), concepts (C), specs (D), habit model (E), evaluation (F), roadmap (G), decisions ledger, open questions, ISSUE-001, `index.json`
- `design/*.dc.html` — baseline recreation + prototypes C (Work Graph, v2), D (Adaptive Workspace), E (Open Loops), Reading Room (D · READ room), Dossier, Design System
- `design/ds/` — `cockpit.css`, `refs.js`, `correspond.js`
- `design/data/snapshot.js` — origin-labelled hand snapshot
- `screenshots/` — first view of each screen + interaction-state captures

## Review asks
- Decisions in `decisions.md` are operator rulings — review for consistency, not re-litigation.
- Owned by Claude Code: Q1 (live data capture), Q4 (`to:` reliability), Q10 (dossier ownership), Q12 (agent type/task derivation), Q20 (where the Reading Room curated list lives).
- Flag anything simulated that reads as wired.

## Not in scope
Production renderer changes. ISSUE-001 files separately upstream to fleet-runner.
