# ADR-0015 — sources.yaml is the single feed registry; reading.opml becomes derived

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Yuri (Jim Green), code-claude
- **Builds on:** ADR-0001 (standalone, local-first, read-only posture)
- **Source:** the Anthropic-watch Stage-1 build

## Context

The Reading pod shipped with its feed list hardcoded in `packages/server/src/config.ts`, and a
second copy hand-maintained in `reading.opml` for import into a desktop RSS reader. Nothing
parsed the OPML — a repo-wide grep found exactly one reference, a comment. The two copies were
kept in sync by hand.

They had already drifted. At the time of this decision the OPML said `Karpathy (Bear blog)`,
`Ahead of AI (Sebastian Raschka)`, and `Import AI (Jack Clark)` where `config.ts` said
`Karpathy (Bear)`, `Ahead of AI`, and `Import AI`. Feed URLs happened to still match. Nothing
would have caught it if they had not.

The Anthropic-watch poller then needed a feed list of its own, with fields the Reading pod has
no use for (`authority`, `fetch_full_text`, a quarantine record). Adding a third list to a repo
that already could not keep two in sync was not a serious option.

## Decision

**`sources.yaml` at the repo root is the one feed registry.** Each entry declares which
surfaces consume it:

```yaml
pods: [watch]            # the Anthropic watch poller only
pods: [reading]          # the cockpit Reading pod only
pods: [watch, reading]   # both — one entry, no drift
```

Three consequences:

1. `config.ts` reads `pods: [reading]` from the registry at startup instead of holding an
   array. It maps to the existing `FeedConfig` shape, so `adapters/rss.ts` and the
   `ReadingSource` type are untouched.
2. **`reading.opml` becomes a generated artifact** — `pnpm watch:opml` writes it, and it
   carries a do-not-edit header. Regenerating it produced exactly the three title corrections
   above and nothing else, which is the evidence that the absorb was faithful.
3. Endpoints that fail verification go to a **`quarantine:` block with a required `reason`
   field**, and are never deleted or replaced with an unfetched URL.

**The validator lives in `@cockpit/shared`, not in either consumer.** It operates on an
already-parsed plain object and does no file I/O, so `@cockpit/shared` keeps its
no-runtime-dependencies property while both consumers share one implementation. Two validators
would have reintroduced the exact drift this ADR removes.

Validation is strict — an unknown pod, a missing `feed_url`, an out-of-range `authority`, a
duplicate id, or a quarantine entry without a reason is a hard error at load. **A
silently-dropped source is indistinguishable from a source that published nothing**, and the
second is a normal Tuesday. A malformed registry must fail loudly rather than render an empty
Reading pod that looks like a quiet news day.

## Consequences

**Good.** One place to add a feed. The OPML cannot drift again. The watch poller and the
Reading pod cannot disagree about what a feed is called. Quarantine reasons are on the record
where the next session will find them, instead of living in a commit message.

**Costs.** The server now reads a file at startup and throws if it is malformed — a new
failure mode, chosen deliberately over a silent empty pod. `sources.yaml` carries fields most
of its entries do not use (`authority` is meaningless to the Reading pod), which is the price
of one registry over two.

**Watch for.** If a third consumer ever wants a genuinely different shape, revisit rather than
bolting on a third set of optional keys.
