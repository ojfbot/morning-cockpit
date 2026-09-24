# RFI — fleet-navigator → morning-cockpit

**From:** design session (claude.ai), working from `ojfbot/core@main` and `ojfbot/morning-cockpit@main`
**To:** the Claude Code session prototyping `fleet-navigator.html` on `localhost:8777`
**Date raised:** 2026-08-09
**Purpose:** unblock a UX audit of Fleet Navigator and a plan to land it inside morning-cockpit.

---

## Addendum — 2026-08-09, after two screenshots

Two screenshots landed (canvas + filter chrome; accordion tail + mermaid section). They
partially answer **A1** and shift which items matter. Read this before answering.

**Now known, don't re-answer:** the page self-describes as *"prototype for the cockpit nav
pane"* (so E28 is narrowed — it's the nav pane, confirm *which* pane); it carries three
distinct modes — a pannable cluster **canvas** with clickable nodes, an **accordion** list,
and a **rendered-mermaid** narrative section (D5, D6…); the stat rail reads 20 northstars /
13 roadmaps / 17 ready / 111 queued / 67 merged / 1 dispatched, 26 unregistered repos placed,
9 wayfinder maps, 696 vault wiki pages, 45 repos in census; search **dims** rather than
filters; solid vs. dashed encodes registered vs. unregistered.

**The operator's read: the UI/UX as drawn is not the target.** The three *patterns* are what
we're keeping. Design work starts from the patterns, not the pixels.

**Raised in priority by the screenshots:**

- 🔴 **A1 still stands** — the source is needed for the interaction and data layers, which
  screenshots can't show. Especially the canvas: layout algorithm, hit-testing, pan/zoom
  implementation, and whether node positions are computed or authored.
- 🔴 **New — A8. Is the canvas hand-rolled or a library?** tldraw, a force layout, absolute
  positions from a data file? This is the single biggest cost question for integration, and
  it decides whether the cockpit takes on a large dependency it has so far avoided.
- 🔴 **New — A9. Where does each of the three modes get its data?** The census (45 repos)
  exceeds `REPO_META` (35) and the northstar registry (20). Name the reader for each number
  in the stat rail — several look like they come from outside the cockpit's current reach
  (vault wiki pages, wayfinder maps, residual census).
- 🔴 **New — A10. Are the mermaid diagrams authored or generated?** If authored, they are
  editorial content with a staleness problem and need the cockpit's "seeded" honesty
  treatment. If generated, from what? (This is C17 sharpened — answer it there too.)
- 🟡 **New — A11. What does clicking a node do today**, and what should it do? "Clickable
  interactions" is the named keeper; the target behavior matters more than the current one.
- 🟡 **D22 gets sharper** — the canvas has its own selection *and* the cockpit has fleet
  selection (ADR-0012). Are these one focus or two?
- 🟡 **E29 gets sharper** — three vertical modes need to reconcile with the cockpit's
  numbered single-page scroll. Your view: one section with a mode switch, three sections,
  or a pane that leaves the scroll entirely?
- ⚪ **Deprioritized:** items about visual styling. The look is being redesigned.

### Vol. 3 screenshot — the node popover

A third screenshot shows **Vol. 3**, which is materially different: the masthead now reads
*"click any node or edge · chat wired to cockpit Leo (:3040)"*, and clicking a node opens a
popover with — what this is (prose) · delivery state (a merged/queued bar + slice count +
roadmap id) · `ladders up to` · the source file path · and an **"Ask Leo"** composer labeled
*"cockpit chat · local model · thread persists in cockpit."*

This answers **A11** and makes the prototype non-standalone: it is already calling `:3040`.
Consequences:

- 🔴 **New — A12. Thread keying is a hard collision, not a detail.**
  `packages/server/src/chat-store.ts` holds **one global thread** in `.data/chat-history.json`
  with no tab or unit key. A per-node "Ask Leo" promises per-repo threads the store cannot
  hold. This is open ticket **#340** in `core/decisions/wayfinder/cockpit-northstar-conversation.md`
  ("thread keying and focus changes mid-conversation"), which also has an unresolved ruling on
  what happens when focus changes mid-conversation. What does the prototype actually do today
  — post into the global thread, keep a local-only thread, or something else? And is closing
  #340 a prerequisite for this work, or does the nav pane ship with a documented limitation?
- 🔴 **New — A13. Which endpoint does the Ask box call**, with what context payload, and does
  it go through `routes/chat.ts` (which deliberately bypasses the `llm.ts` provider selector
  per core ADR-0006 §3)? If it invented its own path, that path is load-bearing policy.
- 🟡 **New — A14. Is the popover's prose ("what this is") authored or generated?** Same
  staleness/honesty question as the mermaid captions (A10) — if authored, where does it live,
  and who updates it when a repo's purpose changes?
- 🟡 **New — A15. Edges are clickable too** ("click any node or edge"). What does an edge
  open, and is it the same popover shape or a different one?
- 🟡 **New — A16. The search field carries a query language** (`"ready"`, `cluster:f1`,
  `status:charting`) documented only in placeholder text. Is the grammar specified anywhere?
  List every supported key — the audit needs to know whether this is a real query layer worth
  surfacing properly or an unfinished experiment.

---

## How to answer

Answer inline under each item. Keep the numbering — answers get referenced by number.
Write the completed file to `~/ojfbot/morning-cockpit/research/fleet-navigator-rfi-response.md`
(or paste it back into the design chat).

Three answer states are all acceptable and all useful:

- **A** — answered, with a file path or code reference backing it.
- **U** — genuinely undecided; say what the options are and who decides.
- **N/A** — the question rests on a wrong assumption; say what the right frame is.

Guessing is worse than **U**. If a claim is judgment rather than something readable on
disk, label it `[judgment]`.

**Priority key:** 🔴 blocking (the audit cannot start without it) · 🟡 shapes the plan · ⚪ nice to have.

---

## What I already know (correct me — items 1–3 exist because I might be wrong)

Read from the repos, not assumed:

- `morning-cockpit` is a local-first read-model dashboard: Express read-model on `:3040`,
  Vite renderer on `:5180` proxying `/api`. React + GroupThink tokens, deliberately **not**
  Frame OS / Carbon (`CLAUDE.md`, "Deliberate non-conformance").
- The renderer is ~16 top-level components in `packages/renderer/src/components/` —
  `FleetSection`, `RepoCardView`, `CriticalPathSection`, `DeliverySection`, `LoopSection`,
  `ReadingSection`, `PapersSection`, `Masthead`, plus `briefing/` and `chat/` subtrees.
  Styling is one 53KB `styles/app.css` over `styles/tokens.css`.
- Fleet already exists as a surface: `REPO_META` in `packages/server/src/fleet-config.ts`
  (35 hand-maintained repos with `role` + `phase`), joined to live `openCount` /
  `lastActivity` / `liveness` per `packages/shared/src/fleet.ts`, rendered by `FleetSection`.
- Fleet selection already drives repo-scoped briefing — `decisions/adr/0012-fleet-selection-drives-repo-scoped-briefing.md`,
  and northstar `P3` records Flow 01 as complete (F1 selection #17, F2 briefing #18,
  F3 swap #20, F4 empty #22 perf).
- The app is **read-only with one carve-out**: handoff emission via
  `packages/server/src/handoff-emit.ts` (ADR-0005), per-emission approval.
- Fleet membership is known-drifted across four hand-maintained inventories —
  core `TECHDEBT.md` TD-007, HIGH.

**`fleet-navigator.html` does not exist in `ojfbot/morning-cockpit@main` or `ojfbot/core@main`.**
No file matching `navigator` in either tree. Everything below follows from that.

---

## A. The artifact itself 🔴

The audit is blocked here. Nothing else matters until A1 is done.

1. 🔴 **Get me the file.** Commit `fleet-navigator.html` (plus every CSS/JS/JSON/font it
   loads) to a branch — `prototype/fleet-navigator` in `morning-cockpit` is the obvious
   home — and give me the branch name and paths. If it must stay uncommitted, paste the
   full source. A localhost URL is unreachable from the design session; screenshots are a
   distant third choice.
2. 🔴 Is it **one self-contained file** or does it load siblings? List every asset it
   fetches, including data files and CDN URLs.
3. 🔴 Does it run against **live cockpit APIs**, a **local fixture**, or **hardcoded data**?
   If live: which endpoints, and does it hit `:3040` directly or something else on `:8777`?
4. 🔴 What is serving `:8777` — `python -m http.server`, a Vite instance, an Express
   route? Is that server in a repo, and does the port conflict with anything in the fleet's
   port map (core `CLAUDE.md` ecosystem table)?
5. 🟡 Which **states are reachable in the prototype today** vs. drawn-but-dead? Give me the
   exact clicks/URL params to reach each live state, so the audit critiques real behavior
   and not a mock.
6. 🟡 Is there a **seeded/fixture dataset**? How many repos, and does it reflect the real 35
   in `REPO_META` or a trimmed set? Density is most of the UX problem here — auditing 6
   fake cards would be worthless.
7. ⚪ Any **screen recording** of you using it for a real morning. Two minutes of real use
   beats any static read.

---

## B. What it is for

8. 🔴 **One sentence: what job does Fleet Navigator do that `FleetSection` does not?**
   Is it (a) a bigger/better Fleet section, (b) a cross-repo *navigation* layer — jump to
   any repo's surfaces, (c) a fleet *health* triage view, (d) the Track L launch surface
   named as P3's remaining work, or (e) something else?
9. 🔴 **Who is the user and when do they open it?** Same 7am cockpit session, or a separate
   moment (mid-day repo-hopping, weekly fleet review)? If it's a different moment, "integrate
   into morning-cockpit" may be the wrong shape and I'd want to say so.
10. 🟡 **What decision does it help make?** Name the top three questions a user should be
    able to answer in under ten seconds.
11. 🟡 What in the **current cockpit is failing** that prompted this? Was 35 repo cards too
    many, was liveness illegible, was there no way to *get into* a repo? The specific failure
    determines whether the fix is a new surface or a change to `FleetSection`.
12. 🟡 Is this the **Track L launch surface** (L1 links, L2 live-probe, L3 popover) that
    `.claude/northstar.md` P3 lists as remaining for 100%? If yes, say so explicitly — it
    changes the integration from "new feature" to "close out an existing slice."
13. ⚪ Was it prompted by a specific handoff, brief, or ADR? Give the path.

---

## C. Data and contracts

14. 🔴 What **fields per repo** does the prototype show? List them, and mark each as
    (i) already in `RepoCard` (`packages/shared/src/fleet.ts`), (ii) available from another
    cockpit endpoint, or (iii) **new** — needing a new adapter or reader.
15. 🔴 For every (iii): **where does the data come from**, and is it readable without a
    write path or a network call? Anything requiring a `gh` shell-out or a live GitHub call
    is a different cost class and needs saying now.
16. 🟡 Does it use the **GraphQL read facade** (G1, cockpit#16 / `@core/read-model-contract`),
    or REST `/api/*`? The G0 drift gate means adding fields is a contract change with CI
    consequences — say which side of that line the prototype sits on.
17. 🟡 Is any displayed number **derived vs. stored**? The cockpit has a strong honesty rule
    — rate suppression in the Loop pane, "seeded" badges on hand-authored chains, truthful
    empty states. Does the prototype have any figure that would need a `[judgment]`,
    "seeded", or "unverified" badge under that rule?
18. 🟡 Does it depend on `REPO_META` (hand-maintained, drift-prone per TD-007)? If it makes
    that list more visible, drift becomes a **user-facing** bug rather than a cosmetic one.
    Was that considered?
19. 🟡 What's the **latency profile**? Cockpit P3 records first-nav going 45s → 1.3ms via
    deterministic-first + async SSE. Does the prototype meet that bar, and does it render
    anything before its data arrives?
20. ⚪ Does it read anything **outside** the cockpit's current reach — `~/selfco`, wayfinder
    maps in `core/decisions/wayfinder/`, `status.jsonl`, launcher registrations?

---

## D. Interaction and state

21. 🔴 **Full interaction inventory.** Every click, hover, keyboard shortcut, filter, sort,
    and search — what it does, and whether it's implemented.
22. 🔴 Does it have a concept of **selection / focus**, and is it the *same* focus as the
    cockpit's fleet selection (ADR-0012)? Two competing notions of "the focused repo" in one
    app is the most likely integration defect, and I want it named before design, not after.
23. 🟡 Does anything **persist**? The cockpit persists theme/density/accent under
    `mc.cockpit.v1` (`cockpitState.ts`, applied pre-paint in `index.html`). Does the
    prototype write localStorage, and under what key?
24. 🟡 What are its **empty, loading, error, and stale** states? F4 established that truthful
    empty states are a designed artifact here, not a fallback — does the prototype honor that
    or does it assume data?
25. 🟡 Any **animation or transition**? F3 shipped the animated focus swap *with*
    `prefers-reduced-motion` honored. Does the prototype respect it?
26. 🟡 Is anything in it a **write**? Claim, launch, open-in-editor, run-a-command — any of
    those would collide with ADR-0005's single carve-out and needs flagging now, not in review.
27. ⚪ Keyboard-only path and focus order — does one exist, or is it mouse-only today?

---

## E. The integration seam

28. 🔴 **Where should it live?** Name your current preference and why:
    (a) replace `FleetSection`; (b) an expanded mode of `FleetSection` (inline "expand");
    (c) a new numbered section in the scroll; (d) a route/view swap — the cockpit is
    single-page today, so this introduces routing; (e) a drawer/overlay; (f) a chat-sidebar
    tab, like the Northstar tab charted in `core/decisions/wayfinder/cockpit-northstar-conversation.md`.
29. 🔴 **What are the cockpit's sections and their order today?** I can see the components
    but not the live numbering. Give me the on-screen list in order (00 Briefing, 01 Fleet,
    02 Critical Path, 03 Delivery, 07 Loop, Reading, Papers…) with the real numbers, so an
    insertion point can be argued rather than guessed.
30. 🟡 **What width does it need?** The chat sidebar is 372px (`app.css:1357`); core's
    wayfinder map already carries an open prototype ticket, "does a one-thread grill survive
    a 372px rail (#338)", on exactly this constraint. What's the main column's width, and
    does Fleet Navigator work inside it?
31. 🟡 Does it use **cockpit tokens** (`styles/tokens.css` — GroupThink / Rams + Lois) or its
    own styling? Does it support both themes, both densities, and all three accents?
32. 🟡 If it merges into `FleetSection`, **what gets deleted**? A merge that only adds is a
    merge that doubles the surface. Name what Fleet Navigator makes redundant.
33. 🟡 **Slice shape.** Should this land as roadmap slices on `rm:rm-l1-morning-cockpit`?
    Is there already a `queued`/`ready` slice this belongs under, or is it net-new? Note the
    house rule: `check:` and `entrance:` are human-asserted — a design session doesn't author them.
34. ⚪ Does it change anything for **daily-logger**, `gastown-pilot`'s WantedBoard, or
    core's `fleet-onboard` surface matrix (14 surfaces)? A better fleet view might obsolete
    a surface elsewhere.

---

## F. Constraints and prior art

35. 🔴 **What's already ruled out?** List operator rulings, ADRs, or dead ends that a design
    proposal must not re-open. I already treat these as fixed: read-only + single handoff
    carve-out (ADR-0005), no cloud cascade (ADR-0003 / core ADR-0006), 127.0.0.1 binding
    with no auth, no Frame OS / Carbon, no `@core/workflows` dependency.
36. 🟡 Which **prior design docs** are still live vs. superseded? `research/` holds
    `dashboard-ux-flows.md`, `dashboard-ux-handoff-prompts.md`,
    `dashboard-ux-rollout-gated-slices.md`, `F1`–`F4` specs, `empty-state-design-followup.md`.
    Fleet Navigator sits squarely on top of these — tell me which to treat as binding.
37. 🟡 Are the **F4 / ADR-0014 deferred items** (empty-state suggested entrypoints,
    persistent read-model) in or out of scope for this work?
38. 🟡 Any **hard tech constraints** on the eventual implementation — must stay one file, no
    new deps, no routing library, bundle budget, Node version?
39. ⚪ Is there **test infrastructure** it must land under? There are Vitest component tests
    (`FleetSection.test.tsx`, `RepoCardView.test.tsx`) and recorded Playwright runs for the
    swap. Would Fleet Navigator be held to the same bar?

---

## G. What "done" looks like

40. 🟡 **What would make you say the integration succeeded?** A behavior you could record,
    ideally — the cockpit's own convention is a recorded run, not an assertion.
41. 🟡 Does this move a **northstar property**, and which? P3 is at 55 with Track L named as
    remaining; if Fleet Navigator *is* Track L, say what honest `current:` it would justify —
    but don't write `current:` anywhere, that's recorded at merge.
42. ⚪ **Timebox.** Is this a this-week slice or an exploration? It decides whether I plan a
    minimal seam or a proper redesign of the fleet surface.

---

## Answer these four first if you answer nothing else

**A1** (get me the file) · **B8** (what job it does that Fleet doesn't) ·
**D22** (does it share the cockpit's focus concept) · **E28** (where it should live).

Those four are enough to start the audit. The rest sharpens the integration plan.
