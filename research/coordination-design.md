# Morning Cockpit — Coordination Design

**Status:** Draft for review
**Date:** 2026-06-07
**Author:** code-claude
**Scope:** Future-state coordination architecture to close the gaps the read-only cockpit dashboard exposes.

---

## 0. Grounding (verified, not assumed)

Everything below was checked against the live system on 2026-06-07, not taken from the brief on faith.

| Claim | Verification | Result |
|-------|-------------|--------|
| Dolt store reachable at `127.0.0.1:3307`, db `.beads-dolt` | `mysql2` connect + query | Reachable |
| Schema = `beads` + `bead_events` as described | `dolt-schema.sql` + live `SHOW`/queries | Confirmed |
| Only 4 live `task` beads, all NULL hook, April seed | `SELECT … WHERE type='task'` | Confirmed: `core-task-43fca84d`, `core-task-47f4e47a`, `shel-task-0f13799f`, `shel-task-0fb1617f`, all `created_at` 2026-04-11, hook NULL |
| 11 agent beads, all `active`, all `last_session=NULL` | `SELECT … WHERE type='agent'` | Confirmed |
| Pre-project chat ideation tracked nowhere | grep of bead types + emit CLI commands | Confirmed — no `seed`/intake path exists |
| `bead_events` is the liveness log | `SELECT count(*) FROM bead_events` | **`bead_events` has 0 rows. It has never been written to.** |

**The sharpest new finding:** `bead-emit.mjs` writes to `beads` and runs `DOLT_COMMIT`, but it **never inserts a row into `bead_events`**. The table exists in the schema and is indexed, but nothing populates it. Any liveness design that "reuses `bead_events`" is not reusing an existing signal — it is **standing up the writer for the first time**. This is good news (the table and indexes are already there; the schema is settled) but it changes the framing from "read an existing log" to "begin emitting to an empty log."

A second grounding note: the brief calls the target the **WantedBoard**. In the real `gastown-pilot` code the panel is `WantedBoard`, but it lives inside `WastelandView.tsx` and renders rows with `{title, effort, status, poster, actions}` where `status === 'open'` shows a **Claim** button. That row shape is the contract the unassigned queue must satisfy if it is ever to surface there. The design below maps onto exactly those columns.

---

### 0.1 Reconciliation with the read-only slice (already on disk)

The read-only slice exists (`ADR-0001` accepted; `packages/shared/src/lanes.ts` implemented). Two points must line up so the write-path *feeds* the read-model rather than fighting it:

- **The slice already names the lane this design fills.** `lanes.ts` has an `available` lane assigned to `kind==='task' && !hookAssigned` (and open issues/briefs). My `queue=available` write-path produces exactly such beads: `type=task, hook=NULL`. So a posted queue bead lands in the slice's *existing* Available lane with **no read-model change** — the write-path is the missing producer for a consumer that is already built. The slice synthesizes Available today from open issues+briefs (a stopgap its own CLAUDE.md flags as "no real unassigned-task pool yet"); this design supplies the real source.
- **The slice's "Overnight is timestamp-driven off `bead_events`" claim is currently running on a fallback.** ADR-0001 and the slice CLAUDE.md say Overnight reads `bead_events` + `created/closed_at`. But `bead_events` is empty (§0), so the *only* live signal today is `created/closed_at`. This does **not** contradict the slice — `lanes.ts:classifyLane` keys Overnight off `status==='running'` and `activityAt` within the window, fed by created/closed timestamps. It means the `bead_events` branch is **dead code waiting for a writer**, which is precisely why liveness item #1 (§6) is "stand up the `bead_events` writer" and ranks first. Closing gap 2 *activates* a path the read-only slice already anticipated.

Net: nothing here asks the read-only slice to change its lane model. The write-paths below are additive producers for lanes and signals the slice already defined.

## 1. The one high-leverage question (grill)

Before the proposals, the assumption that, if wrong, invalidates most of this document:

> **Is the unassigned queue meant to be picked up by *agents autonomously*, or is it a *human triage inbox* that Yuri pulls from each morning and then dispatches?**

These produce different designs:

- If **agent-autonomous**: claiming must be atomic and race-safe across concurrent processes, staleness must auto-release, and the cockpit is mostly a monitor. The keystone risk is a claim race (two workers grab one bead).
- If **human-pull**: claiming is a single-operator act (no race), staleness is a nudge not an auto-release, and the cockpit is the *primary* write surface (Yuri clicks "claim → dispatch"). The keystone risk is staleness rotting silently, not races.

**This document designs for the human-pull model as the default**, because (a) the cockpit is explicitly "personal / local / GroupThink-styled," (b) there is exactly one human operator, and (c) the existing system has *no* autonomous claim loop today — building one is a much larger bet than the read-only slice implies. Every proposal below notes what changes if the answer is "agent-autonomous." **This is the question to settle before ADR-0002 is accepted.**

---

## 2. Unassigned-queue write-path

### 2.1 What an unclaimed, pickup-able bead is

**Do not add a `BeadStatus` value.** `BeadStatus = created | live | closed | archived` is referenced across `@core/workflows`, the emit CLI, gastown-pilot adapters, and ADR-0016's documented lifecycle. Adding `available` (or `ready`) is a breaking change to a union type that ripples through every consumer and every status-icon switch. The status enum is the wrong axis — status is about lifecycle (is this work alive?), not about ownership (does someone hold it?).

**Reuse the existing fields. An unassigned, pickup-able bead is:**

```
type     = 'task'
status   = 'created'      ← ADR-0016 literally defines this as "Filed, not yet picked up"
hook     = NULL           ← nobody holds it
labels   = {
  queue:        'available',   ← the explicit lane marker (the load-bearing label)
  repo:         '<repo|"">',   ← "" for repo-less / pre-project work
  effort:       's|m|l',       ← maps to gastown WantedBoard "effort" column
  posted_by:    '<actor>',     ← maps to WantedBoard "poster" column
  posted_at:    '<iso>',       ← redundant with created_at but explicit for the lane
  expires_at:   '<iso>'        ← staleness horizon (see 2.4)
}
```

The `queue=available` label is the keystone. `status=created` alone is too weak a signal — it is the *default* status (`DEFAULT 'created'` in the schema), so a half-written or seed bead also reads as `created`. The label makes "this was *deliberately* posted to the pool" explicit and queryable: `WHERE type='task' AND status='created' AND JSON_EXTRACT(labels,'$.queue')='available'`. The `idx_beads_status` index covers the status predicate; the JSON extract is the residual filter on a small result set.

**Why this beats `status=created` + NULL hook alone (the brief's first option):** the 4 existing April seed tasks are *already* `status=created`-equivalent garbage with NULL hook. Without a positive lane marker, the queue and the seed cruft are indistinguishable. The label is what separates "intentionally available" from "abandoned."

**Weakest point of this proposal:** labels are JSON, not a column, so the queue lane is not a first-class index. At the current volume (single-digit live tasks) a JSON-extract filter is free. At thousands of open tasks it would warrant a generated column or a dedicated index — but that is a volume problem the system is nowhere near, and noting it now is enough. The second weakness: `queue` is a new reserved label key not documented in `bead.ts`. That must be written down (the ADR does this) or it becomes folklore.

### 2.2 Who files them

Three legitimate producers, all reusing one new emit verb (`queue-post`, see 2.6):

1. **A triage step (`/triage` postflight, or a `frame-standup` action).** When standup or triage identifies work that is real but unowned, it posts to the queue instead of inventing a convoy. This is the highest-value path: it turns "things we noticed but nobody is doing" into claimable beads instead of prose in a daily-logger post.
2. **A chat agent at end of session.** When a `claude.ai` chat produces a concrete next action with no agent to take it, it posts a `queue=available` task (or a `seed`, see §4) rather than letting it die in history.
3. **Yuri, manually, from the cockpit.** The cockpit's first *write* affordance: a "post to queue" box.

**This does not replace convoys.** Convoys remain the right primitive for *coordinated, already-assigned* multi-agent jobs (`/orchestrate`). The queue is the **front door before a convoy exists** — the lane for work that has no owner yet. A claimed queue bead can later be added to a convoy as a slot (`convoy-add-slot`), which is the natural promotion path.

### 2.3 How one is claimed (atomic)

Claiming = assign a holder atomically and flip the lane closed in **one conditional UPDATE**, so two claimants cannot both win:

```sql
UPDATE beads
   SET hook = :claimant_agent_id,
       status = 'live',
       labels = JSON_SET(labels, '$.queue', 'claimed', '$.claimed_at', :now),
       updated_at = :now
 WHERE id = :bead_id
   AND status = 'created'
   AND JSON_EXTRACT(labels, '$.queue') = 'available';
```

The `WHERE … queue='available'` guard is the compare-and-swap. If `affectedRows = 0`, someone else (or staleness) already took it — the caller lost the race and must re-query. This is the standard optimistic-claim pattern and it works on Dolt/MySQL without extra locking. A new emit verb `queue-claim --bead-id --agent-id` wraps it (see 2.6), runs the `DOLT_COMMIT`, and prints `{claimed: true|false}`.

Note the field reuse: `hook` is *exactly* the right field — ADR-0016 defines `hook` as "id of bead on the agent's hook." Claiming a queue task *is* slinging it onto a holder. We are not inventing ownership semantics; we are using the ones already named.

**Weakest point:** in the human-pull model there is no race, so the CAS is belt-and-suspenders — but it costs nothing and makes the path correct if the answer to §1 flips to agent-autonomous later. The real weakness is that `hook` on a *task* bead means "who holds this task," while `hook` on an *agent* bead (per `agent-bead.ts` `labels.hook`) means "what this agent is working on." Same field, mirrored direction. That is a pre-existing ambiguity in the schema, not one I am introducing, but the ADR must state the convention explicitly: **on a task, `hook` = the agent/actor holding it.**

### 2.4 Staleness / expiry

Timestamp-driven, no daemon required (a daemon is a liability in a personal/local system that isn't always running):

- On post, set `labels.expires_at = posted_at + TTL`. Default TTL by effort: `s`=2d, `m`=5d, `l`=10d. (Opinion: short defaults. A queue item nobody claims in a week is usually a bad item, not a patient one.)
- **Lazy sweep, computed at read time** by the cockpit and by `queue-post`/`queue-claim`: any `queue=available` bead with `expires_at < now` is rendered as **stale** (greyed, "expired N days ago"), not silently hidden.
- A `queue-sweep` verb (run from `frame-standup`, or a `/loop`/`/schedule` cron *if* the host is reliably up) flips expired available beads to `labels.queue='expired'` and emits a `queue.expired` event. This is the only place auto-state-change happens, and it is observe-then-act: expiry is reversible by re-posting.

**Weakest point:** lazy/read-time staleness means an expired item *looks* claimable until someone reads the board. In the human-pull model that is fine (the human reads the board to act). In an agent-autonomous model, a worker could claim an expired bead before the sweep runs — so under that model the CAS in 2.3 should also guard `expires_at > now`. Noted, not built.

### 2.5 Mapping onto the gastown WantedBoard

The real `WantedBoard` (in `WastelandView.tsx`) consumes `{id, title, effort, status, poster, actions}` and shows a **Claim** button when `status === 'open'`. The mapping is near-exact:

| WantedBoard column | Queue bead source |
|--------------------|-------------------|
| `title` | `beads.title` |
| `effort` | `labels.effort` |
| `status` | derived: `queue=available && !expired → "open"`; `queue=claimed → "claimed"`; `queue=expired → "expired"` |
| `poster` | `labels.posted_by` |
| `actions` (Claim) | calls `queue-claim` (the cockpit's write path) |

So the unassigned queue is **the data the WantedBoard was always meant to render** — gastown stubbed the panel against a hypothetical Wasteland service; this design gives it a real local source. That is the strongest argument for eventual convergence (see §5): the cockpit's queue and gastown's WantedBoard are the same concept viewed from two product stances (personal-local vs. observability-Frame).

### 2.6 New emit verbs (additive to `bead-emit.mjs`)

All additive — no change to existing verbs. Each follows the file's existing pattern (parse args → INSERT/UPDATE → `doltCommit` → print JSON):

- `queue-post --title --repo --effort=s|m|l --posted-by --ttl-days=N` → inserts the `queue=available` task, computes `expires_at`.
- `queue-claim --bead-id --agent-id` → the CAS UPDATE in 2.3; prints `{claimed: bool}`.
- `queue-sweep` → flips expired available → `expired`, emits events.
- `queue-list` → reads available (+ optionally claimed/expired) for the cockpit.

These also become the first writers of `bead_events` (see §3).

---

## 3. Agent liveness truth

### 3.1 The actual problem

`agent_status` lies because it is only ever written `active` (in `agent-create`) and `idle` (in `agent-idle`), and **`agent-idle` is evidently never called** — all 11 agents are `active`, all `last_session=NULL`. `agent_status` is a *self-reported* field with no ground truth behind it. You cannot fix a lying field by reading it more carefully.

### 3.2 Liveness must come from events, not state

The trustworthy signal is **"when did this actor last *do* something observable,"** which is an append-only fact, not a mutable flag. That is exactly what `bead_events` is for — and it is **empty today**, so this is greenfield.

**Proposal: start emitting `bead_events` on every meaningful bead write, then derive liveness from the event stream.**

- Add a single helper to `bead-emit.mjs`: `emitEvent(pool, {event_type, bead_id, actor, summary, payload})` → one INSERT into `bead_events` with `timestamp = now`. Call it from every mutating verb (`session-start/update/close`, `task-*`, `pr-created`, `convoy-*`, `agent-*`, and the new `queue-*`). One line per verb.
- **Liveness is then a query, not a stored boolean:**

```sql
SELECT actor, MAX(timestamp) AS last_seen
  FROM bead_events
 GROUP BY actor;
```

An agent is **live** if `last_seen` is within a freshness window (proposal: 15 min for "running now," 24 h for "ran today"), **stale** otherwise. The cockpit renders the agent as live/stale/dark off this derived value and *ignores `agent_status` for liveness* (it can still display the self-reported status as a secondary, clearly-labeled hint).

### 3.3 Did it run overnight?

Direct consequence of 3.2: `SELECT actor, COUNT(*), MAX(timestamp) FROM bead_events WHERE timestamp BETWEEN <last-night-window> GROUP BY actor`. An agent that "ran overnight" is one with events in the overnight window. No heartbeat ping needed — *real work is its own heartbeat*. If you additionally want liveness for agents that are *up but idle* (no work to show), add a cheap `heartbeat` event emitted on a timer from the agent's session loop; but do not build that until something actually needs to distinguish "idle-but-alive" from "dead," because in the cockpit's morning-pull model, "no events overnight" and "dead" are operationally the same.

### 3.4 Why not just fix `agent-idle` / write `last_session`?

That patches the symptom. `last_session` and `agent_status` are mutable single fields with last-write-wins semantics and no history — the same class of field that already lied. An event log is append-only, gives you *cadence* (not just last value), survives crashes (a crashed agent can't write its own `idle`, but its last real event is still there), and answers "overnight?" for free. Reuse the table that already exists for exactly this.

**Weakest point:** every mutating verb now does a second INSERT, roughly doubling writes and `DOLT_COMMIT` churn. At current volume (single-digit writes/day) this is irrelevant. If write volume grows, batch the event insert into the same transaction as the bead write (one commit, two inserts) — the helper should do this from day one to avoid a second `DOLT_COMMIT`. Second weakness: `actor` granularity. Events carry `actor` (e.g. `claude-code`), not the *agent bead id*. If you need per-agent-bead liveness rather than per-actor, the event payload must also carry `agent_id`. The helper should accept an optional `agent_id` in `payload`; liveness can then group by whichever is needed.

---

## 4. Pre-project chat-session capture

### 4.1 The gap

An idea in a repo-less `claude.ai` chat has nowhere to land. The `/bead` skill writes to a `.handoff/` directory — but a pre-project idea *has no repo and therefore no `.handoff/`*. The Dolt store has no `seed`/`intake` concept. Ideas die in chat history (gap 3, confirmed).

### 4.2 Lightest capture path: the `seed` bead

A **seed** is a bead representing an idea that is not yet a project. Reuse the existing machinery; add no new storage:

```
type    = 'task'              ← reuse; do NOT add a 'seed' BeadType (same reasoning as §2.1: union churn)
status  = 'created'
hook    = NULL
labels  = {
  kind:       'seed',         ← distinguishes an idea-seed from a work-task
  queue:      'incubating',   ← NOT 'available' — a seed is not yet claimable work
  repo:       '',             ← the defining property: no repo
  source:     'chat',
  posted_by:  'chat-claude'
}
refs    = [ url:<chat-permalink-if-any> ]
body    = the idea, in the chat's own words
```

Two label axes do the work: `kind=seed` (this is an idea, not a task) and `queue=incubating` (not yet pickup-able). A seed is **promotable**: when the idea becomes a project, `kind` drops and `queue` flips to `available` (it joins the unassigned queue), or it spawns a repo and the seed is closed with a `refs` link to the new project's first real bead.

### 4.3 Two capture surfaces, pick the lightest per context

- **From a repo-less chat (no `.handoff/`):** the chat agent calls a new emit verb `seed-create --title --body --source=chat --url=<permalink>`. This is the *only* path that reaches Dolt directly from chat; it is one CLI call. This is the lightest possible capture: one command, no repo, no file.
- **From `/bead --compact` (existing):** `/bead --compact` already produces a one-shot handoff *file* for an incoming agent. Extend its contract so that when the handoff is a *pre-project idea* (no repo), it ALSO emits a `seed-create`. The file is the human-readable artifact; the seed is the queryable index entry. This reuses an existing, already-loved path instead of inventing a parallel one.

### 4.4 Tie to the selfco vault

The selfco vault (`~/selfco`) is the user's "second brain" with an append-only `raw/` + LLM-owned `wiki/`. A seed bead and a vault note are **complementary, not redundant**:

- The **seed bead** is the *actionable* index entry — it shows up in the cockpit, it is promotable to the queue, it answers "what ideas are waiting?"
- The **vault note** is the *durable knowledge* — the idea's full context, research, and cross-links, owned by `/vault`.

Recommended tie: `seed-create` writes the bead and (optionally, if `~/selfco` is initialized) drops a one-line stub into `~/selfco/Inbox/` — exactly mirroring the existing opt-in `vault-session.sh` SessionEnd hook pattern (ADR-0085). The seed bead carries `refs: [vault:<note-path>]` once `/vault` folds it in. This keeps the cockpit (action) and the vault (knowledge) as separate surfaces over the same idea, each strong at its job.

**Weakest point:** `kind=seed` is a *second* overloaded label on `type=task`, on top of `queue` from §2. The `task` type is becoming a catch-all distinguished only by labels. That is a real smell. The honest alternative is to add a `seed` BeadType — but that reopens the union-churn cost from §2.1 and, worse, every consumer's `type` switch. The judgment call: **labels are cheap to add and cheap to ignore; a BeadType is expensive to add and impossible to ignore.** Stay with labels until a consumer genuinely needs to branch on seed-ness at the type level. State the reserved label keys (`queue`, `kind`) in `bead.ts` so this doesn't become folklore.

---

## 5. gastown-pilot convergence — recommendation

**Recommendation: keep them separate now; converge later by making gastown-pilot a *consumer* of the cockpit's coordination primitives, not by merging codebases.** Specifically: build the queue/liveness/seed write-paths into `core` (the emit CLI + the shared types), let the **local cockpit be the first and primary read/write surface**, and let **gastown-pilot's WantedBoard/AgentTree eventually read the same Dolt data** through its existing `DoltSqlClient` adapter. Convergence happens at the **data layer**, not the UI layer.

Reasoning (not a hedge — a specific call with specific evidence):

1. **They are the same data, different stances.** §2.5 showed the cockpit's queue maps column-for-column onto gastown's `WantedBoard`; §3 produces the exact liveness signal gastown's `AgentTree` wants. The shared substance is the Dolt store. That is *already* the convergence point — both apps are clients of `127.0.0.1:3307`.
2. **Their product stances are genuinely different and both valid.** gastown-pilot is Frame/Carbon, Module-Federation, JWT-gated, observability-and-control for a *fleet*. The cockpit is personal, local, GroupThink-styled, single-operator, write-first. Forcing one UI to serve both stances would compromise both — the cockpit would inherit Carbon + MF + auth ceremony it doesn't want; gastown would inherit personal-workflow opinions that don't generalize.
3. **gastown-pilot's adapters are still stubbed (SCAFFOLD markers everywhere).** Merging into a half-built app imports its incompleteness. The cockpit can ship real write-paths *now* against Dolt, and gastown can wire its already-designed adapters to the same data *when it's ready* — each on its own clock.
4. **The risk of merging is the bigger risk.** Coupling a personal morning tool's release cadence to a Frame fleet dashboard's MF/Vercel/CI pipeline would make the cockpit slower and more fragile for no user benefit. The risk of *not* merging is duplicated read logic — which is cheap and well-contained if the write-paths and types live in `core` (shared) rather than in either app.

**Concrete convergence boundary:** put the queue/liveness/seed verbs and the reserved-label conventions in `core` (`bead-emit.mjs` + `types/bead.ts` doc-comments). Both apps depend on `core`. The cockpit owns the *personal* write UX; gastown owns the *fleet observability* read UX; neither owns the other.

**What would change this recommendation:** if the answer to §1 is "agent-autonomous fleet coordination," gastown-pilot's control surface (sling, nudge, merge-queue) becomes the natural home and the cockpit becomes a thin personal view — then merge *toward gastown*. So this recommendation is conditional on the cockpit staying a personal, human-pull tool. State that condition in the ADR.

---

## 6. Prioritized follow-up work items

Effort: S = <½ day, M = ~1–2 days, L = ~3–5 days. Each names the cockpit slice it unblocks.

| # | Title | Why | Effort | Unblocks |
|---|-------|-----|--------|----------|
| 1 | **`bead_events` writer** (add `emitEvent` helper; call from all mutating verbs, single transaction) | The table is empty; liveness is impossible without it. Foundational — everything in §3 depends on it. Lowest-risk, highest-leverage. | S | Cockpit "agents live/dark overnight" panel; all event-stream views |
| 2 | **`queue-post` + reserved-label doc** (`queue`, `kind` in `bead.ts`) | Creates the unassigned pool at all. Without it the queue is a concept, not data. | S | Cockpit "Unassigned / Wanted" lane (read) |
| 3 | **`queue-claim` (atomic CAS)** | Makes the pool actionable — the cockpit's first *write* affordance. | S | Cockpit "Claim" button → dispatch |
| 4 | **Liveness derivation query + cockpit binding** (group `bead_events` by actor; freshness windows) | Turns item 1's raw events into the trustworthy live/stale/dark signal that replaces lying `agent_status`. | M | Cockpit agent-liveness panel; "did it run overnight" |
| 5 | **`seed-create` verb** | Stops repo-less chat ideas from dying in history (gap 3). | S | Cockpit "Incubating ideas" lane |
| 6 | **`/bead --compact` → seed emission** (extend existing skill) | Reuses a loved path; makes capture near-free from chat. Depends on #5. | S | Same as #5, lighter UX |
| 7 | **`queue-sweep` + lazy staleness rendering** | Keeps the pool honest; expired ≠ hidden. Depends on #2/#3. | M | Cockpit stale-item styling; optional `/schedule` cron |
| 8 | **selfco vault tie-in** (seed → `~/selfco/Inbox/` stub; `refs: vault:…`) | Connects action-surface (cockpit) to knowledge-surface (vault) without merging them. Depends on #5. | S | Cross-surface idea traceability |
| 9 | **gastown `DoltSqlClient` reads the queue/liveness** (wire its stubs to the same Dolt data) | Realizes the §5 data-layer convergence; un-stubs WantedBoard/AgentTree against real data. Depends on #1–#4. | M | gastown WantedBoard + AgentTree (not a cockpit slice — fleet view) |
| 10 | **ADR-0002 acceptance after §1 is answered** | The human-pull vs agent-autonomous call gates the CAS strictness, staleness behavior, and the convergence direction. Don't accept the ADR until Yuri answers. | S | Locks the keystone decision |

**Suggested order:** 1 → 2 → 3 → 5 → 4 → 6/7/8 in parallel → 9 → (10 gates the whole thing and should be answered *first* even though it ships last).

---

## 7. Summary of the opinionated calls

1. **No new `BeadStatus`.** `status=created` + `hook=NULL` + `labels.queue='available'` *is* the unassigned queue. The label is the load-bearing part; status alone can't distinguish the pool from seed cruft.
2. **Claim = atomic conditional UPDATE guarded on `queue='available'`.** Reuses `hook` as the holder field. Correct even though the default (human-pull) model has no race.
3. **Liveness comes from `bead_events`, which is currently empty — so step one is writing to it at all.** Real work is its own heartbeat; don't trust `agent_status`.
4. **Pre-project ideas = `type=task` + `kind=seed` + `queue=incubating`, captured via a one-call `seed-create`**, optionally mirrored into the selfco vault. Promotable into the queue later.
5. **Don't merge the cockpit and gastown-pilot.** Converge at the Dolt data layer; let each own its UI stance. Re-evaluate only if the system becomes agent-autonomous.
6. **The keystone open question (settle before accepting ADR-0002): human-pull triage inbox vs. agent-autonomous pickup pool.** This document assumes human-pull.
