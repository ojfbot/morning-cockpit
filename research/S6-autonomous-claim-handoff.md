# Handoff — S6: Autonomous claim/dispatch (the shadow-gated control)

**For:** a fresh agent session that will **spec then deliver S6** of the coordination rollout.
**You do not have this session's context — this doc is self-contained.** Read it fully first.

> **Naming:** per `research/coordination-rollout-gated-slices.md`, the autonomous-claim slice is **S6**.
> **S5** (un-stub Briefing verbs: `bead-snooze`/`-archive`/`repo-scaffold`) is a *separate, independent,
> human-gated* slice — NOT this one, and not a prerequisite. This handoff is **S6 only**: agents
> self-claiming work from the unassigned queue. It is the one slice the whole control-gated rollout
> was built to do carefully.

---

## 1. What the coordination rollout is

Morning Cockpit (`~/ojfbot/morning-cockpit`) is a standalone, local-first read-model dashboard over the
ojfbot **bead store** (Dolt, db `.beads-dolt`, sql-server on `:3307`). The "coordination rollout" turns it
into a real work-coordination layer in **control-gated vertical slices** (NASA-SEH discipline; see
`/gated-slice` skill + ADR-0086 in core). Shipped so far:

| Slice | What | PRs (merged) |
|---|---|---|
| **S1** Event spine | `emitEvent` → every mutating verb writes a `bead_events` row in the SAME `DOLT_COMMIT` as the bead | core #167 |
| **S2** Liveness | `agent-*` events carry `actor=<agent-id>` (#168); cockpit derives agent live/idle/dark from `bead_events` (#9) | core #168, cockpit #9 |
| **S3** Unassigned queue | `queue-post` populates a real pool (`labels.queue=available`); cockpit reads it, badges posted-vs-synthesized | core #169, cockpit #10 |
| **S4** Human claim | `queue-claim`/`renew`/`sweep` (CAS + lease lifecycle, #171); cockpit Claim button shells out to it (#11) | core #171, cockpit #11 |

**S6 is next.** Governing design: **core ADR-0002** (`decisions/adr/0002-unassigned-queue-and-coordination.md`)
— the queue/lease/autonomy model. Slice plan + gates: **`research/coordination-rollout-gated-slices.md`**.

## 2. What S6 is

Let **agents autonomously claim** eligible work from the same queue humans pull from — the same
`queue-claim` CAS, but initiated by an agent worker instead of a human button. This is an
**action-taking control** (an agent decides to take work without a human in the loop), so it is the
one slice that MUST mature through an **observe-only shadow stage** before it ever enforces.

**Crucial — most of the mechanism already exists:**
- `queue-claim` (core, S4) **already** takes `--agent` and **already** enforces the autonomy gate:
  an agent may only claim `labels.autonomy ∈ {agent_eligible, either}`; humans bypass. Agents get a
  short lease (5min); `queue-sweep` already reclaims dead leases.
- So S6 is **not** "write the claim" — it's: **(a)** a shadow claimer that logs "would-claim X" and
  emits TPMs but **claims nothing**, **(b)** the per-item-class **RIDM promotion** (flip a starter
  class to `agent_eligible`) gated on those TPMs, **(c)** surfacing shadow activity in the cockpit.

## 3. The gates (from the rollout doc — do not re-derive, honor these)

| Gate | Entrance | Success (MOE→MOP→TPM) | V&V |
|---|---|---|---|
| **C0 policy** | S4 operational; per-item `labels.autonomy` exists | eligibility policy + **safest starter item-class** chosen (one-shot) | Verif |
| **C1 Brassboard/shadow** | C0 | claimer runs **observe-only**: logs "would-claim X" + emits TPMs, **claims NOTHING** | Valid |
| **C2 sweep** | C1 | simulated dead-lease recovery via `queue-sweep` — **pass = 100%** | Verif |
| **C3 Operational (RIDM)** | C1+C2 TPMs cleared over a window | flip `agent_eligible` for the **starter class only** | Valid |

**Shadow TPMs (vs baseline = no autonomy):**
- **M-falseclaim** = human-judged-wrong would-claims / total — **pass < 5%**
- **M-override** = would-claims a human would have overridden / total — **pass < 20%** (≥20% = policy overfit → stay shadow, narrow the class)
- **M-lease** = simulated dead-lease recovery via `queue-sweep` — **pass = 100%**

**RIDM promotion (C1 shadow → C3 operational):** flip to `agent_eligible` for the starter class **only
when M-falseclaim < 5% AND M-override < 20% AND M-lease = 100%**, sustained over ≥ N would-claims. On
any breach → **stay shadow / narrow the class, never enforce**. Autonomy scales by **graduating one
item-class at a time** (ADR-0002), never a global switch.

## 4. The hard rule (this is the whole point of the slice)

**The autonomous claimer gets a shadow stage. No straight-to-enforce.** It runs observe-only —
emitting M-falseclaim / M-override / M-lease — and is promoted to actually claiming **only on the
TPM data (RIDM), per item-class**. This is the anti-pattern the control-gated approach exists to
prevent. Treat "shadow mode" and "vertical slice" as harness extensions (flag them; closest NASA-SEH
terms are Brassboard+TRL and life-cycle phase/WBS).

## 5. Open design forks you'll need to resolve (grill the user — don't guess)

1. **Where does the shadow claimer run?** A core verb (`queue-claim-shadow`?) invoked on a schedule
   (cron / `frame-standup`)? A standalone loop? It must read the queue, decide what it *would* claim
   per the eligibility policy, and log + emit TPMs — without issuing the CAS.
2. **How are M-falseclaim / M-override captured?** They need *human judgment* of would-claims. How is
   that surfaced and recorded — a cockpit "shadow" panel where the human marks would-claims
   right/wrong/would-override? A `.handoff` review? This is the load-bearing fork.
3. **Starter item-class** (C0): the safest, narrowest class to graduate first (e.g. a specific
   `kind`/repo/label). What is it?
4. **Cockpit surfacing:** does the cockpit show "shadow would-claims" (read-only) so the human can
   judge them, reusing the S2 liveness + S3 posted/claimed rendering? (Cockpit stays read-only over
   Dolt — see conventions.)

## 6. Conventions & invariants you MUST honor (learned the hard way this rollout)

- **Tests run against an ISOLATED throwaway Dolt server — NEVER the shared `:3307` store.** Pattern:
  `dolt init` a scratch `.beads-dolt` in a temp dir, apply `core/packages/workflows/src/bead-store/dolt-schema.sql`,
  `dolt sql-server --port <scratch> --data-dir .`, run tests with `DOLT_TEST=1 DOLT_PORT=<scratch>`.
  Tear it down after. (The auto-mode classifier will — correctly — block destructive ops on the shared store.)
- **core is REBASE-ONLY merge** (a ruleset blocks squash/merge-commit even though the repo flags read
  true). Rebase-merge core PRs; if GitHub's server-side rebase refuses (branch behind), rebase locally
  + force-push, then merge. cockpit allows any method.
- **core's main checkout (`~/ojfbot/core`) is usually on another agent's dirty branch.** Do NOT branch
  off it or disturb it. Work in an **isolated `git worktree` off `origin/main`**
  (`git worktree add -b <branch> /tmp/... origin/main`; symlink `node_modules` from the main checkout).
  `git fetch origin main` first — the local `origin/main` ref can be stale.
- **The cockpit is READ-ONLY over Dolt.** Its only direct write is the ADR-0005 filesystem handoff. A
  claim is a Dolt write, so it **shells out to core `bead-emit.mjs`** (ADR-0010, `packages/server/src/queue-claim.ts`
  — `execFile`, injection-safe, forwards `DOLT_PORT`). **Do not add a direct Dolt write from the cockpit.**
  Writes belong in core's `bead-emit.mjs`.
- **Per slice: two stacked PRs** — core first (rebase-merged), then cockpit off fresh `main`.
- **S1 invariant:** any new mutating verb calls `emitEvent(...)` immediately BEFORE its single
  `doltCommit()` (one commit holds bead + event). `agent-*` events set `actor=<agent-id>` (S2a).
- **Process:** this rollout is `/gated-slice` (gates already exist for S6 — see §3) → `/plan-feature`
  (spec + surface assumptions, WAIT for confirmation) → `/tdd` (red→green). Use them.
- **E2E across repos:** to test the cockpit against a queue-claim-capable core, point `COCKPIT_REPO_ROOT`
  at a temp dir whose `core/` symlinks a core worktree on `origin/main` (with `node_modules` symlinked),
  and `COCKPIT_DOLT_PORT` at the scratch Dolt. (This is how S4b was verified.)

## 7. Key files

**core** (`~/ojfbot/core`):
- `scripts/hooks/bead-emit.mjs` — all queue verbs: `queue-post`/`queue-claim`/`queue-renew`/`queue-sweep`
  (+ the CAS, the `QUEUE_LEASE_MS`, `QUEUE_AUTONOMY`, `RESERVED_QUEUE_LABELS` block). The shadow claimer
  likely lands here.
- `scripts/hooks/__tests__/bead-emit.test.mjs` — the isolated-Dolt test suite (40 tests; extend it).
- `packages/workflows/src/bead-store/dolt-schema.sql` — schema + the label contract comment.
- `.claude/skills/frame-standup/SKILL.md` — Step 7b posts unassigned work + runs `queue-sweep`; a
  scheduled shadow-claim run could hang here too.

**cockpit** (`~/ojfbot/morning-cockpit`):
- `packages/server/src/adapters/dolt.ts` — read-only Dolt adapter; surfaces `posted`/`claimedBy`/
  `leaseUntil`/liveness. Where shadow would-claims would be read.
- `packages/server/src/queue-claim.ts` + `routes/claim.ts` — the shell-out write + `POST /api/claim`.
- `packages/shared/src/work-item.ts` — `WorkItem` (`posted`, `claimedBy`, `claimedByKind`, `leaseUntil`).
- `packages/renderer/src/components/WorkItemCard.tsx` — Claim button + claimed badge (the place to add
  shadow-would-claim rendering / human judgment affordance).

## 8. Reference docs

- `research/coordination-rollout-gated-slices.md` — the slice ladder + all gates (S6 = §"Slice S6").
- core `decisions/adr/0002-unassigned-queue-and-coordination.md` — queue/lease/**autonomy + shadow-first** model.
- cockpit ADRs: `0009` (real queue → Available), `0010` (cockpit shells out, not a Dolt writer), `0005` (only-write carve-out), `0001` (read-only standalone).
- Prior slice PRs for the established patterns: core #167/#168/#169/#171, cockpit #9/#10/#11.

## 9. Verification shape for S6

- **Shadow (C1):** a test proving the shadow claimer, given an `agent_eligible` available bead, **logs a
  would-claim + emits the TPMs but leaves the bead `available` (claims NOTHING)** — assert `hook` stays NULL.
- **Sweep (C2):** simulated dead-lease → `queue-sweep` recovers 100% (already covered by S4 tests; extend
  for the shadow scenario).
- **Operational (C3):** only after the human flips the starter class to `agent_eligible` does a real
  `queue-claim --agent` succeed — and only for that class (a `human_only` bead still refuses an agent).
- All against isolated Dolt; existing 40 core / 73+13 cockpit tests stay green.

## 10. First moves

1. `git fetch` both repos; confirm S1–S4 are on `main` (core has `queue-claim`/`renew`/`sweep`; cockpit
   has the Claim button + ADR-0010).
2. Run **`/plan-feature`** on S6 (the gates in §3 are already set by `/gated-slice` — you're speccing the
   slice, not re-decomposing). Surface assumptions on the §5 forks and WAIT for the user.
3. Then `/tdd` — shadow claimer + TPM emission first (red→green), per the two-stacked-PR shape.
