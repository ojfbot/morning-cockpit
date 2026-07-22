# ADR-0015 — System Map pane: render committed OPM models as the fleet's inspectability surface

- **Status:** Draft / Proposed (no code on this branch — proposal only, written with the OPM
  research drop of 2026-07-22)
- **Date:** 2026-07-22
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0001 (standalone read-only), ADR-0003 (local-first synthesis; deterministic floor)
- **Relates to:** core ADR draft `opm-inspectability-layer` (the OJF-OPL convention this pane
  consumes), daily-logger ADR-0039 (first repo with a committed model), the Loop pane
  (`adapters/loop.ts` — same "observe, don't act" posture)

## Context

Core's ADR draft `opm-inspectability-layer` introduces a per-repo `opm/system.opl`: a
controlled-English Object-Process model (stateful objects, processes, agent/instrument enabler
links) with a deterministic Mermaid twin (`opm/system.md`). daily-logger carries the first real
model. These artifacts answer exactly the questions the cockpit's morning lanes can't: *what are
the moving parts of each repo, what does each process consume and produce, and where are the
human gates?* Today that knowledge lives in per-repo CLAUDE.md prose; the cockpit re-derives
fragments of it (adapter by adapter) without a shared vocabulary.

The cockpit is the natural read surface: it is already the fleet's read-model, it already reads
per-repo files off disk read-only (`adapters/handoff.ts`), and its deliberate non-conformance
rules (no writes, degrade gracefully, truthful empty states) fit a pane whose data source is
sparse — only 2 repos have models today.

## Decision (proposed)

Add a read-only **System Map** pane fed by a new `adapters/opm.ts`:

- **Adapter:** scan `~/ojfbot/<repo>/opm/system.opl` for each known repo (same repo-root
  discovery as the handoff adapter). Parse line-per-fact OPL with a small template matcher
  (mirror the grammar table from core `domain-knowledge/opm-modeling.md` with a
  `// Mirrors <path> @ <date>` comment, per this repo's mirroring convention — no `@core`
  dependency). Emit per repo: things, links, states, `[src:]` anchors, and a parse-health note.
  Repos without a model are reported as such — truthful empty states, never synthesized.
- **Endpoint:** `/api/system-map` (own endpoint, like `/api/loop`); `Promise.allSettled`
  degradation; parse failures degrade to "model unreadable" per repo, never crash the snapshot.
- **Pane:** per-repo cards — SD diagram (render the committed Mermaid from `opm/system.md`
  verbatim rather than re-deriving layout), the OPL paragraph as clickable text (each sentence
  links to its `[src:]` anchor on GitHub), and a fleet-level **"who gates what"** rollup derived
  from agent links (every `X handles P.` across the fleet) — the human-in-the-loop map, the
  tuning surface: an autonomy change shows up as a `handles`→`requires` diff.
- **Non-goals:** no editing (models change via PRs in their home repos), no liveness/telemetry
  join in v1 (a later slice may badge processes with `bead_events` recency), no OPL authoring
  here — that is core's `/opm` skill.

## Why this shape

The pane consumes *committed artifacts*, so it inherits git's audit trail and stays inside the
read-only carve-out; parsing a 30-line controlled-English file is deterministic-floor work (no
LLM in the path, per ADR-0003 posture). The mirror-not-import rule keeps the repo standalone at
the cost of drift-risk, which the `// Mirrors` stamp makes visible — same trade as
`dolt-bead.ts` (ADR-0001).

## Consequences

**Gains:** one pane answers "how does this repo work and where am I in the loop" across the
fleet; the agent/instrument rollup gives the first fleet-wide autonomy inventory.
**Costs:** a second copy of the OPL grammar to keep in sync (mirror comment mitigates); pane
value is capped by model coverage (2 repos today) — acceptable, the empty states advertise the
convention.
**Honest gap to record on landing:** the pane shows the *modeled* system, not the running one;
until a liveness join exists, a beautiful map of a dead pipeline looks identical to a live one.
Label the pane "as modeled", with each repo's model mtime.

## Slice plan (if accepted)

S1 adapter+endpoint with parse-health; S2 pane with per-repo cards + gates rollup; S3 (separate
decision) liveness badges from `bead_events`.
