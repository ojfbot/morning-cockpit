# Spec — S1 Event spine: `emitEvent` / `bead_events` writer

Feature spec for Slice S1 of the coordination rollout (`coordination-rollout-gated-slices.md`).
Implements core `.handoff/` brief `20260622-2158-brief-stand-up-bead-events-writer`. Plan only — no
implementation code. Execute via `/tdd`.

## Problem statement

`bead_events` exists and is indexed (`packages/workflows/src/bead-store/dolt-schema.sql:25`) but has
**0 rows — never written**. The live hooks (`scripts/hooks/bead-emit.mjs`) INSERT/UPDATE the `beads`
table then `doltCommit()` (`CALL DOLT_ADD('-A')` + `CALL DOLT_COMMIT`), and never touch `bead_events`.
The only `insertEvent` is in the **unused** `DoltBeadStore.ts` engine, which the hooks bypass (raw
`mysql2`). Consequence: agent liveness, "did it run overnight", and the whole coordination layer are
unanswerable. This slice is **measure-first instrumentation** — append-only event log, not an
enforcement control, so **no shadow stage**; it is Verification-gated (meets spec). It must add events
**without** changing the one-commit-per-verb shape: the event is written into the working set before
the existing `DOLT_COMMIT`, so bead + event land in the **same** Dolt commit (no second commit).

Assumptions made explicit: (1) "same transaction" = same **Dolt commit** (one `DOLT_COMMIT` snapshots
both statements), not necessarily one SQL transaction — though wrapping the two writes in
`START TRANSACTION`/`COMMIT` is the open question in §6. (2) The cockpit masthead's "overnight events"
count is the first consumer; no new consumer endpoints are in scope. (3) No new `BeadStatus`.

## Proposed solution

**Package/files:** `core/scripts/hooks/bead-emit.mjs` (the running hook — raw `mysql2`, the thing that
actually executes), tests in `scripts/hooks/__tests__/bead-emit.test.mjs`. The TypeScript
`DoltBeadStore.ts` engine is **out of scope** (unused by hooks) — its `insertEvent` is the shape
reference only.

**New helper (signature, no body):**
```
async function emitEvent(pool, { eventType, beadId, actor, summary, payload })
//   → INSERT INTO bead_events (event_type, bead_id, actor, summary, timestamp, payload)
//     VALUES (?, ?, ?, ?, ?, ?)   — timestamp = new Date().toISOString(), payload = JSON.stringify(payload ?? {})
//   NO commit inside; the caller's existing doltCommit() snapshots it.
```

**Call-site shape (the invariant) — per verb:**
```
1. INSERT/UPDATE beads …        (existing)
2. await emitEvent(pool, {…})   (NEW — before the commit)
3. await doltCommit(pool, msg)  (existing, UNCHANGED — single DOLT_COMMIT covers both)
```

**Event-type map (one per mutating verb; `bead:`-prefixed, matching `DoltBeadStore` convention):**

| Verb | event_type | bead_id | summary |
|------|-----------|---------|---------|
| session-start | `session:start` | session id | "session started: \<skill\>" |
| session-update | `session:update` | session id | merged repos/pr-count/skill |
| session-close | `session:close` | session id | "session closed" |
| task-create | `task:create` | task id | title |
| task-done | `task:done` | task id | title |
| pr-created | `pr:created` | pr id | + `session:pr-count` event on the session bump |
| convoy-create | `convoy:create` | convoy id | — |
| convoy-add-slot | `convoy:add-slot` | slot bead id | `→ convoyId` |
| convoy-update-slot | `convoy:slot-update` | slot bead id | `→ status` |
| convoy-finalize | `convoy:finalize` | convoy id | `→ finalStatus` |
| agent-create / resume | `agent:create` / `agent:resume` | agent id | role |
| agent-idle | `agent:idle` | agent id | — |
| agent-sling | `agent:sling` | agent id | `→ beadId` |
| (S3/S4) queue-post / queue-claim | `queue:post` / `queue:claim` | task id | designed to call `emitEvent` when they land |

The `actor` comes from the bead's actor (`claude-code`, the agent id, etc.). Read-only verbs
(`convoy-status`, `active-sessions`) emit nothing.

**Cockpit consumer (read side):** `morning-cockpit/packages/server/src/adapters/dolt.ts` already
counts `eventRows` from `bead_events WHERE timestamp >= since` for the health note "K overnight
events"; once rows exist this becomes real with no cockpit change. Retire/clearly-demote the
`created/closed_at` fallback branch for overnight placement once events are flowing (C3).

## Acceptance criteria

1. `emitEvent(pool, {...})` exists in `bead-emit.mjs`; a unit test asserts it INSERTs exactly one
   `bead_events` row with the passed fields and an ISO timestamp.
2. **C1 (coverage = 6/6):** each verb **class** — session, task, pr, convoy, agent, queue — emits ≥1
   event. A test drives one verb per class and asserts a matching `bead_events` row per bead mutation.
   (queue verbs: assert the call-site is wired even though the verb body lands in S3/S4 — i.e. a
   failing/pending test marks the contract.)
3. **C2 (transaction integrity = 100%):** for a scripted sequence of N mutating verbs,
   `COUNT(bead_events created in window) == COUNT(bead mutations)`, and there is **exactly one**
   `DOLT_COMMIT` per verb (no second commit). A test asserts the Dolt commit count does not increase
   relative to the pre-change baseline for the same verb sequence.
4. **C3 (0→non-zero + real consumer):** `SELECT count(*) FROM bead_events` is 0 before and > 0 after a
   verb run; the cockpit masthead "overnight events" renders the real count (manual/integration
   check), and the `created/closed_at` overnight fallback is removed or explicitly marked as
   secondary.
5. Existing `bead-emit.test.mjs` tests stay green; `pnpm --filter` lint/typecheck/test pass.
6. No new `BeadStatus`; event shape matches `dolt-schema.sql` (`event_type, bead_id, actor, summary,
   timestamp, payload`).

## Test matrix

| Scenario | Input/state | Expected | Type |
|----------|-------------|----------|------|
| emitEvent inserts | call with full payload | 1 row, fields + ISO ts + JSON payload | unit |
| emitEvent null payload | `payload` omitted | row with `payload = {}` (or NULL per schema choice) | unit |
| session-start emits | run `session-start` | `bead_events` has `session:start` for the new id | unit |
| task-done emits | run `task-done` | `task:done` row + the bead row, same commit | unit |
| convoy-add-slot emits | add a slot | `convoy:add-slot` row | unit |
| agent-sling emits | sling a hook | `agent:sling` row | unit |
| **single commit** | one verb | Dolt commit count +1 only (not +2) | integration |
| **count parity** | sequence of 5 verbs | 5 bead mutations ⇒ ≥5 events, commit count +5 | integration |
| crash between bead + event | simulate throw after bead INSERT, before emitEvent | bead + event either both present in the commit or neither (see §6) | integration |
| read-only verb | `convoy-status` | no new `bead_events` row, no commit | unit |
| cockpit overnight count | events in last window | masthead shows real K, not fallback | integration (cockpit) |

## Open questions

1. **Dolt commit vs MySQL autocommit (the core one).** `mysql2` autocommits each `pool.execute`, but
   only `DOLT_COMMIT` creates a *versioned* commit — so an event INSERT before `doltCommit` is in the
   same Dolt commit. **But** if the process crashes *between* the bead write and `emitEvent` (both
   autocommitted to the working set, no Dolt commit yet), the next `DOLT_COMMIT` from a later verb
   could snapshot a bead with no event. Do we wrap steps 1–2 in `START TRANSACTION … COMMIT` (so the
   pair is atomic at the SQL level before `DOLT_ADD`), or accept best-effort given `connectionLimit:1`
   and the short-lived hook? Recommendation: wrap the bead+event pair in a SQL transaction; cheap,
   removes the only correctness gap. **Decide before C2.**
2. **`pr-created` double event?** It mutates two beads (the PR + the session `pr_count`). Emit two
   events (`pr:created` + `session:pr-count`) or one? Recommendation: two — count parity then means
   events ≥ mutations, and liveness wants the session bump.
3. **Payload contents.** Minimum `{}` vs. capturing the verb args (repos, slot status, etc.). Richer
   payload helps later liveness/queue queries but widens the surface. Recommendation: small, typed
   per verb (e.g. convoy slot status), not the whole args bag.
4. **Backfill?** Leave the historical 0-rows gap as-is (events start now) — yes; backfilling synthetic
   events from `created/updated/closed_at` would fabricate a timeline. Confirm.

## ADR stub

Likely **not** its own ADR — this implements the already-accepted ADR-0002 (coordination) + the
`gated-slice` rollout plan; it's the §6 #1 work item, not a new architectural choice. **Exception:** if
§6-Q1 lands on "wrap each verb's bead+event in an explicit SQL transaction," that changes the hook's
transaction model fleet-wide and is worth a one-paragraph ADR ("bead mutations and their events are
written atomically per verb"). Decide during `/tdd`; if yes: `/adr new "Atomic bead+event writes in bead-emit"`.

**Next:** `/tdd` on `bead-emit.mjs` — write the C2 single-commit/parity test first (it's the load-bearing
invariant and the easiest to get subtly wrong), watch it fail, then add `emitEvent` + the call sites.
