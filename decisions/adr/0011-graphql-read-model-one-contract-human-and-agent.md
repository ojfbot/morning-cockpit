# ADR-0011 — A GraphQL read-model: one typed contract for human and agent readers

- **Status:** Proposed (foundational spin-off; captured 2026-06-25, accept after C0 schema audit)
- **Date:** 2026-06-25
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0001 (standalone, read-only, mirror-don't-import), ADR-0008 (derived liveness)
- **Relates to:** ADR-0010 (repo-scoped Briefing needs this contract)
- **Source:** `research/dashboard-ux-flows.md` (parked workstream)

## Context

The dashboard UX flows (ADR-0010) multiply the read surface: repo-scoped briefings, per-tile
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
   replacing) the existing REST routes during transition. It resolves against the same
   `aggregate`/adapters and `@cockpit/shared` view-models — a typed seam, not a second source.
2. **The SDL is the contract of record.** Repo cards, repo-scoped briefings, links, liveness, and
   future popover payloads are defined once in the schema; `@cockpit/shared` types and the SDL are
   kept in lockstep (codegen or a parity test — decided at C0). Drift between them is a build
   failure, not a runtime surprise.
3. **One contract, two readers.** The same schema serves the renderer and any agent (the cockpit
   chat agent first). No agent-only or human-only side channel for the same data.
4. **Read-only, period.** Query-only schema. No mutation type that writes Dolt or `gh`. Handoff
   Emission stays where ADR-0005 put it. This invariant is asserted by a test (no resolver writes).
5. **Mirror, don't import** (ADR-0001 unchanged). Bead shapes the schema exposes are the mirrored
   `dolt-bead.ts` types with their `// Mirrors <path> @ <date>` provenance — not `@core/workflows`.
6. **Scope ceiling for v1.** This ADR authorizes the read facade + the contract discipline. It
   does **not** authorize federation, a public endpoint, auth ceremony, or write mutations — those
   are out of scope and would need their own ADR.

## Consequences

- The UX slices (ADR-0010) gain a stable, typed shape to build against; the repo-scoped Briefing
  and tile metadata land as schema fields, so renderer and agent can't diverge.
- Real cost: standing up the GraphQL server, the SDL↔types parity mechanism, and porting the first
  read-models. Mitigated by keeping REST live in parallel and porting incrementally (Track G).
- A new dependency surface (a GraphQL server lib) enters a deliberately lean repo — justified only
  by the human+agent shared-contract requirement; noted as a tradeoff, not a default.
- The "schema must not drift" goal becomes **enforceable** (parity test/codegen) rather than a
  hope — the central reason this is worth an ADR rather than an ad-hoc route.
- **Proposed, not Accepted:** ratify after the C0 schema audit confirms the core shapes are stable
  enough to pin a contract on. If the audit finds the schema still churning, this waits.
