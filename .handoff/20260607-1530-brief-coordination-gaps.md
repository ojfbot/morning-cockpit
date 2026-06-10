---
id: 20260607-1530-brief-coordination-gaps
type: brief
title: "Close the morning-cockpit coordination gaps (queue, liveness, seed capture)"
actor: code-claude
to: code-claude
session_id: 2026-06-07T15:30:00Z
status: live
created_at: 2026-06-07T15:30:00Z
hook: null
refs:
  - file:morning-cockpit/research/coordination-design.md
  - file:morning-cockpit/decisions/adr/0002-unassigned-queue-and-coordination-DRAFT.md
  - file:core/scripts/hooks/bead-emit.mjs
  - file:core/packages/workflows/src/types/bead.ts
  - file:gastown-pilot/packages/browser-app/src/components/panels/WastelandView.tsx
  - adr:0016
  - adr:0015
labels:
  project: morning-cockpit
  domain: gas-town-governance
  phase: design-complete
---

# Brief — close the coordination gaps the read-only cockpit exposed

## Context

The read-only morning-cockpit dashboard is being built separately. It exposed three
coordination gaps it cannot solve. A future-state design now exists for all three.
All claims were verified against the live Dolt store (`127.0.0.1:3307`, `.beads-dolt`)
on 2026-06-07 — not assumed.

Confirmed ground truth:
- **No unassigned queue.** Tasks are born already-assigned in convoys. The only 4 live
  `task` beads are April-11 seed data with `hook = NULL`; nothing marks intentional availability.
- **`agent_status` lies.** All 11 agent beads are `active`, all `last_session = NULL`.
  `agent-idle` is evidently never called.
- **`bead_events` is empty (0 rows, ever).** `bead-emit.mjs` writes `beads` and runs
  `DOLT_COMMIT` but never inserts an event. The liveness log exists only as schema.
- **No pre-project seed capture.** Repo-less chat ideas land nowhere; `/bead` needs a `.handoff/` dir.

The design is in `research/coordination-design.md`; the keystone decision is drafted in
`decisions/adr/0002-...-DRAFT.md`.

## Goal

Implement the coordination write-paths, in priority order from the design doc §6:

1. **`bead_events` writer** — add an `emitEvent(pool, {...})` helper to `bead-emit.mjs`;
   call it from every mutating verb (same transaction as the bead write, one `DOLT_COMMIT`).
   This is foundational and lowest-risk. Do this first.
2. **`queue-post`** verb — insert `type=task, status=created, hook=NULL, labels.queue='available'`
   with `effort`, `posted_by`, `expires_at`. Document reserved label keys (`queue`, `kind`, `effort`)
   in `types/bead.ts`.
3. **`queue-claim`** verb — the atomic compare-and-swap UPDATE guarded on
   `status='created' AND labels.queue='available'`; print `{claimed: bool}`.
4. **Liveness query + cockpit binding** — derive live/stale/dark from
   `SELECT actor, MAX(timestamp) FROM bead_events GROUP BY actor` with freshness windows
   (15 min = now, 24 h = today). Stop trusting `agent_status` for liveness.
5. **`seed-create`** verb — `type=task, kind=seed, queue=incubating, repo=''`; one CLI call
   from a repo-less chat. Optionally extend `/bead --compact` to emit it; optionally mirror
   into `~/selfco/Inbox/`.
6. **`queue-sweep`** + lazy staleness rendering.

## Acceptance criteria

- [ ] `bead_events` receives a row on every mutating emit verb; `SELECT count(*) FROM bead_events` > 0 after one session.
- [ ] `queue-post` creates a bead findable by `WHERE type='task' AND JSON_EXTRACT(labels,'$.queue')='available'`.
- [ ] `queue-claim` is atomic: two concurrent claims on one bead → exactly one `{claimed:true}`, one `{claimed:false}`.
- [ ] Reserved label keys (`queue`, `kind`, `effort`) documented in `types/bead.ts`.
- [ ] Liveness is derived from `bead_events`, not read from `agent_status`; the cockpit shows live/stale/dark.
- [ ] `seed-create` produces a `kind=seed, queue=incubating, repo=''` bead from a single CLI call.
- [ ] No change to `BeadStatus` union and no change to existing emit verbs' behavior.
- [ ] Queue rows map cleanly onto gastown `WantedBoard` columns `{title, effort, status, poster}`.

## Flag back

- **Do not accept ADR-0002 or build for agent-autonomous claiming until Yuri answers the keystone
  question:** is the queue a *human-pull triage inbox* or an *agent-autonomous pickup pool*?
  The design assumes human-pull. The wrong assumption changes CAS strictness, staleness behavior,
  and the gastown convergence direction. Surface this first.
- **Do not add a `BeadStatus` value or a new `BeadType`** without re-opening ADR-0002 — the whole
  decision rests on reusing existing fields + labels. If a consumer genuinely needs to branch on
  seed-ness at the `type` level, that is an ADR revision, not a quiet edit.
- **Do not merge morning-cockpit into gastown-pilot.** Convergence is at the Dolt data layer only
  (design doc §5). If you find yourself importing Carbon/MF/JWT into the cockpit, stop and flag.
- Decide unilaterally: verb names, TTL defaults, freshness-window values, JSON-vs-column for the
  lane (stay JSON at current volume).

## References

- `morning-cockpit/research/coordination-design.md` — full design, §6 has the prioritized backlog
- `morning-cockpit/decisions/adr/0002-unassigned-queue-and-coordination-DRAFT.md` — keystone decision
- `core/scripts/hooks/bead-emit.mjs` — the CLI to extend (additive verbs only)
- `core/packages/workflows/src/types/bead.ts` — reserved-label documentation target
- `gastown-pilot/packages/browser-app/src/components/panels/WastelandView.tsx` — WantedBoard row contract
- adr:0016 (FrameBead, `status`/`hook` semantics), adr:0015 (Wasteland/WantedBoard origin)
