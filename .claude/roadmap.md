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
  # PH4 intentionally skipped: a concurrent main-checkout WIP may be minting it; ids are immutable, gaps are fine.
  - id: PH5
    name: "Cockpit v2 — instrument shell + fleet structure"
    goal: "The design_handoff_cockpit_v2 program: fleet-structure adapter + three-mode Fleet section + keyed Leo threads + instrument shell, per the ruled decisions in research/design-handoff-cockpit-v2/README.md. Entrance/check values below are PROPOSED drafts from the design brief — operator ratifies by flipping queued → ready."
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
  - id: S9B
    phase: PH2
    title: "Bead-lane P0 quartet: age is the organizing principle of the pickup queue"
    advances: "ns:l1-morning-cockpit#P2"
    moves_from: 56
    moves_to: 58
    deliverable: "PR: (1) finalizeItems stale-marks any non-overnight lane (was available-only — pickup briefs could never look old); (2) pickup sorts rot-first like available, agreeing with the briefing fallback's ranking; (3) shared ageBucket() (fresh <7d / aging 7-30d / rotten >30d) replaces the StalenessBadge 14d cliff, rotten renders red; (4) HandoffArtifactCard routes claim-on-emit by id namespace — handoff-ledger ids are never sent to the Dolt claim, and a failed/skipped claim is said on the card, never swallowed. Companion to core rm:rm-l2-ojfbot#S32 (bead-lint); the write-side claim verb for handoff beads is wave 2."
    entrance: "Fleet bead audit 2026-08-02 (core S32 t0): 36 open hooks, oldest 96d, invisible in the cockpit — pickup sorted newest-first and could not stale-mark; HandoffArtifactCard.tsx:39 swallowed cross-namespace claim failures with an empty catch."
    success: "Oldest brief renders at the TOP of pickup wearing a rotten chip; overnight items are never stale-marked; ageBucket boundaries covered by tests; emitted cards state claim outcome; full suite green."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: s
    status: delivered
  # ── PH5 (design_handoff_cockpit_v2, 2026-08-09). Ratified 2026-08-08 sitting: S10+S11 → ready,
  # S13 re-scoped as generalization-of-S9 (coexist ruling: Leo threads pin, Northstar follows focus),
  # order S10→S11→S12→S13→S14 then S15/S16/S17 confirmed. S12, S14–S17 remain queued.
  # Slice letters in the design brief map: S-a→S10 S-f→S11 S-b→S12 S-c→S13 S-d→S14 S-e→S15 S-g→S16 S-h→S17.
  # Suggested order (brief): S10 → S11 → S12 → S13 → S14, then S15/S16/S17 in any order.
  - id: S10
    phase: PH5
    title: "Registry adapter + /api/fleet-structure (read-only)"
    advances: "ns:l1-morning-cockpit#P2"
    moves_from: 50
    moves_to: 54
    deliverable: "PR: adapters/fleet-structure.ts reading core registry frontmatter, roadmap status: tallies across sibling repos, wayfinder frontmatter, ~/selfco/wiki counts (precedent: adapters/loop.ts); REST endpoint /api/fleet-structure, not the G1 facade (RFI C16). Badges in payload: DERIVED tallies, JUDGMENT cluster assignment, AUTHORED prose. Membership joins to the REGISTRY, never REPO_META; census/registry disagreement is rendered, not hidden (TD-007)."
    entrance: "design_handoff_cockpit_v2 bundle in research/; RFI response A9/C15 names every reader; loop.ts precedent for ~/selfco reads."
    success: "Endpoint serves the full node/edge/stat payload from live files; Vitest covers each parser; a missing sibling repo degrades that roadmap's tallies with a health note, never the snapshot."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    status: ready
  - id: S11
    phase: PH5
    title: "Derived-truth selectors — no surface hardcodes a count"
    advances: "ns:l1-morning-cockpit#P1"
    moves_from: 66
    moves_to: 68
    deliverable: "PR: one selector layer over the snapshot (decisions = openBriefs − emittedBriefs and friends); hero/dial/spine/meta/chips all consume it; grep-able removal of the v1 hardcoded literals (42 pickups, 80/7d, sinceGap, stat rails)."
    entrance: "S10 payload shape settled (selectors read the same snapshot)."
    success: "Emitting a brief visibly moves every decision surface in one render; Vitest proves emit → all counts move; grep for the named v1 literals returns nothing."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: s
    status: ready
  - id: S12
    phase: PH5
    title: "Fleet section, three modes (grid / tiers / constellation) + ADR-0012 binding"
    advances: "ns:l1-morning-cockpit#P3"
    moves_from: 55
    moves_to: 62
    deliverable: "PR: port of the prototype canvas as a zero-dep React SVG component (masonry cluster boxes, bundled per-cluster edges — never per-node; polar constellation); grid restructure (SIGNAL cards / DORMANT cluster rows); filter = dim .14 + brighten + match pill, never remove; selection drives ADR-0012 fleet selection for repo nodes, no-op for non-repo (RFI D22 ruling); inspector replaces rail widgets on selection."
    entrance: "S10 live; design reference research/design-handoff-cockpit-v2/design/Cockpit Fleet v2.dc.html; punch-list canvas items (pan clamp, a11y tab stops) in scope."
    success: "The G40 Playwright run's canvas beats pass: type ready → click f1-substrate → inspector opens AND fleet selection follows; layout fns pure + Vitest-covered; SVG nodes tabbable with focus ring."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    status: queued
  - id: S13
    phase: PH5
    title: "Scoped Leo threads (global + per-repo) — generalize S9's keying; share-to-global toggle"
    advances: "ns:l1-morning-cockpit#P3"
    moves_from: 62
    moves_to: 66
    deliverable: "PR: extend S9's ThreadMap/chatThreadKey with Leo scope — 'leo' stays the global thread (S9's v1→leo migration already preserves history; no new migration), 'leo:<repo>' per-repo; scoped seed reusing the buildNorthstarPreload pattern (authored prose + delivery counts); context → Global ON/OFF toggle; thread tabs open from the S12 inspector's Ask Leo; selection changes the INSPECTOR, never yanks a pinned Leo thread — Northstar tab keeps its S9 follow-focus behaviour (per-tab contract, coexist ruling ratified 2026-08-08). Implements core wayfinder #340's recommended answer — record the decision on that map (core brief owns the map edit)."
    entrance: "PR #43 (S9 preservation) merged; S12 selection seam merged (thread tabs open from the inspector's Ask Leo)."
    success: "Global + repo threads hold distinct histories across restarts; focus-change mid-thread keeps a pinned Leo thread pinned while the Northstar tab re-scopes; S9's 'leo' history byte-for-byte intact after upgrade; Vitest on the store."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    status: queued
  - id: S14
    phase: PH5
    title: "Instrument shell — meta bar, phase hero + day dial, spine nav, last-viewed"
    advances: "ns:l1-morning-cockpit#P1"
    moves_from: 68
    moves_to: 72
    deliverable: "PR: 40px meta bar (loop pulse, phase chip, clock); phase wordmark + focus sentence (red only on decision counts) + day dial (24h ring, phase arcs, one added center element per the operator flag — pick ONE of next-anchor ETA / loop count-up / phase glyph); 192px spine with derived state summaries + red decision dots; last-viewed timestamp powering SINCE YOU LAST LOOKED; hero collapse-on-scroll (punch-list); prefers-reduced-motion kills the pulse."
    entrance: "S11 selectors live (every shell number derives)."
    success: "All shell numbers trace to selectors (no literals); phase flips at 5/11/17/22 with manual override; dial has role=img + label; collapse keeps >60% viewport for content at 900px-tall windows."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: m
    status: queued
  - id: S15
    phase: PH5
    title: "Leo thread color coding + UI-executed command tokens"
    advances: "ns:l1-morning-cockpit#P1"
    moves_from: 72
    moves_to: 74
    deliverable: "PR: thread accents by scope (global cream, repo = cluster hue, system green, red only on decision-required); token chip row — /explain /ladder /gap /open /draft-handoff — each a deterministic UI verb (never free text to the model); /draft-handoff enters the existing ADR-0005 gated flow; unknown tokens fall through as text. Core-verb tokens (queue-claim etc.) are explicitly OUT — new operator decision required (core brief §4)."
    entrance: "S13 threads merged."
    success: "Each token performs its verb deterministically in a recorded run; /draft-handoff cannot emit without the Approve gate; token chips render in the transcript."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: s
    status: queued
  - id: S16
    phase: PH5
    title: "Newline pane — course ops from vault notes + open briefs"
    advances: "ns:l1-morning-cockpit#P1"
    moves_from: 74
    moves_to: 76
    deliverable: "PR: units table (real unit names from vault notes — the prototype's are placeholders, punch-list), DERIVED — VAULT NOTES badge, hot-row binding to the live brief, NEXT SITTING card navigating to the matching briefing thread."
    entrance: "S11 + S13 merged (derived counts, thread navigation)."
    success: "Every unit row traces to a vault note; NEXT SITTING opens the right briefing thread; truthful empty state when no notes exist."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: s
    status: queued
  - id: S17
    phase: PH5
    title: "Canon pane — regenerated D5 + authored D6, dark-theme native"
    advances: "ns:l1-morning-cockpit#P1"
    moves_from: 76
    moves_to: 78
    deliverable: "PR: figure cards with provenance headers (AUTHORED / GENERATED, canon path, 'the cockpit shows, the vault keeps') + staleness footers; consumes core's registry-generated D5 (core brief §2) and authored D6; mermaid themed dark-native — never a light-theme SVG embedded (punch-list)."
    entrance: "Core's D5 generator slice delivered (registry → mermaid → dark render)."
    success: "Both figures render dark-native with provenance + staleness; deleting the canon file yields a truthful empty state pointing at the vault path."
    check: "pnpm test"
    autonomy: gate-0
    claimable_by: agent_eligible
    kind: s
    status: queued
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
