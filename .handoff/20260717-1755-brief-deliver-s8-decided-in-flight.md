---
id: 20260717-1755-brief-deliver-s8-decided-in-flight
type: brief
title: "Deliver rm:rm-l1-morning-cockpit#S8 — derive decided-in-flight from closes: refs"
actor: code-claude
to: code-claude
session_id: d92e3b15-2271-45da-88c6-80d4250d2e25
status: live
created_at: 2026-07-17T22:55:00Z
refs:
  - rm:rm-l1-morning-cockpit#S8
  - closes:20260717-1717-brief-pick-up-evolve-morning-cockpit-s-northstar-from
labels:
  project: morning-cockpit
  emitted_by: code-claude
---

## Context

Operator-verified 2026-07-17: Approve & emit (ADR-0005) writes a successor brief carrying
`refs: [closes:<old-id>]`, but nothing on the read side consumes it — Pickup counted both
beads (16→17), the Briefing re-seeded the identical DECISION NEEDED thread, the item
rendered 8×. The slice block in `.claude/roadmap.md` (S8, PH2, ready) is the spec of
record; design settled: **derivation, never bead mutation** (single write path stands).

## Goal

Implement S8: closes-ref index in `packages/server/src/adapters/handoff.ts`; pure
`decided-in-flight` derivation + tests in `packages/shared`; decided beads leave the
Briefing decision pool and render chained with their successor as ONE Pickup item;
behavior reverts when the successor closes.

## Acceptance criteria

- [ ] Real fixture pair (20260628-2015 / 20260717-1717 beads) drives the tests; dangling
      `closes:` and closed-successor cases covered
- [ ] Browser-verified: decided item leaves DECISION NEEDED; Pickup count drops by 1;
      one chained item renders
- [ ] PR body carries `Movement proposal: ns:l1-morning-cockpit#P2 50% -> 56% — evidence: ...`;
      movement recorded only at merge via core `record-movement.mjs --ref rm:rm-l1-morning-cockpit#S8`

## References

- rm:rm-l1-morning-cockpit#S8 (spec of record)
- CLAUDE.md § Honest gaps (decision→delivery seam entry)
- Note: this bead partially supersedes 20260717-1717 — delivering S8 fixes the seam that
  brief's own emission exposed; the northstar-evolution goal in 20260717-1717 remains open.

## Flag back

Meet the acceptance criteria to close the bead; surface blockers rather than redefining scope.
