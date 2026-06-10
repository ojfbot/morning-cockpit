# ADR-0004 — Research papers section + a living, read-only reader profile

- **Status:** Accepted
- **Date:** 2026-06-09
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0001 (standalone local read-model), ADR-0002 (queue write-path posture), ADR-0003 (local-first synthesis)

## Context

The cockpit is a vertical stack of visually-distinct context blocks (Beads, then Reading). The
user is an engineer who is also actively *learning* ML/AI and systems-engineering, and wanted a
third context: ~3 trending research papers with an AI breakdown that makes out-of-depth papers
legible (what it is, why it matters, **how it connects to concepts they already command**, key
claims, caveats), in the spirit of "AI as a personal research assistant." (The reader's specific
strengths/learning/domains live in a gitignored local profile, not in this repo.)

Two facts forced the shape:

1. **The local default model (qwen2.5:7b) reads abstracts well, not full PDFs.** A faithful
   figures/methods/limitations breakdown needs the full text and a stronger model.
2. **"Relate it to what I know" requires a model of what the reader knows.** A frozen string was
   rejected; the user wanted it "mapped to evolving memory + selfco vault, with a cross-linking
   layer" — i.e. the same `[[wikilink]]` / domain-MOC mesh the vault and Claude memory already use.

## Decision

1. **Source: Hugging Face Daily Papers** (`huggingface.co/api/daily_papers`) — community-curated,
   upvote-ranked, abstracts included. Top-N by upvotes (`config.papers.count`, default 3).
   `adapters/papers.ts` (native fetch + timeout, mirrors `adapters/rss.ts`'s graceful failure).

2. **Two-tier explainer.**
   - **Local (abstract-level), default:** `explainPaper` reuses the ADR-0003 provider selector
     (Ollama `qwen2.5:7b`; deterministic floor on failure). Always-on, cached.
   - **Deep-dive (full-PDF), opt-in:** `deepDivePaper` attaches the arXiv PDF (by URL document
     block) to **Claude Sonnet** (`config.papers.deepDive.model`, stronger than the cheap
     `summary.claude` tier). Gated on `ANTHROPIC_API_KEY`; per-paper, on demand.

3. **Reader profile = a living, read-only, re-derived graph.** `adapters/profile.ts` reads — off
   disk, no MCP — the vault's `wiki/_hot.md` router + each domain hub note's frontmatter, plus a
   config seed (strengths/learning), and assembles a `ReaderProfile` of `strengths`/`learning`/
   `domains` nodes (`assembleProfile`, pure). A domain is flagged `recent` when it appears in the
   _hot router (by slug, path, **or** prose label). Because it re-reads each refresh, the profile
   *evolves* as the vault/memory change — no hardcoding. The explainer is conditioned on this
   profile and returns `relatedNodes` (validated profile keys), surfaced as clickable cross-link
   chips that open the actual vault note via `obsidian://`.

4. **Write boundary — "surface + stage", read-only on upstream.** Proposed cross-links can be
   **staged** into the cockpit's OWN local JSON store (`store.ts` → `.data/suggestions.json`) for
   later review. This is the cockpit's own state — it does **not** write to the selfco vault or
   Claude memory, so ADR-0001's read-only line on upstream sources holds. The actual "apply a
   staged link to the vault/memory" write-path is **deferred & gated**, exactly like the ADR-0002
   queue write-path (it crosses into the vault and needs its own gating + ADR amendment).

## Consequences

- A new external dependency (HF) and a network adapter, both behind `Promise`-isolated failure:
  HF down → `papers` health `down`, profile still returns; Ollama down → deterministic floor.
- The cross-link mesh now surfaces inside the cockpit, mirroring the vault — but only outbound
  (read + open); nothing is written back yet.
- The deep-dive is the only path that sends paper content off-machine, and only on explicit click
  with a key present — consistent with ADR-0003's "no automatic cloud cascade."

## Out of scope (later, gated slices)

Vault/memory write-back of staged links; personalized paper *selection* (rank by profile-nearness
vs HF upvotes); per-paper read/seen state; HF model-release tier; arXiv category sources;
in-cockpit profile editing.
