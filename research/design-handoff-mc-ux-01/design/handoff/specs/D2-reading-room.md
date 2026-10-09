# Spec · Reading Room (fifth room of D — READ)

**File:** `Reading Room.dc.html` (standalone) · embedded in `Adaptive Workspace.dc.html` when intent = READ · **Data:** `data/snapshot.js → READING`
**Decisions:** 2026-10-09 ×5 in `decisions.md` (Reading Room rows). **Open:** Q19 (community list + X route), Q20 (where the curated list lives).

## Purpose
News and learning for the start of the day and for breaks. It collects channels in one place and never asks for a decision, so **nothing in it is red**. It is never picked by the clock; you enter it with the READ intent or open the file directly.

## Structure
- **This sitting** strip: Start of day 20m · Short break 10m · Long break 30m. Start runs a local timer, shows progress (`--progress`) and a time-left readout. When time is up it shows "Back to the desk" (calls `onBack` when embedded) or "5 more minutes". Status counts: on your list · sources wired x/y · LOCAL ONLY badge.
- **Channels nav** (keys 0–6): Today's stack, then News · Papers · Podcasts · Community · Course · Textbooks. Each line shows its mode (READ / LISTEN / SCAN) and wiring status.
- **Today's stack**: built from your list and sized to the sitting. `stackRule` = `fits-first` (channels that suit this sitting first, then oldest) or `oldest-first`. Items that don't fit are listed under "doesn't fit this sitting". Below that, a grid of channel cards ("every channel, one glance").
- **Channel page**: status, mode and origin badges (READ FROM THE RENDERER vs NAMED BY YOU) · your curated source list with per-source status and add/remove · "To wire it" (what an adapter needs) · where it fits in the day · Papers: reader-profile chips · Community: the headings the digest tracks · "Suggested for your list" (labelled candidates; Keep / not for me) · items in the channel.
- **Add to your list**: title or URL, channel, minutes (5/10/20/30/45), optional repo in mind (rendered as a repo chip).
- **WHAT I TOOK FROM IT**: a correspondence field (`ds/correspond.js`, thread `reading-room`). A request needs ROUTE TO before it counts.
- **Leo rail** scoped `thread: reading` (standalone only; when embedded, D's rail is used).

## Status vocabulary (one selector over `READING.channels[].sources` + kept + added)
Channel: `up` → WIRED · `degraded` → WIRED · DEGRADED (`--warn`) · `planned` → NOT WIRED · `later` → LATER (out of scope: Course, Textbooks).
Source: wired · degraded · planned · suggested (never counted until kept).

## Honesty rules
- `items` are always `[]`. No headline, episode, post, lesson or chapter is invented. Every empty state says why it is empty.
- Course (newline AI Accelerator) and Textbooks take hand-added items only, until wired later (Q16/Q17 ruled).
- Community is a digest. Links open the digest's summary, never reddit.com or x.com.
- Podcasts hand off to your player; the room does not become one.

## Props
`defaultSitting` (clock | first-light | short | long) · `stackRule` · `showLeo` · `embedded` · `onBack()` · `onSummary({stack, budget, sitting, nSrcWired, nSrc})` (feeds D's Leo answers).

## Simulated / local-only
List items, timer, kept/skipped suggestions, added sources, the takeaway, and Leo replies. All are stored in localStorage under `mc.proto.reading.v1`; nothing is written to a server.

## To build for real
Adapters: arXiv (dedupe against HF), podcast RSS, subreddit RSS, X route (Q19). The curated list should be server-readable (Q20). Name the two unreachable News feeds from the audit.
