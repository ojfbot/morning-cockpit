# Design follow-up — the Briefing empty state (input for F4 + a later design review)

Captured 2026-06-27 from the operator during the F2 dogfood (watching the Fleet→Briefing focus-swap
land a truthful empty First Move for quiet repos like lean-canvas). **Not built here** — this records
intent so F4 and a subsequent design review don't lose it.

## The operator's framing

1. **The empty state should ideally become rare.** The north star is that the cockpit gets the
   operator into a state where there *isn't* idle, un-triaged work sitting around — so a repo showing
   "no first move" is a signal the system is working, not a dead end. Don't over-invest in making
   emptiness comfortable; the goal is to not be there often.

2. **But when a repo IS empty, the empty state is an opportunity, not just an apology.** Rather than
   only saying "quiet — nothing to fabricate" (what F2 ships), the empty First Move could surface
   **suggested entrypoints** that seed *new* work for that repo:
   - **New threads** — start a fresh decision/brief for this repo from scratch.
   - **Audits** — "nothing's stale, but want to run an audit?" (e.g. deepen/security/triage passes).
   - **Integrations** — surface integration opportunities or setup the repo is missing.

   i.e. the empty state turns "no pending decisions" into "here's how to *create* the next move."

## Status / where this goes

- **F4** (truthful empty First Move) ships the *honest, plain* empty state — fabricated-thread rate = 0.
  It should NOT try to build the suggested-entrypoints UX; that's richer and needs design.
- **The suggested-entrypoints idea is a deliberate design-review item**, not an F4 build target. It
  likely becomes its own slice (an "empty-state entrypoints" feature) after the design review decides
  the contents (which audits/integrations/new-thread affordances, and how they map to real verbs).
- Honesty constraint carries over: any suggested entrypoint must map to a **real** action (a core verb
  that exists, or an honestly-disabled affordance) — no fabricated capabilities, consistent with the
  Briefing's existing "verb not built yet" discipline.

## Open questions for the design review
- Which entrypoints earn a place (new-thread / audit / integration / something else)?
- Do they belong only in the empty state, or always-available (e.g. a "+" affordance on any repo)?
- How do audit/integration entrypoints map to core verbs — and which exist today vs need building?
