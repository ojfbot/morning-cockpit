# ADR-0003 — Lane synthesis uses a pluggable, local-first inference provider

- **Status:** Accepted
- **Date:** 2026-06-07
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0001 (standalone local read-model), ADR-0002 DRAFT (coordination)

## Context

The lane summaries (bottom-of-column "what's pending + recommended action") can be produced
two ways: a **deterministic** rollup (pure, offline, already shipped) and a **synthesized**
narrative from a language model. The first synthesis implementation called cloud Claude
(`@anthropic-ai/sdk`). That directly contradicted ADR-0001's "standalone / local / read-only"
posture: it added an outbound dependency, a per-call cost, and — critically for the eventual
home-server deploy — it sent work-item titles and repo names off the machine.

The user is open to **self-hosting a local model** for this "lightweight initial call." The
machine already runs **Ollama** on `:11434` (Apple Silicon) with `qwen2.5:7b` and
`qwen3-coder-next`, and LM Studio on `:1234`. So local inference is available today.

## Decision

1. **Synthesis is a pluggable provider**, selected by `COCKPIT_SUMMARY_PROVIDER`:
   `ollama` (default) · `claude` (opt-in) · `off`. Providers live in
   `packages/server/src/providers/` (`ollama.ts`, `claude.ts`) behind a shared
   prompt/parse module (`prompt.ts`); `llm.ts` is the selector. All return the same
   `LaneSummary` shape (`source: 'llm'`, `provider`, `model`).

2. **Local-first by default.** The default provider is self-hosted **Ollama with
   `qwen2.5:7b`** (`COCKPIT_OLLAMA_URL`, `COCKPIT_OLLAMA_MODEL` overridable). Ollama is
   called via `/api/chat` with `format: 'json'` to constrain output. This keeps the
   read-model fully offline by default and reconciles synthesis with ADR-0001.

3. **No automatic cloud cascade.** When local inference fails or times out
   (`COCKPIT_SUMMARY_TIMEOUT_MS`, default 45s), the route falls back to the **deterministic**
   summary — never silently to the cloud. Cloud Claude runs only when the user explicitly sets
   `provider=claude` (and `ANTHROPIC_API_KEY`). This guarantees the local-first property can't
   be broken by an outage.

4. **Deterministic stays the floor.** It is always computed (in `@cockpit/shared`,
   `summarizeLane`) and shipped in `/api/cockpit`. Synthesis only ever upgrades it; every
   failure path degrades to it. The result is cached server-side keyed on the lane's item-set
   so 60s polls don't re-run inference.

## Consequences

**Positive:** Local-first restored — no egress, no key, no per-call cost by default. Provider
is swappable (Ollama / Claude / LM Studio-as-openai-compatible later) without touching the
route or UI. Honest degradation: a down model shows the deterministic summary, never a blank
or a surprise cloud call. `@anthropic-ai/sdk` remains a dependency but is dormant unless
explicitly selected.

**Negative / risks:**
- **Local latency.** qwen2.5:7b is ~8s cold for a lane (acceptable for a morning cockpit;
  cached thereafter). A heavier model would be slower; tune via `COCKPIT_OLLAMA_MODEL`.
- **Quality variance.** A 7B local model is less fluent than Claude; mitigated by the
  deterministic baseline being fed into the prompt and by per-field fallback in `parseSummary`.
- **Provider drift.** LM Studio / other runtimes aren't wired yet (Ollama + Claude only);
  noted as a follow-up, not built.
- **ADR-0001 amendment.** ADR-0001 said "no LLM dependency." This ADR refines that: an LLM
  call is allowed *because it defaults to local and never silently leaves the machine*. The
  cloud path is the exception, gated behind explicit configuration.

## References

- `packages/server/src/providers/{ollama,claude,prompt}.ts`, `src/llm.ts`, `src/config.ts`.
- `packages/shared/src/summarize.ts` — the deterministic floor.
- GroupThink `src/lib/ai.ts` — prior art for an Ollama-or-Anthropic provider switch.
- ADR-0001 (the posture this refines), ADR-0002 DRAFT (coordination).
