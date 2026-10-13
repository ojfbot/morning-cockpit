# ISSUE-001 · "Asked by" names a tool, not a worker

**Raised:** 2026-10-08, operator (chat) · **Status:** prototyped, not wired · **Trickles up to:** fleet-runner umbrella (actor identity on beads / memos) · **Prototype:** `Design System.dc.html` § Who asked; `ds/refs.js` `chip('who', actor)`; applied in Adaptive Workspace (What needs a decision), Open Loops (agents moved, from → to), Work Graph (who's here)

## Problem
Every "asked by" in the cockpit resolves to a bare actor string — `code-claude`, `claude-design`, `claude-design-session`. That string names the **harness** (Claude Code, Claude Design, Codex, chat, Cowork, launchd) and nothing else. Eight briefs from one repo have `actor == to == code-claude`; the operator cannot tell which process asked, on what, from where, or whether it is the same process that owes the answer (see Q4).

## Prior art
- **Gas Town** (Yegge): workers are named processes with a role, not tool labels; a named worker survives across sessions and can be addressed.
- **Leo**: this cockpit already has one named runner — chief of staff, in-app, global thread. It is the pattern; everything else is unnamed.

## Proposal — the actor tuple
```
actor:
  harness: claude-code | claude-design | codex | chat | cowork | launchd | cockpit | human
  name:    Ferrier            # the named process; stable across sessions; absent today on every bead
  role:    implementing_agent # v2 to[].role vocabulary (Q14)
  session: 7f3a               # changes per run
  host:    mbp-14             # where it ran
```
Back-compat: a bare string stays legal and is read as `{ harness: <classified from the string> }` with evidence ASSERTED; a full tuple is DERIVED (from frontmatter). Nothing is invented: when `name` is absent the UI says so.

## UI contract (built)
- **Top level stays quiet.** The `who` chip is a two-letter harness mark (CC · CD · CX · CH · CW · LD · MC · H) + state dot + the process name. No name on the bead → the bare actor id, dimmed (`--ink-2`), never a made-up name. Proposed/simulated identities render dashed.
- **Hover → peek** (260px, one layer): harness · process · role · session · host · last seen, an evidence word, and "click for the full card". **Click → the agent card** (existing navigable card) with a new first row WHO, EXACTLY.
- **Peek overlap rules** (the part that had to be careful; `ds/refs.js`):
  1. one peek page-wide — a new hover replaces, nothing stacks;
  2. non-interactive (`pointer-events: none`) and under the card's z — it can never trap the pointer or fight the card;
  3. never opens while a card is pinned; never for a chip inside the card (the card is already the detail);
  4. 220ms intent delay cold, 40ms warm when moving chip → chip; leaving closes after 120ms; click, scroll and ESC close at once;
  5. flips above when there is no room below, clamps to the viewport; keyboard focus peeks too;
  6. only `who` chips peek — every other chip keeps the native tooltip (ruling 2026-10-08, chips open on click only).

## Evidence labels in the prototype
`WHO.actors[*].origin`: `repo` (read off frontmatter → DERIVED) · `asserted` (harness classified from the id) · `simulated` (`WHO.proposed`, the target state — shown only on the Design System sheet, dashed).

## Asks upstream (fleet-runner)
1. Ratify the actor tuple on beads and lego-pipe-memo/v2 `from`/`to` (or confirm `to[].role` + a new `to[].name`).
2. Decide where names are minted and kept stable — a registry of named processes per harness (Gas Town keeps a roster), or per-rig config.
3. `bead_events` should carry `session` and `host` so liveness can be per process, not per harness (ADR-0008 derives from recency today).
4. Q4 is downstream of this: "waiting on you" when `actor == to` is only decidable once the two sides are distinguishable.

## Not done
No bead was rewritten; `data/snapshot.js WHO` is a read-model proposal. Names in `WHO.proposed` (Ferrier, Sexton) are placeholders to show the shape, not suggestions.
