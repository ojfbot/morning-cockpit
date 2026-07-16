# CLAUDE.md — morning-cockpit

A standalone, **local-first** read-model dashboard. It unifies "beads" (work-items) from
across every ojfbot project into three morning lanes: **Overnight** (what ran while you
slept), **Daily pickup** (human-in-the-loop priorities), and **Available** (unclaimed,
pickable work with stale items flagged).

## Deliberate non-conformance (read before "fixing" anything)

This repo is **intentionally outside the Frame OS ecosystem**, matching daily-logger's
standalone posture:

- **NOT** a Module Federation remote. **NOT** Carbon Design System. The UI borrows
  GroupThink's design tokens (Rams + Lois editorial look). See `packages/renderer/src/styles/tokens.css`.
- **NO dependency on `@core/workflows`.** We query Dolt with raw read-only SQL and **mirror**
  the bead type shapes locally (`packages/shared/src/dolt-bead.ts`). Every mirrored block
  carries a `// Mirrors <path> @ <date>` comment. This trades drift-risk for true standalone
  deployability and read-only safety. See ADR-0001.
- **Read-only, with ONE carve-out.** This app never writes to Dolt, never calls `gh` with
  side effects. The single exception is Handoff Emission (ADR-0005): the chat sidebar may
  write a brief bead into `~/ojfbot/<repo>/.handoff/` after explicit per-emission user
  approval (`packages/server/src/handoff-emit.ts`). Do not "fix" that write path away, and do
  not add any other write path — anything else belongs in the bead system (core) or the
  Track-R coordination design (ADR-0002 draft).
- **Local-first synthesis (ADR-0003).** Lane summaries default to a self-hosted model
  (**Ollama `qwen2.5:7b`**); cloud Claude is opt-in (`COCKPIT_SUMMARY_PROVIDER=claude`) and
  there is **no automatic cloud cascade** — a local failure degrades to the deterministic
  summary, never silently to the network. The deterministic rollup (`@cockpit/shared`,
  `summarizeLane`) is the always-present floor.

## Commands

**Node ≥ 20.19 required** (`.nvmrc` pins fleet-standard 24.11.1; `fnm use`/`nvm use` selects it).
The renderer's jsdom-29 test env transitively `require()`s an ESM-only module, which only works on
runtimes with `require(ESM)` support — Node 20.19+/22.12+. On Node ≤ 20.18 `pnpm --filter
@cockpit/renderer test` dies at env setup with `ERR_REQUIRE_ESM` (the tests themselves are fine).

```bash
pnpm install
pnpm build            # build all packages
pnpm test             # vitest across packages (load-bearing: packages/shared/lanes)
pnpm typecheck
pnpm dev:server       # Express read-model on :3040
pnpm dev:renderer     # Vite renderer on :5180 (proxies /api → :3040)
```

## Architecture

```
packages/shared    WorkItem view-model + pure lane/staleness logic + mirrored Dolt types
packages/server    Express :3040 — adapters (dolt, handoff) → aggregate → /api/cockpit, /api/health
packages/renderer  Vite + React — three-lane UI, GroupThink tokens, polls /api/cockpit
```

A small **server is required** because two data sources can't run in a browser: Dolt needs a
TCP socket (`mysql2`) and (later) GitHub needs to shell out to `gh`. Adapters fan out with
`Promise.allSettled` — one failing source degrades gracefully and is reported via
`/api/health`, never crashes the snapshot.

## Data sources (slice status)

| Source | Adapter | Slice | Notes |
|--------|---------|-------|-------|
| Dolt beads (agent/convoy/task/pr/session) | `adapters/dolt.ts` | 0 ✅ | "Overnight" is **timestamp-driven** off `bead_events` + created/closed_at — NOT `agent_status` (all agents read permanently `active`). |
| Per-repo `.handoff/*.md` briefs | `adapters/handoff.ts` | 0 ✅ | Open-hook logic ported from core's `orient.py`. Only ~3 repos have `.handoff/` today. |
| GitHub PRs + issues | `adapters/github.ts` | 1 | **NOT BUILT** (planned, Slice 1). The file does not exist and `aggregate.ts` wires only dolt + handoff. Plan: copy collectors from daily-logger `collect-context.ts` (gh CLI). |
| frame-standup priorities | `adapters/standup.ts` | 2 | **NOT BUILT** (planned, Slice 2). The file does not exist. Plan: read artifacts (`~/.claude/standup-telemetry.jsonl`), don't invoke the LLM skill. |
| Self-improvement telemetry (OPAV skill dispositions + odometer + audit freshness) | `adapters/loop.ts` | ✅ 2026-07-16 | Loop pane (07), own endpoint `/api/loop`. Reads `~/selfco/tracking/skill-dispositions.jsonl` (core's shadow-mode hooks, ADR-0095), re-reads `status.jsonl` independently of the delivery adapter, mtime-probes `~/.claude/skill-architecture-audit.jsonl`. Renders the funnel's zeros explicitly — the pane observes the loop, closing it happens in core. |

## Honest gaps (do not paper over)

- There is **no real unassigned-task pool** yet — tasks are born already-assigned in a convoy.
  The Available lane is *synthesized* from open issues + open briefs. The real write-path is
  designed in `decisions/adr/0002-*` (Track R). Until then, show truthful empty states.
- `agent_status` is not liveness — agent liveness is **derived** from `agent-*` `bead_events`
  recency (live/stalled/idle/zombie/dark, `deriveAgentLiveness`; S1 writer + S2 derivation,
  ADR-0008; stalled/zombie problems-view states added 2026-07-04). Live agents surface in
  Overnight; the other states are tallied in the dolt health note. Treat timestamps as truth.
  (The stale "bead_events — the empty log" seeded chain was removed from the Critical Path on
  2026-07-04; the remaining hand-authored chains carry an "editorial" badge in the UI. Several
  seeded next-moves — queue-post, queue-claim, the liveness binding — have also since shipped
  (S2/S3/S4) and await the same refresh.)
