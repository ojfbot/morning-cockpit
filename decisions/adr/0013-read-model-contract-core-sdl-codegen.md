# ADR-0013 — The read-model contract: a core-authored SDL, codegen'd into the cockpit facade

- **Status:** Accepted
- **Date:** 2026-06-26
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0001 (standalone, read-only, mirror-don't-import), ADR-0011 (GraphQL read-model)
- **Extends:** ADR-0001 (adds a generated-contract path; does **not** supersede it)
- **Refines:** ADR-0011 (supplies the concrete drift-enforcement mechanism #2 left open)
- **Source:** the 2026-06-26 Track-G integration stress-test (this session)

## Context — how this area evolved

This ADR exists because the obvious answer was wrong twice, and writing down *why* protects the
next person from re-deciding it from scratch.

**Where we started (ADR-0001, 2026-06-07).** morning-cockpit was deliberately built **outside**
the Frame ecosystem as a standalone, local-first, **read-only** read-model — matching
daily-logger's posture. It explicitly chose **mirror-don't-import**: rather than depend on
`@core/workflows`, it hand-copies the bead type shapes into `packages/shared/src/dolt-bead.ts`
with `// Mirrors <path> @ <date>` provenance comments. The stated rationale (ADR-0001 #2): there is
no pnpm workspace spanning `~/ojfbot`; `@core/workflows` ships only built `dist/` and pulls in
`@anthropic-ai/sdk`; and `DoltBeadStore` is a read-**write** engine — the wrong shape for a
read-only cockpit. The accepted cost was **type drift**, mitigated only by defensive parsing +
the pointer comments + the ADR paper trail.

**What ADR-0011 added (2026-06-25).** The dashboard-UX work multiplies the read surface
(repo-scoped briefings, tile links, runtime liveness, popover payloads). ADR-0011 proposed a
**typed GraphQL read-model** so there is *one* contract for the human UI and for agent readers —
the operator's explicit requirement: *"I need human and agents to be able to read it together,"*
and *"the core schema must stay rock-solid; this UI work must refine it, never drift."* ADR-0011
named the goal (one SDL as the contract of record, drift = a build failure) but **left the
mechanism open** ("codegen or a parity test — decided at C0").

**The fork that triggered this ADR.** The day-runner brief framed Track G as *"core first, cockpit
imports from core."* Taken literally — cockpit takes a code dependency on a core package — that
**reverses ADR-0001's founding invariant**. A stress-test (with ground-truth exploration of both
repos) found that the bare import is a **weakness, and doesn't even buy the goal**:

1. **It doesn't deliver the actual contract.** What humans and agents consume is the **served
   GraphQL SDL at runtime**, not a TypeScript type. A source-level TS import does not guarantee the
   *served schema* matches — a codegen/parity discipline is still needed either way. The import
   solves a problem we don't have.
2. **The mechanics are fragile.** Core has **no publish pipeline** (every package is
   `workspace:*`-internal, zero registry presence). The only fleet precedent for cross-repo code
   reuse is ADR-0030's `file:` sibling-link to a *dedicated library repo* — not a package inside
   core's workspace. `file:`-linking `@core/workflows` would couple build graphs and drag a
   read-**write** `DoltBeadStore` + `@anthropic-ai/sdk` into a deliberately read-only app — exactly
   ADR-0001's three original blockers, all still standing.
3. **Version skew reintroduces drift.** If core serves schema vX but cockpit built against vX-1, the
   human and agent contracts diverge — the very drift ADR-0011 exists to kill, on a new axis.
4. **The cited precedent was hollow.** ADR-0001 leaned on daily-logger as the "standalone" exemplar,
   but daily-logger neither imports **nor mirrors** core — it's standalone-by-no-overlap. So there
   was no evidence importing core is safe here. (And the current mirror has **no parity test** —
   drift is guarded by comments alone.)

The operator's refinement resolved it: **codegen** — generate the TypeScript types from one
canonical SDL so the contract is strict at compile time *and* run time. That dissolves the
import-vs-mirror dilemma: you neither hand-mirror nor runtime-import — you **generate**.

## Decision

1. **Core is the schema authority.** The canonical read-model **SDL** is a committed artifact in
   **core** (where fleet-wide agents reference one shape). This is net-new — core has no GraphQL
   today. The SDL covers the dashboard-UX surface: repo card, repo-scoped briefing, tile links,
   liveness, popover payload.

2. **Cockpit generates its types from that SDL — it does not import a core package.** The GraphQL
   facade (`packages/server`, ADR-0011) has its resolver + client TypeScript types produced by
   **codegen** from the SDL. The cross-repo SDL is obtained at **CI time via git-clone of core**
   (the ADR-0030 sibling-clone precedent), written to a known path, and codegen runs against it.
   **No `@core/*` runtime dependency, no published package, no `file:` link, no write-engine.**

3. **Drift is structurally impossible, enforced two ways.** *Compile time:* generated types will
   not compile against a stale shape. *Run time:* an introspection / regenerate-and-diff CI gate
   fails the build whenever the cockpit's built contract diverges from core's SDL (the *served*
   contract, not a hand-copied type). This is ADR-0011 decision #2, now concrete.

4. **ADR-0001 is extended, not superseded.** Mirror-don't-import for **bead/Dolt shapes**
   (`dolt-bead.ts`) is unchanged; standalone, read-only, no-build-coupling all survive — because a
   generated contract is neither a hand-mirror nor a runtime import. The only thing that changes is
   that the **shared read-model contract** now has a single generated source of truth instead of a
   comment-guarded hand-copy.

5. **Read-only, query-only (unchanged).** The SDL is query-only; no mutation type writes Dolt or
   `gh`; the sole write path remains Handoff Emission (ADR-0005). Asserted by test (ADR-0011 #4).

6. **Scope ceiling.** This authorizes a core-authored SDL + a CI-time fetch + codegen + the drift
   gate. It does **not** authorize a runtime core dependency, a published package, federation, a
   public endpoint, or auth — each would need its own ADR. If the fleet later genuinely converges
   (cockpit's standalone posture deliberately retired), that is a *future* ADR that would supersede
   ADR-0001 outright — this one does not.

## Consequences

- **Positive.** The operator's "one contract, human + agents, never drift" requirement is met by
  construction, against the actually-served schema. Cockpit keeps read-only + standalone deploy +
  zero `@core/*` runtime coupling. The reversal-of-0001 risk is avoided; the change is reversible
  (delete the codegen step, fall back to hand-typing). The previously **untested** mirror gains a
  real enforcement story.
- **Negative / risks.**
  - **CI now depends on cloning core** to fetch the SDL. *Mitigation:* it's CI-only (not runtime);
    a missing/unreachable core fails the build loudly rather than shipping a drifted contract.
  - **Codegen toolchain** (e.g. `@graphql-codegen/*`) + a GraphQL server lib enter a lean repo.
    Accepted as the cost of the shared-contract requirement (ADR-0011 already booked the server lib).
  - **Two-step land** for contract changes: core SDL PR first, then the cockpit codegen PR. This is
    the intended gate (core authority), not accidental friction.
  - **The SDL must actually be authored in core in G0.** Until it is, there is no contract to
    generate from; G0 is the gating slice for exactly this reason.

## References

- ADR-0001 §2 — the original mirror-don't-import decision + its three blockers (still the reason we
  generate rather than import).
- ADR-0011 §2 — "the SDL is the contract of record … codegen or a parity test, decided at C0"; this
  ADR is that decision.
- `core` repo — no publish pipeline, no registry presence, no GraphQL today (2026-06-26 audit).
- ADR-0030 (core) — `file:` sibling-link + CI git-clone precedent; the CI-fetch mechanism reused here.
- `research/dashboard-ux-rollout-gated-slices.md` — Track G (G0 authors the SDL; G1 builds the facade
  against the generated types).
