# ADR-0006 — Cockpit Chat is grounded discussion, not a router

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0003 (local-first synthesis), ADR-0005 (handoff emission)

## Context

The cockpit needed a way to *discuss* the contents of all pods (Beads / Reading / Research) in
one place. The f1-pit-wall "chat UI" was investigated as a pattern reference: it is design-only
(Session-2 goal: corpus-first NL-query routing); what actually exists there is the
**grounded-annotation pattern** (`f1-pit-wall/packages/server/src/annotate.ts`: facts → LLM →
validate → fallback; local-first provider resolution, no silent cascade). We import that
*grounding discipline*, not a routing engine.

## Decision

1. **v1 chat = grounded conversation + exactly ONE action verb.** The chat discusses; its sole
   action is Handoff Emission (ADR-0005). There is NO utterance→UI routing — the chat never
   drives panels, filters, or navigation. That would require f1-style corpus-first research if
   ever wanted.
2. **Deterministic preload, no LLM at load.** A session opens pre-grounded with (a) the
   **Index Skeleton** — a compact per-pod outline built from already-cached snapshots
   (`buildSnapshot()` + peek-only reading/papers caches; cold pods honestly print "(not loaded
   yet)") and (b) the **Day-Goal Brief** — previous day = Overnight lane summary, today =
   Pickup summary + action. No new fetches, no model call. The exact system prompt is
   inspectable in the UI ("grounding context" disclosure).
3. **Ollama-ONLY, streamed, no silent cascade.** Chat reuses `config.summary.ollama`
   (qwen2.5:7b) via `/api/chat stream:true`, relayed as SSE. It deliberately bypasses the
   ADR-0003 provider selector: even `COCKPIT_SUMMARY_PROVIDER=claude` never routes chat to the
   cloud. Any local failure degrades to ONE honest deterministic fallback (the preload itself),
   flagged in the UI — never a retry against another backend.
4. **Context Attachments on demand.** An autocomplete multiselect over the unified registry
   (beads + reading + papers) injects an item's full content into the NEXT prompt only;
   attachment resolution is read-only and path-guarded.
5. **Chat state is cockpit-own.** History and drafts persist in `packages/server/.data/`
   (single global thread, v1) — never in upstream sources.

## Consequences

**Positive:** The chat inherits the proven annotate.ts failure posture — every degradation is
visible and truthful. Scope stays bounded: renderer sidebar + one server route family; the only
upstream write is the ADR-0005 gate.

**Negative / risks:**
- A 7B local model will sometimes paraphrase loosely; mitigated by the grounding preamble,
  title-citation instruction, and the inspectable context disclosure (the user can always see
  what the model saw).
- No routing means "open that brief" does nothing; deliberate — revisit only with f1-style
  corpus-first evidence.

## References

- `f1-pit-wall/packages/server/src/annotate.ts` — the imported grounding discipline.
- `packages/shared/src/chat.ts` — Index Skeleton / Day-Goal Brief / system prompt / fallback.
- `packages/server/src/routes/chat.ts`, `providers/ollama.ts` (`ollamaChatStream`), `sse.ts`.
- `CONTEXT.md` — ubiquitous language for Pod / Index Skeleton / Day-Goal Brief / Context
  Attachment / Handoff Emission / Grounding discipline.
- ADR-0003 (the selector this deliberately bypasses), ADR-0005 (the single action verb).
