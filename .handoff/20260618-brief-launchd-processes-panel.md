---
id: 20260618-brief-launchd-processes-panel
type: brief
actor: code-claude
date: 2026-06-18
title: Add a "Processes" panel to morning-cockpit that tracks launchd job health
status: live
part-of-series: launchd-tracking
refs:
  - ../core/.handoff/20260618-brief-launchd-health-manifest-and-evaluator.md
  - packages/server/src/aggregate.ts
  - packages/server/src/adapters/handoff.ts
  - packages/renderer/src/App.tsx
  - packages/renderer/src/components/HealthBar.tsx
hooks:
  - "DEPENDS ON the core foundation bead (launchd-health.mjs evaluator). Build that first, OR start here with a direct-launchctl fallback and swap to the evaluator when it lands."
  - "WHY: launchd is now a structured part of the operator's daily process (weekly skill-architecture-audit, daily sync-telemetry, dolt-beads daemon, etc.). The cockpit is the morning surface; it should show whether those jobs are actually healthy."
  - "THE POINT (don't reduce to 'is it loaded'): a job can be loaded + exit-0 + doing NOTHING. The panel's value is surfacing STALE jobs — ran green but produced no output (this happened 2026-06-18 to skill-architecture-audit via an fnm/PATH bug). Render STALE prominently."
  - "READ-ONLY: no start/stop/reload buttons. The cockpit stays a read surface (its only write is the chat handoff carve-out). Don't add a privileged control surface."
---

## Goal

A new **Processes** section in the morning-cockpit showing each launchd job's health: name, status dot (ok / stale / failed / down), schedule or daemon-running, last exit, and **output freshness** ("wrote 2h ago" vs "STALE — no output in 9d"), with a link to its log.

## How the cockpit is built (orientation)

morning-cockpit is a pnpm monorepo (`packages/{shared,server,renderer}`):
- **server** — Express read-model on `127.0.0.1:3040`. Adapters in `packages/server/src/adapters/*.ts` fan out via `Promise.allSettled`, aggregated in `packages/server/src/aggregate.ts` (adapter list ~line 19-22) into a `CockpitSnapshot` (type in `packages/shared/src/work-item.ts`, ~line 85). Served at `GET /api/cockpit`. Per-adapter TTL cache in `packages/server/src/cache.ts` (keys in `config.ts`).
- **renderer** — Vite + React on `:5180`, proxies `/api → :3040`, polls `GET /api/cockpit` every 60s (`POLL_MS`, `App.tsx:12`). Sections are stacked in `App.tsx` (~lines 66-83); there is a literal insertion slot: `{/* Add more cockpit sections here as <Section title="…">…</Section> */}` at ~`App.tsx:77`.
- **health styling** — the footer `packages/renderer/src/components/HealthBar.tsx` already renders status dots from an `AdapterHealth[]` (`up|down|degraded|disabled`). Reuse its `health-dot` styling.

The existing `packages/server/src/adapters/handoff.ts` (reads per-repo `.handoff/*.md`) is the closest pattern to copy for a shell-out/file-reading adapter.

## Build

1. **Adapter** `packages/server/src/adapters/launchd.ts` (mirror `handoff.ts`):
   - Preferred: shell out to the core evaluator — `node <core>/scripts/launchd-health.mjs --json` (path configurable via `config.ts`, e.g. `LAUNCHD_EVAL_PATH`, default `~/ojfbot/core/scripts/launchd-health.mjs`). Parse its JSON.
   - Fallback (if the evaluator isn't present yet): run `launchctl list` + read `~/Library/LaunchAgents/*.plist` directly for a basic loaded/last-exit view, and mark output-freshness `unknown`. Degrade gracefully — never throw; this is a `Promise.allSettled` member.
   - Return the per-job health array **and** a roll-up `AdapterHealth` entry (so the footer reflects "2 launchd jobs stale").
2. **Register** the adapter in the `adapters[]` array in `aggregate.ts`; add a TTL key in `config.ts` (60-120s is fine).
3. **Snapshot** — extend `CockpitSnapshot` (`packages/shared/src/work-item.ts`) with a `processes: LaunchdJob[]` field; populate it in `buildSnapshot()` (`aggregate.ts` ~line 70). Put the `LaunchdJob` type in `shared` so renderer + server agree.
4. **Renderer** — add `<Section title="Processes">` at the `App.tsx:77` slot; model the component on `packages/renderer/src/components/ReadingSection.tsx` / `PapersSection.tsx`. Per job render: name · health dot · schedule/next-run (scheduled) or "running" (daemon) · last-exit · freshness string · a link to `StandardOutPath`. Sort unhealthy (stale/failed/down) to the top.

## First steps

1. `git worktree add -b feat/launchd-processes-panel <path>` off the cockpit's main (isolate).
2. Build the adapter with the **fallback path first** (direct `launchctl`) so you can see real data immediately, then wire the evaluator once the core bead lands.
3. `pnpm dev:server` + `pnpm dev:renderer`; confirm the Processes section renders all jobs and that a deliberately-stale job shows STALE (test by pointing a contract at a missing file in the manifest).
4. PR within morning-cockpit; keep renderer styling consistent with the GroupThink tokens already in use (not Carbon/Frame OS).

## Gotchas

- **The cockpit and the launchd host are the same Mac, but the cockpit server has zero launchd awareness today** — the adapter is the bridge. It reads `~/Library/LaunchAgents` + `launchctl` on whatever host the server runs on (the Mac). Fine.
- **Don't let a launchctl hiccup tank the whole snapshot.** The adapter must catch/timeout and return a `down`/`unknown` health rather than rejecting — respect the `Promise.allSettled` contract the other adapters rely on.
- **'Loaded' ≠ 'healthy'.** If you render only loaded/exit, you've missed the point — the freshness/STALE signal (from the evaluator's `expectedOutput` contract) is the feature. With the fallback path, label freshness `unknown` honestly rather than implying green.
- **60s poll + the server's TTL cache** mean the panel is near-real-time enough; don't add websockets or a faster poll.
- **No control buttons.** Tempting to add start/stop; that's a deferred, separate decision (privileged write surface). Keep this read-only.

## Boundaries

Read-only panel. No launchctl control. No edits to plists or jobs. Depends on the core `launchd-health.mjs` evaluator for the full silent-fail contract; ship the fallback if that's not ready, with freshness marked `unknown`.
