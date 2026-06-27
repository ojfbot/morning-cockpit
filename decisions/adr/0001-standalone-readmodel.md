# ADR-0001 — Morning cockpit is a standalone local read-model, not a Frame remote

- **Status:** Accepted
- **Date:** 2026-06-07
- **Deciders:** Yuri (Jim Green), code-claude
- **Extended by:** ADR-0013 (2026-06-26) — the GraphQL **read-model contract** is **codegen'd from
  core's canonical SDL** (generated at CI, *not* hand-mirrored and *not* a runtime import).
  Decision #2 below (mirror-don't-import for bead/Dolt shapes) and the standalone-deploy posture are
  **preserved**; ADR-0013 only adds a generated-contract path for the shared schema. **Not superseded.**

## Context

The user wants a single morning surface showing the state of work across all ojfbot
projects, in three lanes: Overnight, Daily-pickup, and Available. The data already exists,
scattered across four sources: the Dolt bead store (`127.0.0.1:3307`), per-repo
`.handoff/*.md` markdown beads, GitHub PRs/issues (already swept by daily-logger), and
frame-standup priorities.

`gastown-pilot` is a partially-built Frame observability dashboard (Carbon DS, Module
Federation remote, Express+Dolt adapters) whose `BeadExplorer` / `ConvoyTracker` /
`WantedBoard` panels overlap this need. We could finish those panels instead of building new.

The user explicitly chose a **standalone, local-friendly app outside Frame**, taking design
cues from the personal GroupThink plugin rather than Carbon. The cockpit is a personal
cockpit you open at 7am, not an enterprise observability console.

Two coupling questions follow: (1) do we depend on `@core/workflows` for bead types and the
`DoltBeadStore`? (2) where does the data-reading logic run?

## Decision

1. **Build a new standalone repo** `morning-cockpit`, outside the Frame ecosystem, with its
   own internal pnpm workspace. No Module Federation, no Carbon. UI borrows GroupThink's
   `tokens.css`. This matches daily-logger's established "intentionally standalone" posture.

2. **Do not depend on `@core/workflows`.** Query Dolt with raw, read-only `SELECT`s and
   **mirror** the bead type shapes (`FrameBead`, `AgentBead`, `ConvoySlot`, `beadPrefix`)
   into `packages/shared/src/dolt-bead.ts`, each block carrying a `// Mirrors <path> @ <date>`
   pointer comment. Rationale: there is no workspace spanning `~/ojfbot`; `@core/workflows`
   only exports built `dist/` and pulls in `@anthropic-ai/sdk`; and `DoltBeadStore` is a
   read-*write* engine (it calls `DOLT_COMMIT` and writes `bead_events`) — the wrong shape for
   a read-only cockpit.

3. **Run a small local Express service** (`:3040`) that fans out to source adapters with
   `Promise.allSettled`, normalizes everything into one `WorkItem` view-model, and serves
   `/api/cockpit` + `/api/health`. A browser renderer cannot open a TCP socket to Dolt or
   shell out to `gh`, so the server is non-optional.

4. **Read-only, always.** The cockpit never writes beads, never mutates `.handoff/`. The
   "Available queue" lane is synthesized from existing open items; the real unassigned-bead
   write-path is deferred to ADR-0002 (Track R).

## Consequences

**Positive:** True standalone deployability (eventually to a home server). Minimal dependency
surface. Read-only safety by construction. A design language the user enjoys. No build
coupling to core.

**Negative / risks:**
- **Type drift.** Mirrored types go stale if core renames a label or adds a bead type.
  *Mitigation:* defensive parsing (unknown type → `generic`, parse failure → skip, never
  throw); pointer comments; this ADR as the paper trail.
- **A second design language** in the ecosystem (GroupThink vs Carbon) and **zero reuse** of
  `frame-ui-components`. Accepted as the cost of a personal cockpit.
- **Possible convergence with gastown-pilot.** Whether these merge is an open question handled
  in the Track-R coordination design (ADR-0002 draft).

## References

- `core/packages/workflows/src/bead-store/dolt-schema.sql` — the `beads` + `bead_events` schema we read.
- `core/packages/workflows/src/types/{bead,agent-bead,convoy}.ts` — shapes we mirror.
- `daily-logger` CLAUDE.md — precedent for an intentionally-standalone ojfbot repo.
- `GroupThink/src/styles/tokens.css` — vendored design tokens.
