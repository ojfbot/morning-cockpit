# ADR-0002: Unassigned task queue via label lane, not a new BeadStatus
slug: unassigned-queue-and-coordination
serial: 0002
domain: gas-town-governance
type: architecture

Date: 2026-06-07
Status: Accepted
Repos affected: core (bead-emit.mjs, types/bead.ts), morning-cockpit, gastown-pilot (consumer, later)

> **Keystone resolved (2026-06-07):** the operator chose **BOTH human-pull AND agent-autonomous**, and intends to **scale background-agent autonomy over time**. The design below is updated for the concurrent model: claims are leases (not permanent), each item carries an autonomy-eligibility, and autonomy graduates per item-class rather than via a global switch. See §Resolution.

---

## Context

The morning-cockpit read-only slice surfaced a gap it cannot solve: **there is no pool of unassigned, pickup-able work.** Verified against the live Dolt store (`127.0.0.1:3307`, `.beads-dolt`) on 2026-06-07:

- Every `task` bead is born already-assigned inside a convoy (via `task-create --convoy-id` → `convoy-add-slot`). There is no lane for "ready, unclaimed, anyone-can-take-this."
- The only 4 *live* `task` beads (`core-task-43fca84d/47f4e47a`, `shel-task-0f13799f/0fb1617f`) are April 11 seed data with `hook = NULL`. They are indistinguishable from "abandoned" because nothing marks them as *intentionally available*.
- There is no claiming mechanism, no staleness/expiry policy, and no mapping onto the `WantedBoard` panel that `gastown-pilot` already stubs (in `WastelandView.tsx`, rows of `{title, effort, status, poster}` with a **Claim** action on `status === 'open'`).

The shared work primitive is `FrameBead` (ADR-0016). `BeadStatus = created | live | closed | archived` is a union type referenced across `@core/workflows`, `bead-emit.mjs`, and every gastown adapter's status switch. ADR-0016 explicitly documents `created` as **"Filed, not yet picked up."**

The full design context — liveness, seed capture, and the gastown convergence call — lives in `research/coordination-design.md`. This ADR isolates the **keystone**: how an unclaimed pickup-able bead comes to exist and is claimed.

---

## Decision

**Represent an unassigned, pickup-able task using existing fields plus one reserved label. Do not add a `BeadStatus` value.**

An unassigned queue bead is:

```
type   = 'task'
status = 'created'                     # ADR-0016: "Filed, not yet picked up"
hook   = NULL                          # nobody holds it
labels = {
  queue:     'available',              # the lane marker — load-bearing
  repo:      '<repo|"">',              # "" = repo-less / pre-project
  effort:    's' | 'm' | 'l',          # → WantedBoard "effort"
  posted_by: '<actor>',                # → WantedBoard "poster"
  expires_at:'<iso>',                  # staleness horizon (post freshness)
  autonomy:  'human_only'              # who may claim — see below; default conservative
             | 'agent_eligible'        #   agents may self-claim
             | 'either'
}
```

**Autonomy is per-item, not global (this is how autonomy scales).** Default new posts to
`human_only`; graduating an item-class to `agent_eligible`/`either` is how the operator
"scales background-agent autonomy over time" without a system-wide flip. `queue-post` takes
an `--autonomy` flag; `queue-claim` enforces it (a worker may only claim `agent_eligible|either`).

`labels.queue` is reserved with values `available | claimed | expired | incubating` (the last for seed beads, see the design doc §4). `queue=available` is the positive marker that separates a *deliberately posted* item from default-`created` cruft.

**Claiming is one atomic conditional UPDATE (compare-and-swap on the lane), and grants a LEASE — not a permanent hold:**

```sql
UPDATE beads
   SET hook = :claimer_id,
       status = 'live',
       labels = JSON_SET(labels,
                  '$.queue','claimed',
                  '$.claimed_at',:now,
                  '$.claimed_by_kind',:human_or_agent,
                  '$.lease_until',:now_plus_lease),   -- self-expiring hold
       updated_at = :now
 WHERE id = :bead_id
   AND status = 'created'
   AND JSON_EXTRACT(labels,'$.queue') = 'available'
   AND JSON_EXTRACT(labels,'$.expires_at') > :now      -- can't claim a rotted post
   AND ( JSON_EXTRACT(labels,'$.autonomy') IN ('agent_eligible','either')   -- agent claimer
         OR :claimer_is_human = 1 );                                         -- human bypasses
```

`affectedRows = 0` ⇒ the claim was lost (already claimed, expired, or autonomy-ineligible); the caller re-queries. On a task bead, `hook` means **"the actor currently holding this task."**

**The lease is the dead-agent safety valve.** Because agent liveness is unreliable (all 11 agent beads read permanently `active`; `bead_events` is empty — see `research/coordination-design.md` and adr:0001), an agent that claims then dies must NOT lock the item forever. `queue-claim` sets `lease_until = now + LEASE_TTL`; `queue-sweep` returns any `queue=claimed` bead whose `lease_until < now` back to `queue=available` (clearing `hook`). A live agent renews its lease via a cheap `queue-renew` (a CAS bump of `lease_until`). Humans get a long/again-renewable lease; agents a short one (minutes), so a crashed worker frees work quickly.

**New additive verbs in `bead-emit.mjs`** (no existing verb changes): `queue-post`, `queue-claim`, `queue-renew` (lease bump), `queue-sweep` (expiry + dead-lease release) (+ read helper `queue-list`). They follow the file's existing pattern (parse args → INSERT/UPDATE → `DOLT_COMMIT` → print JSON).

**Staleness is timestamp-driven and lazy:** `expires_at = posted_at + TTL` (defaults: `s`=2d, `m`=5d, `l`=10d). Expired-but-available beads render as *stale* (not hidden); `queue-sweep` (run from `frame-standup` or a `/schedule` cron) flips them to `queue='expired'`. Expiry is reversible by re-posting.

**Reserved label keys (`queue`, plus `kind` and `effort` from the design doc) are documented in `types/bead.ts`** so they are convention, not folklore.

---

## Resolution (the keystone, answered 2026-06-07)

**The queue is BOTH human-pull and agent-autonomous**, and the operator will **scale agent
autonomy over time**. Consequences folded into the Decision above:

1. **Real contention ⇒ CAS is now required, not merely prudent.** A human (UI) and a worker
   (CLI/hook), or two workers, can race for the same item. The atomic CAS claim is the
   correctness mechanism, not an optimization.
2. **Claims are leases, with auto-release.** Permanent holds are unsafe under unreliable agent
   liveness — a crashed claimant would orphan work. `lease_until` + `queue-sweep` return dead
   claims to `available`. (This replaces the human-pull design's "merely render stale.")
3. **Autonomy is gated per item, and graduates.** Default `human_only`; scaling autonomy =
   moving more item-classes to `agent_eligible`/`either`. This keeps a human gate while
   letting it widen deliberately — not an all-or-nothing switch.
4. **Roll autonomy out shadow-first (control-gated).** Before workers self-claim-and-execute,
   run a **shadow stage**: agents *propose* claims (logged, not enforced) and the operator
   reviews; promote an item-class to live autonomous claiming only on observed-good data
   (a RIDM-style, data-gated decision per `[[feedback_control_gated_slices]]` / the
   `gated-slice` approach). Giving agents autonomy to take action is exactly the kind of
   automated control that should mature through observe-only before enforce.
5. **Convergence with gastown-pilot shifts toward the data layer.** Agent-autonomous pickup is
   gastown's domain (it is the agent-coordination surface). Recommendation: keep the cockpit's
   UI separate (personal, local, GroupThink-styled), but let gastown's `DoltSqlClient` read and
   claim the **same** queue/lease records — converge at Dolt, not in the UI. (Supersedes the
   human-pull-conditional stance in `research/coordination-design.md` §5.)

---

## Consequences

### Gains
- Zero breaking changes: `BeadStatus`, every status switch, and every existing emit verb are untouched. The queue is purely additive.
- The queue maps column-for-column onto gastown-pilot's existing `WantedBoard`, giving that stubbed panel a real data source without a UI rewrite.
- `hook` is reused for ownership exactly as ADR-0016 intends; no new ownership concept is invented.
- Claiming is race-safe by construction (CAS + lease), which is now load-bearing under the concurrent human+agent model.
- Autonomy scales safely: per-item eligibility + shadow-first rollout means widening agent autonomy is a series of small, reversible, data-gated steps — not a risky global switch.
- The cockpit gains its first *write* affordances (`queue-post`, `queue-claim`, `queue-renew`) with a handful of small verbs.

### Costs
- `labels.queue` is JSON, not an indexed column, so the lane filter is a JSON-extract on top of the `idx_beads_status` index. Free at current volume (single-digit live tasks); would need a generated column or dedicated index at thousands of open items — a volume the system is far from.
- `type=task` becomes more overloaded (distinguished by `queue` and, for seeds, `kind`). Mitigated by documenting reserved keys; revisit if a consumer must branch on the distinction at the *type* level.
- `hook` now carries mirrored meaning (on an agent bead: "what I'm working on"; on a task bead: "who holds me"). Pre-existing ambiguity in the schema, now made explicit by convention rather than removed.
- **Lease bookkeeping is new operational surface:** `queue-sweep` must run on a cadence (frame-standup and/or a `/schedule` cron) or dead-agent claims linger until the next sweep. Lease TTLs need tuning (too short → live agents lose work mid-task; too long → slow release). Agents must renew, which is new client behavior to implement when autonomy goes live.
- **Autonomy correctness depends on the claimer honestly declaring human-vs-agent.** A worker calling `queue-claim` with `--as-human` would bypass the eligibility gate. Acceptable in a single-operator trust domain; would need real identity if ever multi-tenant.

### Neutral
- The 4 April seed tasks are left as-is (not back-filled into the queue); they remain `created`/NULL-hook without `queue=available`, so the queue and the cruft stay distinguishable.

---

## Alternatives considered

| Alternative | Why rejected |
|-------------|--------------|
| Add `BeadStatus = 'available'` (or `ready`) | Breaking change to a union referenced across `@core/workflows`, `bead-emit.mjs`, and every gastown status switch. Status is the wrong axis: it encodes lifecycle (is work alive?), not ownership (does someone hold it?). |
| `status=created` + `hook=NULL` alone, no label | Indistinguishable from the existing April seed cruft and from any half-written bead (`created` is the schema default). Needs a *positive* "deliberately posted" marker. |
| A separate `queue` table | New schema, new migration, new adapter. The two-table `beads`/`bead_events` model is settled and sufficient; a third table buys nothing at this volume. |
| Born-in-a-convoy only (status quo) | This *is* the gap. Convoys are for already-assigned coordinated work; the queue is the front door *before* an owner exists. A claimed queue bead can promote into a convoy slot via `convoy-add-slot`. |
| Pessimistic locking on claim | Even under the now-real human+agent contention, an optimistic CAS + short lease handles it without holding DB row locks across an agent's work session (which could be minutes). CAS+lease is the right tool for claim races with long post-claim work; pessimistic locks are not. |
| Permanent claim (no lease) | Unsafe: an autonomous agent that crashes mid-task (and liveness is unreliable) would orphan the item forever. The lease is what makes agent-autonomy survivable. |
| Global autonomy switch (all-or-nothing) | Can't scale autonomy safely — flips every item at once with no gradual, reversible, observable rollout. Per-item eligibility + shadow-first is the controlled path. |

---

## References

- `research/coordination-design.md` — full design (queue, liveness, seed capture, gastown convergence, prioritized backlog)
- adr:0001 (morning-cockpit) — standalone read-model; §Decision.4 defers the real unassigned-bead write-path to "ADR-0002 (Track R)" — this is that ADR
- file:morning-cockpit/packages/shared/src/lanes.ts — the read-model `available` lane this write-path produces beads for
- adr:0016 — FrameBead work primitive (`status` lifecycle, `hook` semantics)
- adr:0015 — Gas Town / Paperclip / Wasteland adoption (WantedBoard origin)
- file:core/scripts/hooks/bead-emit.mjs — emit CLI to extend
- file:core/packages/workflows/src/types/bead.ts — reserved-label documentation target
- file:gastown-pilot/packages/browser-app/src/components/panels/WastelandView.tsx — WantedBoard row contract
