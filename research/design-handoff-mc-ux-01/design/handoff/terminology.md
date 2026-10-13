# Terminology audit (brief §4)

Every string below is in `packages/renderer` today. Plain-words replacements are proposals; technical precision stays one disclosure away (`WHERE THIS CAME FROM`).

| In the UI today | Where | Proposed | Keep the technical term where |
|---|---|---|---|
| Beads | `App.tsx` section 04 title | **Work** | `WHERE THIS CAME FROM` (bead id, source path) |
| Overnight · ran or running since last evening | `Lane.tsx` | **Since you last looked** (E) / Overnight (D) | — |
| Pickup · your queue — oldest first, rotten on top | `Lane.tsx` | **Waiting on you** | — |
| Available · unclaimed — pickable, stale floats up | `Lane.tsx` | **Nobody owns this yet** | — |
| synth | `WorkItemCard.tsx` | **guessed from open issues — not a real queue post** (tooltip stays) | badge `DERIVED` |
| POSTED | `WorkItemCard.tsx` | **in the queue** | — |
| decided → in flight | `WorkItemCard.tsx` | **you decided this; delivery is under way** | chip `DECIDED · IN FLIGHT` |
| Handoff Artifact · Draft | `HandoffArtifactCard.tsx` | **Brief for the next session (draft)** | file path in disclosure |
| Approve & emit → | `HandoffArtifactCard.tsx` | **Write this brief into ‹repo› →** | — |
| On delivery → closes ‹id› | `HandoffArtifactCard.tsx` | **Finishing this closes ‹title›** | id in disclosure |
| deterministic · ↻ / ✨ Chief of Staff · ↻ | `Briefing.tsx` | **rule-based · regenerate** / **written by the local model · regenerate** | badge DERIVED / SYNTH |
| Catch-up | `Briefing.tsx` | **Bring me up to date** | — |
| BEADS SCANNED · LIVE · IDLE · STALLED · ZOMBIE · DARK AGENTS | `Masthead.tsx` | **items read · agents working / resting / stuck / silent** | health footer |
| LOCAL EDITION · No. N | `Masthead.tsx` | drop (return-to surface has no edition) | — |
| northstar → roadmap → queue | `DeliverySection.tsx` | **goal → plan → next slices** | — |
| property gaps | `DeliverySection.tsx` | **how far each goal has come** | — |
| ‹slug› · L1 northstar | `DeliverySection.tsx` | **‹repo›'s goals** | slug in disclosure |
| status.jsonl · recorded at merge | `DeliverySection.tsx` | **progress recorded when work merged** | path in disclosure |
| drift | `DeliverySection.tsx` | **file and queue disagree** | — |
| autonomy: auto / gated | `DeliverySection.tsx` | **runs itself / needs your OK** | — |
| shadow-mode skill dispositions | `LoopSection.tsx` | **did suggestions get used?** | — |
| ignored · engaged_no_act · followed · capture_miss · acted | `LoopSection.tsx` | **skipped · looked · tried · not recorded · used** | keys in disclosure |
| rates unverified | `LoopSection.tsx` | **counts only — no percentages until capture quality is checked** | — |
| Selfco vault hygiene · Codex heartbeat | `LoopSection.tsx` | **Is the vault being tidied?** | — |
| EDITORIAL | `CriticalPathSection.tsx` | **hand-written** → badge `ASSERTED` | — |
| BLOCKS / GATES | `CriticalPathSection.tsx` | **holds up / must be settled first** | — |
| grounding context | `ChatContextDisclosure.tsx` | **what Leo was told before answering** | — |
| Northstar · ‹repo› (tab) | `ChatSidebar.tsx` | **‹repo›'s goals** | — |
| ▸ Ask the Chief of Staff | `ChatSidebar.tsx` | **Ask Leo** | — |
| draft handoff | `ChatSidebar.tsx` | **turn this into a brief** | — |
| deterministic fallback | `ChatSidebar.tsx` | **rule-based answer (model unavailable)** | — |
| reading as (profile chips) | `PapersSection.tsx` | **explained for someone who knows … · edit** (one line) | — |
| staged cross-links | `PapersSection.tsx` | **links waiting for your review** | — |

Rule carried into the prototypes: **a control says what happens when you press it** ("Write this brief into morning-cockpit →", "Not today — counted in Review"), and **every number says how it was made** (badge) before it says how big it is.
