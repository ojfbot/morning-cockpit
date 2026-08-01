# Findings — control-plane probe (prototype, retired)

The prototype (`probe.mjs`) has been **deleted**: its question was answered and the real wiring
landed. Kept here as the verdict record until the findings are folded into the wayfinder tickets
they feed (core #315 / #316 / #309 / #318).

**Question asked:** can *"what's working and connected vs what isn't"* be derived for the whole
fleet from committed files alone?

**Shipped as:** `@cockpit/shared` `control-plane.ts` (pure derivation) +
`packages/server/src/adapters/loops.ts` (the only I/O) + `GET /api/control-plane` + pane 08.

## 1. Yes, and portably ✅

Registry read + evidence resolution needs no vendor SDK, no network, no build step. The adapter
shells `git` and stats files. Whatever triggers it — a Claude Routine, cron, systemd, Actions, or
a human — gets identical output, because nothing it knows lives anywhere but the filesystem.

This is core #311's **portability seam** demonstrated rather than argued.

## 2. Connectedness-by-reference DOES NOT WORK ❌ — the load-bearing negative result

The prototype scored each loop by how many files reference its output artifact, as a proxy for
"does anyone read this". It reported **7 of 23 orphans — then 0 of 23** once two bugs in its own
search terms were fixed (`git-branch:telemetry/daily` basename-d to `"daily"`, and
`gh:owner/repo:wf.yml` mangled into an unsearchable string).

The honest reading is not "everything is connected". It is that **the proxy cannot discriminate**:
in a documentation-dense cluster every artifact is named somewhere, and naming is not reading.

**Therefore the shipped pane has no consumption column**, deliberately. Core #316 needs a
consumer-written signal or demonstrable downstream causality — not reference counting. This is
recorded in `control-plane.ts`'s module docblock so the idea does not get re-invented.

Secondary limit: excluding a loop's own script from its reference count also excludes legitimate
dual-mode self-consumers (`deviation-log.mjs` both writes the ledger and reads it under
`--recurrence`).

## 3. Three-quarters of the control plane is unobservable 📊

Live against the real registry: **32 loops, 7 watchable, 25 unobserved** (19 `event`, 5 `manual`,
plus parks), and **9 declare no verifier**.

`loops-liveness.mjs` — the fleet's only health check — is structurally blind to most of the
registry. **An event hook that silently stops is invisible to every mechanism that exists today.**
Pane 08 therefore leads with watched/unwatched rather than a green count; rendering only the
watchable subset would make that blindness look like health.

Feeds core #315 (census) and #318 (who watches the conductor — 9 loops already have no verifier,
so "every loop needs one" is not today's baseline).

## 4. Vantage is decisive 🔍

From a container checkout, 5 of 7 watchable loops read `unverifiable` and 1 reads `down` — evidence
lives on the operator's Mac, on an unfetched branch, or behind an authenticated `gh` call.

Input to core #309: either the conductor runs where the spines are (the split-brain S25 warned
about), **or local loops publish committed digests** and it stays single-vantage and portable —
`sync-telemetry` already proves that pattern. The shipped snapshot carries `vantage` so
"unverifiable here" can never be rendered as "broken".
