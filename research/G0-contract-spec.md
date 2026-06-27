# Spec — G0: Schema audit + read-model contract (core-authored SDL → codegen)

Feature spec for Slice **G0** of the dashboard-UX rollout (`dashboard-ux-rollout-gated-slices.md`,
Track G). Decisions of record: **ADR-0011** (GraphQL read-model), **ADR-0013** (core-authored SDL,
codegen'd into the cockpit facade), **ADR-0001** (standalone, read-only, mirror-don't-import —
*extended*, not superseded). Plan only — no implementation code. Execute via `/plan-feature` →
`/tdd`. This is the **gating** slice: F2, L1, L2 all land on the contract it pins.

## Problem statement

The dashboard-UX flows multiply the read surface (repo-scoped briefings, tile links, runtime
liveness, popover payloads). Today each new shape would be a bespoke REST route returning ad-hoc
JSON (`routes/fleet.ts`, `routes/briefing.ts`, … wired in `packages/server/src/index.ts:16-22`),
and the only typed contract is the **hand-authored** `@cockpit/shared` view-model
(`packages/shared/src/{fleet,briefing,liveness,work-item}.ts`). There is **no GraphQL, no SDL, no
codegen, and no drift test** anywhere in either repo today (verified: core has zero `*.graphql`).

Per ADR-0013 the fix is one **canonical SDL authored in core** (the fleet-wide authority), with the
cockpit facade's types **codegen'd from it** — strict at compile time (generated types won't compile
against a stale shape) *and* run time (an introspection / regenerate-and-diff CI gate fails the build
on any divergence from the *served* contract). No runtime dependency on core; the SDL is fetched at
CI via git-clone (the ADR-0030 sibling-clone precedent). G0 produces **the SDL + the codegen/drift
mechanism**, not the running facade (that is G1).

**Assumptions made explicit:**
1. "Core authors the SDL" = a new committed artifact in the **core** repo (net-new — core has no
   GraphQL). G0's core PR adds it; the cockpit PR adds the codegen + drift gate that consumes it.
2. The SDL describes the **existing `@cockpit/shared` view-models** (RepoCard, BriefingThread,
   WorkItem, AgentLiveness …) — it is a typed seam over the current aggregate, **not** a new shape
   or a second source of truth (ADR-0011 #1).
3. Query-only. No `Mutation` type. The sole write path stays Handoff Emission (ADR-0005).
4. G0 pins the **shape**; it does not require the briefing *contents* to be production (those remain
   the ADR-0007 generated-threads work). Forward-declared fields (e.g. briefing `repo`) are pinned
   now so F2/L1/L2 land on them without re-cutting the SDL.

## C0 audit — which shapes are stable enough to pin; churn risks named

**Stable → pin now (source: `packages/shared/src`):**
| SDL type | Backing view-model | Stability |
|----------|--------------------|-----------|
| `RepoCard` (name, role, phase, openCount, lastActivity, liveness, here) | `fleet.ts RepoCard` | **stable** — shipped, drives Fleet today |
| `Liveness` enum `LIVE/STALE/DARK` | `fleet.ts Liveness` | **stable** |
| `AgentLiveness` (agentId, state, lastEventAt, lastEventType) + `AgentLivenessState LIVE/IDLE/DARK` | `liveness.ts` | **stable** — S2 shipped (ADR-0008) |
| `WorkItem` core fields (id, nativeId, source, kind, status, lane, title, repo, activityAt, staleDays, url) | `work-item.ts WorkItem` | **stable** core; `posted/claimedBy/leaseUntil` are S3/S4-recent but landed |
| `BriefingThread`/`BriefingBranch`/`BriefingArtifact`/`BriefingSnapshot.source` | `briefing.ts` | **shape stable**; *contents* still mock until ADR-0007 Slice 3 |

**Churn risks → pin as forward-declared / extensible, do NOT freeze contents:**
1. **Briefing repo-scoping (F2).** `BriefingSnapshot` is **global** today — no `repo` field; threads
   are generated globally (`briefingFallback`). F2 adds `briefing(repo:)` + per-repo generation.
   → **Pin a `repo: String` field + a `briefing(repo: String): BriefingSnapshot` query now** so F2
   lands on it. Contents (per-repo threads) come in F2.
2. **Tile links (L1).** **Net-new** — no link shape exists; `fleet-config.ts REPO_META` has only
   name/role/phase. → Pin an **extensible** `RepoLink { kind, url, label }` list on `RepoCard`;
   actual URLs are L1.
3. **Popover payload (L3/L3s).** Contents **deliberately deferred** to the L3s spike (ADR-0012 #7).
   → Pin a **placeholder** `RepoPopover` type (extensible, contents TBD) — do **not** model fields
   the spike hasn't chosen.
4. **Ownership inversion (the load-bearing audit finding).** `@cockpit/shared` is **hand-authored
   and is the current source of truth** for renderer+server. Making core the SDL authority inverts
   this. Two ways to reconcile (see Open Questions Q1) — G0 recommends the *lighter* one: keep
   `@cockpit/shared` hand-authored, add an **SDL↔shared parity check** so they cannot diverge,
   rather than regenerating `@cockpit/shared` from the SDL (a larger change deferred past G0).

## Proposed solution

**New core artifact (G0 core PR) — RESOLVED Q2 = package:** a dedicated `@core/read-model-contract`
workspace package in core, holding `schema.graphql` (the canonical SDL) + its codegen config + the
parity tooling. The package is **workspace-internal** (no `publishConfig`, never published) and is
consumed by cockpit via **CI git-clone**, not a runtime import — ADR-0013's "no runtime import, no
publish" invariant is preserved; the package is purely a hardened *home + identity* for the contract,
not a dependency. Query-only. Header comment names it the fleet-wide read-model contract + the cockpit
consumer.

**SDL sketch (illustrative — full field list finalized in `/tdd`):**
```graphql
enum Liveness { LIVE STALE DARK }
enum AgentLivenessState { LIVE IDLE DARK }

type RepoLink { kind: String!  url: String!  label: String! }          # L1 fills urls
type RepoPopover { placeholder: Boolean! }                              # L3s decides contents
type RepoCard {
  name: String!  role: String!  phase: String!  openCount: Int!
  lastActivity: String  liveness: Liveness!  here: Boolean
  links: [RepoLink!]!                                                   # forward-declared (L1)
  popover: RepoPopover                                                  # forward-declared (L3)
}
type AgentLiveness { agentId: String!  state: AgentLivenessState!  lastEventAt: String!  lastEventType: String! }

type BriefingArtifact { title: String!  target: String!  closes: String!  align: String!  task: String!  criteria: [String!]! }
type BriefingBranch { key: String!  label: String!  recommended: Boolean!  type: String!  artifact: BriefingArtifact  cta: String  outcome: String  doneText: String }
type BriefingThread { id: String!  tag: String!  title: String!  whyNow: String!  catchUp: String!  question: String!  branches: [BriefingBranch!]! }
type BriefingSnapshot { generatedAt: String!  repo: String  source: String!  threads: [BriefingThread!]! }   # repo forward-declared (F2)

type Query {
  fleet: [RepoCard!]!
  briefing(repo: String): BriefingSnapshot!                            # arg forward-declared (F2)
  agentLiveness: [AgentLiveness!]!
}
# NO Mutation type — query-only (ADR-0011 #4 / ADR-0013 #5).
```

**Codegen toolchain (cockpit PR):** schema-first `@graphql-codegen/cli` with `typescript` (base
types) + `typescript-resolvers` (G1's resolver types). Config `packages/server/codegen.ts`; output
`packages/server/src/schema/__generated__/read-model.ts` (committed). The GraphQL server lib itself
(yoga / graphql-http) is a **G1** concern; G0 only needs the SDL + the generator + the gate.

**CI SDL fetch (no runtime core dep):** a CI step `git clone --depth 1 <core>` and copies
`core/contracts/read-model.graphql` to a vendored cockpit path
(`packages/server/src/schema/read-model.graphql`) carrying a `# Vendored from core @ <sha>`
provenance line. Codegen runs against the vendored copy.

**Drift gate (two mechanisms — ADR-0013 #3):**
1. **Regenerate-and-diff:** CI runs codegen + `git diff --exit-code` over the generated output and
   the vendored SDL — a stale commit fails the build.
2. **Vendored-SDL parity:** CI asserts the vendored `read-model.graphql` byte-equals core's current
   `contracts/read-model.graphql` (from the clone) — a cockpit-side hand-edit or a core-side change
   that wasn't re-vendored fails the build.
3. **SDL↔`@cockpit/shared` parity** (the ownership-inversion guard, Q1): a test asserting every SDL
   type has a matching `@cockpit/shared` interface field-for-field (a deliberate divergence fails).

**Read-only proof (ADR-0011 #4):** a test asserts the SDL has no `Mutation` type and (carried into
G1) that no resolver writes Dolt/`gh`.

## Acceptance criteria (Control Gates C0 → C2)

1. **C0 (audit, Verif):** this spec records which shapes are pinned vs forward-declared vs deferred,
   and names the churn risks (done above). The ownership-inversion finding (Q1) is surfaced with a
   recommended resolution. **Pass = the audit table + churn list exist and the operator has chosen
   Q1's path at `/plan-feature`.**
2. **C1 (SDL draft, Verif) — TPM 100%:** every UX field in the audit's "stable" set has an SDL type,
   and every forward-declared field (briefing `repo`, `RepoLink`, `RepoPopover`) is present.
   **Pass = UX-fields-with-an-SDL-type / total = 100%**, asserted by the SDL↔shared parity test.
3. **C2 (parity discipline, Verif) — the load-bearing gate:** codegen + all three drift mechanisms
   are wired. **Pass = a *deliberate* drift breaks CI** — proven by a test/CI-fixture that (a) edits
   the SDL without regenerating → regenerate-and-diff fails; (b) edits the vendored SDL away from
   core's → vendored-parity fails; (c) adds an SDL field with no `@cockpit/shared` backing →
   SDL↔shared parity fails. Plus: the SDL has **no `Mutation` type** (read-only proof).
4. `pnpm build && pnpm test && pnpm typecheck` green; tests run against an **isolated throwaway Dolt**
   (`DOLT_TEST=1`, scratch port — never shared `:3307`). The load-bearing `packages/shared` lane
   suite stays green.
5. **Worktree discipline:** G0 touches the core SDL artifact + cockpit `packages/server` codegen/test
   wiring only. It does **not** edit the renderer or `fleet-config.ts` (F1/L1 own those). It does
   **not** add a GraphQL server/endpoint (that's G1).

## Test matrix

| # | Scenario | Input / state | Expected | Type |
|---|----------|---------------|----------|------|
| T1 | SDL covers the stable surface | `read-model.graphql` + `@cockpit/shared` | every audited "stable" field has an SDL type (TPM=100%) | unit (parity) |
| T2 | Forward-declared fields present | the SDL | `BriefingSnapshot.repo`, `RepoCard.links`, `RepoCard.popover`, `briefing(repo:)` exist | unit |
| T3 | Read-only proof | the SDL | no `Mutation` type; schema parses query-only | unit |
| T4 | Codegen is deterministic & current | run codegen | generated output byte-equals the committed `__generated__/read-model.ts` | CI (regenerate-diff) |
| T5 | **Drift A — stale generated** | edit SDL, skip regen | `codegen && git diff --exit-code` **fails** | CI fixture |
| T6 | **Drift B — vendored ≠ core** | edit vendored SDL away from core's | vendored-parity check **fails** | CI fixture |
| T7 | **Drift C — SDL field w/o backing** | add SDL type with no `@cockpit/shared` field | SDL↔shared parity **fails** | unit |
| T8 | Isolated-Dolt hygiene | `DOLT_TEST=1` scratch port | suite never touches shared `:3307`; shared lane suite green | integration |
| T9 | No collateral edits | git diff | only core SDL artifact + `packages/server` codegen/test files changed; renderer + `fleet-config.ts` untouched; no GraphQL endpoint added | review/CI |

T5–T7 are the load-bearing C2 gate: each proves a *deliberate* drift breaks the build.

## Open questions (settle at `/plan-feature`)

- **Q1 (ownership inversion — the big one) → RESOLVED: A (parity test).** Keep `@cockpit/shared`
  hand-authored + an SDL↔shared **parity test** — smallest blast radius, preserves today's source of
  truth, drift still caught. Regenerating `@cockpit/shared` from the SDL is deferred past G0 (would
  warrant its own ADR). *(Operator did not override the recommendation; default taken 2026-06-26.)*
- **Q2 (SDL home) → RESOLVED: package.** A `@core/read-model-contract` **workspace package** in core
  (not a loose file). Operator chose the heavier option deliberately — *"not as lean, but this schema
  hardening is important."* Remains workspace-internal + CI-fetched (no publish, no runtime import);
  ADR-0013 invariant preserved. **ADR-0013's Q-recommendation (which favored a file) is updated to
  record this choice as part of the G0 cockpit PR.**
- **Q3 (vendor vs fetch-only) → RESOLVED: vendor + parity check.** Cockpit commits a vendored copy of
  the SDL + a CI check that it byte-equals core's package schema. Buildable offline; reviewable in
  cockpit PRs; can't go stale. *(Default taken 2026-06-26.)*
- **Q4 (codegen server lib for G1):** `graphql-yoga` vs `graphql-http` + `graphql` — flagged for G1,
  not decided here; the SDL + generated types are lib-agnostic.

## ADR note

Lands under ADR-0013 (mechanism) + ADR-0011 (the read-model). No new ADR needed unless Q1 resolves to
"regenerate `@cockpit/shared` from the SDL" — that would meaningfully change `@cockpit/shared`'s
authorship and warrants its own ADR. Record the Q1 decision in this spec at `/plan-feature` either way.
