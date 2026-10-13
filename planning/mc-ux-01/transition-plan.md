# MC-UX-01 transition plan

Source capture: `9ff16f62fdf129beeae23c51b068b772c9aab223`. Inventory SHA-256: `7fdbbe469615cd3a819e15ac7681dd2b8f2c31e9c173c3adc5a012b12437bea2`. See [capture record](CAPTURE.md) and [planning entry point](README.md).

This is a proposed implementation plan, dated 2026-10-08 in the user's timezone. The authorized pass captures and plans only. It does not authorize implementation, change dispatch status, allocate roadmap slice IDs, or start a fleet-runner session. The design bundle contains source dates of 2026-10-09; preserve them as source claims without treating them as approval dates for this plan.

## Decisions before delivery

The next implementation initiative should begin with a live-data comparison of Open Loops and Adaptive Workspace. Keep the existing renderer available throughout that comparison. Reuse the committed fleet-structure reader, handoff open-hook derivation, selected-repo binding, Northstar threads and handoff approval path. The bundle's recommendation to combine E's model, D's shell and C's fleet view is an experiment hypothesis, not a selected production architecture.

Do not add report emission while Q3 is open. Do not make a cockpit memo schema operative while Q13 and Q14 are open. Do not infer named processes or per-session liveness while Q15 is open. Those constraints permit useful read-only prototypes now and prevent a demonstration from appearing to deliver, route or close work when it has only prepared local text.

## Evidence and baseline

Source references below are repository-relative unless they begin with `design/`, which means the captured MC-UX-01 bundle. The implementation baseline is committed HEAD `1b15bc9`. The primary checkout contains unrelated dirty PR Train files and edits to `App.tsx`, `api.ts`, config, server registration, styles, README and implementation notes. They are not part of this design capture, are not assumed shipped, and must be reconciled before any later implementation branch rebases onto their delivery.

The committed `App.tsx` renders Briefing, Fleet, Critical Path, Delivery, the three lanes, Reading, Papers and Loop telemetry. It polls `/api/cockpit` every 60 seconds. Sections fetch additional snapshots independently. `CockpitUiState` already persists selected repo, theme, density, Briefing selection/approval and chat tab in `mc.cockpit.v1`. There is no committed room switch, loop ledger or last-looked field.

`aggregate.ts` wires only Dolt and handoff adapters. GitHub and standup sources are still absent. Do not describe PR Train work in the dirty checkout as a complete GitHub issue adapter or quietly make it an MC-UX dependency.

The S10 fleet-structure adapter and route are committed through PR #45. `/api/fleet-structure` supplies registry-derived nodes, edges, slice tallies, census disagreement and provenance. Its roadmap entry still says `ready`; reconcile that evidence/status discrepancy rather than building the adapter again. `/api/fleet` is the older fleet tile snapshot, not a substitute for the S10 strategy snapshot.

`adapters/handoff.ts` already computes open hooks using live briefs with no report's `responding_to`, and folds `closes:` predecessors through `deriveDecidedInFlight`. This transformation precedes the UI. Reuse it instead of recomputing lifecycle from a lossy `WorkItem` or maintaining a second closure ledger. The end of the decided-in-flight derivation can make a predecessor reappear; that is the current documented behavior, not proof of report delivery.

`WorkItem` has agent role/app/status/sessionId but no authoritative named-process roster or task history. Current liveness derives from `agent-*` recency, not stored `agent_status`. A repository-level timestamp can support "items touched since last looked"; it cannot prove which process did what. Unknown type/task/name/session/host values must remain explicitly unknown until upstream data exists.

The design bundle's Q20 claim that News feeds live in code is stale. Accepted ADR-0015 and `config.ts` already read the root `sources.yaml`; `reading.opml` is generated. Reading Room must reuse that registry. The bundle's 8-brief, hand-compiled snapshot is too narrow to select a fleet-wide shell, and the seven task scores are design judgments rather than measured acceptance results.

## Existing roadmap reconciliation

| Existing slice | Committed/status evidence | MC-UX relationship and proposed handling |
|---|---|---|
| S9 | `delivered`; Northstar tab, per-unit thread store and global `leo` history present | Reuse its store and migration. Do not reopen global/Northstar keying as greenfield work. |
| S10 | Code and PR #45 committed; entry still `ready` | Verify current endpoint against live registry and reconcile status separately. Work Graph consumes it. |
| S11 | `ready`; no committed unified MC-UX selector layer identified | Put truthful loop/count selectors and cross-view consistency inside this existing obligation, or explicitly amend it. |
| S12 | `queued`; production remains tile-based Fleet | Work Graph is a refinement candidate for its existing grid/tiers/constellation scope. Resolve rail/popover and Fleet/Cluster/Repo navigation against the newer experiment before changing scope. |
| S13 | `queued`; Leo remains global, Northstar follows focus | Reuse the already-defined global versus pinned per-repo behavior. New room/read scopes need a decision; avoid silent thread proliferation. |
| S14 | `queued`; day dial, spine and last-viewed are specified, absent in committed renderer | Q2 determines whether rooms, one page, or current instrument-shell scope prevails. Record supersession explicitly if MC-UX drops the dial or spine. |
| S15 | `queued`; deterministic token commands planned | Reuse for conversational navigation and `/draft-handoff`; the model cannot authorize or execute upstream writes. |
| S16 | `queued`; newline course pane planned | Reading Room rules defer wiring Course. Record it as deferred scope within this experiment, not deletion or delivery of S16. |
| S17 | `queued`; canon pane depends on core D5 | Preserve vault ownership and existing dependency. MC-UX does not introduce a canon editor or imply this shipped. |
| S18 | `delivered`; pickup staleness, age buckets and emission claim outcomes present | Preserve oldest-first pickup and namespace-safe claim behavior. Reconcile red-for-age with the newer red-only-for-human-decision rule through semantic tokens, not loss of stale warnings. |
| S19 | `queued`; Northstar absence presently depends on delivery pairs | Work Graph's "goal on record" must consume registry truth from S10 or wait for S19's explicit registered-but-unpaired state. Do not infer absence from missing delivery pairs. |

The current roadmap prose says S9 is its only PH4 slice even though S19 is now registered. That is another documentation/status discrepancy to reconcile before compiling a revised roadmap. This plan does not repair or mutate `.claude/roadmap.md`.

## Gates and ownership

| Gate | Owner | What may proceed | What remains blocked |
|---|---|---|---|
| Q1, live-data validity | Cockpit implementation agent plus operator experiments | Fixture capture, honest degraded states, isolated experiments | Using existing prototype scores as proof of a chosen production shell |
| Q2, shell | Operator | Isolated E/D experiments and existing page improvements | Replacing `App.tsx`, final room routing, superseding S14 |
| Q3, report write | Operator plus core | Browser-local review text, preview, copy/export; ordinary brief draft/approve under ADR-0005 | Writing report files, changing brief status, claiming preparation closed a loop |
| Q4, recipient reliability | Cockpit data audit, then fleet-runner/core | Display literal `to`/actor with evidence, unknown recipient | "Waiting on you" from `actor == to`, guessed obligation or authority |
| Q12, agent type/task | Cockpit plus core | Evidence-backed existing agent rows; absent fields labeled | Invented task/type histories or unapproved event-schema changes |
| Q13, operative correspondence schema | Operator plus fleet-runner/core | Render source schema labels and local parsing warnings as advisory | Schema activation, memo-number allocation, registers, dispatch or receipt mutation |
| Q14, recipient vocabulary | Operator plus fleet-runner/core | Display raw identifiers; prepare drafts for a known recipient | Automatic routing from guessed roles or invented identities |
| Q15, process identity and events | Fleet-runner plus core | Bare-ID compatibility and "process name unavailable" | Minting names, claiming tuple provenance, per-process liveness without events |
| Q19, community list/access | Operator | News/Papers and explicit Community empty state | X access choice, paid integration, community digest producer |
| Q20, curated config | Cockpit plus operator | Reuse `sources.yaml`; local reading-list preferences | A second canonical feed list, a server registry write from the prototype |

ADR-0005 defines the approved brief-emission exception: brief draft, validated preview, explicit per-emission human Approve, exclusive file creation within the target repo. Accepted [ADR-0010](../../decisions/adr/0010-cockpit-triggers-core-queue-claim.md) separately authorizes delegated human claims through core-backed POST `/api/claim`; cockpit never opens a Dolt write connection. Preserve both accepted exceptions. New verbs or wider authority need their own owner decision. Internal cockpit `.data` stores already exist; any new experiment telemetry needs an explicit shape, retention policy and reader before adding a server JSONL feed or connecting it to Loop. Start with browser-local experiment preferences. "Open Loops" is a product grouping; the existing `LoopSection` is self-improvement telemetry. Do not conflate their counts or endpoints.

Preserve ADR-0003 local Ollama default, deterministic floor and no automatic cloud cascade. Committed `CLAUDE.md` and config agree on `ollama|claude|off`. An uncommitted local AGENTS file supplied to the original session mentioned Codex; that wording is not a committed project requirement or authorization to change providers. Keep clouds explicit and preserve existing offline behavior. Reuse the accepted standalone posture despite reading Frame OS context; Module Federation, Carbon and `@core/workflows` remain outside scope.

Use the [reconciled T1–T7 crosswalk](fleet-integration.md#t1t7-ownership-and-entrances-reconciled-2026-10-10) when planning pickup. T4 requires the Q2 shell ruling; T5 includes an approved draft-handoff write; T6 Community/config/producer work is separately gated. No task or roadmap placeholder becomes ready through this planning amendment.

## Short term, next cycle after implementation authorization

These tasks are ordered by likelihood of changing the decision after review. `p(revise)` uses the roadmap calibration's 0.05 increments and forecasts decision revision, not technical difficulty. These are subjective forecasts, not empirically calibrated probabilities. Efforts are rough active engineering time, excluding operator experiment time, upstream waits and PR queues.

### T1. Set up the live E/D comparison and decision record

- Priority P0; effort M, 2 to 4 days; `p(revise)=0.75` for the comparison shape and shell recommendation.
- Dependencies: authorized implementation; T2 evidence projection. Q2 intentionally stays open during comparison.
- Task brief: add a reversible opt-in experiment entry that renders Open Loops and Adaptive Workspace against the same snapshot loaders. Keep the default existing page. Avoid picking a routing library before Q2. Browser-local state records selected experiment, manual room override and last-looked; it records no domain status. READ is entered deliberately and never selected by clock. Keep names and 05/11/17/22 boundaries marked as hypotheses. Use shared selection callbacks and existing chat components.
- Targets: `packages/renderer/src/main.tsx`, proposed `src/experiments/McUxExperiment.tsx`, proposed `OpenLoopsView.tsx` and `AdaptiveWorkspaceView.tsx`, `cockpitState.ts`, `api.ts`, experiment CSS. Prefer thin vertical increments: first one populated loop with detail and an honest unknown recipient; then orient/desk navigation; then review preview.
- Observable success: same snapshot produces matching counts in both views; first-run diff says no baseline; "I've looked" updates the baseline without mutating a bead; selecting a repo opens its scoped Briefing; default app remains one click away. A failed source remains identified, and stale data retains its timestamp.
- Validation: renderer interaction tests for baseline reset, selection, persisted state and disabled writes. Run `pnpm --filter @cockpit/renderer test`, `pnpm typecheck`, `pnpm build`. Walk all seven tasks on a running build with complete and degraded sources; record completion time, wrong conclusions, navigation steps and help needed, using the same fixture/session for both views. Gather one week of overrides before recommending clock defaults.
- Rollback: turn off the experiment entry and retain existing page/state. Prototype preferences stay separate from domain and approved-brief state.

### T2. Prove loop, recipient and count truth on the current contracts

- Priority P0; effort M, 1 to 3 days; `p(revise)=0.35` for the bounded evidence model.
- Dependencies: live local API services or a dated fixture that says which sources were unavailable. No Q3 write dependency.
- Task brief: capture `/api/cockpit`, `/api/fleet`, `/api/fleet-structure`, `/api/delivery`, `/api/loop`, `/api/reading` and `/api/papers` as dated evaluation inputs. Keep raw local snapshots out of a public commit until their content has been reviewed; create focused safe fixtures for automated tests. Audit `to`, `actor`, `responding_to`, `closes` and missing timestamps across multiple repos. Define pure projections for loops, known recipient versus unknown recipient, counts and since-last-looked. Consume existing open hooks and folded chains. Return "not observable" where snapshot timestamps cannot establish history. Make one selector output feed all related headlines, chips and list lengths.
- Targets: existing `packages/shared/src/work-item.ts`, `decided.ts`, `briefing.ts`; proposed `attention.ts` and its tests; `server/src/adapters/handoff.ts` only if evidence missing at the boundary; `renderer/src/cockpitState.ts` and tests. S11 owns the eventual selector obligation.
- Observable success: every loop references a source item; report responses remove the open hook under existing adapter rules; chains count once; unknown `to` never defaults to operator; empty and degraded inputs have distinct presentation; counts and lists agree after an approved brief refetch.
- Validation: `pnpm --filter @cockpit/shared test`, `pnpm --filter @cockpit/server test`, `pnpm --filter @cockpit/renderer test`, `pnpm typecheck`. Test no-report/report, successor closure, dangling/cyclic refs, duplicate IDs across sources, absent/future/invalid timestamps and cold/corrupt browser state. Use current age buckets without inventing a competing lifecycle store.
- Rollback: selectors are additive and existing endpoints/lanes remain available. If a public snapshot contract must change, update its authoritative schema and parity checks in the same slice rather than adding a disconnected mirror.

### T3. Make one real evidence-backed decision item legible

- Priority P1; effort S to M, 1 to 2 days; `p(revise)=0.15` for evidence presentation and red discipline.
- Dependencies: T2's semantics; align with S11 and S18 behavior.
- Task brief: apply the MC-UX plain-word label, human-decision signal, evidence label and navigable detail to one existing Briefing/Pickup item end to end. Preserve repo/brief deep links and technical terms in source detail. Distinguish authored assertion, derived fact, synthesis and simulated behavior; the same object can carry multiple evidence axes. Do not relabel all existing `judgment|authored|derived` provenance as a single unquestioned origin. Add keyboard-operable click-to-pin details with Back, Escape, focus return and "where this came from". Who-only peek remains a later refinement until identity fields exist.
- Targets: `components/briefing/Briefing.tsx`, `HandoffArtifactCard.tsx`, `WorkItemCard.tsx`, `StalenessBadge.tsx`, proposed `Evidence.tsx` and `ReferenceCard.tsx`, `styles/tokens.css`, `styles/app.css`.
- Observable success: a decision uses red, a stale age uses warn, selection uses ink, progress uses its own token; dark/light contrast, keyboard and reduced-motion behavior work. The approved-emission card still states claim outcome.
- Validation: relevant existing renderer interaction tests plus `pnpm --filter @cockpit/renderer test`, `pnpm typecheck`, `pnpm build`; inspect dark/light, 900px viewport and keyboard-only detail navigation in the running build.
- Rollback: remove item-level additions without changing lifecycle, counts or approval semantics. Expand to other sections only after this slice is demonstrable.

## Medium term, 1 to 3 months

### T4. Choose and adopt the shell from measured tasks

- Priority P1; effort M to L, roughly 4 to 8 days after Q2; `p(revise)=0.80` for selecting D, E or a combination.
- Dependencies: T1/T2/T3 complete, live seven-task observations, operator Q2 ruling, reconciled S14 scope.
- Task brief: publish the operator decision and scope amendment, then replace only the chosen default entry. Keep existing pods reachable, thread history intact and local state migration compatible. If rooms win, move one orient-to-desk-to-review sequence first; if one page wins, move the loop ledger with its detail/Briefing action first. Introduce READ deliberately. Do not bulk rewrite all pods to satisfy prototype geometry.
- Targets: `App.tsx`, `main.tsx`, `cockpitState.ts`, chosen experiment components, existing pod components, relevant ADR/README screen map.
- Observable success: the operator completes the seven tasks on real data without a simulated write mistaken for delivery. Predeclare comparative targets after recording the baseline; the design goal for important developments is under two minutes. Existing lane, theme, chat, approved-brief and selection behavior passes regression checks. Provide a default-page rollback until one working cycle succeeds.
- Validation: `pnpm test`, `pnpm typecheck`, `pnpm build`, recorded running-build tasks, offline/degraded-source walkthrough, persisted state migration and existing approved-emission regression. If adding Playwright, first add an explicit dev/test harness and pnpm script; there is no existing `pnpm test:e2e` command to claim today.

### T5. Refine the fleet map and scoped conversational navigation

- Priority P1; effort L, roughly 1 to 2 weeks split across S12 then S13/S15; `p(revise)=0.45` for the precise map/inspector navigation.
- Dependencies: verified S10, T2 selectors, Q2 inspector placement; S19/registry truth for absence labels. Q15 blocks full parented process/session detail, not repo navigation.
- Task brief: reuse S12's three-mode obligation and ADR-0012 selection. Begin with a read-only Fleet-to-repo map that selects a real repo and opens its Briefing. Then add addressable Fleet/Cluster/Repo navigation, evidence-backed relationship links, no invented artifact lists, pan clamp and keyboard navigation. A hand-read link stays asserted. Implement S13 pinned Leo versus follow-focus Northstar behavior before adding S15 deterministic UI verbs. Keep `/draft-handoff` on the real existing approval flow; all other commands only navigate or explain.
- Targets: `components/FleetSection.tsx`, proposed `FleetCanvas.tsx` and pure layout functions, `api.ts`, `chat/ChatSidebar.tsx`, `shared/src/chat.ts`, `server/src/chat-store.ts`, `routes/chat.ts`, `chat-context.ts` and tests.
- Observable success: filtering dims rather than drops nodes; repo selection updates inspector and Briefing together; browser back/forward restores map context; global history survives and pinned Leo is not re-scoped by incidental selection; absent artifact/process data says why. Report preparation has no delivery receipt without upstream evidence.
- Validation: focused fleet/chat shared-server-renderer tests, `pnpm test`, `pnpm typecheck`, `pnpm build`, recorded selection and pinned-thread scenarios. Corrupt thread-file protection and S9 migration tests remain mandatory.

### T6. Deliver the existing News/Papers reading sitting first

- Priority P2; effort M, roughly 2 to 4 days for current sources; `p(revise)=0.30` for channel/sitting structure.
- Dependencies: T1 local state and T3 evidence patterns. Q19 blocks Community; Q20 governs any registry expansion. Course/Textbooks wiring is later under the bundle's rulings and reconciled S16.
- Task brief: use existing Reading/Papers snapshots in one READ view, with source health, origin, local list, timer and optional repo-in-mind. Empty channels state why; suggestions do not count as kept sources. Do not manufacture items. Add arXiv, podcast or subreddit adapters only as separate reviewed feed-to-item slices when authorized; reuse `rss-parser` where suitable and dedupe actual papers against HF IDs/URLs. Community digests retain deterministic/local provider floors.
- Targets: `ReadingSection.tsx`, `PapersSection.tsx`, proposed `ReadingRoom.tsx`, `cockpitState.ts`, `shared/src/reading.ts`, `papers.ts`, `sources.ts`, `sources.yaml`, `server/src/adapters/rss.ts`, `papers.ts`, existing reading/paper routes.
- Observable success: real existing News/Papers render; source outages show degraded health; channel totals equal registry/kept-list projections; READ is never clock-picked; takeaway is local prepared text with no receipt claim; Podcast handoff opens a player link rather than becoming a player.
- Validation: reading/papers/source validator tests, renderer timer/list tests, `pnpm test`, `pnpm typecheck`, `pnpm build`. For any `sources.yaml` edit run `pnpm watch:verify-sources` and `pnpm watch:opml`; failed endpoints enter quarantine with their reason, never disappear or get speculative replacement URLs.

## Long term, 3 months or more

### T7. Close preparation, routing and delivery through the upstream contract

- Priority P1 for the contract decision; implementation size unestimated until Q3/Q13/Q14/Q15 resolve; `p(revise)=0.85` for the actor/schema/receipt design.
- Dependencies: operator and fleet-runner/core decisions, authoritative schemas, memo identity/number allocation if required, receipt source and core report verb. Use ISSUE-001 and the fleet integration plan as explicit correspondence inputs; do not convert them into unilateral changes here.
- Task brief: fleet-runner owns named process identity, recipient roles, session/host event attribution and receipt semantics. Cockpit consumes the ratified read contract and reports unsupported legacy fields honestly. If Q3 chooses a second cockpit write, obtain an accepted ADR and scoped implementation authorization before adding it; otherwise route through an approved core verb. Keep preparation, intent and receipt as separately observed states. A local preview or clicked button cannot manufacture the receipt.
- Potential targets after decisions: `shared/src/handoff-brief.ts`, `work-item.ts`, `server/src/handoff-emit.ts`, `adapters/handoff.ts`, `routes/chat.ts`, `renderer/src/components/chat/HandoffDraftCard.tsx`; core/fleet-runner schema and event producers live in their owning repos.
- Observable success: a real routed draft receives independently read delivery evidence; legacy bare actor strings remain readable; missing identities are explicit; per-emission approval and path safety remain enforced; upstream report response changes the read-side loop without cockpit status mutation. Add no new dispatch path by implication.
- Validation: agreement-specific schema fixtures and end-to-end preparation/approval/delivery scenarios in a disposable target repo; no approval, wrong path, duplicate emission and stale receipt cases. Existing `pnpm test`, `pnpm typecheck`, `pnpm build` remain the cockpit checks. Ratified upstream validators must be run by the owning repo before declaring compatibility.

## Transition discipline

Implementation workers receive one task brief at a time with the baseline commit, source snapshot ID, dependent decisions, owned paths, success demonstration and validation commands. T2 can prepare fixtures while T1 plans its experiment; T3 consumes T2 rather than duplicating derivations. Map/chat work follows the S12/S13 seams. A shared experiment entry, state file or app shell has one owning worker to avoid conflicting writes.

Do not modify a source design snapshot to retrofit current implementation facts. Record discrepancies and newer decisions alongside it, with references to the superseded claim. Claude Design can continue revising prototypes; each handoff revision should state changes since the captured snapshot. Retain source fidelity, identify which revision an implementation targets, and re-run only the affected usability tasks after a revision.

When implementation encounters a plan/reality gap, append the conservative choice to repository `implementation-notes.md` under `## Deviations`. Keep acceptance evidence tied to the actual running artifact and commit. The release claim is a working slice plus checks and operator-observed behavior, not fidelity to a screenshot alone.
