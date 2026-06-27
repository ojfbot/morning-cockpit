# ADR-0014 — Persistent, precomputed read-model: stop recomputing LLM views on navigation

- **Status:** **Draft / Proposed** (operator-flagged 2026-06-27 during the F2 dogfood; needs the
  substrate + scope decisions below before it's Accepted)
- **Date:** 2026-06-27
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0003 (local-first lane synthesis; the deterministic floor), ADR-0007 (Briefing
  console), ADR-0001 (standalone read-only)
- **Relates to:** ADR-0012/F2 (repo-scoped briefing — the change that made this latency operator-visible)

## Context — grounded diagnosis (measured 2026-06-27)

First navigation is slow, and F2 made it worse. Measured against the live server (warm process):

| Surface | Latency | Note |
|---|---|---|
| `/api/cockpit` (snapshot: Dolt + handoff adapters) | **0.8 ms** | already cached (`TtlCache`) — NOT the problem |
| `/api/briefing?repo=<quiet>` | ~1 ms | scopes empty → deterministic floor (F2) |
| **`/api/briefing?repo=<active>` (cold)** | **~30 s** | snapshot + an **Ollama qwen2.5:7b** generation pass |
| `/api/briefing?repo=<active>` (warm) | ~11 ms | in-memory cache hit |

**The cost is entirely the LLM generation (~30 s/active repo, cold).** The data layer is sub-millisecond.
Two structural problems compound it:

1. **All caches are in-memory and per-process** — `aggregate.ts` (`TtlCache`), `routes/briefing.ts`
   (`Map` per repo), `routes/summary.ts` (`Map`). Every server restart → cold → the next navigation
   eats the full 30 s. There is **no persistence**; the work is recomputed, never *tracked*.
2. **F2 multiplied the exposure.** The briefing is now **per repo**, so a fresh-morning toggle across
   the active fleet is *N × 30 s* of cold LLM passes instead of one global pass. Repo-scoping was
   correct; it just exposed that we recompute a derived view we should be **materializing**.

**This is an ojfbot-wide smell, not a cockpit bug.** Any surface that derives an LLM view over slow
inputs (the daily-logger council, summaries, future agent read-models) has the same shape: expensive
derivation recomputed on demand instead of precomputed + persisted + invalidated on input change.

## Decision (proposed) — a materialized read-model with persistent tracking

Treat the briefing (and other LLM-derived views) as a **materialized read-model**: computed *ahead of*
navigation, **persisted** so it survives restarts, and **invalidated by input change**, not by cache TTL.

1. **Persist the derived views** keyed by a **content hash of their input** (the per-repo scoped
   snapshot). A repo's briefing is recomputed only when that repo's beads actually change — otherwise
   the persisted view is served instantly, cold or warm, across restarts.
2. **Background warming.** Precompute the active repos' briefings ahead of the operator: on a schedule
   (the morning is the natural trigger — the briefing should be *ready before* the cockpit is opened),
   and after each snapshot refresh detects changed inputs. First navigation becomes a cache hit.
3. **Deterministic-first serving (immediate, ADR-0003-aligned).** Never block navigation on the model.
   Serve the **deterministic floor instantly** (already sub-ms), then **upgrade to the LLM view
   asynchronously** and push it via the existing **SSE** channel (`sse.ts`) when ready. This kills the
   *perceived* 30 s even before full materialization lands, and it honors ADR-0003 (deterministic is
   the always-present floor; the model never gates the UI).
4. **Bounded, tracked recompute.** The system records *what was computed from what input hash and when*
   — "persistent tracking" — so it can answer "is this view stale?" without re-running the model.

## Open questions (must resolve before Accepted)

- **Q1 — Scope: cockpit-local now, or a shared ojfbot/core capability?** The operator framed this as a
  "larger ojfbot architectural problem." Options: (a) materialize in the cockpit now, graduate to a
  shared core capability later (the ADR-0013 precedent — solve concretely, lift when a 2nd consumer
  appears); (b) design the persistent-tracking layer in core from the start. Recommend **(a)** —
  cockpit-local first, with the interface shaped so it can lift.
- **Q2 — Substrate:** where do persisted views live — **disk** (JSON under a cache dir; simplest,
  matches standalone posture), **Dolt** (the bead store; co-located with the source-of-truth, but the
  cockpit is read-only over Dolt per ADR-0001 — would need a separate writable store or a carve-out),
  or a small dedicated KV? Recommend **disk** for v1 (preserves read-only-over-Dolt; trivial to ship).
- **Q3 — Warming trigger:** a cron/daemon, the existing morning flow, or warm-on-snapshot-change?
- **Q4 — Near-term vs full:** ship the **deterministic-first + async-SSE-upgrade** mitigation now (cheap,
  big perceived win, no persistence) and design the full materialization as a follow-up? Recommend yes.

## Consequences

- **Positive:** first navigation is instant (deterministic floor immediately; materialized LLM view
  when warmed). Restart-resilient. Recompute bounded to actual input changes, not every request. The
  N×30 s fleet-toggle cost collapses to "already computed." Reusable pattern for other ojfbot LLM views.
- **Negative / risks:** a persistence surface + a warming job enter a deliberately lean repo (justified
  by the measured 30 s). A **staleness window** (a view is as fresh as the last warm) — acceptable for
  a morning read-model; the content-hash + "tracked" timestamps make staleness *visible*, not silent.
  If it graduates to core, it becomes a shared dependency (own ADR, like ADR-0013).
- **Until accepted:** the in-memory caches stay; the cheap mitigation (Q4) can land independently and
  is the recommended immediate step.

## References

- Measured latencies above (2026-06-27, live `:3040`).
- `packages/server/src/{aggregate.ts (TtlCache), routes/briefing.ts (per-repo Map), routes/summary.ts, sse.ts}`.
- ADR-0003 (deterministic floor — the basis for deterministic-first serving).
