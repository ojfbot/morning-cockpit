# morning-cockpit

A standalone, **local-first** read-model dashboard for starting the day. It unifies work across
projects into a vertical stack of visually-distinct **context blocks**:

- **Beads** — work-items from across every ojfbot project in three lanes: **Overnight** (what ran
  while you slept), **Daily pickup** (human-in-the-loop priorities), **Available** (unclaimed,
  pickable work, stale items flagged).
- **Loop** — live skill-telemetry read-model (use-funnel & evolution streams), independently
  degradable across its three sources.
- **System Map** — read-only rendering of committed OPM process models (see ADR-0015).
- **Reading** — curated RSS/Atom feeds with a local-model "what's worth your attention" digest.
- **Research** — trending Hugging Face Daily Papers, each with a leveled AI explainer that relates
  the paper to concepts you already command (plus an opt-in full-PDF Claude deep-dive).
- **Delivery** — a read-only projection of northstar gaps, slice pipeline status, and recent
  movement across repos.

Deliberately **outside the Frame OS ecosystem** (not a Module Federation remote, not Carbon) —
it borrows GroupThink's design tokens and stays read-only on its sources. See `CLAUDE.md` and
`decisions/adr/` for the rationale.

## Quick start

```bash
pnpm install
pnpm dev:server     # Express read-model on :3040
pnpm dev:renderer   # Vite + React renderer on :5180 (proxies /api → :3040)
```

Light/dark toggle is in the header. Optional local model (Ollama `qwen2.5:7b`) powers the
synthesis tiers; without it, deterministic summaries are the floor (no cloud calls by default —
see ADR-0003).

## Personalization (kept out of the repo)

The Research section's "relate this to what I know" feature reads a personal reader profile (your
vault path, self-described strengths/learning, research domains). That data is **not committed** —
copy `packages/server/profile.local.example.json` → `profile.local.json` (gitignored) and fill in
your own. With none set, the cross-link feature simply has no nodes.

## Layout

```
packages/shared    view-models + pure lane/staleness/paper logic + mirrored Dolt types
packages/server    Express :3040 — read-only adapters → aggregate → /api/*
packages/renderer  Vite + React — the cockpit UI, GroupThink tokens
decisions/adr      architecture decision records
```
