# F · Evaluation and recommendation

Scored against the seven tasks in the brief (§9), using the snapshot in `data/snapshot.js` (8 real briefs, 42 repos, 6 agents, 3 chains). Scale: **●●●** does it directly · **●●○** possible with a step · **●○○** weak · **○○○** not addressed. Scores are a design judgement from walking each prototype; they are hypotheses to validate with the operator on live data (open question Q1).

| Task | Today | A Briefing | B Mission Control | C Work Graph | D Adaptive | E Open Loops |
|---|---|---|---|---|---|---|
| 1 · Most important developments in < 2 min | ●○○ (read 8 sections) | ●●● | ●●○ | ●●○ (hot list) | ●●● (Orient) | ●●● (diff strip) |
| 2 · Three most consequential actions | ●○○ (masthead sentence only) | ●●○ | ●●● | ●●○ | ●●● | ●●● |
| 3 · Resume an interrupted project without reconstruction | ○○○ | ●○○ | ●○○ | ●●○ (inspector) | ●●● (Work desk) | ●●○ (continuity group) |
| 4 · Discover a relationship across the Botfleet | ●○○ (chains, editorial) | ●○○ | ●●○ | ●●● | ●○○ | ●○○ |
| 5 · What an agent did / what remains | ●○○ (tallies) | ●●○ | ●●○ | ●●● | ●●○ (Night, Overnight) | ●●○ |
| 6 · Short daily review without admin | ○○○ | ○○○ | ●○○ | ○○○ | ●●● (Review, 3 lines) | ●●○ (flywheel + I'VE LOOKED) |
| 7 · Find technical evidence when a summary is insufficient | ●●○ (grounding disclosure) | ●●○ | ●●○ | ●●● (where this came from) | ●●○ | ●●● (per loop) |

## Qualities (brief §9)
- **Comprehension.** E and D's Orient are read in plain words; C needs a 30-second legend read; A depends on model quality.
- **Cognitive load.** D lowest per room, highest across rooms (what's in the other room?). E constant. C high on first load, then the map is memorable.
- **Navigation effort.** D one click per mode; E zero (one page); C pan/zoom + filter.
- **Trustworthiness.** All three built concepts badge every number; C and E expose "where this came from" per object; D's Review report is the only *new* write and is gated.
- **Actionability.** E has one verb per loop; D one or two per room; C verbs from Leo and the inspector.

## Strongest element of each
- **A** — the voice; the headline sentence. Keep as E's headline and D's Orient lede (already done).
- **B** — intervention on the object you are looking at. Absorbed into C's inspector and E's loop verb.
- **C** — the shape of the fleet with live work on it; the registration gap made visible; verbs that move the UI.
- **D** — rooms with one job; Review as the first capture surface; "Not today" counted.
- **E** — the loop as unit; since-you-last-looked; promises vs reports as the headline metric.

## Recommendation (not a winner)
The product model is **E** (loops over evidence), the daily shell is **D** (rooms the clock proposes), and **C** is the fleet view inside D's Orient and Work rooms. Concretely:
1. **E's information model** becomes the read-side selector set: `deriveLoops`, `sinceLastLooked`, `waitingOn`. Everything else renders from these.
2. **D's Orient and Review** become the two surfaces the app opens into (by clock), with E's diff strip as Orient's header.
3. **C replaces `01 Fleet`** as the v2 handoff already ruled (three modes, one selection), with the inspector in the rail and loop satellites on nodes.
4. **Leo** is conversational navigation everywhere: words that point, verbs the UI executes, one keyed thread store (#340).

Operator decides: whether rooms (D) or one page with groupings (E) is the shell. The two are compatible — E can be the Orient room — but the choice changes routing, which the cockpit has avoided.

## Validation plan (before any production slice)
- Wire `data/snapshot.js` → live `/api/*` (one adapter shim). Re-walk the seven tasks with real counts.
- One week of mode-override telemetry in D (clock said X, you chose Y) and of `I'VE LOOKED` timestamps in E.
- Count reports/briefs weekly; the ratio is the acceptance test for the whole redesign.
