# Spec — Briefing: deterministic-first + async SSE upgrade (ADR-0014 mitigation)

The near-term mitigation for the ~30s first-navigation latency (ADR-0014, operator-approved
2026-06-27). **Not** the full materialized read-model (that's the captured initiative) — this kills
the *perceived* latency cheaply, reusing the existing SSE infra + the deterministic floor (ADR-0003).
Execute via `/tdd`.

## Problem

`GET /api/briefing?repo=` blocks on the Ollama pass (~30s/active repo) before returning anything, so
first navigation hangs. The deterministic floor is sub-ms and always available (ADR-0003). The fix:
**never block on the model** — send the deterministic briefing instantly, then push the LLM-upgraded
version over SSE when it's ready.

## Solution

**Server — new testable seam in `briefing-generate.ts`:**
```
async function* briefingFrames(snapshot, generatedAt, repo?): AsyncGenerator<BriefingSnapshot>
//   1. yield tag(briefingFallback(scopeSnapshotToRepo(snapshot, repo)))   ← instant deterministic floor
//   2. const full = await generateBriefing(snapshot, generatedAt, repo)
//      if (full.source === 'llm') yield full                              ← upgrade only if it beat the floor
```
A quiet/active-but-off repo yields ONE frame (floor); an active repo with a live model yields TWO
(floor, then llm). Pure-ish + unit-testable via the existing Ollama mock.

**Server — new route `GET /api/briefing/stream?repo=&force=`** (`routes/briefing.ts`), mirroring the
chat SSE pattern: `sseInit` → pipe `briefingFrames` via `sseSend(res,'briefing',frame)` → `sseEnd`.
Per-repo cache reused (a cached `llm` result is sent as the upgrade without regenerating; `force=1`
bypasses it). **`GET /api/briefing` stays** for agents / the GraphQL facade / compatibility.

**Renderer — `api.ts`:** `streamBriefing(repo?, force?, signal?)` → `fetch('/api/briefing/stream…')`
→ `streamSse(res)` (the existing parser), yielding each `briefing` frame as a `BriefingResponse`.

**Renderer — `Briefing.tsx`:** replace the single `fetchBriefing` with a `streamBriefing` consumer in
the repo-keyed effect: the first frame (deterministic) renders **instantly**; the second (llm) swaps
in when ready. Abort closes the stream on repo change. Honest-empty + caption + F3 swap unchanged.

## Acceptance criteria
1. **Deterministic-first:** the first frame is the deterministic floor and arrives without awaiting the
   model. A unit test: with the LLM mocked to junk/reject, `briefingFrames` yields exactly one
   (deterministic) frame; with the LLM mocked to a valid response, it yields two (floor, then llm).
2. **Upgrade only when better:** a quiet/empty repo yields a single floor frame (no redundant second).
3. **Renderer swaps:** a component test — `streamBriefing` mocked to yield [deterministic, llm] → the
   Briefing shows the deterministic content first, then upgrades to the llm content.
4. **REST `/api/briefing` unchanged** (agents/facade); `pnpm build && pnpm test && pnpm typecheck`
   green; G0 drift gates + G1/F1/F2/F3 suites stay green.
5. **Browser verify:** first navigation to an active repo renders content **immediately** (no 30s
   hang); the richer LLM version swaps in shortly after.

## Test matrix
| # | Scenario | Expected | Type |
|---|----------|----------|------|
| T1 | LLM junk/reject | `briefingFrames` yields 1 frame, `source==='deterministic'` | unit (server) |
| T2 | LLM valid | yields 2 frames: floor (deterministic) then llm | unit |
| T3 | quiet repo | yields 1 floor frame | unit |
| T4 | renderer upgrade | deterministic content shown first, llm content after | component |
| T5 | first-nav latency | active-repo briefing renders immediately | Playwright |

## Notes / boundaries
- This is the **mitigation**, not ADR-0014's persistence/warming. Caches stay in-memory; on restart the
  *upgrade* still costs 30s in the background, but navigation is never blocked. Full materialization is
  the separate captured initiative.
- ADR-0003 honored: deterministic is the floor; the model never gates the UI; no cloud cascade.
