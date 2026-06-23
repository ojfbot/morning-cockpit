# Coordination-layer rollout — Control-Gated Slices (ADR-0086)

Plan for the "full thin-layer over real contract" depth deferred from the cockpit redesign v1
(`decisions/adr/0007`). Source of truth: `research/coordination-design.md §6` + core ADR-0002.
Plan only — slices execute via `/plan-feature` → `/tdd`.

**Restatement:** Stand up the empty `bead_events` log, derive real liveness from it, build the real
unassigned queue with leased atomic claims, un-stub the Briefing's non-handoff verbs, and graduate
agent-autonomous claim/dispatch from shadow to operational per item-class.

**Warrants Control-Gated Slices: yes** — far too big for one PR, spans two repos (core write +
cockpit read), AND introduces an action-taking control (autonomous claim mutates bead state). The
shadow-stage discipline is the load-bearing reason.

> Harness extensions flagged throughout: **vertical slice** (≈ SEH life-cycle phase / WBS) and
> **shadow mode** (≈ Brassboard + TRL). Neither is canonical NASA SEH.

## Slices (vertical, ordered value-first / measure-first)

| # | Slice | Layers traversed | Observable value shipped |
|---|-------|------------------|--------------------------|
| S1 | **Event spine** — `emitEvent` + `bead_events` | core verb → Dolt table → cockpit count | the log goes 0→N rows; masthead "overnight events" becomes real |
| S2 | **Liveness derivation** | core query → cockpit Fleet + masthead | Fleet liveness/overnight stop being last-activity fallback (caveat removed) |
| S3 | **Unassigned queue (read-only)** — `queue-post`/`queue-list` | core verb → `labels.queue` → cockpit Available lane | Available shows a REAL unassigned pool, not synthesized |
| S4 | **Human claim** — `queue-claim` (CAS lease, `autonomy=human_only`) | core atomic verb → cockpit Claim button → dispatch | cockpit's first non-handoff write: a human Claims → dispatched |
| S5 | **Un-stub Briefing verbs** — `bead-snooze`/`bead-archive`/`repo-scaffold` | core verbs → cockpit `emitIntent` | defer/archive/scaffold branches go live (4/4 branch types real) |
| S6 | **Autonomous claim/dispatch** (the control) | core autonomy-graduated CAS + claimer agent → shadow → operational | agents auto-claim eligible classes — gated through Brassboard |

S7 (follow-on, out of this plan's depth): gastown reads the shared queue + liveness at the Dolt layer.

Measure-first is **forced**: S1 instruments; nothing downstream can gate on TPMs that don't exist yet.

## Slice S1: Event spine — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 spec | ADR-0002 accepted; `bead_events` schema exists (it does, 0 rows) | one-shot: event row shape + which verbs emit, recorded | Verif |
| C1 writer | C0 | MOE: fleet activity is recorded → MOP: mutating verbs that emit → **TPM: event-coverage = emitting verbs / mutating verbs vs baseline 0/6; pass = 6/6** (session, task, pr, convoy, agent, queue) | Verif |
| C2 atomicity | C1 | MOE: an event never desyncs from its bead → MOP: bead-writes with a matching same-commit event → **TPM: transaction integrity vs baseline n/a; pass = 100%, no second DOLT_COMMIT** | Verif |
| C3 cockpit read | C2 | MOE: the log is visible → MOP: masthead "overnight events" sourced from `bead_events` → **TPM: real-event count > 0 after a verb run; pass = non-zero, replaces the `created/closed_at` fallback** | Valid |

No action-taking control here — `emitEvent` is append-only instrumentation. No shadow stage needed.

## Slice S2: Liveness derivation — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 query | S1 C3 (events flowing) | one-shot: `GROUP BY actor, MAX(timestamp)` + freshness windows defined | Verif |
| C1 binding | C0 | MOE: liveness reflects reality not lying `agent_status` → MOP: classification agreement on a labelled spot-check set → **TPM: correct live/idle calls vs `agent_status` baseline (~0% useful); pass = a known-idle agent classified not-live** | Valid |
| C2 cockpit | C1 | MOE: Fleet stops lying → MOP: Fleet cards on derived liveness → **TPM: cards using derived signal / total; pass = 100%, "last-activity fallback" caption removed** | Valid |

## Slice S3: Unassigned queue (read-only) — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 labels | ADR-0002 reserved labels (`queue`,`kind`,`autonomy`,`expires_at`) documented in `bead.ts` | one-shot: label contract recorded | Verif |
| C1 `queue-post` | C0; S1 (post emits an event) | MOE: real unassigned pool exists → MOP: posted beads queryable → **TPM: a posted `queue=available` bead appears in cockpit Available within one poll; pass = yes** | Verif |
| C2 honesty | C1 | MOE: Available stops being synthesized → MOP: real-queue items / Available items → **TPM: real-backed fraction vs baseline 0%; pass = posted items render as real, synthesized ones clearly separated/labelled** | Valid |

## Slice S4: Human claim — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 CAS verb | S3; lease model (`lease_until`) speced | one-shot: atomic `UPDATE … WHERE status='created' AND queue='available'` recorded | Verif |
| C1 atomicity | C0 | MOE: a claim is exclusive → MOP: double-claims under concurrent attempts → **TPM: double-claim rate vs baseline; pass = 0 in a N-way concurrency test** | Verif |
| C2 dispatch | C1 | MOE: a human can pull work → MOP: Claim→dispatch success + latency → **TPM: claim success rate; pass = ≥99%, dispatch observable** | Valid |

**S4's write is human-gated per-click** (the Claim button is the ADR-0005-analog per-action human gate),
so it is NOT an autonomous control — no shadow stage; correctness is Verification (C1 CAS race test).

## Slice S5: Un-stub Briefing verbs — Control Gates
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 verbs | S1 (each verb emits an event) | MOE: every Briefing branch resolves to a real action → MOP: branch-types wired to a live verb → **TPM: live-verb branch types / total vs baseline 1/4 (handoff only); pass = 4/4** (snooze, archive, scaffold) | Verif |
| C1 reversibility | C0 | MOE: defer/archive are safe → MOP: round-trip → **TPM: snoozed bead resurfaces on schedule + archived bead recoverable; pass = both** | Valid |

`bead-snooze`/`-archive` mutate lane/labels (human-gated via the existing Approve click); `repo-scaffold`
creates a repo + seed bead — human-gated, never autonomous. No shadow stage (all human-initiated).

## Slice S6: Autonomous claim/dispatch — Control Gates  ← the action-taking control
| Gate | Entrance Criteria | Success Criteria (MOE → MOP → TPM, threshold) | V&V |
|------|-------------------|-----------------------------------------------|-----|
| C0 policy | S4 operational; per-item `labels.autonomy` (`human_only`/`agent_eligible`/`either`) | one-shot: eligibility policy + safest starter item-class chosen | Verif |
| C1 **Brassboard / shadow** | C0 | claimer runs **observe-only**: logs "would-claim X" + emits TPMs, **claims NOTHING**. MOE: agents claim only what they should → MOPs below | Valid |
| C2 sweep | C1 | MOE: dead claims self-heal → MOP: expired-lease recovery → **TPM: `queue-sweep` would-return rate; pass = 100% of simulated dead leases recovered** | Verif |
| C3 **Operational** (RIDM) | C1+C2 TPMs cleared over the window | MOE: autonomous pull is trustworthy → flip `agent_eligible` for the starter class only | Valid |

**Enforcement control: agent-autonomous claim/dispatch — requires Brassboard/shadow stage at C1**
(observe-only; emits the TPMs below; takes NO real claim).

Shadow TPMs (vs baseline = no autonomy):
- **M-falseclaim**: human-judged-wrong would-claims / total would-claims — **pass < 5%**.
- **M-override**: would-claims a human would have overridden / total — **pass < 20%** (≥20% = policy overfit; stay shadow, narrow the class).
- **M-lease**: simulated dead-lease recovery via `queue-sweep` — **pass = 100%**.

**RIDM promotion (C1 shadow → C3 operational):** flip to `agent_eligible` for the starter item-class
**only when M-falseclaim < 5% AND M-override < 20% AND M-lease = 100%** sustained over ≥ N would-claims.
On any breach → **stay in shadow / narrow the eligible class**, never enforce. Autonomy scales by
**graduating item-classes** (one safe class at a time), per ADR-0002 — never a global switch.

## Cross-slice notes
- **Write boundary:** S1–S2 (events/liveness) and S3 read are low-risk. The real upstream-write
  blast radius is S4 (human, per-click gate) and S6 (autonomous, shadow-gated). Everything routes
  through core's `bead-emit.mjs` + the cockpit's existing `emitIntent` seam.
- **Convergence:** S7 (gastown reads the shared queue/liveness at the Dolt layer) lands after S2+S4.

**Next:** hand **S1 (Event spine)** to `/plan-feature` → `/tdd`. Revisit S6's gates as shadow TPM
data arrives. S1 is queued as a core `.handoff/` brief (see launch below).
