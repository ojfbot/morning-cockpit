# MC-UX-01 verification and usability plan

Source capture: `9ff16f62fdf129beeae23c51b068b772c9aab223`. Inventory SHA-256: `7fdbbe469615cd3a819e15ac7681dd2b8f2c31e9c173c3adc5a012b12437bea2`. See [capture record](CAPTURE.md) and [planning entry point](README.md).

Status: planning only. This pass read source files and test definitions. It did not run application tests, capture live endpoints, execute prototypes, install dependencies, write live beads, or change application code. Commands below are proposed checks, not reported results.

## Baseline and evidence

The implementation baseline is morning-cockpit commit `1b15bc95fbe7d4fdfa720e7acbae2ada5027871d`. The current checkout has unrelated PR Train changes in App, API client, styles, server configuration/index, shared exports, and new PR Train files. Record their status and use an isolated checkout of the agreed integration base. A test in this dirty checkout does not prove baseline behavior. If PR Train lands first, record the new integration commit and repeat checks affected by that integration.

The desktop handoff is an evolving design snapshot. Its embedded roadmap is source material, not permission to implement. Preserve its supplied 2026-10-09 revision labels, although the client date for this planning pass is 2026-10-08 in America/Chicago.

Reuse CONTEXT.md's Pod, Index Skeleton, Context Attachment, Handoff Emission, and grounding discipline. Validate "loop", "room", "who chip", and "correspondence field" before introducing production types. `/api/loop` currently means skill/capture telemetry, not the proposed promise/outcome ledger. Keep those meanings distinct in code and tests.

The eight briefs in `design/data/snapshot.js` are hand-read historical morning-cockpit source material. Other values include dated registry facts, screenshot-derived totals, authored cluster judgments, and simulated interactions. It is useful as a design fixture, not as an eight-item live fleet capture. Other-repo counts have no matching full brief set. Do not certify historical ages, liveness, Last Looked, agent task/type, or progress as live evidence.

Create two separate fixture sets before implementation:

1. Preserve the design fixture with explicit historical/simulated labels and fixed AS_OF. Record bundle revision, checksums, sources and missing coverage.
2. Capture timestamped read-model responses from the agreed committed server. Record endpoint, HTTP status, raw body, generatedAt, health, capture time and provider configuration. Retain failed responses. Review local paths and conversation data before committing; do not include raw chat history in a generic fixture. Never call approve, claim, stage, clear or delete during capture.

Compare shapes and coverage, not live totals against historical eight/forty-two/six/three values. A mismatch report must list missing fields, unjoined IDs, same native ID across repos, source coverage, generation-time skew and degraded adapters. If a live capture is unavailable, Q1 remains pending. Do not substitute invented data.

## Contract inventory and discrepancies

Relevant baseline reads are GET `/api/cockpit`, `/api/health`, `/api/fleet`, `/api/fleet-structure`, `/api/critical-path`, `/api/delivery`, `/api/loop`, `/api/reading`, `/api/reading/digest`, `/api/papers`, `/api/papers/explainer`, `/api/papers/deepdive`, `/api/papers/suggestions`, `/api/briefing`, `/api/briefing/stream`, `/api/chat/context`, `/api/chat/registry`, `/api/chat/history`, and `/api/chat/handoff/drafts`. `/graphql` has a query-only facade.

Inventory existing side effects separately: POST chat, DELETE chat history, draft/approve/reject, POST briefing emit, POST claim, and POST/DELETE paper suggestions. This inventory is evidence of baseline behavior, not authorization to add writes. Supplied project prose about a single upstream carve-out needs reconciliation with the committed core claim path. Preserve baseline behavior and get the relevant owner decision before any extension. Acceptance tests use temporary repo/data roots and stub external transports/core verbs; they never exercise live side effects.

Important discrepancies:

- The handoff adapter computes closure with `responding_to` internally but does not expose that field on WorkItem. It exposes `detail.to`, `detail.openHook`, `provenance.refs` and folded `chain`. Exact outcome provenance needs an additive read contract or dedicated read model.
- Some design prose says `responds_to`; correspondence preview uses `in_reply_to`. Neither alias silently closes a production loop. Require an explicit normalization decision.
- `/api/fleet-structure`, selectedRepo and per-repo northstar threads already exist. Reuse them; the design's missing-adapter/thread assumptions are stale.
- `to: code-claude` plus `actor: code-claude` is ambiguous. Do not classify every such brief as waiting on the operator.
- Agent task/type/process/session/host can be absent. Show unknown. Shared-account strings do not establish a process or decision authority. Derive liveness from event recency, never agent_status.
- Reading feeds already come from `sources.yaml` under ADR-0015. Q20's claim that News feeds are in code is stale.
- Actual synthesis configuration uses `ollama | claude | off`; supplied AGENTS mentions Codex. Verify configuration against ADR-0003 before publishing environment examples. Explicit paper deep-dive is an existing cloud path, never an automatic READ action or fallback.

## Acceptance matrix

Every check below is planned. Existing package scripts contain Vitest, not a Playwright dependency/browser-test command. Decide on a browser runner separately. Until then, execute the same browser steps as a recorded manual protocol with screenshots and an interaction log.

| Design screen or question | Runnable check | Pass criterion |
| --- | --- | --- |
| Current State | Capture baseline using the same fixture and viewport; walk Briefing, selection, lanes, chat and health. | Existing behavior remains reachable on default route with flag off. Logs pin commit, fixture and health. |
| Open Loops, Q1/Q4 | Pure selectors and adapter tests on handoff/Dolt fixtures, reports, missing recipients, duplicate IDs across repos, successors, dangling refs, cycles, empty/degraded data. Extend existing decided/handoff behavior tests. | Source/repo/native ID identifies each item. Folded chains remain one Pickup item. Closed-successor reversion still works. Unknown ownership stays unknown. All visible counts equal the selector's counted IDs. |
| Open Loops diff | Fixed-clock tests for missing/malformed/future lastLooked, exact cutoff, invalid timestamps, timezone offsets and stale capture. Browser arrive, acknowledge, refresh, revisit. | Declared boundary semantics are stable. Acknowledgement only updates local UI state. Source work is unchanged; subsequent activity appears on refresh. |
| Work Graph and v2, Q7 | Registry/census disagreement, absent core checkout, unregistered repo; filter, select, pan/zoom/reset and inspect source. | Filtering dims rather than removes. Graph selection drives existing selectedRepo, Briefing and scoped chat. Badges share counted IDs with ledger. Missing registry facts remain visible gaps; authored edges remain ASSERTED. |
| Graph interaction | Keyboard node selection and controls, Escape; touch pan/zoom; 320/768/1280px and 200% zoom. | All selectable nodes have names and visible focus. Keyboard users reach the same inspector without dragging. No page-wide overflow or unreachable rail. Arrow navigation remains an explicit design follow-up if deferred. |
| Adaptive First Light, Q2/Q5/Q11 | Fake clock at 04:59/05:00/10:59/11:00/16:59/17:00/21:59/22:00 in America/Chicago; DST change, override and refresh; Work on it and Not today. | Clock proposes and never interrupts active notes/reading/draft. READ is never clock-selected. Override behavior is declared. Deferral is local and counted, never closure. Room names stay experimental until decided. |
| Adaptive The Desk | Rapid repo switches with delayed replies; per-repo notes/drafts, global and northstar history; Resume. | Late replies cannot overwrite current repo. Notes and drafts do not leak across scopes. selectedRepo is the sole focus. Resume opens actual evidence or remains SIMULATED. |
| Adaptive Last Light, Q3/Q13/Q14 | Three fields, speech-act detection, pasted-source provenance, recipient warnings, preview/cancel, double-click, failure/retry using temporary roots. | Preparation writes nothing upstream. Schema/allocator remain pending until ratified. Warnings cannot grant authority. PREPARED/INTENT never means RECEIPT/delivered/closed. Simulated reports cannot increase real metrics. Existing Handoff Emission approves the current preview and reuses validation. |
| Night Watch, Q12/Q15 | Event-recency boundaries; stalled/zombie/dark; missing task/type/process/session/host; source inspection. | Unknown identity stays unknown and proposed identity is labeled. agent_status is never liveness. Bare account IDs do not establish independent processes or authority. |
| Reading Room, Q6/Q16–Q20 | READ entry; fixed 10/20/30-minute timer, extension/return; fits-first/oldest-first; oversized items; local add/keep/skip; keys 0–6 with text-input guard; failed source fixtures. | Timer does not duplicate after mounting/refresh. Budget/order are reproducible. Oversized items appear separately. Suggestions are not wired sources. Course/Textbooks remain later/manual; Community stays blocked without access. No invented items or automatic loop creation. Player/digest links honor their stated contract. |
| Reading registry | Existing sources tests; only if registry changes, source verification, generated OPML and diff review. | One sources.yaml serves reading/watch with pod membership intact. Failing endpoints enter quarantine with a reason; no unfetched substitute and no hand-edited OPML. UI source edits stay local until a separate configuration-write decision. |
| Chips and dossier | Click/Enter/Space; nested chips, Back/breadcrumb, Escape and outside click; viewport edges; who hover/focus peek. | One named dialog/popover has declared semantics. Focus enters interactive card and returns to origin. Escape closes top card before clearing selection. Peek is noninteractive, never traps focus or competes with pinned card. |
| Design System/Dossier, Q10 | Compare tokens, badges and source links to authoritative Markdown; light/dark, density and contrast screenshots. | Artifact ownership stays pending until decided. Numerical/identity claims have source evidence. DERIVED/ASSERTED/SYNTH/SIMULATED stay distinct. Model prose does not execute verbs. Red identifies a human decision rather than reading/progress decoration. |
| Local-only failure | Stub Ollama timeout/refusal/malformed/empty result and abort; provider off; spy on cloud transport and SSE frame order. | Deterministic floor appears without waiting. Fallback is honest and makes zero automatic cloud calls. Deep-dive remains separate. Empty lanes have no invented summary. Failed adapters expose health. Existing Loop rates/population suppression remains intact. |
| UI storage | Extend cockpitState tests for old v1, legacy chat key, prototype keys, schema version, corrupt data and denied/quota storage. | Preserve theme/density/accent/selection/thread preferences. Never migrate simulated approval/receipt/closure into real state. Notes/deferrals/reading/lastLooked migration is validated, versioned and idempotent. Storage failure leaves UI usable; rollback reads its prior key. |
| Routes/rollback | Flag on/off, proposed hashes, reload/deep link, unknown hash, back/forward and flag disabled with stored room. | Baseline default works. Prototype reads use existing contracts. Disabling flag restores baseline and never replays approvals/claims. Design support.js and prototype runtime do not become production dependencies. |
| Responsive/reduced motion | Keyboard at mobile/desktop, long titles, 200% zoom, reduced-motion emulation, rapid changes. | Actions remain reachable, focus order matches layout, cards fit viewport, transitions never block actions and honor reduced motion. Color is not the sole status signal. |

## Execution sequence for an implementation pass

Use pnpm and Node at least 20.19, preferably the pinned version. No installation or full-suite execution is required for this docs-only pass.

1. Record the clean integration base. Run relevant existing tests before edits. Available commands are `pnpm --filter @cockpit/shared test`, `pnpm --filter @cockpit/server test`, and `pnpm --filter @cockpit/renderer test`. Start with targeted behavior files when scope is narrow.
2. Add literal expected outcomes for source-to-selector-to-render counts, stale-response scope, local migration and current-preview approval. Avoid tests mirroring internal implementation.
3. Run changed-package tests, `pnpm typecheck`, and `pnpm build`. For read-contract edits, run schema parity/facade/contract checks and `pnpm --filter @cockpit/server contract:check`; inspect generated diff rather than blindly syncing.
4. Run browser protocol against deterministic fixture server with transports stubbed and temporary repo/data roots. No real Dolt mutation, queue claim, cloud call, correspondence delivery or .handoff write.
5. Run a read-only live-data walk for Q1 after fixture checks pass. Record health and unresolved questions. This walk cannot certify report emission/delivery.
6. Exercise rollback. Report exact commands, exit codes, commit, fixture hashes and limitations. A screenshot does not prove data accuracy or approval behavior.

Existing regression anchors are shared lanes/liveness/decided/summarize/reading/loop; server handoff/handoff-emit/fleet-structure/chat-store-threads/chat-context/SSE/briefing-generate; schema parity/facade-invariants/contract-check; renderer cockpitState/FleetSection/Briefing/WorkItemCard. No tests were executed in this pass.

## Usability experiments and shell gate

Treat the evaluation scores as hypotheses. Compare Current State, Open Loops and Adaptive Workspace using the same full fleet capture. Rotate task order between sessions. Keep historical design-fixture runs separate so live fleet changes do not confound revised interactions. Record bundle/fixture checksum, timezone, viewport, task, room, health, actions and outcome. Repeated operator runs are not independent participants.

| Operator task | Metric and initial pass target |
| --- | --- |
| Find principal developments | Under two minutes; name actual changes and open supporting evidence. Record time, prompting and incorrect claims. |
| Choose three consequential actions | Identify three existing items, owner and next verb. Zero invented ownership or implied delivery. |
| Resume interrupted project | Identify open question and next slice without outside reconstruction. Record time to useful context, navigation steps and missing evidence. |
| Discover cross-repo relationship | Find cited relationship and identify authored versus derived. Visual proximity alone does not count. |
| Explain agent work | Name activity evidence and unknowns. Fabricated process identity fails. |
| Short daily review | Three lines plus preview under three minutes without coaching. Record prepared/delivered confusion. Until Q3 is decided, success ends at preview. |
| Find technical evidence | Reach a source for an insufficient summary and return with focus intact. Record dead ends and accuracy. |

After technical checks pass, run one week of operator observation. Log clock-proposed room, chosen room, voluntarily supplied reason, time/timezone, active repo and interruption. Record lastLooked separately. Completion rates require logged task starts/outcomes; clicks alone do not prove success. Keep telemetry local in agreed storage. A new JSONL writer or Loop ingestion is an implementation decision, not permission from this plan. Existing Loop rates remain suppressed without capture-quality verification.

The shell gate is the operator's explicit choice backed by task runs and override evidence. Adopt rooms only if they preserve orientation and continuity while meeting two-minute arrival and three-minute review targets without hidden work or unwanted switching. Prefer grouped loops if rooms obscure waiting items or create failed navigation. READ remains explicit in either candidate. Frequent overrides indicate a weak clock heuristic; retain last room or use one-page default if appropriate. Do not invent percentage thresholds from one week of one-person data.

Reports/briefs ratio stays descriptive until populations and windows are defined. Deduplicate by source/repo/ID; separate created, prepared, delivered, accepted and actually loop-closed outcomes; record zero denominators. A ratio near one can come from unrelated reports or reduced intake. Require linked backlog closure before claiming improved capture.

Claude Design revisions continue through immutable bundle revisions and a delta log. Each round pins its hypothesis, fixture, observations and decision. Do not overwrite accepted references or silently change the implementation target during testing. Keep Q2/Q3/Q4/Q13/Q14/Q15/Q19 pending until their owners resolve them.

## Fleet-runner evidence handoff

The later fleet-runner session receives this plan, pinned design manifest, baseline mismatch report and asked-by provenance issue. Fleet-runner acceptance covers operative schema/version, recipient vocabulary, unique process identity, register/allocator ownership, idempotent delivery and receipt semantics. Morning-cockpit owns truthful display and approval integration. Proposed receipts do not prove delivery. This planning pass changes no fleet-runner roadmap state, northstar score or schema ratification.
