# CONTEXT.md — morning-cockpit ubiquitous language

- **Pod** — one visually-blocked Section in the cockpit's vertical stack (Beads, Reading,
  Research). The chat sidebar is NOT a pod; it is chrome alongside the stack.
- **Index Skeleton** — the compact, deterministic, per-pod outline (titles/status only, no bodies)
  preloaded into the chat system prompt. Built from cached snapshots; never triggers fetches.
- **Day-Goal Brief** — previous/current day framing derived from lane summaries (Overnight =
  previous, Pickup = current). Inferred, not user-authored.
- **Context Attachment** — a bead/article/paper the user multiselects into the chat input; its
  full content is injected into the next prompt only.
- **Handoff Emission** — the chat's single action verb: draft → preview → human Approve → write a
  real brief bead into a target repo's .handoff/. The cockpit's only upstream write (ADR-0005).
- **Grounding discipline** (imported from f1-pit-wall annotate.ts) — context-in-prompt, validated
  or deterministic-fallback output, local-first provider, no silent cloud cascade.
