# ADR-0011 — A GraphQL read-model: one typed contract for human and agent readers

- **Status:** Proposed (foundational spin-off; captured 2026-06-25, accept after C0 schema audit)
- **Date:** 2026-06-25
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0001 (standalone, read-only, mirror-don't-import), ADR-0008 (derived liveness)
- **Relates to:** ADR-0012 (repo-scoped Briefing needs this contract)
- **Refined by:** ADR-0013 (the read-model contract: core-authored SDL, codegen'd into the cockpit
  facade — supplies the concrete drift-enforcement mechanism this ADR leaves open at decision #2)
- **Source:** `research/dashboard-ux-flows.md` (parked workstream)

## Context

The dashboard UX flows (ADR-0012) multiply the read surface: repo-scoped briefings, per-tile
links, runtime liveness, popover payloads — each a new shape that today would be a bespoke REST
route (`routes/fleet.ts`, `routes/briefing.ts`, …) returning an ad-hoc JSON. The operator's
explicit requirement: the **core schema must stay rock-solid**, this UI work must **refine it,
never cause drift**, and the read surface must be a single **data-adapter layer** that serves
**human UI and agentic readers identically** — *"I need human and agents to be able to read it
together."*

A pile of hand-rolled REST endpoints can't enforce that: each one drifts its own shape, and an
agent reading the dashboard's data has to reverse-engineer N endpoints. A **typed GraphQL
read-model** over the existing aggregate gives one schema (SDL) as the contract, one place where
mirrored Dolt shapes (`dolt-bead.ts`) surface, and the same query for a React component or an
agent. This is a read-model facade, not a new datastore.

This stays inside ADR-0001's posture: **read-only, mirror-don't-import.** GraphQL here is queries
only — no mutations, no subscriptions-as-writes. The single write path remains Handoff Emission
(ADR-0005), which is *not* moving into this layer.

## Decision

1. **Introduce a GraphQL read-model facade** in `packages/server`, served alongside (not
   replacing) the existing REST routes during transition. Its resolver + client TypeScript types
   are **codegen'd from the canonical read-model SDL** (authored in core — see decision #2 and
   ADR-0013), and it resolves against the same `aggregate`/adapters and `@cockpit/shared`
   view-models — a typed seam, not a second source.
2. **The SDL is the contract of record — authored in core (ADR-0013).** Repo cards, repo-scoped
   briefings, links, liveness, and future popover payloads are defined once in that SDL. The
   cockpit's types are **generated from it (codegen), not hand-written**, and the running server is
   validated against it. The parity mechanism left open here is **settled in ADR-0013**: codegen +
   an introspection / regenerate-and-diff CI gate makes a drift a **build failure at compile *and*
   run time**, not a runtime surprise. (The cross-repo SDL is fetched at CI via git-clone — no
   runtime dependency on core; see ADR-0013 and ADR-0001.)
3. **One contract, two readers.** The same schema serves the renderer and any agent (the cockpit
   chat agent first). No agent-only or human-only side channel for the same data.
4. **Read-only, period.** Query-only schema. No mutation type that writes Dolt or `gh`. Handoff
   Emission stays where ADR-0005 put it. This invariant is asserted by a test (no resolver writes).
5. **Mirror-don't-import preserved; the contract is generated, not imported** (ADR-0001 extended by
   ADR-0013, not superseded). Bead/Dolt shapes the schema exposes remain the hand-mirrored
   `dolt-bead.ts` types with their `// Mirrors <path> @ <date>` provenance — not `@core/workflows`.
   The read-model **SDL** itself is **codegen'd** from core's canonical artifact (generated at CI),
   so there is **no runtime package dependency** on core and the standalone-deploy posture survives.
6. **Scope ceiling for v1.** This ADR authorizes the read facade + the contract discipline. It
   does **not** authorize federation, a public endpoint, auth ceremony, or write mutations — those
   are out of scope and would need their own ADR.

## Consequences

- The UX slices (ADR-0012) gain a stable, typed shape to build against; the repo-scoped Briefing
  and tile metadata land as schema fields, so renderer and agent can't diverge.
- Real cost: standing up the GraphQL server, the SDL↔types parity mechanism, and porting the first
  read-models. Mitigated by keeping REST live in parallel and porting incrementally (Track G).
- A new dependency surface (a GraphQL server lib + a codegen toolchain) enters a deliberately lean
  repo — justified only by the human+agent shared-contract requirement; noted as a tradeoff, not a
  default. **No `@core/*` runtime dependency** is added (the SDL is fetched at CI, not imported).
- The "schema must not drift" goal becomes **structurally enforced** by codegen — generated types
  cannot compile against a stale shape, and the introspection/regenerate-diff gate fails the build
  on any divergence from the *served* contract (ADR-0013). This is stronger than a hand-parity test
  and is the central reason this is worth an ADR rather than an ad-hoc route.
- **Proposed, not Accepted:** ratify after the G0 schema audit confirms the core shapes are stable
  enough to pin a contract on (the codegen mechanism is decided in ADR-0013). If the audit finds the
  schema still churning, this waits.
