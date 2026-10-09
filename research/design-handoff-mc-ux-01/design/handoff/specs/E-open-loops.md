# Spec · E — Open Loops

**File:** `Open Loops.dc.html` · **Status:** built, interactive · **Data:** `data/snapshot.js` (labelled)

## Purpose
The data-derived concept: every item is a promise awaiting an outcome (a loop) or evidence about one. The page is a diff since you last looked over a ledger of loops; intake is folded beneath.

## Behaviour
- Meta bar: `LAST LOOKED <ts>` · `I'VE LOOKED` stores now (localStorage `mc.proto.lastLooked`) and resets the diff.
- Diff strip (four cards, each with a DERIVED chip and its source): **agents moved** — list rows: agent chip · type (Code session / Design session / Scheduled sweep / Feed poller / Vault heartbeat / Chat assistant) · when · the task it was on · repo chip (operator ask 2026-10-08) · **open loops touched** (repo chips) · **still waiting on you** (oldest brief chip) · **progress recorded**.
- Ledger: group by **attention** (waiting on you / on an agent / on a ruling) · **continuity** (moved / resumable / dormant > 90d) · **age**. Loop row: hue · title · repo chip · promised date · age · waiting-on (coloured) + chip. Click expands: *what was promised (from → to agent chips, cited refs as chips) · what happened since · how it closes · where this came from*. One verb per loop (`Decide →` / `Settle ADR-0002` / `Check progress`).
- Rail: the flywheel measured (orient · decide · act · capture · reflect with a number each) · intake folded (Reading, Research, Loop telemetry, Fleet structure — counts, details on demand) · Ask Leo (three questions, simulated).

## Loop derivation (pure, from existing fields)
loop = brief with `status: live` and no report `responding_to` it (adapter rule) · `decidedInFlight` → folded, not a loop · waiting on = `to:` if agent, else you; a ruling if the brief cites a gating ADR · touched = any agent event in the loop's repo after last-looked.

## Copy rules
"promise", "waiting on", "closes" — never "bead", "pickup", "emit" in first position. Red only on loops waiting on a human.

## Simulated
Leo · loop verbs (they describe what the real app would open) · last-looked is local.
