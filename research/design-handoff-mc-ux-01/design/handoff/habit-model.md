# E · Habit and daily-practice model

The brief's flywheel: **Orient → Prioritize → Act → Capture → Reflect → Improve → Repeat.** The audit shows the loop is open at **Capture** (8 promises, 0 reports) and therefore starved at **Reflect** (2 movements in 96 days, nothing to pattern). The model below is designed around closing that leak first; nothing in it is a streak or a score.

## Daily rhythm
| Moment | Default room (D) | What the surface asks | The one verb | Loop state it moves |
|---|---|---|---|---|
| **Arrive** (any hour) | — | "Since you last looked: N moved, M still wait on you" (E diff strip) | `I'VE LOOKED` | stores last-viewed; resets the diff |
| **Orient** (05–11) | Orient | What needs a decision? What's holding things up? Where to spend today? | `Work on it →` / `Not today` | waiting → chosen, or deferred (counted) |
| **Enter a session** | Work | Bring me up to date on ‹repo›; open questions here; next slices | `Resume` | touched |
| **Switch project** | Work (new focus) | same desk, re-scoped in one click; session notes stay per repo | — | — |
| **End the session** (17–22) | Review | Three lines: decided/done · still open · first thing tomorrow | `Approve & write report →` | **closes** the loop (report responds_to brief) |
| **Night** (22–05) | Night | What runs without me? | none | — |

The daily minimum is **two taps and three lines**: `I'VE LOOKED` on arrival; the three Review lines at the end. Everything else is optional depth.

## Weekly rhythm (Review room, Friday or first Orient of the week)
- **Patterns this week** (built in D · Review): briefs > 60 days · items deferred (and how many times) · repos touched out of 42 · suggestions skipped vs used. Each is a count with a cause, not a grade.
- **Progress recorded**: the movement feed with *days since last movement* as the headline number — the honest habit signal, because movement only happens at merge.
- **Loops closed this week** (E · flywheel panel): reports written vs briefs written. The target is not "more briefs"; it is a ratio that approaches 1.

## How each step is served
| Step | Surface | Mechanism | Honesty |
|---|---|---|---|
| Orient | E diff strip · D Orient · A (as headline) | last-viewed timestamp × activity | DERIVED badges; SYNTH only on prose |
| Prioritize | E attention grouping · D Orient §1 | oldest-first among loops waiting on a human; red only here | counts derive from one selector |
| Act | C inspector verbs · D Work · E loop verb | selection drives ADR-0012; verbs are UI-executed, never model text | `/draft-handoff` enters the gated flow |
| Capture | D Review → report bead · D Work session notes | a report that `responds_to` a brief closes it in existing lane logic | one approved write per report (ADR-0005 pattern) |
| Reflect | D Review patterns · E flywheel | re-brief detection ("Pick up:" prefix), deferral counts, movement gap | no streaks; a deferral is shown, not punished |
| Improve | Loop telemetry (folded) · mode-override telemetry (new) | which room you pick when the clock said otherwise | rates suppressed until capture quality verified |

## Why not gamify
A streak would reward opening the app; the data says opening is not the problem — *closing* is. The only number that should feel good is **reports / briefs**, and it should feel good because the backlog of 60-day-old promises shrinks, which the Age grouping makes visible without a score.

## Leo in the rhythm
Conversational navigation (operator's hypothesis): *what needs me? · what moved? · what keeps slipping?* are answered in words that point at loops or units, and the structured view opens there. The reverse path — see something on the map, ask Leo about it — is scoped by selection (C) or room (D). Leo never writes a bead; `draft handoff` and the Review report are the two gated writes, both approved by you.
