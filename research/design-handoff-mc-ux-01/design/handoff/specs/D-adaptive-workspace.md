# Spec · D — Adaptive Workspace

**File:** `Adaptive Workspace.dc.html` · **Status:** built, interactive · **Data:** `data/snapshot.js` (labelled)

## Purpose
One set of data, four rooms. The clock proposes the room (05–11 · 11–17 · 17–22 · 22–05); the intent chips override it. Leo is always present in a right rail, scoped to the room.

## Rooms and names
The app stays **Morning Cockpit** (meta bar). The rooms carry their own names so "Cockpit" is not repeated per phase (operator ask 2026-10-08): **First Light** (orient) · **The Desk** (work) · **Last Light** (review) · **Night Watch**. Names are a hypothesis — see open-questions Q11.

| Room | Blocks | Verbs |
|---|---|---|
| First Light | 1 what needs a decision · 2 what's holding things up · 3 Overnight (day-phase lane kept, by ruling) · 4 where to spend today | `Work on it →` (switches to The Desk on that repo) · `Not today` (deferred, counted) |
| The Desk | project picker (hot repos first) · bring me up to date · open questions here · next slices · session notes (local) | `Resume` · notes |
| Last Light | three lines → report bead draft · patterns this week · progress recorded | `Approve & write report →` (simulated write) |
| Night Watch | running without you (agents, state, repo) | none |

## Leo rail (persistent)
Header `LEO · CHIEF OF STAFF · thread: global | <repo>` + SIMULATED chip. Intro line per room. Three question chips per room; free text. Answers are rule-based stubs that quote real counts and point at items. In The Desk the thread is scoped to the focused repo and shares context with global (#340).

## Correspondence fields (`ds/correspond.js`)
Every textarea in Last Light and the Desk is a correspondence field. Header: label · **speech-act badge** (auto-detected — REPORT · INFORMATIONAL by default; REQUEST · BINDING when the text asks someone to act; DECISION · AUTHORITY on ruling language; OBSERVATION / CLAIM / DISPOSITION otherwise) · **schema chip** `lego-pipe-memo/v2` · **PASTED FROM A SESSION** + agent chip when frontmatter or a `[agent]` prefix is detected · char count. Below: **DETECTED** chips (repos, agents, refs `adr:/rm:/ns:/bead:`, finding IDs R/N/X/S/Q/K-nn, memo numbers), **warnings** with rule chips (D2 unrouted request · D7 shared-account decision · `argument` must start "In which" · undeclared findings · non-operative schema) and a **ROUTE TO** picker (code-claude · claude-design · James · leo) when a request has no recipient. The three Last Light fields compose one memo: act badge, frontmatter preview (correspondence_schema, memo, revision, status, memo_type, thread, from, to, in_reply_to, reports_on, argument, provenance, authority, register). **Approve & prepare →** records PREPARED → INTENT → RECEIPT pending (D6: preparation ≠ delivery). All simulated; the real path is the ADR-0005 write + fleet-runner delivery receipt.

## Reference chips
Repo chips (hue · registration · liveness · waiting count · phase), agent chips (state dot), brief chips, ADR refs — all open the navigable card (`ds/refs.js`).

## States
mode (clock vs override) · focus repo · deferred set · notes · three review fields · report written · Leo log. Persisted locally under `mc.proto.adaptive.v1` (notes, fields, focus, deferrals).

## Copy rules
Headline numbers say what they are in plain words ("waiting on you", "gone quiet > 60 days"). Every block header carries a badge where its data is derived/asserted.

## Simulated
Report write · Leo · the clock boundaries.
