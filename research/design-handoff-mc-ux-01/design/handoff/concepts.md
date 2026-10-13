# C · UX concept portfolio

Five directions. They differ in **information architecture** (what is the unit, what groups it) and **interaction philosophy** (how you arrive, how you act), not in styling — all five wear `ds/cockpit.css`. Three are built (C, D, E); A and B are specified to the level needed to compare.

| | Unit | Organising axis | You arrive at | You act by | Leo is |
|---|---|---|---|---|---|
| **A · Daily Briefing** | a paragraph | editorial importance, synthesised | a narrative | following a link out of it | the author |
| **B · Mission Control** | an initiative | attention × dependency | a board | intervening on a tile | an alarm annotator |
| **C · Work Graph** | a repo node + what hangs off it | relationship (cluster, ladder, waiting, agent) | a map | selecting; verbs move the map | conversational navigation |
| **D · Adaptive Workspace** | depends on the hour | daily moment (orient / work / review / night) | the right room for now | each room has 1–2 verbs | scoped to the room |
| **E · Open Loops** | a promise awaiting an outcome | attention · continuity · age | a diff since you last looked | deciding, or closing with a reason | points at loops, never ranks intake |

## A · The Daily Briefing (specified, not built)
**Philosophy.** The system reads everything and writes you one page; you read it top to bottom. The existing `Briefing` + `SummaryView` + the masthead cover-line are this idea at 20%.
**IA.** Lead (what changed) → Decisions (≤3) → Watch (agents, blockers) → Intake (3 lines). Every sentence carries its badge (SYNTH/DERIVED) and links to the loop or unit it summarises.
**Strengths.** Fastest orientation when the synthesis is good; the voice the operator likes.
**Trade-offs.** Lives or dies on a 7B model's honesty (S2-2); a *read-through* form — the audit's central objection; no obvious capture step. Best as the **Orient** room of D or the headline of E, not as the whole product.

## B · Mission Control (specified, not built)
**Philosophy.** Situational awareness: a board of initiatives, each tile showing attention state, dependency state, and who is on it.
**IA.** Rows = initiatives (registry northstars; unregistered repos appear as a gap row), columns = waiting-on-you · in flight · blocked · quiet. Intervention is a verb on the tile.
**Strengths.** Scales to many initiatives; blockers are visible as a column, not a section.
**Trade-offs.** Columns are a lane model again (S1-3) — empty columns cost space; needs initiatives to be real objects (today they are northstar slugs with 1–3 members). Its best idea — intervention from the tile — is absorbed into C's inspector and E's verbs.

## C · Work Graph — built (`Work Graph.dc.html`)
**Philosophy.** The fleet has a shape; show it, and hang the live work on it. Extends Fleet Navigator's canvas (clusters, dashed = unregistered, bundled ladders) with what Navigator lacked: briefs waiting (red count), agents working (green dot), and an inspector in the rail instead of a popover.
**IA.** Cluster boxes → repo nodes → satellites (waiting count, agent dot). One apex. Inspector = *what this is · what's waiting on you · who's working here · how far it's come · why it exists · where this came from*.
**Interaction.** Filter dims (never removes). Selection is an ink stroke and drives fleet selection (ADR-0012). Leo is **conversational navigation**: prose answers, plus verbs (`/waiting`, `/gap`, `/open ‹repo›`, `/explain`, `/draft-handoff`) that the UI executes deterministically — the model never gets a verb.
**Strengths.** Answers *discover a relationship across the fleet* and *understand what an agent did* in one view; makes the registration gap unmissable.
**Trade-offs.** Needs ≥ 900px; a map is a poor place to *capture*; counts per node need the live adapter to be trustworthy.

## D · Adaptive Workspace — built (`Adaptive Workspace.dc.html`)
**Philosophy.** The same data wants four different presentations across a day. The clock proposes the room; you can override it (intent chips), and the override is remembered as a preference signal.
**Rooms.** **Orient** (what needs a decision · what's holding things up · Overnight · where to spend today) · **Work** (one project: bring me up to date · open questions · next slices · session notes · scoped Leo) · **Review** (three lines → report bead draft · patterns this week · progress recorded) · **Night** (what runs without you).
**Strengths.** Each room has one job and one or two verbs; "Not today" is counted, not hidden; Review is the first capture surface the app has had. Keeps the Overnight lane (operator asked to compare).
**Trade-offs.** Four layouts to maintain; mode switching can hide something you wanted; the clock boundaries are a guess until telemetry.

## E · Open Loops — built (`Open Loops.dc.html`) — the data-derived concept
**Where it came from.** The audit's S1-2: 8 promises, 0 outcomes, two re-briefs of the same promise, and a `closes:` seam built to cope. The populated data says the app's real unit is not a bead, a repo or a section — it is a **loop**: a promise waiting for an outcome.
**Philosophy.** Every item is a loop or evidence about one. The page is a diff ("since you last looked") over a ledger of loops; intake is folded beneath, counted, never ranked against a promise.
**IA.** Diff strip (agents moved · loops touched · still waiting on you · progress recorded, each badged) → loops grouped by **attention** (waiting on you / on an agent / on a ruling), **continuity** (moved / resumable / dormant) or **age** → the flywheel measured (promises vs reports) → intake folded.
**Interaction.** A loop expands to *what was promised · what happened since · how it closes · where this came from*. One verb per loop (Decide → / Settle ADR / Check progress). `I'VE LOOKED` stores the timestamp. Leo answers three questions in words and points at loops.
**Strengths.** Converts the app from a daily ritual to a return-to surface with one new field; makes the capture leak the headline metric (0/8); every count is derivable today.
**Trade-offs.** Flat when loops are few; needs the report-writing path (a second ADR-0005-style carve-out, or the core verb) to close loops from the UI; the fleet shape is invisible — it borrows C for that.

## What they share (the system)
Red = a human decision, nothing else · four evidence badges · plain words first, technical term one disclosure away · controls say their consequence · nothing simulated unlabelled · one selector for every count.
