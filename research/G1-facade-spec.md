# Spec — G1: GraphQL read facade (parity) over the G0 contract

Feature spec for Slice **G1** of the dashboard-UX rollout (`dashboard-ux-rollout-gated-slices.md`,
Track G). Decisions of record: **ADR-0011** (GraphQL read-model), **ADR-0013** (codegen from core SDL),
**ADR-0001** (standalone, read-only). Entrance gate: **G0** (SDL + generated types + drift gate on
main). Plan only — execute via `/plan-feature` → `/tdd`. Cockpit-only (no core change → single PR).

## Problem statement

G0 pinned the contract (the vendored SDL + `__generated__/read-model.ts`) but nothing *serves* it.
The dashboard still reads bespoke REST routes (`/api/fleet`, `/api/briefing`, `/api/cockpit`, … in
`packages/server/src/routes/*.ts`), each returning ad-hoc JSON. G1 stands up a **GraphQL read facade
beside REST** (not replacing it) that resolves the G0 `Query` fields — `fleet`, `briefing(repo:)`,
`agentLiveness`, `workItems(lane:)` — against the **same `buildSnapshot()` aggregate**, typed by the
generated types, so an agent and the UI read one shape. Query-only; no mutations; no new write path.

**Assumptions made explicit:**
1. **Parity is structural, not just tested.** The fleet repo-derivation currently lives inline in
   `routes/fleet.ts`. G1 **extracts it to a shared function** (`deriveFleet(snap, now)`) that *both*
   the REST route and the GraphQL resolver call — so they cannot diverge by construction (the F1
   "extract a stable seam" hygiene, applied server-side). Briefing already has `generateBriefing()`.
2. `briefing(repo:)` accepts the arg now (G0 forward-declared it) but **ignores it** in G1 — global
   briefing, same as REST. Repo-scoping is **F2**. Stated so F2 lands on the resolver, not a re-cut.
3. **No core change.** Single cockpit PR. The facade imports the **generated** types (`__generated__`),
   never `@core/*`.

## Proposed solution

**Server lib (Open Q1 — recommend `graphql-yoga`) — chosen for the extraction path, not just DX.**
The end-state is a **dedicated lean graph service** (a third tier: core = real logic/data → lean graph
facade → consumers), *not* a GraphQL server welded into cockpit's Express monolith forever. Yoga is
chosen because its schema is a transport-agnostic `GraphQLSchema` (`createSchema({typeDefs, resolvers})`)
and Yoga runs **standalone on any runtime — it does not require Express**. So:
- **Now:** `app.use('/graphql', createYoga({ schema }))` on cockpit's existing Express.
- **Later:** the *same* schema + resolvers spun up as a standalone Yoga server — the lean graph service
  *is* Yoga-without-Express. Extraction is a host swap, **not a rewrite** (continuity, same lib).

The executable schema = the vendored SDL (`buildSchema`/`createSchema`) + a resolver map.

**Extraction seam — the `ReadModelSource` port (load-bearing for the trajectory).** The real lock-in is
NOT the lib; it is resolvers reaching into cockpit's `buildSnapshot()`/Dolt directly — which contradicts
the "core owns logic, graph stays thin" end-state. So G1 resolvers depend on a **`ReadModelSource`
interface** (`packages/server/src/schema/source.ts`): `{ snapshot(): Promise<CockpitSnapshot>;
agentEvents(): Promise<BeadEventRow[]> }`. Today it is backed by the cockpit aggregate
(`cockpitReadModelSource`); later it is re-backed by a core-fed data layer **without touching the
resolvers**. Combined with G0's SDL-already-in-core, the future extraction = swap the host (Express →
standalone) + swap the source impl (cockpit-aggregate → core). Both behind seams.

**Files:**
- `packages/server/src/schema/source.ts` — the **`ReadModelSource` port** + `cockpitReadModelSource`
  (the aggregate-backed impl). Resolvers depend on the interface, never on `buildSnapshot` directly.
- `packages/server/src/schema/resolvers.ts` — the resolver map for `Query`, parameterized by a
  `ReadModelSource`. Each resolver reads from the source and maps to the generated types:
  - `fleet` → `deriveFleet(snap, now)` (extracted; see below).
  - `briefing(repo)` → `generateBriefing(snap, snap.generatedAt)` (repo ignored — F2).
  - `agentLiveness` → `deriveAgentLiveness(events, now)` from the dolt adapter's `agent-*` events.
  - `workItems(lane)` → `snap.lanes[lane]`.
- `packages/server/src/schema/index.ts` — builds the Yoga schema (SDL + resolvers), exported for mount
  + tests.
- `packages/server/src/fleet-derive.ts` — **extracted** `deriveFleet(snap, now): RepoCard[]` +
  `fleetTotals(repos)`, reused by `routes/fleet.ts` (refactored to call it) and the resolver.
- `packages/server/src/index.ts` — `app.use('/graphql', yoga)` beside the REST routers.

**Enum mapping note:** SDL enums are UPPERCASE (`LIVE`), `@cockpit/shared` is lowercase (`'live'`).
The resolver maps case at the boundary (a small `toGqlLiveness()` map). Recorded as a test concern
(parity must compare semantically, not string-identically) — Open Q2.

## Acceptance criteria (Control Gates C0 → C2)

1. **C0 (endpoint, Verif):** Yoga stands up at `/graphql` beside REST; an integration test executes
   `{ fleet { name liveness } }` against the in-process schema and gets repo cards. REST routes remain
   mounted and unchanged in behavior.
2. **C1 (parity, Valid) — TPM 100%:** for `fleet` and `briefing`, the GraphQL result equals the REST
   `/api/fleet` / `/api/briefing` payload (semantic equality, enum-case-normalized) over the same
   snapshot. **Pass = fields at parity / total = 100%, no field only-in-REST.** Enforced structurally
   (shared `deriveFleet`/`generateBriefing`) + asserted by a parity test.
3. **C2 (read-only proof, Verif) — TPM 0:** **zero resolvers write Dolt or `gh`.** Asserted by (a) the
   schema has no `Mutation` (G0 guard, re-asserted), and (b) a test that the resolver module imports
   no write path (`handoff-emit`, `queue-*`, `DOLT_COMMIT`, `gh`) — resolvers are read-only by
   construction.
4. `pnpm build && pnpm test && pnpm typecheck` green; tests pure (no shared `:3307`; `DOLT_TEST=1`
   scratch where Dolt is touched — but the facade tests use a stubbed/seeded snapshot, no live Dolt).
   The G0 drift gates stay green (the vendored SDL is unchanged).
5. **Scope:** server-only; no renderer change (the renderer keeps reading REST until a later slice
   ports it); no core change; no new write path.

## Test matrix

| # | Scenario | Input / state | Expected | Type |
|---|----------|---------------|----------|------|
| T1 | Endpoint resolves | in-process Yoga schema, `{ fleet { name } }` | repo cards returned | integration |
| T2 | fleet parity | same snapshot → REST `deriveFleet` vs GraphQL `fleet` | semantically equal (enum-normalized) | unit |
| T3 | briefing parity | same snapshot → `/api/briefing` vs GraphQL `briefing` | equal threads/source | unit |
| T4 | briefing(repo:) accepted, ignored | `briefing(repo:"core")` | same as global briefing (F2 not yet) | unit |
| T5 | workItems(lane:) | `workItems(lane:"overnight")` | == `snap.lanes.overnight` | unit |
| T6 | read-only proof | resolver module source | imports no write path; no `Mutation` in schema | unit |
| T7 | REST unchanged | `/api/fleet` after refactor-to-`deriveFleet` | byte-identical payload to pre-refactor | regression |
| T8 | drift gates intact | G0 parity/vendored/codegen | still green (SDL untouched) | CI |

## Open questions (settle at `/plan-feature`)
- **Q1 (server lib) → recommend `graphql-yoga`** — chosen for the *extraction path* (transport-agnostic
  schema; runs standalone without Express; the eventual lean graph service is Yoga-without-Express =
  continuity). Alternatives: Apollo (heavier/more coupled), `graphql-http` (leaner but hand-wired
  transport). Operator raised the future dedicated-graph-service trajectory — Yoga + the `ReadModelSource`
  port serve it; confirm the port is in-scope for G1 (recommend yes — cheap insurance).
- **Q2 (enum case):** normalize at the resolver boundary (UPPERCASE SDL ↔ lowercase shared), or change
  the SDL enums to lowercase to match shared? Recommend boundary-mapping (keep SDL idiomatic UPPERCASE;
  GraphQL convention) — record the map in one place.
- **Q3 (agentLiveness source):** the dolt adapter computes liveness internally; does it expose the
  `agent-*` events for the resolver, or a derived list? Recommend a small read-only accessor on the
  snapshot/adapter; no new query.
- **Q4 (GraphiQL):** enable the GraphiQL explorer in dev only (off in prod)? Recommend dev-only.

## Future trajectory (captured — not built in G1)

The end-state is a **dedicated lean graph service**, separate from cockpit's Express monolith:
**core** owns real logic/data → a **thin graph facade** (the schema + resolvers, hosting only) →
consumers (cockpit UI, agents). G1 does *not* build that service — building it now is premature (the
cockpit is the only reader). Instead G1 is **structured so the extraction is cheap**:
1. **G0 already put the SDL in core** — the future service inherits the contract for free.
2. **Yoga schema is transport-agnostic** — the standalone service is the same schema, unhosted from Express.
3. **The `ReadModelSource` port** isolates the data dependency — re-back it with a core-fed layer without
   touching resolvers.

So the extraction is: (a) move `schema/` to a standalone Yoga server, (b) swap `cockpitReadModelSource`
for a core-backed impl. No resolver or contract rewrite. **This trajectory is recorded so a future
session doesn't re-derive it — when the extraction is scheduled, it gets its own ADR superseding the
"facade in cockpit packages/server" placement (ADR-0011 #1).**

## ADR note
No new ADR for G1 itself — it executes ADR-0011 + ADR-0013. The **dedicated-graph-service extraction**
above is a forward direction, not this slice; capture it as an ADR stub (Proposed) only when scheduled.
If Q3 surfaces a new adapter accessor, note it inline; it doesn't rise to an ADR.
