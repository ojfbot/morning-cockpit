---
type: northstar
slug: l1-morning-cockpit
tier: L1
app: morning-cockpit
ladders_up_to: l2-ojfbot
status: active
# FIRST-CUT — placeholder %s and framing, grounded in what the cockpit already is.
# To be refined against the northstar goals discussed in Claude Design (audio walk).
properties:
  - id: P1
    name: "The cockpit is the morning's single legible pane"
    target: "One glance answers: what ran overnight, what I should pick up, what's available — every lane sourced from ground truth (Dolt events, real handoff/queue state), never synthesized filler."
    current: 60
    verification: "Overnight/Daily-pickup/Available lanes render from real bead_events + queue; no lane is a mock; staleness flagged honestly."
    ladders_up_to: "ns:l2-ojfbot#P2"
    okr_drivers: []
  - id: P2
    name: "Coordination is real and ground-truth, not synthesized"
    target: "Liveness, the unassigned queue, and claim are live over the Dolt spine (S1–S4 shipped); the cockpit's writes go through core verbs, never a parallel truth. Autonomy graduates shadow-first."
    current: 50
    verification: "deriveAgentLiveness from real events; Claim button shells to core queue-claim; S5/S6 land behind the shadow gate."
    ladders_up_to: "ns:l2-ojfbot#P2"
    okr_drivers: []
  - id: P3
    name: "The cockpit pivots focus across the active fleet"
    target: "Selecting a fleet app re-scopes the briefing to that app — start on home base, toggle across the fleet to triage each app's first move. (The dashboard-ux Fleet→Briefing work.)"
    current: 45
    verification: "Fleet tile selection drives Section 00; recorded run toggling focus across ≥2 apps; the dashboard-ux G/F/L slices delivered. (2026-06-27: G0 contract+drift-gate [core#178+cockpit#14], G1 GraphQL facade [#16], F1 selection [#17], F2 repo-scoped briefing — the focus-swap WORKS end-to-end: a recorded Playwright run toggled morning-cockpit→lean-canvas[honest empty]→core. Remaining: F3 animation, F4 designed empty, L1/L2/L3 launch surface.)"
    ladders_up_to: "ns:l2-ojfbot#P1"
    okr_drivers: []
---

# Northstar — morning-cockpit (L1)

> **First-cut.** The properties and %s below are grounded in what the cockpit already is, as a
> starting point. The real northstar goals were discussed in Claude Design — refine these against
> that material (the audio-walk conversation), don't treat them as settled.

**Vision.** The cockpit is the place the day starts: a single legible pane that tells the truth about
what the fleet did, what needs picking up, and what's free to claim — and lets you pivot focus to
whichever app needs you. It advances ojfbot's legibility property (it *is* the fleet's read-model) and
its demoable-surfaces property (the focus-swap is the most fleet-visible interaction).

## P1 — The cockpit is the morning's single legible pane

Ladders to `ns:l2-ojfbot#P2` (work is legible / self-measuring). The three lanes from ground truth,
not mocks. This is the cockpit's reason to exist.

## P2 — Coordination is real and ground-truth, not synthesized

Also ladders to `ns:l2-ojfbot#P2`. The S1–S4 coordination layer (event spine, liveness, queue, claim)
is live; S5/S6 mature shadow-first. The cockpit never holds a truth parallel to core/Dolt.

## P3 — The cockpit pivots focus across the active fleet

Ladders to `ns:l2-ojfbot#P1` (the fleet ships demoable surfaces). This is the `dashboard-ux-flows`
Fleet→Briefing focus-swap — the in-flight feature this whole day-runner effort is dogfooding to
deliver. 45% = **the focus-swap works end-to-end.** Track G shipped the contract spine (G0
`@core/read-model-contract` SDL + codegen + 3-part drift gate [core#178+cockpit#14]; G1 the GraphQL
read facade [#16]); F1 made Fleet a selector [#17]; **F2 made the Briefing repo-scoped** — selecting a
tile re-scopes Section 00, with a truthful empty for quiet repos. A recorded Playwright run toggled
morning-cockpit→lean-canvas(honest empty)→core. Remaining for 100%: F3 (animated swap), F4 (designed
empty state), L1/L2/L3 (tile launch surface + popover).
