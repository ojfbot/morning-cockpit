---
type: roadmap
slug: rm-l1-morning-cockpit
northstar: l1-morning-cockpit
status: active
phases:
  - id: PH1
    name: "Ground-truth producers"
    goal: "Every lane and liveness signal renders from real upstream data — no stubs, no honest-empty caused by unwired producers."
  - id: PH2
    name: "The dispatch loop goes live"
    goal: "Roadmap slices flow available → claimed → delivered → merged through the cockpit and day-runner, with movement recorded at merge."
  - id: PH3
    name: "Focus-surface completion"
    goal: "Track L launch surface lands; the fleet focus-swap is a complete operator loop (see, pivot, launch)."
slices:
  - id: S1
    phase: PH1
    title: "Wire the GitHub adapter into the aggregate"
    advances: "ns:l1-morning-cockpit#P1"
    moves_from: 60
    moves_to: 67
    deliverable: "PR: adapters/github.ts called by aggregate.ts; PRs/issues in the snapshot with per-source health."
    entrance: "gh CLI authenticated on the host; adapter stub already in-tree."
    success: "/api/cockpit includes GitHub-sourced items; a failing gh degrades health, never the snapshot; tests cover the merge."
    autonomy: gate-0
    claimable_by: either
    kind: m
    status: ready
  - id: S2
    phase: PH1
    title: "Fleet sessions emit agent-* bead_events end-to-end"
    advances: "ns:l1-morning-cockpit#P2"
    moves_from: 50
    moves_to: 58
    deliverable: "PR in core: session-init/bead-session hooks verified to emit agent lifecycle events in daily use; a scripted session leaves rows in bead_events."
    entrance: "Dolt sql-server running on 3307; bead-emit verbs already emit events when invoked."
    success: "After one interactive session, bead_events gains session/agent rows; cockpit Overnight lane and deriveAgentLiveness render live agents."
    autonomy: gate-0
    claimable_by: either
    kind: m
    repo: core
    status: ready
  - id: S3
    phase: PH2
    title: "First compiled dispatch: roadmap slices appear in the Available lane"
    advances: "ns:l1-morning-cockpit#P2"
    moves_from: 58
    moves_to: 64
    deliverable: "A recorded run: roadmap-compile.mjs posts this roadmap's ready slices as queue=available beads; cockpit Available lane shows them; Claim works."
    entrance: "The roadmap-dispatch-pipeline PR (roadmap schema + compiler) is merged in core."
    success: "Compile is idempotent (second run posts nothing); claimed slice shows the lease in the next snapshot."
    autonomy: gate-0
    claimable_by: either
    kind: s
    repo: core
    status: queued
  - id: S4
    phase: PH2
    title: "First runner-delivered slice (Gate 0, end to end)"
    advances: "ns:l1-morning-cockpit#P2"
    moves_from: 64
    moves_to: 72
    deliverable: "day-runner claims a gate-0 slice, works it in an isolated worktree, and leaves: a pushed branch, a PR with evidence + movement proposal, a report bead, bead_events."
    entrance: "S3 verified; day-runner.mjs merged; one small gate-0 slice chosen as the guinea pig."
    success: "The slice-boundary contract is fully observable; /resume --verify corroborates the session's claims; nothing landed on main without a human merge."
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    repo: core
    status: queued
    depends_on: "rm:rm-l1-morning-cockpit#S3"
  - id: S5
    phase: PH2
    title: "Delivery pane: northstar gaps, slice pipeline, movement feed"
    advances: "ns:l1-morning-cockpit#P1"
    moves_from: 60
    moves_to: 66
    deliverable: "PR: read-only Delivery pane rendering per-property gap bars, roadmap slice states (available → claimed → delivered → merged), and the status.jsonl movement feed."
    entrance: "Roadmap schema exists; registry lists this roadmap."
    success: "Pane renders from files + Dolt read-only (ADR-0001 posture kept); empty states are truthful; snapshot contract unchanged or drift-gated."
    autonomy: gate-0
    claimable_by: either
    kind: m
    status: merged
  - id: S6
    phase: PH3
    title: "Track L launch surface — L1 tile links"
    advances: "ns:l1-morning-cockpit#P3"
    moves_from: 55
    moves_to: 65
    deliverable: "PR: fleet tiles expose launch links (L1) per the Track L design brief."
    entrance: "Track L design brief (launchd processes panel bead) reviewed."
    success: "Selecting launch from a tile opens the app's surface; recorded run."
    autonomy: gate-0
    claimable_by: either
    kind: m
    status: queued
  - id: S7
    phase: PH3
    title: "Track L — L2 live-probe + L3 popover"
    advances: "ns:l1-morning-cockpit#P3"
    moves_from: 65
    moves_to: 80
    deliverable: "PR: live-probe of app processes (L2) and the launch popover (L3)."
    entrance: "S6 merged; probe approach agreed (launchd panel brief)."
    success: "Tiles show live/dead app state; popover launches; reduced-motion honored."
    autonomy: gate-0
    claimable_by: either
    kind: l
    status: queued
    depends_on: "rm:rm-l1-morning-cockpit#S6"
  - id: S8
    phase: PH2
    title: "Decision->delivery seam: derive decided-in-flight from closes: refs (read-side)"
    advances: "ns:l1-morning-cockpit#P2"
    moves_from: 50
    moves_to: 56
    deliverable: "PR: handoff adapter builds a closes:-ref index over open beads; a live bead referenced by an open successor derives decided-in-flight (pure logic + tests in packages/shared); such beads leave the Briefing decision pool immediately and render chained with their successor as ONE Pickup item; behavior reverts when the successor closes at delivery. Regression fixture: the real 20260628-2015 / 20260717-1717 bead pair."
    entrance: "Operator-verified defect 2026-07-17: after Approve & emit, Pickup counted both beads (16->17), the Briefing re-seeded the identical DECISION NEEDED thread, and the item rendered 8x — closes: is write-only, nothing on the read side consumes it. Design settled: derivation, never bead mutation (ADR-0005 single write path)."
    success: "With the real pair on disk: the decided item leaves DECISION NEEDED, Pickup shows one chained item (count drops by 1), dangling closes: refs and closed successors are covered by tests; full suite green."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    status: ready
---

# Roadmap — morning-cockpit (l1-morning-cockpit)

**Route.** The cockpit's northstar gap is producer-starvation (P1/P2) plus the unfinished focus
surface (P3). PH1 closes the producer gaps — GitHub items and agent lifecycle events — so the lanes
stop being honest-empty. PH2 dogfoods the new northstar→roadmap→dispatch pipeline against this very
roadmap: slices flow through the Available lane, the day-runner delivers one end-to-end, and the
first movement lines ever land in `status.jsonl`. PH3 finishes the Track L launch surface so the
fleet focus-swap becomes a complete operator loop. Slices marked `repo: core` deliver cockpit
properties but land in core, where the producers live.

## PH1 — Ground-truth producers

S1 wires the stubbed GitHub adapter into the aggregate. S2 verifies the session-lifecycle hooks emit
`agent-*` events in daily use — the verbs exist and emit; what's missing is the daily flow actually
invoking them (as of 2026-07-02, `bead_events` holds a single row).

## PH2 — The dispatch loop goes live

S3 is the first compiled dispatch (Available lane shows real roadmap slices). S4 is the first
runner-delivered slice — the full Gate-0 slice-boundary contract, observable. S5 is the Delivery
pane, dispatched to the same effort that authored this roadmap (it is being delivered as this file
lands — dogfooding from line one).

## PH3 — Focus-surface completion

Track L (tile launch surface) in two slices, sequenced L1 links then L2 probe + L3 popover. This is
the remaining 45% of P3 after the Flow-01 focus-swap shipped.
