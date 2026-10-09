# B · Data-derived information model

Derived from the read-models the server actually serves (`/api/cockpit`, `/api/fleet`, `/api/critical-path`, `/api/delivery`, `/api/loop`, `/api/reading`, `/api/papers`, `/api/chat`), their adapters, and the populated `.handoff/` beads. "Knows" = present in a read-model type; "Shows" = rendered by a component.

## 1. What the app knows (eight information types)

| # | Type | Where it comes from | Relevance | Knows but doesn't show |
|---|---|---|---|---|
| 1 | **Promise** — a brief (`type: brief`, `status: live`) with `to:`, `refs:`, acceptance criteria | `.handoff/*.md` via `adapters/handoff.ts`; Dolt beads via `adapters/dolt.ts` | **actionable** | `refs:` (what it cites), `to:` (who owes it), `responding_to` graph, `closes:` beyond one fold |
| 2 | **Outcome** — report / decision / discovery beads; movement rows in `status.jsonl` | same adapter; `adapters/delivery.ts` | historical, closes #1 | reports are read only to compute open-hooks — never listed |
| 3 | **Unit** — a repo with role, phase, cluster, registration, northstar + roadmap | `REPO_META`, registry (`fleet-structure.ts`) | contextual | registration gap, cluster, ladder (adapter exists, renderer doesn't consume) |
| 4 | **Actor** — agents (`agent-*` bead_events) and humans (`actor:` on beads); liveness derived | `dolt.ts` → `deriveAgentLiveness` | contextual → actionable when stalled | *which repo* an agent is in; per-agent history (only tallies reach the masthead) |
| 5 | **Dependency** — chains (hand-read), `waitsOn`, ADR gates | `CRITICAL_CHAINS` (editorial) | actionable | nothing derived; the real deps live in `refs:` and roadmap `depends_on` |
| 6 | **Progress** — northstar `current:` per property, slice status, drift | `adapters/delivery.ts` | historical / diagnostic | that `current:` is asserted, not measured |
| 7 | **Intake** — feed items, papers, explainer, profile cross-links | `rss.ts`, `papers.ts`, `profile.ts` | contextual, rarely actionable | which items were *acted on* (staged suggestions are the only trace) |
| 8 | **Telemetry** — skill dispositions, capture freshness, hygiene heartbeat | `adapters/loop.ts` | diagnostic | — (already the strictest surface) |

Plus **Conversation** (Leo threads: `chat-store.ts`, one global + per-repo northstar threads) — a *container* for 1–8, not a type of its own; conversations never produce an item of type 1 or 2 except through the gated `draft handoff` button.

## 2. The structure under the data
Everything in the app resolves to one of two things:

- a **loop** — a promise (1) awaiting an outcome (2), owned by an actor (4), inside a unit (3), possibly blocked by a dependency (5), whose closure *should* record progress (6);
- **evidence** about loops — intake (7) and telemetry (8), which inform decisions but are not themselves commitments.

The S8 derivation (`deriveDecidedInFlight`) is the app's one existing acknowledgement of this: a brief that `closes:` another is a loop in the act of closing. The information model generalises it.

### Loop state machine (derived, not stored)
```
written ──(no report)──▶ waiting on <to:>
   │                          │
   │ closes: ref              ├─▶ touched (activity in unit since last looked)
   ▼                          ├─▶ decided · in flight (successor exists — S8)
decided ──────────────────────┘
   │
   ▼
closed (report responds_to) ──▶ movement recorded at merge (optional, today manual)
```
Every state above is computable from fields the adapters already read. None requires a write.

## 3. Clusters that answer a human question
| Cluster | Question it answers | Computable today from |
|---|---|---|
| **Attention** | What is waiting on *me*? | loops where `to:` is a human, or tag = decision; chains with severity decision |
| **Continuity** | What moved since I left? What can I resume? | last-viewed timestamp (new, ~20 lines) × `activityAt`, agent `lastEvent`, movement dates |
| **Initiative** | What is this body of work? | unit → its loops, agents, slices, reports; cluster → its units (registry + `[judgment]` for unregistered) |
| **Dependency** | What is holding things up? | `refs:` graph + roadmap `depends_on` + ADR gates (editorial today) |
| **Practice** | What keeps slipping? | re-briefs (title prefix "Pick up:"), deferral counts (new), days since last movement |
| **Opportunity** | What connects across repos? | `refs:` that cross repos; paper cross-links to vault entities (already staged) |

Proximity that is **not** a relationship (do not cluster on): same section number; same `kind`; same `phase` label; same day of creation.

## 4. Honesty vocabulary (one, everywhere)
Drafting Table's evidence axes, folded to four values that appear as a token and a badge:

| Badge | Token | Means | Today's spellings |
|---|---|---|---|
| **DERIVED** | `--ev-derived` | computed in this app from files/events | `auto`, `deterministic`, unlabelled lane counts |
| **ASSERTED** | `--ev-asserted` | a human wrote this value | `EDITORIAL`, northstar `current:` (unlabelled), `[judgment]` cluster |
| **SYNTH** | `--ev-synth` | a model wrote this | `✨ ollama (…)`, `Chief of Staff` |
| **SIMULATED** | `--ev-simulated` | prototype stub | — (new; mandatory in prototypes) |

Suppression (Loop's `rates unverified`) stays a separate, orthogonal flag: *we have the number and refuse to show it*.

## 5. Automatic clustering, correction, refinement
- **Automatic:** all six clusters derive from existing fields; none needs a model.
- **Correctable:** the only judgment calls are cluster membership of unregistered repos and "waiting on" when `to:` is an agent id — both surface a badge and a `fix this →` that opens the registry file / bead in the editor (no write from the cockpit).
- **Refinable:** a dismissed or deferred loop records the dismissal (count, date) and *shows* it in Practice — refinement is visible, never silent.
