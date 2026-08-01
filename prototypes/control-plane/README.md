# Prototype — control-plane probe

**Status: throwaway.** Per `/prototype`: record the verdict, then delete. Kept only until the
findings land in the wayfinder tickets it feeds (core #315/#316/#309/#318).

## The question

Can *"what's working and connected vs what isn't"* be derived for the whole fleet from
**committed files alone** — and what does it actually show?

Run:

```bash
CP_CORE_ROOT=~/ojfbot/core CP_SCAN_ROOT=~/ojfbot node probe.mjs          # table
CP_CORE_ROOT=~/ojfbot/core CP_SCAN_ROOT=~/ojfbot node probe.mjs --json   # pane-shaped
```

## Verdicts

### 1. Feasible, and portable by construction ✅

~250 lines, zero dependencies, no build step, no network, no vendor SDK. Reads
`core/decisions/loops/loops.md`, resolves each `evidence_ref:`, shells `git` and `rg`.

This is the **portability seam** (core #311) demonstrated rather than argued: every fact the
probe knows comes from the filesystem, so the trigger above it is genuinely swappable. A Claude
Routine, a cron entry, a systemd timer, a GitHub Actions schedule, and a human typing
`node probe.mjs` all produce byte-identical output. Nothing needs re-pointing but the caller.

### 2. Connectedness-by-reference DOES NOT WORK ❌ — the load-bearing negative result

The novel column was: does anything reference this loop's output artifact? Zero references would
mean the loop produces into a void.

**First run said 7 of 23 artifacts were orphans. After fixing two bugs in my own search, the
answer was 0 of 23.** Both bugs inflated orphan counts by searching for terms that could never
match — `git-branch:telemetry/daily` basename-d to `"daily"`, and `gh:owner/repo:workflow.yml`
mangled into an unsearchable string.

So the honest reading is not "everything is well connected." It is that **the proxy cannot
discriminate.** In a documentation-dense cluster every artifact is named *somewhere* — an ADR, a
handoff bead, a CLAUDE.md, a roadmap slice. Naming is not reading.

Consequence for core #316 (*What "consumed" means for a loop's output*): **consumption cannot be
inferred from references.** It needs a real signal — a claimed/consumed ledger written by the
consumer, or demonstrable downstream causality (this artifact changed, therefore that one did).
This prototype's job was to make that cheap approach fail before it got built into the cockpit,
and it did.

Secondary limit found: excluding the writing script from its own reference count also excludes
legitimate self-consumers — `deviation-log.mjs` both writes the ledger and reads it under
`--recurrence`. A dual-mode script is a real consumer that this method scores as an orphan.

### 3. The scheduled surface is far smaller than the registry looks 📊

| | |
|---|---|
| Loops declared | 32 |
| **EXCLUDED from liveness** | **25** — 19 `event`, 5 `manual`, plus disabled parks |
| Actually cadenced (can breach) | 7 |
| Reading OK from this vantage | 1 (`defects-sweep`, 0.7d) |
| Declaring **no verifier** | **9 / 32** |

Three-quarters of the registry has no cadence to breach, so `loops-liveness.mjs` — the fleet's
only health check — is structurally blind to most of it. Event-driven hooks are the bulk of the
control plane and **nothing watches whether they fire.** A hook that silently stops is invisible
to every mechanism the cluster currently has.

Feeds core #315 (census) directly, and #318 (*who watches the conductor*): 9 loops already declare
no verifier, so "every loop needs one" is not today's baseline.

### 4. Vantage is decisive, and argues for publish-digests 🔍

From a cloud checkout, 5 of the 7 cadenced loops are `UNVERIFIABLE` and 1 is `DOWN` — not because
they are broken but because their evidence is on the operator's Mac (`~/.claude/*.jsonl`), on a
branch not fetched (`telemetry/daily`), or behind an authenticated `gh` call.

This is the sharpest input to core #309 (*where the conductor runs*): a cloud-hosted conductor
reading only git sees almost nothing today. Either it runs where the spines are — accepting the
split-brain that S25 warned about — **or local loops publish committed digests and the conductor
stays single-vantage and portable.** `sync-telemetry` already proves the digest pattern works.

The probe reports this as a statement about *the vantage*, never about the loop. That distinction
has to survive into anything built from this.

## What this is NOT

- **Not a consumption metric.** See verdict 2. The `refs` column is retained in the JSON as a weak
  signal, deliberately never labelled "consumed".
- **Not a replacement for `loops-liveness.mjs`.** The working half is reimplemented standalone only
  to prove the read needs nothing but files. Core's version stays authoritative.
- **Not wired into the cockpit.** No adapter, no route, no pane. `--json` emits a pane-shaped
  payload (`sample-output.json`) so the shape can be argued about before anything is built.
- **Not a writer.** Reads only, exits 0 on findings, exits 2 only on mechanical failure — the
  cluster's "a measurement never blocks" rule.

## Disposition

Delete once the four findings above are recorded in their tickets. If a control-plane pane is
built later, `deriveControlPlane()` belongs in `@cockpit/shared` as a pure clock-injected function
next to `fleet.ts` and `liveness.ts`, with the I/O in a `packages/server/src/adapters/loops.ts`
following the `adapters/loop.ts` degradation pattern — one `AdapterHealth` per source, never throw.

**Do not port the `refs` column into that pane without a better signal behind it.**
