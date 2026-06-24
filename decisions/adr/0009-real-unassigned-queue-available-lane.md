# ADR-0009 — Available lane reads the real unassigned queue; posted vs synthesized

- **Status:** Accepted
- **Date:** 2026-06-23
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0001 (standalone read-only), ADR-0002 (coordination design / Track R), ADR-0005 (handoff is the only cockpit write)
- **Depends on:** core S3a (`queue-post` verb + reserved-label contract, PR #169)

## Context

The cockpit's **Available** lane has been *synthesized* — open GitHub issues + open `.handoff`
briefs + any unhooked task routed there by `classifyLane`. There was no real unassigned-task pool:
tasks are born already-assigned in a convoy. The honest-gaps doc said so plainly.

ADR-0002 defines the real pool: a task bead `status=created, hook=NULL, labels.queue=available`
(+ `kind`/`autonomy`/`expires_at`). Core **S3a** stands up `queue-post`, which writes exactly that.
S3b is the read side: the cockpit must surface those real posts **without** hiding the synthesized
signal during the transition, and **without** taking a write or a claim.

## Decision

1. **Flag real posts, don't replace.** The Dolt adapter sets `WorkItem.posted = (labels.queue ===
   'available')`. Available shows both: posted items render with a **POSTED** badge (signal red),
   synthesized items (issues/briefs/unhooked tasks) keep a muted dashed **synth** label. Nothing
   disappears; provenance is legible per the C2 gate.
2. **Read-only — no cockpit write, no claim.** `queue-post` is core CLI/skill-invoked
   (frame-standup auto-posts non-dispatched priorities, `human_only` only). The cockpit never
   writes the queue (ADR-0005 keeps handoff emission the sole write). **Claiming is S4.**
3. **Mirror the label contract, don't import it.** The reserved labels are documented in
   `dolt-bead.ts` mirroring core's `dolt-schema.sql` + `RESERVED_QUEUE_LABELS` (ADR-0001 no-import
   stance).

## Consequences

- The Available lane is now **honest**: a posted item is provably a deliberate post; a synthesized
  one is labelled as such. The "no real unassigned pool" honest-gap is retired for posted work.
- Posted tasks expire (`expires_at`); rendering them stale (and `queue-sweep`) is S4+.
- This is read-derivation — **no action-taking control, no shadow stage** (Verification + Validation).
- Until something actually `queue-post`s, Available shows only synthesized items (all `synth`) —
  correct, not a regression.
