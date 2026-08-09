# UX audit — morning-cockpit + Fleet Navigator

Read from screenshots of the running app (`:5180`, edition no. 42, 8 Aug 2026) and the
Fleet Navigator prototype (`:8777`, vols. 2–3), against source in
`ojfbot/morning-cockpit@main` and `ojfbot/core@main`.

Findings are severity-tagged: **S1** structural (changes what the product is) · **S2**
significant (costs the user something every session) · **S3** worth fixing.

---

## The thesis

**The cockpit is built as a magazine. The job it now has is a control plane. Those are
different forms and almost every finding below is a symptom of that gap.**

A magazine has a masthead, an issue number, numbered sections in a fixed order, and one
linear reading path. Every one of those is present: `LOCAL EDITION · NO. 42`, a two-line
display masthead, `00 — BRIEFING` through `07 — LOOP`, one continuous scroll. It is a
genuinely beautiful magazine.

But a magazine is a **read-through** form: you start at the top, you go until you stop, the
order is the editor's. A control plane is a **return-to** form: you arrive several times a
day with a specific question, and what's urgent must come to you. The cockpit currently
answers every arrival with the same fixed sequence, at the same volume, in the same order,
whether the news is "three blockers gate your coordination layer" or "nine RSS items came in."

That's the frame. The naming relic you flagged is downstream of it — see §5.

---

## 1. What is genuinely good — do not lose these in any redesign

The redesign risk here is throwing out real assets. These are assets.

- **The typography.** The Rams/Lois editorial voice, the display/mono pairing, the section
  rules. This is a distinctive product with a point of view, and almost nothing in its class
  looks like it. Keep it.
- **The honesty apparatus.** `EDITORIAL` badges on hand-read chains; the footnote *"Chains
  hand-read from coordination-design.md — wire live repo deps + bead refs to make this
  auto-update"*; Loop's per-population funnels with `LEGACY` never blended. This is rare and
  it is the product's actual differentiator.
- **The best empty state in the app**: *"Queue is empty (no real unassigned pool exists yet
  — see ADR-0002)."* Truthful, causal, and it names the decision that would change it. That
  is the model for every other empty state.
- **The decision card** in Briefing — a question, `Pick it up now` / `Defer 7 days`, one
  `RECOMMENDED`. Clear, low-ceremony, and it ends in an artifact.
- **The provenance line** — `deterministic · ↻`, `ollama (qwen2.5:32b)`, `grounding context`.
  Every synthesized thing says who synthesized it. Keep this everywhere.

---

## 2. Structural findings

### S1-A · Seven sections, no navigation, no priority

Eight numbered sections in one flat scroll with no index, no jump, no collapse, no memory of
where you were. `07 — LOOP` is several screens below the fold. The only wayfinding is the
scrollbar.

The order is also fixed and content-independent. Reading (05) and Research (06) sit between
Work (04) and Loop (07) permanently, so getting from "what should I do" to "is the system
learning" crosses two sections of ambient intake every time.

**Direction:** the sections are good *units*; their fixed linear arrangement is the problem.
A control plane wants a persistent index (the section numbers are already a natural nav),
collapsed-by-default sections with a one-line state summary in the header, and an order that
can respond to state — or at minimum a top-level "what changed since you last looked."

### S1-B · Everything is at the same volume

Every section is: red number · huge display heading · right-aligned mono metadata · rule ·
content. `Critical Path` (three blockers gating the whole coordination layer) and `Reading`
(9 feed items) are rendered at identical weight, size, and prominence.

Hierarchy exists *within* sections and never *between* them. The result is that nothing is
loud, because everything is.

**Direction:** the masthead already computes a state sentence (*"Quiet night. 42 briefs want
a decision, and zero tasks are going stale"*). That sentence is the only cross-section
prioritization in the app and it's decorative. Make it structural — it should determine what
opens, what collapses, and what jumps to the top.

### S1-C · Space allocation is inverted relative to information

`04 — Work` gives three equal columns to `OVERNIGHT 0`, `PICKUP 42`, `AVAILABLE 0`.

Two-thirds of the width renders *nothing happening* — and not tersely: each empty lane gets a
dashed empty state **plus** a multi-paragraph LLM summary explaining the emptiness at length.
The Overnight summary spends four paragraphs and four bullets to say "no activity," ending in
a red-emphasized recommendation to *"conduct a routine check on automated processes."*

Meanwhile the lane with 42 real items gets one narrow column, ungrouped, unsorted, unfiltered
— an undifferentiated stack of `BRIEF · core · code-claude · 4d ago`.

**Direction:** lane width should follow lane contents. An empty lane is one line. The 42-item
lane is the actual work surface and needs grouping (by repo, by age, by type), and a way to
act on more than one at a time.

### S1-D · Fleet is a 35-item grid with no structure — and Navigator already solves it

`01 — Fleet` renders 35 uniform cards; `0 live · 8 stale · 27 dark`. Roughly thirty cards read
`0 open / no activity`. The signal — core at 23 open, capture-agent 11d, fairway 9d — is
distributed evenly through noise, because a uniform grid asserts that all 35 repos are equally
worth your attention, which is exactly false.

This is the same problem Fleet Navigator's canvas is attacking, and **Navigator's answer is
better**: clusters give the fleet a shape, laddering shows why a repo matters, solid-vs-dashed
encodes registration. That's not a coincidence — it's the strongest argument for the
integration. See §4.

### S1-E · Two competing focus concepts, and chat is already the casualty

The cockpit has fleet selection (ADR-0012: selecting a repo re-scopes the Briefing). Navigator
has canvas node selection. The chat rail shows tabs `Leo · Northstar · morning-cockpit`.

And the Navigator popover's messages arrive in Cockpit Chat **string-prefixed**:
`[fleet-navigator] I'm looking at "morning-cockpit" (L1 · PLATFORM SPINE)…`

That prefix is a workaround for a missing key. `packages/server/src/chat-store.ts` holds one
global thread in `.data/chat-history.json` with no tab or unit key — which is open ticket
**#340** in core's wayfinder map. Right now context is being smuggled into a shared thread as
a text prefix, so two surfaces' conversations interleave in one history.

**This must be decided before design, not after.** It is the single hardest constraint in the
integration.

---

## 3. Content and signal findings

### S2-A · The LLM summaries are the weakest content in the app, and one is false

The `AVAILABLE` synthesis recommends *"better tracking of tasks across repositories such as
`repo-frontend`, `repo-backend`, and `repo-infrastructure`."*

**Those repos do not exist.** They are not in `REPO_META`, not in the fleet, not anywhere.
A 7B model invented three repositories and the cockpit rendered them in bold red as a
recommended action, inside an application whose stated thesis is that it never shows
synthesized filler.

This is not a summarization-quality nitpick. It's a truth violation in the surface that most
loudly claims truthfulness, and it undermines every honest thing around it.

Beyond the hallucination, the summaries are structurally wrong: they are longest when there is
least to say, and the red-emphasized `→` recommendation — the most visually emphatic text on
the whole section — is consistently the least informative sentence in it.

**Direction:** three options, all better than today. (a) Suppress synthesis when a lane is
empty — the deterministic floor already handles "nothing happened" in one line. (b) Cap
synthesis at one sentence plus at most three bullets, and make the `→` line a *specific*
next action or omit it. (c) Ground the model against `REPO_META` and refuse any output naming
an unknown repo. I'd do all three, and (c) is close to mandatory given the honesty posture.

### S2-B · Red carries at least eight incompatible meanings

Counted across the screenshots, red is: section numbers · urgency in the masthead sentence ·
`0 open` counts on every fleet card · `DECISION NEEDED` · the `RECOMMENDED` action · every
`Synthesize` button · Delivery progress-bar fill · Loop funnel-bar fill · the selected chip ·
inline links · the `HIGH` severity chip · the `Brief ↑` CTA.

Two consequences are actively harmful:

- On the fleet grid, `0 open` renders red on ~30 of 35 cards. **The most common and least
  urgent state in the fleet is styled as alarm.**
- In Delivery and Loop, red means *quantity* (progress, volume). Everywhere else red means
  *attention*. So a long red bar reads as "bad" when it means "good" — `P1 66%` and Loop's
  `169 ignored` are drawn identically.

**Direction:** red earns one job — *this needs a human decision*. Progress and volume become
neutral/foreground. Severity gets its own scale (the `HIGH`/`BLOCKED`/`DECISION` chips are
already there and already differentiated — extend that vocabulary instead of leaning on red).

### S2-C · Honesty treatment is applied inconsistently

Loop suppresses rates entirely until a capture-quality artifact exists, and labels populations
so eras are never blended. That's the strict standard.

Delivery renders `66%`, `50%`, `55%`, `30%`, `10%` as precise red bars with no badge — but
those are hand-asserted `current:` values from northstar frontmatter, and `l1-morning-cockpit`'s
own file calls itself **"FIRST-CUT — placeholder %s and framing."** The strictest surface in
the app sits four sections below the least strict, and neither knows about the other.

**Direction:** one honesty vocabulary applied everywhere — asserted vs. derived vs. suppressed
— rather than per-section conventions. Delivery's bars need the `EDITORIAL` treatment Critical
Path already uses.

### S2-D · Loop renders three full funnels including one that is all zeros

`FUNNEL · LEGACY` is five labeled rows of `0` with five empty bars. Honest, and correct not to
delete — but it occupies as much vertical space as the funnel with real data.

**Direction:** collapse zero-population funnels to a single line that keeps the claim
("legacy: 0 events, archived at the 2026-07-17 rebuild") and expands on demand.

### S2-E · Research chips are truncated to unreadability

`READING AS` shows eleven chips over two rows, several cut mid-word: *"Senior software
engineering — TypeScript, distribut…"*, *"ojfbot fleet architecture (beads, convoys, Frame,
Do…"*. One is selected (`LLM Tooling`) and the selection is a red outline that reads like an
error.

**Direction:** these are a profile, not a filter bar. Short labels, or a single line stating
the active profile with an edit affordance.

### S3-A · Smaller items

- The collapsed chat rail is vertical text (`ASK THE CHIEF OF STAFF`) — a full head-tilt to
  read a label that could be an icon plus a count of unread.
- `Beads` items all read `code-claude · 4d ago` with no visual distinction between 42 rows.
- Delivery bars have no axis, no target marker, and no indication of movement direction.
- The masthead consumes a full viewport height on load — the largest element in the app is
  the one with the least information.
- `DENSE` / `LIGHT` sit top-right as equals; they're different axes (density, theme).

---

## 4. Fleet Navigator — what to take, what to leave

The prototype's *styling* is not the target (your call, and correct). Three patterns are.

**Pattern 1 — the cluster canvas. Take it, and make it a *mode* of `01 — Fleet`.**
This is the strongest idea in either surface. Clusters (`PLATFORM SPINE`, `F1 STACK`,
`GOLF-GEO`, `STORY WORLDS`…) give 35+ repos a shape a grid cannot. Laddering edges show *why*
a repo exists. Solid-vs-dashed makes the registration gap — 26 unregistered repos, core's
TD-007 — visible instead of a line in a tech-debt file.

*Revised after the RFI response (see §8).* I originally said "replace the grid." The Code
session pushed back with a real argument: the two surfaces share **no fields except repo
identity** — the grid carries `openCount` / `liveness` / `lastActivity` (operational), the
canvas carries ladder / slice-state / registration-gap (structural). Different jobs. Its
proposal was a sibling section, staged, then delete whichever loses.

Both halves of that are right except the conclusion. A ninth section is the one move the
operator's own mandate forbids — *"morning cockpit is starting to get very noisy… simplify."*

**The synthesis: `01 — Fleet` becomes one section with three modes — `Grid` / `Tiers` /
`Constellation` — over one selection.** Code's two-mode toggle already exists inside the
prototype; this just admits the existing grid as the third mode. Different jobs, different
fields, different modes — same section, same focus, no page growth, and the "measure which
surface the operator actually uses" experiment still runs, now as mode telemetry rather than
as two competing sections.

Fixes needed before it lands: the search should dim less brutally (dimming over filtering is
the right instinct — spatial stability — but currently the canvas reads as empty); default
zoom must show the whole fleet, not one node at half the viewport; edges from `l2-ojfbot` need
bundling or on-demand reveal instead of a permanent hairball; the viewport must not silently
clip cluster labels at the edges.

**Pattern 2 — the node popover. Take the content model, not the popover.**
"What this is / delivery state / ladders up to / source path" is exactly the right per-repo
payload, and it is strictly better than what a fleet card shows today. But a popover that
covers the node it describes and its neighbour is the wrong container in a page that already
has a right rail. Put this content in the rail — which is where the chat it wants to talk to
already lives.

**Pattern 3 — the mermaid canon. Take it, but it is not part of the navigator.**
`D5 · The constellation at altitude`, `D6 · How decisions become recorded movement` — these
are *explanatory* content answering "how does this system work," a different job from "what is
happening right now." Bundling them under the same surface as a live canvas is the prototype's
main structural error.

They deserve to exist (they're the best onboarding material in the fleet — note the popover's
`NEW HERE? WHAT THIS IS` is reaching for the same need). They belong in a separate reference
surface the control plane links to, not a third vertical mode under a live map. They also
render white-on-dark today, and they need the same authored-vs-generated honesty treatment as
everything else.

**Where the integration lands, in one line:** Navigator is not a new section. It is the
**replacement for `01 — Fleet`**, with its detail payload rehomed into the right rail and its
diagrams split off into a reference surface.

---

## 5. The naming relic is a modeling relic

You called "morning" a naming artifact. It is deeper than the name:

- Copy: `LOCAL EDITION · NO. 42`, the date, `Quiet night`, *"while you sleep"*, `08:25 PM`.
- Semantics: `OVERNIGHT` — *"ran or running since last evening"* — is a lane whose definition
  is a time of day. `PICKUP` is *"human-in-the-loop, act today."*
- Form: an edition number asserts one issue per day. A control plane you open at 8:25 PM,
  as here, has no coherent "edition."

Renaming the app without re-modeling those lanes leaves the temporal assumption in the data
model and the copy. The load-bearing change is: **`OVERNIGHT` becomes "since you last looked."**
That single change converts the app from a daily ritual to a return-to surface, makes the
edition number obsolete, and makes the `08:25 PM` visit sensible. It also requires storing a
last-viewed timestamp — small, and currently absent.

Naming is worth doing (I'd want a round on it), but after that model change, not instead of it.

---

## 6. Sequence

Ordered by dependency, not by size.

1. **Settle thread keying (#340).** Blocks the whole Navigator↔chat seam. Nothing else in
   the integration can be designed around a `[fleet-navigator]` string prefix.
2. **Fix the summaries.** Ground against `REPO_META`, suppress on empty, cap length. This is
   small, and it's the one live *correctness* defect.
3. **Re-model `OVERNIGHT` → "since you last looked."** Unlocks the rename and the return-to
   posture.
4. **Give the page a spine.** Persistent section index, collapse with state summaries, a
   working top-level "what changed."
5. **Retire red's other seven jobs.** Cheap, and it makes every subsequent change legible.
6. **Registry-reader adapter + `/api/fleet-structure`.** Read-only local file reads, with the
   badge treatment from §2-C. Must be registry-generated — a hand-maintained node list would
   become fleet enumeration surface #15 and a fresh TD-007 casualty.
7. **`01 — Fleet` becomes three modes** (`Grid` / `Tiers` / `Constellation`) over one
   selection; the node payload rehomes into the right rail.
8. **Rebalance `04 — Work`** to information density; group the 42.
9. **Canon diagrams stay in the vault** (`~/selfco/diagrams/`, standing ruling) — the cockpit
   links, it does not host.

1–3 are worth doing whether or not Navigator ever lands.

---

## 7. What I need decided

These change the design, and I shouldn't pick them:

- **Thread keying** — per-repo threads (needs a store change), or one thread with explicit
  visible context switching? Now confirmed live: the popover's questions land in Leo's global
  thread today, disclosed only in the prototype's footer.
- **Is a control plane still single-page?** A spine and collapse may be enough, or this may
  want real routing — which the cockpit has so far avoided, and which the Code session
  recommends against for one surface.
- **How much editorial voice survives?** The magazine framing is the app's personality and
  the source of its problems. My read: keep the voice, drop the *periodical* — no edition
  number, no fixed running order.
- **Three modes in one section, or a ninth section?** (§4, §8.) I argue modes; the Code
  session argues sibling-then-delete. This is the main disagreement in the whole exchange.
- **One popover or two?** Track L's planned "L3 popover" and Navigator's node popover are the
  same component wearing two roadmap ids. Flagged by the Code session; worth ruling before
  either gets built.

---

## 8. What the RFI response settled

The Code session answered in full (`prototype/fleet-navigator` @ `0e7ab49`,
`research/fleet-navigator/`). What changed:

**Cheaper than expected.** The canvas is ~200 lines of hand-rolled vanilla JS building SVG
directly — no tldraw, no d3, no force layout, zero dependencies. Node positions are computed
from static layout constants; pan/zoom is viewBox arithmetic; hit-testing is native SVG event
delegation. Integration is "one React component that renders SVG," not a dependency decision.
This was the biggest cost unknown and it evaporated.

**Richer than expected.** ~66 nodes across six kinds, 13–66 edges, edge popovers typed by
relationship class, and a real query mini-language (`cluster:f1`, `status:ready`, `kind:vault`,
`tier:L1`, `unregistered`) that returns node *and* edge hits. My §4 note to "surface the query
layer properly" stands — it's more capable than its placeholder-text discoverability suggests.

**Data is a hand-compiled snapshot, and every reader is outside the cockpit's reach.** Registry
frontmatter, roadmap `status:` tallies across ~13 sibling repos, wayfinder frontmatter,
`~/selfco/wiki` file counts, and a 2026-07 census held in operator memory. Needs one new
read-only adapter; the `~/selfco` reach has precedent in `adapters/loop.ts`. Three things need
honesty badges: derived slice tallies, `[judgment]` cluster assignment of unregistered repos,
and all authored prose plus the four diagrams.

**My §1-E finding is confirmed as a live defect.** "Ask Leo" POSTs straight to `:3040/api/chat`
and the exchange persists into Leo's global thread. Not a new ADR-0005 exception, but map
questions silently join Cockpit Chat history, disclosed only in a footer.

**One correction to my read.** What I called an accordion is the query-results rail. There is
no accordion component. The three-vertical-modes observation holds, but the third region is
results, not a list view.

**Confirmed by ruling, not just by argument:** the canon diagrams belong in `~/selfco/diagrams/`
— *the cockpit shows, the vault keeps* (standing operator ruling, 2026-08-03). My §4 Pattern 3
recommendation lands on an existing decision rather than proposing a new one.

**Also new:** nothing persists (no localStorage, no URL state); no keyboard navigation beyond
ESC/Enter and no tab stops on SVG nodes; the canvas needs ≥560px and does not survive the 372px
rail — consistent with core #338. And the operator's own mid-session mandate is now on the
record: *"morning cockpit is starting to get very noisy and we need to plan to simplify and
build delightful progressive disclosure workflows."* That is this audit's thesis, independently
arrived at, and it should govern sequencing: minimal integration seam now, condensation as its
own charted initiative.
