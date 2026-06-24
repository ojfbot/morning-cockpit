# ADR-0008 — Derived liveness supersedes `agent_status` distrust; live agents re-enter the lanes

- **Status:** Accepted
- **Date:** 2026-06-23
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0001 (standalone read-model), ADR-0002 (coordination design / Track R)
- **Depends on:** core S1 (`bead_events` writer, PR #167) + S2a (`agent-*` events carry `actor=<agent-id>`, PR #168)

## Context

`agent_status` is a permanent lie: every agent bead reads `'active'` forever with
`last_session = NULL`. ADR-0001-era code therefore (a) hid agent beads from the work lanes
entirely (the Dolt adapter `continue`d on `type === 'agent'`), (b) captioned Fleet-card liveness a
"last-activity fallback," and (c) printed "N agents (liveness unknown)" in the masthead. The honest
gaps doc said plainly: *"`agent_status` is not liveness."*

That was correct while `bead_events` was empty. It no longer is: core S1 makes every mutating verb
emit a `bead_events` row, and S2a keys the four `agent-*` lifecycle events
(create/resume/idle/sling) with `actor = <agent-id>`. Real per-agent liveness is now derivable.

This slice is **measure/read-derivation, not an enforcement control** — it takes no action, so it
needs no Brassboard/shadow stage. Verification (the pure function meets spec) + Validation (it stops
lying) gate it.

## Decision

1. **Derive agent liveness from `bead_events`.** A pure, clock-injected
   `deriveAgentLiveness(events, now)` (in `@cockpit/shared`) groups `agent-*` events by `actor`,
   takes the most-recent, and classifies **live / idle / dark** by recency — with the rule that an
   explicit `agent-idle` is *never* live (the exact case `agent_status` lies about). Windows default
   to **2 h live / 24 h idle**; agents with no events default to **dark**.
2. **Live agents re-enter the Overnight lane.** The Dolt adapter emits `kind: 'agent'` items for
   `live` agents (lane forced to `overnight` — a live agent *is* current activity, decoupled from the
   overnight-window heuristic). Idle/dark agents are tallied in the health note, not surfaced.
3. **Retire the fallback captions.** The masthead shows `X live · Y idle · Z dark agents`; Fleet and
   the adapter no longer caption liveness a "fallback" or claim `bead_events` is empty. Repo-card
   liveness continues to derive from `activityAt` (which prefers event time since S1) — now honestly
   event-derived rather than a labelled fallback.

## Consequences

- **Reverses the agent-hiding posture.** Agents return to the lanes, but only when their *derived*
  liveness justifies it — honesty is preserved by window-based `dark` demotion, never a fabricated
  signal.
- **Window thresholds are a tuning knob,** not a contract — to be validated against real fleet data;
  changing them is a one-line edit to `DEFAULT_LIVENESS_WINDOWS`.
- **Work-attribution is partial.** Liveness keys off `agent-*` lifecycle events; an agent doing
  `task`/`pr` work (still `actor='claude-code'`) without re-slinging/idling reads stale by lifecycle
  alone. Session-linked work-liveness is a deferred refinement.
- **The Critical Path seeded chains are now stale** — they still name "bead_events the empty log" as
  the top blocker (resolved by S1). Flagged for a dedicated Critical Path refresh; out of S2 scope.
- End-to-end depends on core S1+S2a being deployed to the running hooks; until an `agent-*` event is
  emitted with the new actor, agents read `dark` (correct — we have not seen them act).
