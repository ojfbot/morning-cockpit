# ADR-0010 — Cockpit triggers core queue-claim; claimed-state rendering

- **Status:** Accepted
- **Date:** 2026-06-25
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0001 (standalone read-only), ADR-0002 (coordination design / Track R), ADR-0005 (handoff is the only cockpit write), ADR-0009 (Available reads the real queue)
- **Depends on:** core S4a (`queue-claim`/`renew`/`sweep`, PR #171)

## Context

S3 made the cockpit *read* the real unassigned queue (`queue=available`). S4 is **claim** — taking
ownership of a queued item with a self-expiring lease. Claim is a Dolt **write** (an atomic CAS).
The cockpit has been read-only over Dolt by deliberate design; its single upstream write is a
*filesystem* handoff brief (ADR-0005), and CLAUDE.md says plainly: *"do not add any other write path
— writes belong in the bead system (core) or ADR-0002."* So "add a Claim button" forces a decision:
make the cockpit a Dolt mutator, or keep the write in core.

## Decision

1. **The CAS+lease write lives in core `bead-emit.mjs`** (`queue-claim`/`queue-renew`/`queue-sweep`,
   next to `queue-post`). The cockpit **shells out** to it (`execFile` — no shell, injection-safe —
   in `packages/server/src/queue-claim.ts`), forwarding `DOLT_PORT` so the verb writes the same Dolt
   the cockpit reads. **The cockpit never opens a Dolt write connection.** This honors CLAUDE.md and
   keeps the entire queue lifecycle in one place (core).
2. **`POST /api/claim`** is the per-action human gate (the button click), mirroring `/api/briefing/emit`.
   A *lost* claim (already claimed / expired / autonomy-ineligible) is a normal `409`, not a `500`.
3. **Read-side rendering:** the adapter surfaces the bead `hook` as `WorkItem.claimedBy` (+ `leaseUntil`,
   `claimedByKind`), previously discarded. A posted, unclaimed item shows a **Claim** button; a claimed
   item shows a "claimed by X · lease Nh" badge. On claim success the renderer refetches the snapshot.
4. **Auto-claim on emit:** Briefing "Approve & emit" also claims `artifact.closes` (define + delegate +
   take ownership in one gesture), best-effort — a lost claim doesn't undo the written brief.

## Consequences

- The cockpit gains a **second upstream write capability** — but as a *trigger*, not a Dolt mutator;
  the read-only-over-Dolt invariant holds (adapters remain `SELECT`-only). This ADR is the carve-out,
  the way ADR-0005 was for the handoff write.
- Identity is single-user/local (`COCKPIT_CLAIMER`, default `human:cockpit`); the cockpit always
  claims as a **human** (bypasses the autonomy gate). Multi-user identity is out of scope.
- **Agent-autonomous claim** — agents self-claiming — is a later slice with a Brassboard/shadow →
  operational RIDM gate. S4 is human claim only.
- A claim depends on `~/ojfbot/core/scripts/hooks/bead-emit.mjs` being present and the Dolt server
  reachable; failures surface as a claim error on the card, never a crash.
