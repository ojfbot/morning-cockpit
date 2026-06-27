# Spec — F2: Repo-scoped Briefing (the core of Flow 01)

Feature spec for Slice **F2** (Track F, Flow 01) — the visible payoff: selecting a Fleet tile
re-scopes Section 00's Briefing to that repo. Decisions of record: **ADR-0012** (#1, #2, #4),
**ADR-0007** (Briefing console). Entrance gates: **G1** (facade serves briefing) ✅ + **F1**
(`selectedRepo` exists) ✅. Plan only — execute via `/tdd`.

## Problem statement

The Briefing (`Briefing.tsx`) fetches **one global** briefing (`fetchBriefing()` → `/api/briefing`),
generated from the whole snapshot (`generateBriefing` over `snapshot.lanes`). F1 made the Fleet a
selector but the Briefing ignores it. F2 makes the briefing **repo-scoped**: the operator toggles a
Fleet tile and Section 00 swaps to that repo's First Move + threads (or an honest empty for a quiet
repo). This is the dogfood moment the whole G/F track exists for.

**Assumptions made explicit:**
1. **Scope = filter the snapshot, reuse the generator.** A pure `scopeSnapshotToRepo(snapshot, repo)`
   filters each lane to `item.repo === repo`; the existing `generateBriefing` / `briefingFallback`
   then produce a per-repo briefing with no generator rewrite. One code path, global vs scoped.
2. **Renderer reads REST `?repo=` (decision D1).** Lowest-risk path to the visible swap: add `repo`
   to `fetchBriefing` → `/api/briefing?repo=X`. The **GraphQL `briefing(repo:)` is scoped too** (same
   helper) so agents get per-repo — but fully porting the renderer onto the GraphQL client is **out
   of F2** (a later slice). Both transports go repo-scoped; only the renderer's transport stays REST.
3. **Quiet repos must not lie.** Most repos have no pickup/available items → empty threads. F2 must
   render an **honest empty** First Move (not the previous repo's threads, not `MOCK_THREADS`). The
   *polish* of that empty state is **F4**; F2 ships the truthful-but-plain version.

## Proposed solution

**Shared (`packages/shared/src/briefing.ts`):** add pure
`scopeSnapshotToRepo(snapshot: CockpitSnapshot, repo: string): CockpitSnapshot` — returns a snapshot
whose `lanes.{overnight,pickup,available}` keep only `item.repo === repo`. Summaries/health pass
through (the generator only reads lanes + headlines). Unit-tested.

**Server:**
- `briefing-generate.ts` → `generateBriefing(snapshot, generatedAt, repo?)`: when `repo` is set,
  scope first (`scopeSnapshotToRepo`) then generate; the LLM grounding + fallback both see only that
  repo's items. `repo` flows into the returned `BriefingSnapshot.repo`.
- `routes/briefing.ts` → `GET /api/briefing?repo=X`: pass `repo`; **cache key includes repo** (a
  `Map<repo, {key,snapshot}>` instead of one slot) so toggling repos doesn't thrash one cache cell.
- `schema/source.ts` → `briefing(repo)` passes `repo` through to `generateBriefing` (GraphQL parity).

**Renderer:**
- `api.ts` → `fetchBriefing(repo?: string, force?, signal?)` → `/api/briefing?repo=<repo>&force=1`.
- `Briefing.tsx`:
  - read `ui.selectedRepo`; fetch that repo's briefing; **refetch when `selectedRepo` changes**
    (`useEffect` dep). Use an `AbortController` so a fast toggle cancels the in-flight fetch.
  - **always** `setThreads(b.threads)` (even when empty) — drop the `length > 0` guard that currently
    keeps stale threads; on empty, render an honest empty First Move.
  - on repo change, reset `activeId` to the new repo's first thread (the thread rail re-seats).
  - caption shows the scoped repo (e.g. `The First Move · cv-builder`) so the swap reads even when a
    repo is quiet.

## Acceptance criteria (Control Gates C0 → C2)
1. **C0 (query, Verif):** `generateBriefing(_, _, repo)` + `/api/briefing?repo=` + GraphQL
   `briefing(repo:)` all accept `repo` and return `BriefingSnapshot.repo === repo`.
2. **C1 (scoping, Valid) — TPM 100%:** `scopeSnapshotToRepo(snap, R)` yields only items with
   `repo === R`; a labelled set → the brief's underlying items are all `R`. **Pass = brief.repo ==
   selectedRepo on the set; no cross-repo item leaks.**
3. **C2 (swap-on-select, Valid):** changing `ui.selectedRepo` rebinds Section 00 to that repo's brief
   **or an honest empty** (no stale/fabricated threads). **Pass = N repos each yield their own brief
   or honest empty; a quiet repo shows the empty First Move, never the prior repo's threads.**
4. `pnpm build && pnpm test && pnpm typecheck` green; tests pure (no live Dolt — scoping + renderer
   tests use seeded snapshots / mocked `fetchBriefing`). G0 drift gates + G1 facade tests stay green.
5. **Browser verify (dogfood):** run the stack; toggle ≥2 Fleet tiles; Section 00 visibly swaps; a
   quiet repo shows the honest empty. (Playwright or manual.)

## Test matrix
| # | Scenario | Input / state | Expected | Type |
|---|----------|---------------|----------|------|
| T1 | scope filters lanes | snapshot w/ mixed repos, `scopeSnapshotToRepo(_, 'core')` | only `repo==='core'` items in every lane | unit (shared) |
| T2 | scope is pure | call twice | original snapshot unmutated | unit |
| T3 | generate carries repo | `generateBriefing(snap,_, 'core')` | `result.repo === 'core'` | unit (server) |
| T4 | REST repo param | `GET /api/briefing?repo=core` | `repo==='core'`, scoped threads | integration |
| T5 | GraphQL parity | `briefing(repo:"core")` | `repo==='core'` (source passes it) | unit |
| T6 | renderer refetch on select | mock fetchBriefing; change `selectedRepo` | fetchBriefing called with new repo | component |
| T7 | honest empty | repo with no items → empty threads | empty First Move; NOT stale/MOCK threads | component |
| T8 | caption shows repo | select cv-builder | caption includes `cv-builder` | component |

## Open questions (settle in `/tdd`)
- **D1 (renderer transport):** REST `?repo=` (recommended — visible swap, low risk; GraphQL also
  scoped) vs port the renderer to the GraphQL client now. Recommend REST for F2; GraphQL-port later.
- **D2 (empty-state depth):** F2 ships a plain honest empty; **F4** owns the designed empty + the
  fabricated-thread=0 guarantee. F2 must not regress to MOCK/stale.
- **D3 (LLM cost per repo):** per-repo generation is slower; mitigated by the per-repo cache + the
  deterministic floor. Demo responsiveness relies on the fallback when Ollama is slow/absent.

## ADR note
Executes ADR-0012 (#1,#2,#4) + ADR-0007. No new ADR. F3 (animated swap) and F4 (designed empty)
build on this; F2 reports the per-repo briefing shape to them.
