# ADR-0005 — Chat sidebar may emit handoff beads (gated upstream write)

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0001 (standalone read-only read-model), ADR-0006 (chat posture)

## Context

ADR-0001 makes the cockpit read-only on all upstream sources: it never writes to Dolt, never
mutates `.handoff/`, never calls `gh` with side effects. Cockpit Chat's purpose includes
queuing next-session work out of a morning discussion, which requires writing real
`.handoff/` brief beads into target repos so the normal bead orient flow (core's `orient.py`)
picks them up. Staging fake beads inside the cockpit would be theater — nothing would ever
act on them.

## Decision

1. **Carve out exactly one upstream write path.** The chat handoff endpoints
   (`POST /api/chat/handoff/draft` → `POST /api/chat/handoff/approve`) may write a brief bead
   into `~/ojfbot/<repo>/.handoff/<YYYYMMDD-HHMM>-brief-<slug>.md` — and nothing else. Vault
   and Claude memory remain read-only (the ADR-0004 boundary is unchanged).
2. **Human-gated per emission.** The LLM only *drafts* (facts = conversation + the actual
   repo list); a deterministic validator (`validateBriefDraft`) gates the draft; the file is
   written ONLY on an explicit per-emission Approve in the UI. Reject writes nothing upstream
   (tombstone in cockpit `.data/chat-drafts.json`). Drafts persist in `.data/` until resolved.
3. **Write safety.** Target repo must be an existing directory under the repo root (repos are
   never created; `.handoff/` is created if missing); the resolved path must stay inside the
   repo root; an existing target file is never overwritten (`flag: 'wx'`). Filename and bead
   id are recomputed at approve time — the bead is born when approved, not when drafted.
4. **Provenance.** Emitted beads carry `actor: morning-cockpit-chat` and
   `labels.emitted_by: morning-cockpit-chat`, so misuse is attributable and filterable.

## Consequences

**Positive:** The cockpit becomes a bead *producer* with a single, narrow, audited write.
Emitted beads loop back into its own Beads pod via the handoff adapter — the system
self-verifies every emission (loop closure is observable in the UI on the next poll).

**Negative / risks:**
- ADR-0001's clean "read-only, full stop" story now has one exception; mitigated by the
  approve gate, path safety, and provenance labels.
- A misdrafted brief that gets approved is a real file in a real repo; mitigated by the
  editable preview and by beads being plain markdown (trivially deleted or superseded).

## References

- `packages/server/src/handoff-emit.ts` — draft/validate/approve/reject.
- `packages/shared/src/handoff-brief.ts` — slug/filename/validator/renderer (orient-compatible).
- `packages/server/src/adapters/handoff.ts` — the adapter that closes the loop.
- core `.claude/skills/bead/scripts/orient.py` — the downstream consumer contract.
- ADR-0001 (the posture this amends), ADR-0004 (vault boundary unchanged), ADR-0006 (chat posture).
