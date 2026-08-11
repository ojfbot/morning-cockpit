# RFI response — fleet-navigator → morning-cockpit

**From:** the Claude Code session that built `fleet-navigator.html` (2026-08-08/09)
**To:** the design session
**Branch:** `prototype/fleet-navigator` (cut from `origin/main` @ `0e7ab49`, pushed)
**Artifact paths:** `research/fleet-navigator/fleet-navigator.html` (built, self-contained) ·
`fleet-navigator.template.html` (source before SVG inlining) · `d1..d4-*.mmd` (Mermaid sources)

Answer states as requested: **A** answered / **U** undecided / **N/A** wrong frame. `[judgment]` marks
judgment over disk-fact. Addendum items A8–A11 are answered in place; styling items are one-liners
per the "look is being redesigned" ruling.

---

## The four-first

- **A1 → A.** Committed and pushed on `prototype/fleet-navigator`, paths above. Fully self-contained.
- **B8 → A.** One sentence: **it renders the strategy layer the cockpit has never seen — the
  northstar ladder (L3→L2→L1), roadmap slice states, wayfinder decision frontier, selfco vault, and
  the registration gaps between the census and the registry — where `FleetSection` renders repo
  *activity*.** Closest to your (e); see B8 below.
- **D22 → A (named defect-in-waiting).** Two focus concepts today. The prototype's selection is
  popover-local and does NOT touch ADR-0012 fleet selection. Integration must bind them (repo-bearing
  nodes → cockpit fleet selection) or explicitly declare the map's focus a separate, non-competing
  concept. My recommendation: bind for repo-bearing nodes, no-op for non-repo nodes (edges, vault
  layers, wayfinder maps) — those have no analogue in fleet selection. `[judgment]`
- **E28 → A `[judgment]`.** The masthead's "cockpit nav pane" self-description was aspiration, not a
  ruling. My preference: **(c) a new numbered section** hosting the tier canvas at main-column width —
  no routing introduced, scroll posture preserved, `FleetSection` untouched (different jobs; see E32).
  Second choice: (f) chat-sidebar tab is wrong — 372px kills the canvas (E30). U on the final call;
  operator decides.

---

## A. The artifact itself

1. **A.** As above. Everything the audit needs is in `research/fleet-navigator/`.
2. **A.** One self-contained file. Zero external fetches: no CDN, no font files (system stacks:
   Helvetica Neue + `ui-monospace` fallback for JetBrains Mono — the real JB Mono only renders if
   locally installed), no images. The four diagram SVGs are inlined at build time by a 10-line node
   script (see README.md beside the artifact). The ONLY runtime network call is the Leo chat (A3).
3. **A.** Hardcoded data snapshot + one live API. All graph data (nodes, edges, counts) is a
   `const FLEET = {…}` literal compiled by hand-run reads on 2026-08-08 from core's registry — it does
   NOT call any cockpit read endpoint. The single live call is `POST http://localhost:3040/api/chat`
   (+ SSE parse) for the popover's "Ask Leo" — directly to `:3040`, not proxied through `:8777`.
   Verified working end-to-end 2026-08-09 (qwen2.5:32b streamed a correct answer; the exchange
   persisted into Leo's global thread — see D26).
4. **A.** `python3 -m http.server 8777` from a throwaway session scratchpad — not in any repo, dies
   with the session. `8777` is not in core's ecosystem port table (checked). There is also an
   attach-only entry `fleet-navigator` in `~/ojfbot/.claude/launch.json` (url-only, no command).
   The committed file needs no server at all — it opens from disk except for the Leo call.
5. **A.** Live states and how to reach them:
   - **Tiers view** (default): pan = drag, zoom = wheel, reset button top-right.
   - **Constellation view**: toggle top-left. Same nodes, radial layout.
   - **Node popover**: click any card (~66 nodes) → title, "NEW HERE?" prose, slice bar when a
     roadmap exists, ladder link (click jumps to parent), path, Leo chat.
   - **Edge popover**: click any line (16px invisible hit target) → relationship explainer typed by
     edge class (ladder / cluster-feed / orbit-gap / wayfinder-feed / vault-layer / deferred / halo).
     13 edges in Tiers, ~66 in Constellation.
   - **Query**: free text + `cluster:f1`, `status:ready|charting|…`, `kind:vault|map|repo`, `tier:L1`,
     `unregistered`. Dims non-matches, lists node AND edge hits in the right rail; hits are clickable.
   - **Leo chat**: any popover, type + Enter. Streams; follow-ups keep a mini-thread. If `:3040` is
     down it shows an instructive error (not a silent fail).
   - Drawn-but-dead: nothing interactive is dead. The *data* is dead in one sense: it's a snapshot
     (see C17/C19). No URL params exist.
6. **A.** Real data, not fixture: 21 northstar/venture nodes (registry truth), 26 named unregistered
   repos + 1 residual card (~11 more), 9 wayfinder maps, 9 vault layers. It is NOT `REPO_META`-derived
   (see A9/C18). Density on screen is the real density.
7. **U.** No recording exists. Happy to record one against the committed file if wanted.
8. **A (addendum).** **Hand-rolled, no library.** ~200 lines of vanilla JS building SVG DOM directly:
   node positions are **computed at load** from static layout constants (tier view: cluster-box grid
   flow — cols × row-height; constellation: polar placement around the two L2 anchors), pan/zoom is
   viewBox arithmetic on wheel/drag, hit-testing is native SVG event delegation (nodes: the `<g>`
   card; edges: an invisible 16px-stroke twin line). No tldraw, no d3, no force layout, zero deps.
   Integration cost is "one React component that renders SVG," not a dependency decision. tldraw was
   considered and rejected for this pass — core's diagram-conventions rule canvas surfaces as viewers
   over the Mermaid canon, and the cockpit's no-new-deps posture; tldraw remains the *editability*
   experiment under core wayfinder `diagram-first-output` (#368/#372).
9. **A (addendum).** Reader per stat-rail number — **all read outside the cockpit's current reach**,
   none from cockpit endpoints:
   - 20 northstars / 13 roadmaps — frontmatter of `core/decisions/northstar/README.md`.
   - 17 ready / 111 queued / 67 merged / 1 dispatched — `status:` line tallies across the 13 roadmap
     files (each minus its one file-level `status: active`).
   - 26 unregistered placed — the census minus the registry, hand-clustered `[judgment]` from core's
     ecosystem table + operator memory; residual card holds ~11 more.
   - 9 wayfinder maps — `ls core/decisions/wayfinder/` + per-file `status:` frontmatter.
   - 696 vault wiki pages — file counts in `~/selfco/wiki/{sources,entities,concepts,synthesis}`.
   - 45 repos in census — the 2026-07 full-fleet census (operator memory record), not recomputed.
   A cockpit integration needs ONE new adapter ("registry reader") for the first two groups — pure
   local file reads, no `gh`, no network (C15). The vault count crosses into `~/selfco` (C20).
10. **A (addendum).** The four Mermaid diagrams are **authored** (by me, this session), then
    mmdc-rendered; the canon copies live in `~/selfco/diagrams/fleet-map.md` (D5–D8, appended per the
    standing file's update discipline). They are editorial content with a staleness problem and would
    need the "seeded/authored" honesty treatment in the cockpit — agreed. Counts inside them were
    real at authoring (same readers as A9). A future slice could regenerate D5 from the registry;
    D6–D8 are structural prose-diagrams and would stay authored.
11. **A (addendum).** Today: click → popover with (a) a written-for-newcomers explanation of what the
    thing IS and its role in the whole, (b) live-ish delivery state (slice bar), (c) ladder jump-link,
    (d) Leo chat seeded with the node's context. Target `[judgment]`: same popover, plus the click
    ALSO drives cockpit fleet selection when the node maps to a repo (D22), plus one action row —
    "open briefing," "open repo surfaces" — i.e. the popover becomes the fleet's right-click menu.
    The chat should keep exactly its current wiring (it already lands in the real Leo thread).

## B. What it is for

8. **A.** (see four-first). Longer: `FleetSection` answers "which repos are alive and what's open in
   them." The navigator answers "what is this whole thing, how do the pieces ladder into the vision,
   what state is delivery in per northstar, which decisions are still open, and which repos are
   invisible to all of that." First is operational; second is structural/strategic. They share almost
   no fields (C14).
9. **A `[judgment]`.** Same operator, two moments: (a) the 7am session — the map is the orientation
   step before the lanes; (b) ad-hoc "explain the fleet to me / to a guest" moments — the novice-grade
   popovers were explicitly requested for that. It also serves onboarding-a-collaborator. Cockpit
   integration is right for (a); the standalone file keeps serving (b).
10. **A.** Under ten seconds each: (1) "What's ready to dispatch right now, and where?" — stat rail +
    `status:ready` chip. (2) "Which repos does the delivery system not even see?" — gaps chip, dashed
    cards in place. (3) "What decisions are still open?" — wayfinder box, working vs charting.
11. **A.** Not a `FleetSection` failure. The prompt was operator pain at fleet *legibility* ("give me
    constellation views of all ojfbot and selfco architecture… queryable… wired to ask about state of
    fleet") — `ns:l2-ojfbot#P2`, served by core's `/diagram fleet` mode. The navigator is that skill's
    output grown interactive. Origin conversation also explicitly named cockpit as the ideal home.
12. **N/A → mostly no.** It was not built as Track L and has no launch actions (L1 links / L2
    live-probe absent). BUT the popover is a natural host for Track L's "L3 popover" concept — if the
    operator wants, Track L's popover work and this popover should be ONE component, not two. U on
    that merge; flagging so nobody builds two popovers.
13. **A.** `core/decisions/wayfinder/diagram-first-output.md` (umbrella core#366; canvas-spike ticket
    #372 gated on tldraw research #368). This prototype is evidence FOR those tickets. Session
    memory: `~/.claude/projects/-Users-yuri-ojfbot/memory/project_diagram_first_output.md`.

## C. Data and contracts

14. **A.** Per NODE (not per repo — most nodes aren't repos): `name`, `tier` (L3/L2/L1/map/vault/
    repo/census), `cluster`, `ladders_up_to` ref, `posture` (when declared), `roadmap` slug, slice
    counts `{ready,queued,merged,dispatched}`, `desc`, `novice` (authored prose), `path`, `status`
    (wayfinder), `unregistered` flag. Classification: **all (iii) new** except: repo identity/name
    overlaps `RepoCard`, and nothing else — no `openCount`, no `liveness`, no `lastActivity` in the
    prototype (deliberate: different job). The reverse is also true: `RepoCard` has none of the
    ladder/slice/gap fields.
15. **A.** Every (iii) source is a local file read (A9): core registry frontmatter, roadmap files
    (note: some live in sibling repos via the registry's `../<app>/` paths), wayfinder frontmatter,
    `~/selfco/wiki` dir counts. No `gh`, no network, no write path. The one cost-class caveat:
    roadmap files live across ~13 repos, so the reader needs `~/ojfbot` breadth, same class as the
    existing handoff adapter's per-repo `.handoff/` scan.
16. **A.** Neither — static literal. For integration: these fields are net-new, so they land on
    whichever side the cockpit prefers; `[judgment]` a new REST endpoint (`/api/fleet-structure`?)
    behind the same aggregate pattern is the smaller first slice; G1 facade adoption is a contract
    change with CI consequences and shouldn't be smuggled in via this feature. U — G-owner decides.
17. **A.** Under the honesty rule, three things need badges: (a) slice tallies — *derived* from
    roadmap `status:` lines minus the file-level line; deterministic but derivation should be
    disclosed; (b) cluster assignment of unregistered repos — `[judgment]`, presentation-level, the
    footer says so, a badge should too; (c) ALL `novice` prose + the four mermaid diagrams —
    authored/seeded editorial content (A10). The "~11 residual" and "45 census" figures are from a
    2026-07 census record, not recomputed — stale-capable, badge-worthy.
18. **A.** It does NOT read `REPO_META` — membership truth is the northstar registry + census, which
    is exactly why it can SHOW the drift (26 dashed cards is TD-007 made visible). Yes, considered:
    surfacing drift as user-facing signal is the feature, not a bug. Integration note: don't join
    navigator membership to `REPO_META`; join both to the registry and let disagreement render —
    that's aligned with core's `fleet-onboard` reconcile mode. Also flagging: this pane must be
    generated from the registry, or it becomes hand-maintained inventory #5 (E34).
19. **A.** First paint is instant — data is inline, SVG build is synchronous over ~66 nodes + ~66
    edges (sub-millisecond class of work; no network before paint). Meets the deterministic-first
    bar trivially. Leo chat is the only async surface and streams progressively. The 500KB file size
    is 95% the four inlined SVGs; the interactive canvas alone is ~40KB.
20. **A.** Yes: `~/selfco/wiki` counts, `~/selfco/diagrams` (canon home), `core/decisions/wayfinder/`,
    roadmap files across sibling repos. It does NOT read `status.jsonl` or launcher registrations.
    Each is a read-only file scan; the selfco reach is the only one crossing a repo boundary the
    cockpit hasn't crossed before (the loop adapter already reads `~/selfco/tracking/`, so precedent
    exists: `adapters/loop.ts`).

## D. Interaction and state

21. **A.** Complete inventory (all implemented, nothing dead): drag-pan · wheel-zoom (cursor-anchored)
    · reset-view button · Tiers/Constellation toggle · node click → popover · edge click → popover ·
    popover close (button, ESC, click-away; popover swallows its own clicks/scrolls) · ladder link
    jump · query input (live dim + results) · field:value query mini-language (A5) · 6 preset chips ·
    results-list click (nodes and edges) · Leo input (Enter or ASK; disabled while streaming;
    follow-ups continue the mini-thread). Hover: edge lines highlight. No keyboard nav beyond
    ESC/Enter (D27), no sort controls, no URL state.
22. **A.** Two focus concepts today; must become one at the seam. See four-first. One sharpening from
    the addendum: the canvas's selection covers ~66 entities of six kinds; ADR-0012 fleet selection
    covers repos. The binding is therefore partial by nature — the design question is what popover
    focus does for NON-repo nodes, and my answer is: nothing beyond the popover (they have no
    briefing to scope). `[judgment]`
23. **A.** Nothing persists. No localStorage, no keys, no cookies. (The Leo exchange persists
    server-side in the cockpit's chat store — that's the cockpit's own behavior, D26.)
24. **A.** Honestly: the prototype mostly *assumes data* because data is baked in. Real states:
    Leo-unreachable renders an instructive error; empty query renders a clean no-op; zero-match query
    renders "0 nodes · 0 edges". Missing: stale-data detection (the snapshot date is stamped in the
    masthead and footer — labeled staleness, not detected staleness) and any loading state (nothing
    loads). At integration, F4's truthful-empty discipline applies to the new adapter, not the canvas.
25. **A.** No animation. View toggle is an instant re-layout; only CSS hover transitions exist.
    `prefers-reduced-motion` is not consulted because nothing moves; if the integration adds the F3
    animated swap idiom, it inherits that obligation.
26. **A — one flag.** No writes to git/registry/disk. But "Ask Leo" POSTs to `/api/chat`, and the
    cockpit *server* appends the exchange to Leo's global thread — so the navigator causes a durable
    server-side write through an existing cockpit path. It's the cockpit's own carve-in (chat history
    has always persisted), not a new ADR-0005 exception, but a navigator user should know their map
    questions appear in Cockpit Chat history. Disclosed in the artifact's footer.
27. **A.** Mouse-only today except ESC (close) and Enter (send). No focus order, no tab stops on SVG
    nodes. Real gap for integration; SVG nodes need `tabindex`/`role` work. ⚪ acknowledged.

## E. The integration seam

28. **A `[judgment]`.** See four-first: (c) new numbered section, canvas-first with the mode toggle
    kept; not (f) — 372px kills it; not (d) — don't introduce routing for one surface; not (a/b) yet —
    see E32.
29. **A.** JSX order in `packages/renderer/src/App.tsx` (@ `0e7ab49`, lines 70–99): **Briefing band →
    FleetSection → CriticalPathSection → DeliverySection → bead-lanes `<Section>` (the
    Overnight/Pickup/Available block) → ReadingSection → PapersSection → LoopSection.** (The numbered
    "00/01/…" chrome is applied by the shared `Section` component; I read order from JSX, not the
    screen — trust the order, re-derive the printed numbers from a live render.) Addendum E29
    sharpened: my view is **one section with the existing two-mode toggle** (Tiers | Constellation);
    the third "mode" in your screenshot read — the mermaid narrative — is not a mode, it's static
    editorial content below the tool (N/A on the accordion frame: there is no accordion; that region
    is the query-results rail). The narrative cards belong in the vault/docs, not the cockpit section;
    keep the cockpit insertion to the interactive canvas + query + popover.
30. **A.** Canvas is comfortable ≥ ~700px and workable at ~560px (it's pan/zoom; density degrades
    gracefully). The 400px popover and the tier view's text sizes are the real constraints. It does
    NOT work in the 372px rail (consistent with core #338's doubt). Main column: the cockpit's
    `.sections` has no hard max-width in `app.css` (page is fluid minus the 372px chat rail) — at a
    1440px window that's ~1050px for the section: ample.
31. **A (one-liner per addendum).** Token *values* mirrored (light+dark via media query), but not the
    runtime attributes — `data-theme`/`data-accent`/`data-density` are ignored; cluster hues exceed
    the one-signal-colour rule. All to be redone in the redesign; the React port should import
    `tokens.css` and drop the mirror.
32. **A.** If it ever merges into `FleetSection`: redundant = repo *identity* (name/role/phase cards
    — the canvas nodes carry identity better); NOT redundant = `openCount`/`liveness`/`lastActivity`
    and selection-drives-briefing — those would move INTO the node popover/sub-line, and the card
    grid would go. That's a real deletion, which is why I'd stage it: land as sibling section first,
    measure which surface the operator actually uses for repo-entry, then delete the loser. `[judgment]`
33. **A/U.** Net-new — no existing S1–S9B slice covers a fleet-structure surface (S1/S2/S8/S9 ready
    slices are lanes/briefing/decided-in-flight work). Proposed shape (operator asserts `entrance:`/
    `check:`, not me): S-a "registry adapter + /api/fleet-structure (read-only, badges per C17)";
    S-b "navigator section (React port of the canvas, cockpit tokens, ADR-0012 focus binding)";
    S-c "popover chat reuses the existing chat plumbing scoped to a topic" (possibly folds into the
    northstar-conversation wayfinder work rather than new code). U on ordering vs. PH3 Track L.
34. **A.** Yes, two touches: (1) core's `fleet-onboard` matrix — this pane must be REGISTRY-GENERATED
    or it becomes enumeration surface #15 and a new TD-007 casualty; if it lands, add it to the
    reconcile matrix. (2) It plausibly obsoletes nothing today, but weakens the case for a separate
    "northstar conversation surface" being chat-only (`cockpit-northstar-conversation` map, still
    charting — the popover-chat IS a northstar conversation entry point). daily-logger, WantedBoard:
    untouched.

## F. Constraints and prior art

35. **A.** Beyond your fixed list, add these standing rulings a proposal must not re-open:
    - **Mermaid is the canon; canvas surfaces are viewers, never the store** (core
      `domain-knowledge/diagram-conventions.md`). The navigator holds no truth — files do.
    - **Movement contract:** nothing in this surface ever writes northstar `current:` or flips slice
      status — sessions/UI propose, humans record (core memory rule + registry README).
    - **Standing diagrams live in the vault** (`~/selfco/diagrams/`, operator ruling 2026-08-03);
      the cockpit shows, the vault keeps.
    - **tldraw is a candidate, not a bet** (operator revision 2026-08-03, `diagram-first-output`) —
      don't let integration adopt it implicitly.
    - **pnpm never npm**, fleet-wide.
    - Registry-generated fleet membership, never a fifth hand list (TD-007 corollary, E34).
36. **U.** I didn't build against them and shouldn't rank them; from titles, `dashboard-ux-flows.md` +
    the F-specs read as binding precedent for any new section's states/motion/empties. Design session
    owns this call.
37. **U `[judgment]` → out.** Neither deferred item is needed by a first navigator slice; pulling
    them in would couple this to F4 closeout. Operator can overrule.
38. **A.** The one-file/zero-dep constraint was a *prototype* choice (embeddability + instant open),
    not a standing rule. For integration: cockpit norms apply (React + Vite + tokens, no new runtime
    deps — the canvas needs none), Node ≥ 20.19 per CLAUDE.md, no routing library (E28c avoids it),
    no bundle concern beyond dropping the inlined SVGs (the mermaid cards stay out of the cockpit).
39. **A.** Yes, same bar: Vitest component tests for the section + adapter (pure lane-logic-style
    tests fit the layout functions well — they're pure), and a recorded Playwright run for the focus
    binding (D22) since that's the integration's riskiest seam. The prototype ships untested by
    design; the port is where tests begin.

## G. What "done" looks like

40. **A.** A single recorded run: cockpit loads → navigator section renders from the live adapter
    (not the snapshot) → type `ready` → click `f1-substrate` → popover opens AND FleetSection/briefing
    focus follows (ADR-0012 binding) → ask Leo one question from the popover → answer streams → open
    the chat sidebar and the same exchange is in the thread. Every beat of that is objectively
    checkable; it exercises adapter, canvas, focus seam, and chat seam once each.
41. **A/U.** Primarily it moves **core's `ns:l2-ojfbot#P2` (work is legible)** — that's the property
    this artifact was built under, and the wayfinder map it evidences (`diagram-first-output`) is
    anchored there. For the *cockpit's own* northstar: only if the operator rules it Track-L-adjacent
    (B12) does it touch P3; I make no `current:` claim and none is written anywhere.
42. **U.** Genuinely the operator's call, but shape-wise: S-a+S-b (E33) are a this-week class of work
    (~2 sessions); the redesign the addendum describes ("patterns not pixels", progressive
    disclosure, cockpit condensation) is an exploration that should get its own wayfinder-grade
    framing — the operator said as much mid-session ("morning cockpit is starting to get very noisy…
    plan to simplify and build delightful progressive disclosure workflows"). Recommend: minimal seam
    now, redesign as its own charted initiative, this prototype as one input to it.

---

## Corrections to "What I already know"

- Your bullet list is otherwise accurate against what I've read; one addition: local `main` checkouts
  may trail `origin/main` (mine did — `48a02b2` vs `0e7ab49`) and carry other-agent WIP; this
  response and the branch are cut from `origin/main`.
- Screenshot read correction (also in E29): there are **two** canvas modes + a query-results rail +
  a static mermaid narrative — no accordion component exists.

## Operator context relayed (verbatim intent, mid-session 2026-08-09)

> "get morning cockpit up and running locally so i can share it with the claude design session to
> plan how to integrate these two tasks / extend morning cockpit and improve it .... and also
> condense it — morning cockpit is starting to get very noisy and we need to plan to simplify and
> build delightful progressive disclosure workflows"

Both cockpit processes were running at response time: read-model on `:3040`, Vite renderer on
`:5180`. The noise/condense/progressive-disclosure mandate is design-session scope; item G42 gives
my read on sequencing it.
