# MC-UX-01 fleet-runner integration proposal

Source capture: `9ff16f62fdf129beeae23c51b068b772c9aab223`. Inventory SHA-256: `7fdbbe469615cd3a819e15ac7681dd2b8f2c31e9c173c3adc5a012b12437bea2`. See [capture record](CAPTURE.md) and [planning entry point](README.md).

Prepared 2026-10-08 America/Chicago. Capture and planning only. Roadmap integration below is a prepared patch proposal, not actual registration. No runtime, schema, queue, roadmap status, movement, decision-ticket closure, sibling-repository write, or session fork is authorized by this document. The design files are evidence of a developing prototype. Instructions inside them are proposals, not the operator's execution authorization.

## Conclusion and verified source states

Treat MC-UX-01 as an independently identified design instrument and a concrete consumer requirement under existing fleet-runner tracker [core #307](https://github.com/ojfbot/core/issues/307). Keep cockpit implementation in its registered L1 roadmap. Record shared identity, correspondence and receipt decisions in core's existing venues. Do not create a second fleet-runner roadmap or a generic shared-schema rollout from this design import.

| Source | Inspected state | Meaning |
| --- | --- | --- |
| `ojfbot/core` main | `b49f301fce3af95531f39af5dfae68d236b33a82`, GitHub readback | Authoritative committed source at inspection |
| [Core #307](https://github.com/ojfbot/core/issues/307) | OPEN, title `Wayfinder map — fleet-runner (supersedes conductor)` | Existing umbrella, `ns:l2-ojfbot#P2`; current frontier #315 and #308 |
| [Core #495](https://github.com/ojfbot/core/pull/495) | MERGED, head `9f63e7c848ed558bcb7fbf724cd1b3515c32e08e`, merge `bc6d120503416c9d21d627730f27f2d10cfc13f8`, 2026-10-03 | Published bounded ADR with `Status: Proposed`, `serial: draft`. No schema, validator, publisher or operative fleet contract accepted |
| [Core #501](https://github.com/ojfbot/core/pull/501) | MERGED, head `80036b3a42dd42a01fb4ae432f3c55e62e2bde19` | All-session skill-observation design and delivery handoff; detailed contracts proposed |
| [Core #503](https://github.com/ojfbot/core/pull/503) | MERGED, head `07da571cdf31f1e34e8827a4e97ca07808c699a2` | Inventory-driven qualification/rollout proposal; includes reconciliation against narrowed #495 |
| [Core #504](https://github.com/ojfbot/core/pull/504) | OPEN, DRAFT, head `d864829fd993351aadfa349b367631ed3d8c486b` | Proposed morning maintenance, voice review and attributed calibration amendments to existing map and L2 roadmap; not operative because referenced by issue |
| `ojfbot/lego-village-pipeline` main | `8aae0d658b0d8ba458f3adcc7ae79d041aaf2298`, register `2026-09-18.33` | Operative register and protocols for play-well cluster; prior art for cockpit, not cross-project governing law |
| Desktop design `MC-UX-01` | `index.json`: date `2026-10-08`, updated `2026-10-09`; status includes interactive prototype and simulated effects | Designer-authored dates remain source claims. Receipt collection time must be separate. Use capture receipt/tree digest as exact-byte identity |

Local core checkouts were dirty or unrelated to current policy, and the local LEGO checkout was stale. Their unpublished branch details are not needed to reproduce this inspection; the remote pins above are the source of record. The local `fleet-runner` directory contains only notes and is not the accepted implementation home.

Accepted ADR-0108 rev A places fleet-runner in core, intended at `packages/fleet-runner`, with independent deployment. Core owns correspondence, identity, grants and review semantics. Cockpit owns its read-model and UI; its standalone/raw-read/one-approved-handoff-emission contract continues. ADR-0109's affected-item publication hold is accepted. Runtime/store/host, human-authority mechanism, source revisions, recovery and exact-state delivery remain unresolved.

## Versioned cockpit capture

The immutable received tree is `morning-cockpit/research/design-handoff-mc-ux-01/` at capture commit `9ff16f62fdf129beeae23c51b068b772c9aab223`, on branch `codex/mc-ux-01-capture` with baseline `1b15bc95fbe7d4fdfa720e7acbae2ada5027871d`. The importer receipt is [CAPTURE.md](https://github.com/ojfbot/morning-cockpit/blob/9ff16f62fdf129beeae23c51b068b772c9aab223/planning/mc-ux-01/CAPTURE.md), with machine inventory in [capture.json](https://github.com/ojfbot/morning-cockpit/blob/9ff16f62fdf129beeae23c51b068b772c9aab223/planning/mc-ux-01/capture.json). Its `inventory_sha256` is `7fdbbe469615cd3a819e15ac7681dd2b8f2c31e9c173c3adc5a012b12437bea2`. This is the parent's verified inventory digest under its recorded recipe; do not mislabel it as the LEGO tree digest. The receipt and `verify-capture.py` define and verify the actual capture algorithm.

The local planning dossier is [README.md](README.md), with [transition-plan.md](transition-plan.md), [verification-plan.md](verification-plan.md), [CAPTURE.md](CAPTURE.md), [capture.json](capture.json), [verify-capture.py](verify-capture.py) and this [fleet-integration.md](fleet-integration.md) beside it under `planning/mc-ux-01/`. These links refer to the reviewed planning PR head; pin that exact commit before a later application. Capture is committed and pushed. This document's roadmap patch remains prepared for a later authorized core session. After the planning commit lands, replace any branch links in a registration PR with that exact planning commit. Commit `9ff16f62fdf129beeae23c51b068b772c9aab223` identifies source capture, not approval of a later plan.

At eventual merge, either preserve the capture/planning commits with a merge commit or replace registration links with the actual accepted `main` commit after squash/rebase. The required registration pin is the accepted capture plus amended planning state, not the original capture-only SHA or `refs/pull/54/head`. Re-run the verifier at that accepted commit. No merge is requested by this amendment.

## Exact contract boundaries and prototype defects

The current [bounded ADR](https://github.com/ojfbot/core/blob/b49f301fce3af95531f39af5dfae68d236b33a82/decisions/adr/draft-correspondence-speech-act-tiers.md) preserves beads and leaves correspondence identity/canonical-state mapping open. D9 explicitly defers exchange schemas and tooling. D7 proposes a trustworthy human boundary that the worker cannot forge; shared `ojfbot` account authorship cannot establish a verified human ruling. These are Proposed requirements, not implemented enforcement.

The [skill profile](https://github.com/ojfbot/core/blob/b49f301fce3af95531f39af5dfae68d236b33a82/decisions/fleet-runner/skill-observation-correspondence.md) includes a 2026-10-03 reconciliation. Its original D1–D12 table cites historical #495 head `62d7d7a4fafa2b7e7209c4c48a4d27c7cd022fbb`; those labels changed meanings. Its typed records, relations and SC01–SC08 cases remain proposed. Read current reconciliation when linking that profile.

LEGO `lego-pipe-memo/v2` is ratified at register `.13` for play-well, with capable `tools/memo_preflight.py` by `.20`. Its schema requires `HANDOFF|CORR|REVIEW-LEGO-PIPE-NNN` identity, `from.actor/role`, `to[].actor/role`, title, authority and register allocation. That identity prefix, allocator and ratification scope cannot be inherited by cockpit.

Findings in captured `design/ds/correspond.js` are concrete blockers to copying it into production:

- It labels a combined `lego-pipe-memo/v2 · fleet-runner profile` operative since play-well register `.13`; no combined cockpit contract was ratified.
- The generated `CORR-OJF-COCKPIT-###` memo fails LEGO v2's identity regex. `to[]` omits required `role`. The preview omits required `title`, and request previews omit conditional `parts`. Placeholder allocation is not an allocated identity.
- Regexes and a limited frontmatter reader detect candidate acts. They cannot authenticate authors, validate nested records, ratify policy or establish delivery. Imperative language inside quoted evidence can misclassify a report; `memo_type: review` can mask a request in its body.
- The code cites historical D2 as report/request classification and current D7 as a proposed amendment without the newer reconciliation. Core's current D2 instead concerns issue creation and authority; current D7 already incorporates the human-boundary prerequisite as Proposed.
- Report composition and Approve & write report remain simulated. Report emission would require a separately accepted cockpit write carve-out or core writer contract. Handoff emission cannot silently authorize report emission, dispatch or policy acceptance.

Preserve these bytes in the import. Put corrections in importer/planning notes and the subsequent design round. A capture commit establishes availability and byte identity; it does not accept the wireframe, settle Q13 or confirm receipt/consumption by an external design session.

## Actor identity and provenance decision inputs

| Design question | Existing venue | Decision or evidence needed |
| --- | --- | --- |
| Q4 and ISSUE-001, actor equals recipient | #315 census; #311 stable portable identity; #313 authority | Enumerate actual actor/to strings and sources. Do not infer that equality means the human owes work. Show unresolved recipient and preserve raw values |
| Q12, agent type/task | #315 census; #310 receipt question remains blocked by #309 | Specify the evidence linking a process to a task/revision and timestamp. Newest-touched bead alone can be a candidate association. Do not add Dolt writes in cockpit |
| Q13, operative correspondence | Bounded #495 ADR venue and #307; separate play-well contract remains operative there | Choose an approved bounded cockpit consumer profile or keep display advisory. Preserve existing bead schema and no automatic issue-per-artifact requirement |
| Q14, route-to identity versus role | #311 and #313 | Declare addressable actor identity separately from role and authenticated sender. A role is not a unique delivery destination or authorization |
| Q15, durable names/session/host | #311 portability and #309 host/reach; #318 independent supervision | Decide roster owner and minting/reuse/rename rules, process/session/work-attempt distinction, host namespace and retention. No placeholder names become real workers |

ISSUE-001 calls a tuple read from frontmatter DERIVED. That confuses collection provenance with verification. Reading a claimed name or host from a file verifies the bytes, not the claim. `origin: repo` should identify the file and revision; an independent assessment must name the exact proposition it supports. Missing names, host/session IDs and unsupported process-to-work links remain unknown.

The prototype itself contains mixed evidence. `WHO.actors['code-claude']` sets `origin: repo` while deriving harness and role from a bare string; its note admits no process/session/host exists. `claude-design-session` supplies a session from brief-body prose. `leo.host` is `packages/server`, a code location rather than a host identity. `WHO.proposed` names Ferrier and Sexton are simulated examples. This is useful UI exploration, not a qualified actor registry.

A later core decision should retain raw actor strings and source references, separately identify provider/harness, named process, run/session, host and scope, and declare which collector or issuer supplied each fact. Preserve the authenticated publisher account independently of the claimed logical actor. Design labels such as DERIVED, ASSERTED and SIMULATED must describe a specific proposition; they grant no permissions and do not settle human authority.

## Capture and correspondence bundle lessons

Adopt the useful mechanics as local capture discipline, without claiming conformance to an unaccepted shared format:

1. Keep the received design tree byte-for-byte. Put importer receipts, inventory, hashes, validation results and implementation proposals outside it. Preserve each later design cut and its predecessor pin; usability revisions must not overwrite earlier reviewed bytes.
2. Identify a cut with logical instrument `MC-UX-01`, immutable local capture key, exact package path, source tree SHA-256, captured commit and source provenance. The source supplies no formal `R0/R1` or typed cut-state manifest, so an importer capture key must not pretend to be a designer revision or an allocated correspondence number.
3. Follow the declared hash recipe. LEGO's `design-package-import/v1` hashes regular-file bytes and POSIX relative paths sorted bytewise through a SHA-256 manifest. A directory received unzipped has no independently verifiable archive digest; use null with unavailable, not a manufactured zip hash presented as source evidence.
4. Retain per-file path/bytes/hash inventory and verify copied bytes. Designer `handoff/index.json` is a prototype contents index, not the complete LEGO designer manifest or a fleet correspondence validator pass. Missing fields remain gaps; do not synthesize a purported designer-authored manifest.
5. Keep importer observation, source claim, review assessment, operator approval, execution grant, local preparation, publication attempt, delivery receipt and consumption receipt distinct. A hash proves byte identity; it does not prove the source author's authenticated identity, design acceptance, safe execution or usability.
6. Keep review object identity explicit. Reviewers must name bundle digest/capture commit plus exact implementation PR head when applicable. Changed bytes need a new reviewed-state pin. Preserve stable finding identities and reply links separately from filenames and screen sheet IDs.

LEGO's governing register is a multi-file authoritative set at main: REGISTER, ALLOCATIONS, KNOWN-ANOMALIES, MIGRATION records and immutable version records. Pending/generated reading views are not authority. Its immutable instrument cut key is instrument+revision+cut state, separate from lifecycle status. The reviewed H-01-R1 overlay documents importer reconstruction, unavailable source archive digest and evidence strength separately. These are proven design-package patterns to discuss in core; they do not appoint LEGO's allocator, create cockpit reservations or require a fleet-wide migration.

## Concrete registration proposal, pending a later authorized core session

Use this body-only amendment in the existing files. No new phase or slice number is allocated here. No roadmap frontmatter changes or compiler invocation is included. The current source pins must be refreshed in the later session; #504 may merge or change before then.

Proposed addition to `core/decisions/wayfinder/control-plane-conductor.md`, after the existing notes and before historical findings:

```markdown
### MC-UX-01 cockpit consumer and design capture, 2026-10-08

The operator requested versioned capture and implementation planning for the evolving
MC-UX-01 design in ojfbot/morning-cockpit. The capture receipt identifies the received
source bytes, immutable cut path and reviewed commit; the planning dossier records
transition and test proposals. Capture does not accept the wireframe, authorize its
implementation or settle the shared correspondence contract.

Use the registered cockpit L1 roadmap for cockpit deliveries. ISSUE-001 and Q4/Q12/Q15
contribute concrete process/session/host and process-to-work identity evidence to #315,
#311/#309 and #318. Q13/Q14 contribute a bounded cockpit-consumer requirement to the
correspondence-speech-act-tiers venue and #313. Preserve the current #310 hosting
blocking edge. Report preparation, item-scoped operator approval, dispatch, source
review, human merge, publication readback and original-action settlement remain
separate, consistent with the maintenance/calibration amendment where accepted.

The current #495 publication remains Proposed. LEGO v2 and its register govern play-well,
not cockpit. Do not ship the prototype's combined correspondence preview as an operative
schema or infer human obligation from actor==to. Keep unavailable identity and task
associations explicit. Reconcile existing skill-observation contracts and S25 before
registering overlapping producer or runtime work. Existing #307 decisions and gates remain
open; this note registers a requirement, not a runtime slice or movement.

Evidence: [cockpit capture receipt](https://github.com/ojfbot/morning-cockpit/blob/9ff16f62fdf129beeae23c51b068b772c9aab223/planning/mc-ux-01/CAPTURE.md)
and [inventory](https://github.com/ojfbot/morning-cockpit/blob/9ff16f62fdf129beeae23c51b068b772c9aab223/planning/mc-ux-01/capture.json),
inventory_sha256 7fdbbe469615cd3a819e15ac7681dd2b8f2c31e9c173c3adc5a012b12437bea2.
The planning dossier is morning-cockpit `planning/mc-ux-01/README.md` at the eventual
reviewed planning PR head. Pin its exact commit before this core amendment is submitted;
resolve its repository-relative path there rather than treating a branch link as a frozen
review object.
```

Proposed addition to `core/decisions/northstar/roadmap-l2-ojfbot.md` in PH5 alongside the placement and maintenance notes:

```markdown
**2026-10-08 MC-UX-01 consumer requirement:** the existing fleet-runner map records
morning-cockpit's evolving design capture and its concrete identity/correspondence
requirements. The cockpit transition plan belongs to rm:rm-l1-morning-cockpit;
shared producer and governed-runtime work belongs here only after #307's applicable
identity, authority, reach, receipt and recovery decisions and S25 overlap are reconciled.
Add later bounded slices with real owners/checks after entrance review. This note allocates
no slice, changes no S25 frontmatter, dispatch eligibility or movement, and creates no queue.
Link the immutable capture receipt and planning dossier, not the mutable desktop folder.
```

Use the actual existing property `ns:l2-ojfbot#P2`, "Every app's daily work traces to a measurable property," for initiative alignment. Its inspected definition has `current: 30`; S25's historical expected range is 35 to 36. Do not copy either number into a new movement claim. Lint/odometer and operator evidence determine later values. Core registry already has `l1-morning-cockpit`, `rm-l1-morning-cockpit` and `rm-l2-ojfbot`; no new northstar or parallel roadmap is needed.

S25 is still `ready`, `human_only`, `gate-0` at the inspected main, with check `node scripts/trace-join.mjs --latest`. Its criterion is narrower than fleet-runner and is not proof that the prototype's dispatch button is safe or wired. Do not change its status from this capture. Issue/PR gates belong in prose entrances; roadmap `depends_on` accepts a resolved `rm:<slug>#S<n>` reference, not an invented issue or capture key.

Before registering a formal implementation slice, resolve a real phase/id using the canonical roadmap, select one existing property, set evidence-grounded movement with the owner, identify implementation owner and accepted entrance, choose `queued` until the entrance clears, and add a meaningful public-boundary check. Unattended eligibility requires the established compiler/check rules and accepted grants. Planning labels below are not assigned slice IDs.

## Future task briefs and handoff sequence

| Planning task | Owner at pickup | Deliverable and completion evidence | Blocking dependencies |
| --- | --- | --- | --- |
| Refresh and reconcile registration | Core/fleet-runner planner | Fresh main/#504 pins; body-only map/L2 patch linked to immutable cockpit receipt and transition plan; existing roadmap lint passes after an authorized registration PR | Later core session authorization; no runtime required |
| Audit actors and recipients | Core census planner with cockpit consumer reviewer | Selected real sources, population/unknown denominator, field-level provenance, ambiguous equality cases, process/session/host distinctions and Q4/Q12/Q15 dispositions | #315/#311/#309 venues; no collector/schema implementation assumed |
| Reconcile bounded correspondence consumer | Core contract owner with cockpit planner and design counterpart | Compare current bounded ADR/profile against prototype; choose accepted format or explicitly advisory display; role/address mapping, author/account separation and acceptance tests | #495 venue, #313 authority, Q13/Q14; separate experiment authorization and registration |
| Specify preparation/approval/delivery UI | Cockpit planner with fleet publication reviewer | Observable states, exact reviewed subjects, existing handoff-only write boundary, report-write decision, unknown publication state and original-work settlement links | Accepted producer/consumer contract and grants; ADR-0109; #316/#318; Q3 report emission |
| Qualify one bounded identity projection | Assigned implementer after registration | A real source-to-read-model-to-UI demonstration plus positive/counterexample cases for stale/missing/conflicting identity, same harness distinct processes and unsupported task associations | Registered cockpit slice; any producer change independently registered in core; do not broaden to runtime |

### T1–T7 ownership and entrances, reconciled 2026-10-10

This incorporates the [qualified Codex crosswalk](https://github.com/ojfbot/morning-cockpit/pull/54#pullrequestreview-5465329055). The tasks can progress independently where their stated entrances clear; they are not one serial core dependency, and T1–T6 are not collectively ungated read-only work.

| Task | Cockpit home / independent portion | Entrance or separately gated work |
| --- | --- | --- |
| T2 evidence projection | Existing S11; preserve source/repo/native identity before aggregation and use one declared count population | Implementation authorization; retained ambiguity/degraded evidence; public read-contract changes need owner review. Q4/Q12/Q15 stay unknown |
| T1 E/D comparison | Opt-in comparison using the bounded T2 projection | T2 fixtures and implementation authorization. Q2 stays open; exclude inherited write controls |
| T3 decision-item legibility | Metadata inspector and keyboard navigation in S11/S18 | T2 evidence; process peek needs qualified identity; reused action controls need truthful claim/emission states |
| T4 shell adoption | Compare existing and experimental views; reconcile S14 | Operator Q2 ruling and observation record before default replacement or S14 supersession |
| T5 fleet/scoped navigation | S12, then S13/S15; reuse S10 registry and selectedRepo | Reconcile S10 status and S19 absence. Process details need Q15; `/draft-handoff` remains the approved ADR-0005 write; core claims use accepted ADR-0010 |
| T6 reading sitting | Existing News/Papers and browser-local preferences; preserve S16 deferral | Q19 Community access, Q20 registry writes, Q6 intake-as-work and new producer/storage choices are separate decisions |
| T7 preparation/routing/delivery | Local advisory preparation until producer/profile/authority is accepted | Q3/Q13/Q14/Q15; core #311/#313/#316/#318 and correspondence venue; host #309 before receipt probe #310 where needed |

A later cockpit L1 amendment can reconcile its delivered/status and PH4 prose discrepancies without waiting for a deployed fleet-runner. Core map/L2 registration is a separate authorized change. Issue/Q entrances remain prose; no placeholder `depends_on`, new slice, readiness or movement is registered here. The operator-confirmed first-slice criteria in the linked review remain proposals requiring their own implementation authorization.

Read-only presentation can proceed with explicit unknowns when its own entrance clears. Cockpit experiments continue on separately captured prototype cuts. Feed corrections into the next design cut while keeping the original capture unchanged.

Required future test boundaries include copied-byte integrity, new cut versus old cut, missing origin fields, same harness/different process, stale or conflicting task association, actor/to equality with unresolved recipient, request hidden inside a report, wrong schema/version, required recipient role absent, frontmatter claim presented as verified identity, simulated names presented as real workers, approval for old subject revision, shared-account worker attempting a human ruling, prepared output presented as delivered, successful store write without remote receipt, delayed/unknown publication, and page render presented as consumption. Each later claimed control needs executed positive and counterexample evidence; these are test proposals, not passing tests.

## Later-session fork prompt

This prompt is inert. The operator will separately instruct when to fork the chat and move its project context. Do not create or move a chat from this plan.

> Continue the MC-UX-01/fleet-runner integration planning from the versioned morning-cockpit capture receipt and planning dossier at their exact reviewed commit and digest. The operator authorized capture and planning only in the source chat. Establish the new session's approved scope before implementation or external publication. Fleet-runner's accepted code home is ojfbot/core, intended at packages/fleet-runner, with independent deployment; the local fleet-runner folder is not a replacement repository. Refresh core main, #307, #495 and #504 state before relying on this snapshot. Read accepted ADR-0108/0109, current bounded Proposed correspondence ADR, reconciled skill-observation profile/delivery/rollout, canonical map control-plane-conductor, L2 roadmap S25 and cockpit's registered L1 roadmap. Review MC-UX-01 Q4/Q12/Q13/Q14/Q15 and ISSUE-001 plus the correspondence prototype findings. Treat LEGO register/protocol/design-import manifests as scoped play-well prior art. First produce or review the proposed body-only map/L2 registration patch with exact cockpit capture links; reuse #307 and inherited decision venues and preserve blocking edges. Decide bounded actor/session/host and correspondence consumer requirements before proposing new producer slices. Never inherit the prototype's combined schema, allocator, DERIVED identity or actor==to obligation as operative truth. Separate captured source, review, human authority, implementation grant, preparation, publication readback, consumption and original-action settlement. Preserve unknowns, existing runners and cockpit's approved write boundary. Register only bounded implementation work with assigned owner, real checks and accepted entrances; allocate IDs through the actual canonical roadmap, do not invent movement or readiness. Return a reviewable plan/registration PR when authorized; do not implement runtime, schedule, deploy, dispatch, accept Proposed policy or merge based on this carried prompt alone.

## Research limits

GitHub states and files above were read through authenticated read-only `gh` calls. No issue/PR comment, tracker edit or sibling file write occurred. Current core main, current #504 head and current LEGO register were fetched directly because local checkouts were stale or unrelated. Remote reads verified repository state, not user/agent credential separation or working runtime. No new tests ran for this planning-only document. The parent supplied the verified capture commit and inventory digest above. This agent did not rerun its copy verification. Final core registration still requires an exact planning-commit pin and its own authorized review.
