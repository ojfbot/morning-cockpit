---
id: 20260628-2015-brief-northstar-control-surface
type: brief
title: "Evolve morning-cockpit's northstar from read-model pane → operator control surface"
actor: code-claude
to: code-claude
session_id: northstar-offsite-2026-06-28
refs: []
hook: "Refine the existing l1-morning-cockpit northstar toward 'control surface' (observe → act, via core verbs), land it, lint green"
status: live
created_at: 2026-06-28T20:15:00
labels:
  project: ojfbot-northstar
---

## Context

This is the **morning-cockpit leg** of the OJFBot Fleet Northstar offsite (a per-app northstar
authoring effort; governing ADR `core/decisions/adr/draft-three-tier-northstar.md`). A northstar = a
compass: vision + named **properties**, each with `target` (aspirational — what done looks like),
`current` (0–100, **honest, evidence-based, never aspirational** — the gap to target is the roadmap),
`verification`, and `ladders_up_to` (to an L2 parent property). Full schema:
`~/ojfbot/core/decisions/northstar/schema.md` (v1.1). Lint: `node ~/ojfbot/core/scripts/northstar-lint.mjs`.

**This is review-and-refine, not greenfield.** A first-cut northstar already exists at
`morning-cockpit/.claude/northstar.md` (slug `l1-morning-cockpit`, registered in core's registry):
- **P1** (60) "single legible pane" → `ns:l2-ojfbot#P2` (legibility)
- **P2** (50) "coordination is real and ground-truth" → `ns:l2-ojfbot#P2`
- **P3** (55) "pivots focus across the fleet" (the Fleet→Briefing focus-swap) → `ns:l2-ojfbot#P1` (delivery)

**The direction James set:** evolve the northstar from *read-model dashboard ("single legible pane")*
→ **the operator's fleet control surface** — observe *and act*. This is not a leap; the progression is
already in the code: it **observes** (3 lanes + pods), **navigates** (focus-swap F1–F4, shipped
2026-06-27), and has its **first control verb** (Claim → core's `bead-emit queue-claim`, ADR-0010).
Elevate P2's coordination into the spine; name the fuller control verbs (claim → dispatch →
spawn/manage/route).

**The crux that makes this coherent (resolve it this way):** morning-cockpit is **deliberately
read-only** to Dolt, with exactly ONE write carve-out (Handoff Emission, ADR-0005). A "control surface"
must NOT break that. The resolution — identical to the Frame/shell leg — is that the cockpit becomes
the **authorizing/triggering surface OVER core's write verbs**: the cockpit triggers + authorizes, core
executes the write. The Claim button already works exactly this way (ADR-0010: cockpit shells to core's
`queue-claim`, never writes Dolt itself). So "control surface" = trigger/authorize core verbs, never a
parallel write path. This keeps the read-only invariant (ADR-0001) intact.

## Goal

Refine `morning-cockpit/.claude/northstar.md` so its vision + properties express the cockpit as the
operator's **control surface** (observe → act via core verbs), keep the %s brutally honest against the
verified gaps below, land the updated file, and run the lint to green. Record the cross-app edges
(`depends_on` core; sibling-of Frame) and the LADDER_STRESS (see the gate flag).

## Acceptance criteria

- [ ] Vision reframed: cockpit = the fleet **control surface** (observe → act), not just a legible pane.
- [ ] An explicit **control/act property** (the operator can act on the fleet from the cockpit: claim →
      dispatch → spawn/manage), with `current` honestly LOW (Claim is the only control verb today) and
      `depends_on: ns:l1-core#P-<spawn/queue>` (NOTE: core has no northstar yet — this forward-ref will
      not resolve; record it, do not invent a core northstar to satisfy it).
- [ ] The observe/legibility property keeps its honest %, gated by the verified gaps (below).
- [ ] `node ~/ojfbot/core/scripts/northstar-lint.mjs` → no NEW structural errors for l1-morning-cockpit.
- [ ] LADDER_STRESS recorded (see gate flag) — surfaced, not silently absorbed.

## Verified current state & gaps (from this repo — treat as evidence)

- `agent_status` is NOT liveness — liveness is **derived** from `agent-*` `bead_events` recency
  (`deriveAgentLiveness`, S1 writer + S2 derivation, ADR-0008). All raw agents read permanently
  "active". (CLAUDE.md "Honest gaps"; `decisions/adr/0008`.)
- **No real unassigned-task pool** — tasks are born already-assigned in a convoy; the Available lane is
  *synthesized* from open issues + open briefs. The real write-path is the **Track R** coordination
  design, `decisions/adr/0002-*` (draft, unbuilt). Until then, truthful empty states.
- **Read-only posture (ADR-0001) + single write carve-out (ADR-0005, Handoff Emission).** No
  `@core/workflows` dep; bead types are **mirrored** (`packages/shared/src/dolt-bead.ts`, dated comment)
  — drift undetected.
- Focus-swap (P3) is Flow-01-complete + fast (45s→1.3ms, ADR-0014 mitigation); remaining for 100% =
  Track L launch surface + ADR-0014 persistent read-model.

## References

- file:morning-cockpit/.claude/northstar.md — the northstar to refine
- file:morning-cockpit/CLAUDE.md — posture + honest gaps
- file:morning-cockpit/decisions/adr/0001 (read-only posture), 0002 (Track R write-path, draft), 0005 (Handoff Emission), 0008 (liveness), 0010 (cockpit→core queue-claim), 0014 (read-model persistence)
- file:~/ojfbot/core/decisions/northstar/schema.md — schema v1.1 (depends_on, LADDER_STRESS)
- file:~/ojfbot/core/decisions/northstar/offsite/itinerary.md — the offsite map (cockpit = leg-6 #24)
- Frame (shell) confirmed northstar — the sibling "authorizing surface over core mechanism" pattern + the instance-federation framing: https://app.notion.com/p/38d54a8c53d78130b1cbef8df26c9328
- morning-cockpit Notion row (this leg) — https://app.notion.com/p/38d54a8c53d781cb9135cfe6d802dd40

## Flag back (do not decide unilaterally)

- **⚠️ This leg may TRIP the kickback gate.** P3 (focus-swap) ladders to `ns:l2-ojfbot#P1` ("ships
  demoable **Frame OS** surfaces") while morning-cockpit is *explicitly non-Frame*. That is the **same
  L2-P1-widening strain already logged at 2 of 3** (f1-substrate, Frame) in
  `core/decisions/northstar/offsite/schema-evolution-log.md`. If this leg strains there too, it's the
  **3rd instance → the gate trips → freeze the roadtrip for a deliberate L2 revision** (widen P1 to
  "Frame-composed *or* standalone surfaces," a MAJOR bump via semver-on-refs). **Do NOT hot-patch the L2
  parent mid-leg** — record the strain, surface to James, stop.
- **The cockpit↔Frame relationship is unresolved** — two candidate control surfaces over one core
  (cockpit standalone/GroupThink; shell Frame/MF). Converge? Divide by domain (cockpit = work/bead
  control; shell = app-instance control)? Surface it; don't resolve alone. (Possible cluster-tier
  question — see the Frame block's framework flags.)
- Don't break the read-only invariant: every new control verb must delegate to a core write verb, never
  write Dolt directly.

## Constraints

- Aspiration in `target`/vision; honesty in `current` (the gap is the roadmap). Don't deflate the
  control-surface target to make the % look better; set an honest LOW % against an ambitious target.
- This is a Code session in-repo: refine + land `.claude/northstar.md` directly + lint. No Notion relay
  round-trip needed (the row exists for reference + status).
