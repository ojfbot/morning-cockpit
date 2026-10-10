# MC-UX-01 evidence inspector — validation record

Validated 2026-10-10 in America/Chicago against the isolated worktree branch
`codex/mc-ux-evidence-inspector`.

## Pins and scope

- Implementation base: `baf1d1139ade33eae9126260f8f8e88b09752d50`
- Validated implementation: `aa9a63d5e4f4f5f92d72e5bfbc505afe276e5dfa`
- MC-UX-01 planning source: draft PR #54 at
  `5078639b2e752c3e1fa7125288201a2ccfef8424`
- Core comparison source: read-only checkout at
  `8d90aad84d5ed2115a0a83a4049af616fbb65489`
- Scope: the bounded T2/T3 vertical slice — typed metadata-only handoff evidence on
  `GET /api/cockpit`, collision-safe read coordinates and consumers, an in-place evidence
  inspector, and source-safe Briefing claim routing needed by the new collision contract.
- Explicitly outside scope: shell selection, report delivery, correspondence ratification,
  process identity, fleet-runner dispatch/receipt/settlement, roadmap mutation, and core writes.

The primary checkout and core checkout were not modified. No live claim, emission, dispatch,
cloud call, or Dolt write was used during validation.

## Verdicts

### Spec: PASS

The dedicated contract reviewer found no critical, significant, or minor issue in the exact range
`baf1d1139ade33eae9126260f8f8e88b09752d50..aa9a63d5e4f4f5f92d72e5bfbc505afe276e5dfa`.
This technical PASS does not accept the deferred REST diagnostic policy/owner gate.

### Standards: PASS WITH NOTES

No blocking standards finding remains. The slice stays local-first and read-only except for the
pre-existing, explicitly approved Briefing emission/claim paths. New claim routing fails closed:
the server derives a REST/SSE-only list of qualified Dolt thread IDs, the model cannot author
source identity or mutation routing, and GraphQL/core contracts remain unchanged.

Notes:

- No `@frame/eslint-plugin` or repository ESLint configuration is present, so there is **no
  automated lint result** to report. Typecheck, build, focused contract checks, diff checks, and
  behavior tests are the applicable automated standards evidence.
- No dependency or lockfile changed.
- No authentication boundary changed. This is the existing local server surface; no new remote
  authorization model is implied.
- No new ADR was added. Long-term REST compatibility and owner acceptance remain explicitly
  deferred in `decisions/open-unknowns.md`; accepting the diagnostic shape is a merge gate, not a
  conclusion of this validation.
- `/verify` is not available in this session. Repository verification commands and the recorded
  browser protocol were used instead.

## Acceptance evidence

| # | Criterion | Executed evidence | Result |
|---|---|---|---|
| 1 | Equal native IDs across repositories and sources remain distinct. | `lanes.test.ts`; `handoff-evidence.test.ts`; real `cockpit-rest-evidence.test.ts` with colliding Dolt and handoff rows. | PASS |
| 2 | Each observation has stable source, repository, native ID, and repository-relative path coordinates. | `source-record.ts`; adapter assertions in `handoff-evidence.test.ts` and REST integration assertion. | PASS |
| 3 | Finalization deduplicates only the same source record and preserves lane priority. | `lanes.test.ts` qualified-collision and repeated-observation cases. | PASS |
| 4 | Missing, ambiguous, tied, and cyclic relations are typed diagnostics rather than guessed lane state. | `decided.test.ts`; `handoff-evidence.test.ts`; inspector partial/unresolved rendering test. | PASS |
| 5 | A uniquely supported `closes:` chain folds once. | Existing and extended `decided.test.ts` chain cases plus handoff adapter regression suite. | PASS |
| 6 | Closing the successor ends derivation so the predecessor can reappear. | `decided.test.ts` closed-successor case. | PASS |
| 7 | Named population list, total, and per-repository counts derive from the same records. | `handoff-evidence.test.ts` exact population/count assertion. | PASS |
| 8 | Evidence contains frontmatter metadata only; record bodies are not read or returned by the inspector. | Streamed-frontmatter adapter; REST SHA-256 before/after test; payload body-exclusion assertions. | PASS |
| 9 | Missing recipient and process identity remain explicit unknowns. | `EvidenceView.test.tsx` null-recipient assertion; modal renders `Unknown` and `Verified process identity: Unavailable`. | PASS |
| 10 | Coverage distinguishes complete, partial, and unavailable and fails closed on discovery/adapter errors. | `handoff-evidence.test.ts`; `aggregate-evidence.test.ts`. | PASS |
| 11 | Opening/filtering evidence does not change the app repository focus. | `EvidenceView.test.tsx`; keyboard/manual browser walkthrough. | PASS |
| 12 | Repository focus changes only through the explicit Focus action. | `EvidenceView.test.tsx`; manual Focus action changed the Briefing caption to the selected repo. | PASS |
| 13 | Exact-key selection clears when a record disappears; colliding records cannot inherit chat or Briefing state. | `EvidenceView.test.tsx`; `chat-context-collision.test.ts`; chat/Briefing shared tests; Ollama qualified-routing test. | PASS |
| 14 | Inspection introduces no source mutation, claim, emission, dispatch, or authority inference. | Read-only fixture hash test; facade invariant tests; claim routing tests; dedicated fleet/core review; no new POST route. | PASS |

## Automated execution

All commands ran from the isolated worktree. The managed worktree has no sibling `core` checkout,
so the repository-documented read-only `CORE_REPO` override was required for the SDL drift gate.

```text
CORE_REPO=/Users/yuri/ojfbot/core pnpm test
  shared:   15 files, 185 tests passed
  server:   17 files, 64 tests passed
  renderer:  9 files, 40 tests passed
  watch:      5 files, 64 tests passed

pnpm typecheck
  4 workspace packages passed

pnpm build
  4 workspace packages passed; renderer production build completed

CORE_REPO=/Users/yuri/ojfbot/core pnpm --filter @cockpit/server contract:check
  GraphQL code generation completed; generated diff empty

git diff --check
  passed
```

Focused review corrections also ran independently: mixed-source REST, chat body isolation,
Briefing server grounding, GraphQL parity/drift, evidence interactions, Dolt-only claim routing,
and lost-claim presentation.

## Browser walkthrough

The running fixture build was inspected through the desktop browser at a 900 × 900 viewport.
Inline screenshots were captured during the session for:

- light theme with the expanded Evidence panel;
- dark theme with the expanded Evidence panel;
- dark-theme evidence modal showing repository-relative source reference, authored fields,
  timestamps, and unavailable verified identity.

Keyboard Enter opened a record. Escape closed the modal and returned focus to the exact opener.
Opening and filtering did not change `selectedRepo`; the explicit `Focus asset-foundry` action did,
and the Briefing caption changed to `scoped to asset-foundry`. No fetch was initiated by opening the
metadata inspector. The screenshots were inline session evidence and were not committed as image
files; there is no existing Playwright/browser screenshot harness in the repository.

## Dedicated review cycles

- Pre-implementation contract review: PASS WITH NOTES.
- Pre-implementation fleet/core boundary review: PASS WITH NOTES.
- First post-diff reviews found incomplete discovery coverage, a mixed valid/unresolved fold,
  source-identity leaks in chat and Briefing state, and deleted implementation-note history.
- Focused correction reviews then found the pre-existing ID-shape queue-claim guess and model-authored
  Briefing routing. Those were replaced by opaque record selection plus server-derived routing.
- A proposed shared `BriefingArtifact.source` field was rejected because it would advance a
  core-owned GraphQL contract. The final design keeps routing metadata REST/SSE-only and preserves
  byte-identical core/vendored SDL.
- Final fleet/core review of the validated SHA: no findings.
- Final contract review of the validated SHA: PASS with no findings.

No review accepted the deferred policy/owner gate, changed core, or authorized a merge.

## Rollback and limitations

Rollback is a branch/PR revert: remove the additive evidence payload, inspector component/styles,
qualified consumer keys, and REST-only Briefing routing metadata. There is no data migration, new
database state, or new persisted artifact format to unwind. Existing `nativeId` values and handoff
`closes:` refs remain the mutation addresses.

Limitations:

- Fixtures prove the contract; this pass did not commit a raw live-fleet capture because local paths
  and conversation metadata require separate review.
- The inspector deliberately does not establish process identity, recipient authority, receipt,
  delivery, settlement, or loop closure.
- REST compatibility beyond the current renderer is not accepted yet.
- Screenshots are session evidence rather than durable binary artifacts.
- Shell adoption, seven-task operator comparison, and a week of override observation remain future
  MC-UX work and are not implied by this bounded T2/T3 slice.
