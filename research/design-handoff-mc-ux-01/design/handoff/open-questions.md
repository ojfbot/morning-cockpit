# Open questions

| # | Question | Owner | Where it surfaces |
|---|---|---|---|
| Q1 | Validate the seven-task scores on **live data** — the snapshot is 8 briefs from one repo; core alone has 23 open beads. Operator offered to point at local code for the full queue + daily-logger queue; an agent can collect `/api/cockpit`, `/api/fleet`, `/api/delivery`, `/api/loop` JSON into `data/` | operator → Claude Code | `evaluation.md`, `data/snapshot.js` |
| Q2 | **Shell:** rooms (D) or one page with groupings (E)? Changes whether a hash switch is needed | operator | `roadmap.md` Phase 3 |
| Q3 | **Report emission** as a second gated write (ADR), or wait for a core verb? Without it, loops cannot close from the UI | operator + core | `roadmap.md` Phase 2, `habit-model.md` |
| Q4 | Does `to:` on a brief reliably name who owes it? Several beads have `actor == to == code-claude`; the "waiting on" derivation treats those as waiting on you | Claude Code (data check) | E `waitingOn` |
| Q5 | Clock boundaries for rooms (05/11/17/22) — guessed; settle with override telemetry | telemetry → operator | D |
| Q6 | Should intake (reading, papers) ever create a loop ("read this with ‹repo› in mind")? Today staging a cross-link is the only verb | design session | E intake panel |
| Q7 | Cluster for `lego-village-pipeline` / `play-well-library` — in `REPO_META` since 2026-09-24, absent from the 2026-08-08 registry read. Register, or keep `[judgment]`? | operator | C |
| Q8 | Day-dial from the v2 hero — dropped here (rooms carry phase instead). Bring back as a 24px glyph in the meta bar? | operator | D header |
| Q9 | Does "Not today" need a reason? A free-text reason makes deferrals reviewable but adds admin | operator | D Orient, Review patterns |
| Q10 | Who owns the HTML dossier after handoff — regenerate from markdown, or hand-maintain? | Claude Code | `Dossier.dc.html` |
| Q11 | Room names: First Light · The Desk · Last Light · Night Watch are a first pass. Alternatives: Orient / Desk / Close / Watch (plainer), or Dawn / Noon / Dusk / Night. Wants a naming round | operator | D |
| Q12 | Agent `type` and `task` are not in any read-model today — task is the newest bead/brief an agent touched; type is a classification of agent ids. Derive in the dolt adapter or store on bead_events? | Claude Code + core | E agents-moved rows, `ds/refs.js` agent page |
| Q13 | Which correspondence contract is operative for ojfbot cockpit memos — lego-pipe-memo/v2 (ratified for play-well, register .13) or the fleet-runner bounded profile (Proposed, core #495)? The fields render v2 frontmatter and the fleet-runner speech-act tiers together; the register/number allocator for a cockpit thread does not exist | operator + core | `ds/correspond.js` preview, D Last Light |
| Q15 | Where are process names minted and kept stable — a roster per harness (Gas Town style), per-rig config, or self-declared in frontmatter? And does `bead_events` grow `session` + `host` so liveness is per process (ADR-0008)? | fleet-runner + core | ISSUE-001, `who` chip peek |
| Q14 | Recipient vocabulary for ROUTE TO — agent ids from bead_events, or role names (implementing_agent, correspondence_steward, operator) per v2 `to[].role`? | operator | D fields |
| Q16 | ~~newline enrolment~~ — resolved 2026-10-09: wired later, out of scope | — | Reading Room · Course |
| Q17 | ~~textbooks~~ — resolved 2026-10-09: out of scope | — | Reading Room · Textbooks |
| Q18 | ~~room or side door~~ — resolved 2026-10-09: fifth room (READ) in D | — | D |
| Q19 | Community curated list: which subreddits and X accounts, and the X access route (paid API vs bridge)? The digest is blocked on both | operator | Reading Room · Community |
| Q20 | Where does the curated source list live so the server reads it — config in morning-cockpit, or a vault note? Today News sources are in code | operator + Claude Code | Reading Room · every channel |
