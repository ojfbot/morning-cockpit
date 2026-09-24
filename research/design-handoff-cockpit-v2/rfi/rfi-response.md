# RFI response — fleet-navigator → morning-cockpit
(as received from the Claude Code session, 2026-08-09; preserved verbatim for the handoff)

From: the Claude Code session that built fleet-navigator.html (2026-08-08/09) · To: the design session
Branch: prototype/fleet-navigator (cut from origin/main @ 0e7ab49, pushed)
Artifact paths: research/fleet-navigator/fleet-navigator.html (built, self-contained) · fleet-navigator.template.html (source before SVG inlining) · d1..d4-*.mmd (Mermaid sources)

Answer states: A answered / U undecided / N/A wrong frame. [judgment] marks judgment over disk-fact.

## The four-first
- A1 → A. Committed and pushed on prototype/fleet-navigator, paths above. Fully self-contained.
- B8 → A. One sentence: it renders the strategy layer the cockpit has never seen — the northstar ladder (L3→L2→L1), roadmap slice states, wayfinder decision frontier, selfco vault, and the registration gaps between the census and the registry — where FleetSection renders repo activity.
- D22 → A (named defect-in-waiting). Two focus concepts today. The prototype's selection is popover-local and does NOT touch ADR-0012 fleet selection. Integration must bind them (repo-bearing nodes → cockpit fleet selection) or declare the map's focus separate. Recommendation: bind for repo-bearing nodes, no-op for non-repo nodes. [judgment]
- E28 → A [judgment]. "Cockpit nav pane" masthead line was aspiration. Preference: (c) a new numbered section hosting the tier canvas at main-column width; NOT (f) chat-sidebar tab — 372px kills the canvas (E30). U on final call; operator decides. [Superseded by operator ruling: three modes in one Fleet section.]

## A. The artifact
- A2 → One self-contained file. Zero external fetches; system font stacks; four diagram SVGs inlined at build time by a 10-line node script. Only runtime network call is Leo chat.
- A3 → Hardcoded data snapshot + one live API. Graph data is a const FLEET literal compiled by hand-run reads 2026-08-08 from core's registry. The single live call is POST http://localhost:3040/api/chat (+ SSE parse) — direct to :3040, verified end-to-end 2026-08-09; the exchange persisted into Leo's global thread (see D26).
- A4 → python3 -m http.server 8777 from a throwaway session scratchpad — not in any repo, dies with the session. 8777 not in the ecosystem port table. Attach-only entry in ~/ojfbot/.claude/launch.json. The committed file opens from disk.
- A5 → Live states: Tiers (default; drag pan, wheel zoom, reset) · Constellation toggle · node popover (~66 nodes: title, NEW HERE? prose, slice bar, ladder jump, path, Leo chat) · edge popover (16px invisible hit target; explainer typed by edge class: ladder / cluster-feed / orbit-gap / wayfinder-feed / vault-layer / deferred / halo; 13 edges Tiers, ~66 Constellation) · query (free text + cluster:, status:, kind:, tier:, unregistered; dims non-matches; node AND edge hits in right rail, clickable) · Leo chat (streams; follow-ups keep a mini-thread; instructive error if :3040 down). Nothing interactive is dead. No URL params.
- A6 → Real data, not fixture: 21 northstar/venture nodes, 26 named unregistered + 1 residual card (~11 more), 9 wayfinder maps, 9 vault layers. NOT REPO_META-derived.
- A7 → U. No recording exists; happy to record one.
- A8 → A. Hand-rolled, no library. ~200 lines vanilla JS building SVG DOM; static layout constants (tier: cluster-box grid flow; constellation: polar around the two L2 anchors); viewBox pan/zoom; native SVG event delegation; invisible 16px twin line for edge hits. No tldraw/d3/force, zero deps. Integration cost is "one React component that renders SVG." tldraw rejected for this pass (diagram-conventions: canvas surfaces are viewers over the Mermaid canon; no-new-deps posture); tldraw remains the editability experiment under diagram-first-output (#368/#372).
- A9 → A. Stat-rail readers, all outside cockpit reach: 20 NS / 13 roadmaps — registry frontmatter; 17/111/67/1 — status: tallies across the 13 roadmap files; 26 unregistered — census minus registry, hand-clustered [judgment]; 9 maps — ls decisions/wayfinder + frontmatter; 696 vault pages — file counts in ~/selfco/wiki/{sources,entities,concepts,synthesis}; 45 census — 2026-07 census record (operator memory), not recomputed. ONE new adapter ("registry reader") covers the first two groups — pure local reads, no gh, no network. Vault count crosses into ~/selfco (loop adapter precedent).
- A10 → A. Four Mermaid diagrams authored this session, mmdc-rendered; canon copies in ~/selfco/diagrams/fleet-map.md (D5–D8). Editorial with a staleness problem; need seeded/authored honesty treatment. A future slice could regenerate D5 from the registry; D6–D8 stay authored.
- A11 → A. Today: click → popover (explanation, slice bar, ladder link, Leo chat seeded with node context). Target [judgment]: same popover + click drives cockpit fleet selection for repo nodes + one action row ("open briefing", "open repo surfaces") — the popover becomes the fleet's right-click menu. Chat keeps its wiring (lands in the real Leo thread).

## B. Purpose
- B9 → A [judgment]. Same operator, two moments: 7am orientation before the lanes; ad-hoc "explain the fleet to me / to a guest" (novice-grade popovers were explicitly requested for that). Cockpit integration right for the first; the standalone file keeps serving the second.
- B10 → A. Ten-second answers: what's ready to dispatch and where (stat rail + status:ready) · which repos the delivery system doesn't see (gaps chip, dashed cards) · what decisions are open (wayfinder box, working vs charting).
- B11 → A. Not a FleetSection failure. Prompt was fleet legibility ("constellation views of all ojfbot and selfco architecture… queryable… wired to ask about state of fleet") — ns:l2-ojfbot#P2, /diagram fleet mode grown interactive. Origin conversation named cockpit as the ideal home.
- B12 → N/A mostly. Not built as Track L; no launch actions. BUT the popover is a natural host for Track L's "L3 popover" — if wanted, they should be ONE component. Flagged so nobody builds two popovers.
- B13 → A. core/decisions/wayfinder/diagram-first-output.md (umbrella #366; canvas-spike #372 gated on tldraw research #368). This prototype is evidence FOR those tickets.

## C. Data and contracts
- C14 → A. Per NODE (most nodes aren't repos): name, tier, cluster, ladders_up_to, posture, roadmap slug, slice counts {ready,queued,merged,dispatched}, desc, novice prose, path, status, unregistered flag. All (iii) new except repo identity. RepoCard has none of the ladder/slice/gap fields; the prototype has no openCount/liveness/lastActivity (deliberate).
- C15 → A. Every source is a local file read. Roadmaps live across ~13 repos via the registry's ../<app>/ paths — needs ~/ojfbot breadth, same class as the handoff adapter. No gh, no network, no write path.
- C16 → A/U. Static literal today. Integration: new REST endpoint (/api/fleet-structure?) behind the aggregate pattern is the smaller first slice [judgment]; G1 facade adoption is a contract change with CI consequences — don't smuggle it. G-owner decides.
- C17 → A. Badge-needing: (a) slice tallies — deterministic but derivation should be disclosed; (b) cluster assignment of unregistered repos — [judgment], presentation-level; (c) ALL novice prose + the four diagrams — authored/seeded. "~11 residual" and "45 census" are from a 2026-07 record — stale-capable, badge-worthy.
- C18 → A. Does NOT read REPO_META — membership truth is registry + census, which is why it can SHOW the drift (26 dashed cards is TD-007 made visible). Don't join navigator membership to REPO_META; join both to the registry and let disagreement render. This pane must be REGISTRY-GENERATED or it becomes hand-maintained inventory #5.
- C19 → A. First paint instant (inline data, synchronous SVG build, sub-ms class). Meets deterministic-first trivially. Leo streams progressively. 500KB file is 95% the four inlined SVGs; the canvas alone ~40KB.
- C20 → A. Reads outside current reach: ~/selfco/wiki counts, ~/selfco/diagrams, decisions/wayfinder/, roadmaps across siblings. Does NOT read status.jsonl or launcher registrations. adapters/loop.ts is the ~/selfco precedent.

## D. Interaction and state
- D21 → A. Full inventory (all implemented): drag-pan · wheel-zoom (cursor-anchored) · reset · Tiers/Constellation toggle · node click → popover · edge click → popover · close (button/ESC/click-away; popover swallows its own clicks) · ladder jump · query live dim + results · field:value mini-language · 6 preset chips · results click (nodes and edges) · Leo input (Enter/ASK; disabled while streaming; mini-thread). Hover: edge highlight. No keyboard nav beyond ESC/Enter, no sort, no URL state.
- D22 → (see four-first) + sharpening: canvas selection covers ~66 entities of six kinds; ADR-0012 covers repos — binding is partial by nature; non-repo nodes do nothing beyond the popover (no briefing to scope). [judgment]
- D23 → A. Nothing persists client-side. (Leo exchange persists server-side in the cockpit chat store — the cockpit's own behavior.)
- D24 → A. Mostly assumes data (baked in). Real states: Leo-unreachable instructive error; clean empty-query no-op; "0 nodes · 0 edges". Missing: detected staleness (only labeled — snapshot date stamped), loading states (nothing loads). F4 truthful-empty discipline applies to the new adapter.
- D25 → A. No animation; instant re-layout; CSS hover only. prefers-reduced-motion not consulted (nothing moves); F3 idiom inherits the obligation if added.
- D26 → A, one flag. No writes to git/registry/disk. But "Ask Leo" POSTs /api/chat and the server appends to Leo's global thread — a durable server-side write through an existing cockpit path. Not a new ADR-0005 exception, but map questions appear in Cockpit Chat history. Disclosed in the artifact footer.
- D27 → A. Mouse-only except ESC/Enter. No focus order, no tab stops on SVG nodes. Real gap for integration.

## E. The seam
- E28 → (four-first; superseded by operator ruling: modes in one section).
- E29 → A. JSX order in App.tsx @ 0e7ab49 lines 70–99: Briefing band → FleetSection → CriticalPathSection → DeliverySection → bead-lanes Section → ReadingSection → PapersSection → LoopSection. Numbered chrome applied by the shared Section component. Addendum correction: two canvas modes + a query-results rail + static mermaid narrative — NO accordion component exists. The narrative cards belong in the vault/docs, not the cockpit section.
- E30 → A. Canvas comfortable ≥ ~700px, workable ~560px; popover 400px and tier text are the real constraints. Does NOT work at 372px (consistent with #338's doubt). Main column: no hard max-width; ~1050px at a 1440 window.
- E31 → A (one-liner). Token values mirrored but not runtime attributes (data-theme/accent/density ignored); cluster hues exceed the one-signal-colour rule. To be redone; the React port should import tokens.css and drop the mirror.
- E32 → A. If it merges into FleetSection: redundant = repo identity cards; NOT redundant = openCount/liveness/lastActivity + selection-drives-briefing — those move INTO the popover/sub-line and the card grid goes. Real deletion → stage it: land, measure which surface the operator uses for repo-entry, delete the loser. [judgment]
- E33 → A/U. Net-new slices; proposed (operator asserts entrance:/check:): S-a registry adapter + /api/fleet-structure (badges per C17); S-b navigator section (React port, tokens, ADR-0012 binding); S-c popover chat reuses existing plumbing scoped to a topic. U on ordering vs PH3 Track L.
- E34 → A. Two touches: (1) fleet-onboard matrix — pane must be REGISTRY-GENERATED; add to reconcile matrix if it lands. (2) Weakens the case for a chat-only northstar conversation surface (the popover-chat IS a northstar conversation entry point). daily-logger, WantedBoard untouched.

## F. Constraints and prior art
- F35 → A. Standing rulings not to re-open: Mermaid is the canon; canvas surfaces are viewers, never the store · movement contract: nothing writes current: or flips slice status — sessions propose, humans record · standing diagrams live in the vault (ruling 2026-08-03) · tldraw is a candidate, not a bet · pnpm never npm · registry-generated fleet membership, never a fifth hand list.
- F36 → U. Didn't build against the research/ specs; from titles, dashboard-ux-flows + F-specs read as binding precedent for states/motion/empties. Design session owns the call.
- F37 → U [judgment] → out. Neither ADR-0014/F4 deferred item is needed by a first slice.
- F38 → A. One-file/zero-dep was a prototype choice, not a rule. Integration: React + Vite + tokens, no new runtime deps (canvas needs none), Node ≥ 20.19, no routing library.
- F39 → A. Same bar: Vitest for section + adapter (layout fns are pure), recorded Playwright run for the focus binding (riskiest seam). Prototype ships untested by design; the port is where tests begin.

## G. Done
- G40 → A. Single recorded run: cockpit loads → navigator renders from live adapter → type ready → click f1-substrate → popover opens AND fleet/briefing focus follows → ask Leo from the popover → answer streams → same exchange in the sidebar thread. Exercises adapter, canvas, focus seam, chat seam once each.
- G41 → A/U. Primarily moves core ns:l2-ojfbot#P2 (work is legible). Cockpit P3 only if ruled Track-L-adjacent. No current: claim made or written.
- G42 → U. Shape-wise: S-a+S-b are a this-week class (~2 sessions); the redesign ("patterns not pixels", progressive disclosure, condensation) should get its own wayfinder-grade framing. Recommend: minimal seam now, redesign as its own charted initiative.

## Corrections to the design session's priors
- Local main checkouts may trail origin/main (48a02b2 vs 0e7ab49) and carry other-agent WIP; this response and the branch are cut from origin/main.
- No accordion exists (query-results rail).

## Operator context relayed (verbatim intent, mid-session 2026-08-09)
"get morning cockpit up and running locally so i can share it with the claude design session to plan how to integrate these two tasks / extend morning cockpit and improve it .... and also condense it — morning cockpit is starting to get very noisy and we need to plan to simplify and build delightful progressive disclosure workflows"

Both cockpit processes were running at response time: read-model on :3040, Vite renderer on :5180.
