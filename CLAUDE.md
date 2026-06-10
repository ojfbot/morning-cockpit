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
- **Read-only.** This app never writes to Dolt, never mutates `.handoff/`, never calls `gh`
  with side effects. If you find yourself adding a write path, stop — that belongs in the
  bead system (core) or the Track-R coordination design (ADR-0002 draft).
- **Local-first synthesis (ADR-0003).** Lane summaries default to a self-hosted model
  (**Ollama `qwen2.5:7b`**); cloud Claude is opt-in (`COCKPIT_SUMMARY_PROVIDER=claude`) and
  there is **no automatic cloud cascade** — a local failure degrades to the deterministic
  summary, never silently to the network. The deterministic rollup (`@cockpit/shared`,
  `summarizeLane`) is the always-present floor.

## Commands

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
| GitHub PRs + issues | `adapters/github.ts` | 1 | Copy collectors from daily-logger `collect-context.ts` (gh CLI). |
| frame-standup priorities | `adapters/standup.ts` | 2 | Read artifacts (`~/.claude/standup-telemetry.jsonl`), don't invoke the LLM skill. |

## Honest gaps (do not paper over)

- There is **no real unassigned-task pool** yet — tasks are born already-assigned in a convoy.
  The Available lane is *synthesized* from open issues + open briefs. The real write-path is
  designed in `decisions/adr/0002-*` (Track R). Until then, show truthful empty states.
- `agent_status` is not liveness. Treat timestamps as truth.
