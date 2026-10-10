import type { BriefingThread } from '@cockpit/shared';

/**
 * Slice 2 mock read-model — the four seeded threads from the design prototype, shaped to
 * BriefingThread. Slice 3 replaces this with a fetch of GET /api/briefing (the Chief-of-Staff
 * generator); the UI and the deliver-branch write path do not change when it does.
 */
export const MOCK_THREADS: BriefingThread[] = [
  {
    id: 'metric',
    tag: 'decision',
    title: 'Land the core keep/discard metric',
    whyNow: 'Blocks closed-loop control · oldest live brief',
    catchUp:
      "I read both core briefs. The keep/discard metric is the keystone — two downstream briefs (renumber ADR, resolve catalog) wait on it, and the cockpit's own liveness work sits behind the same control loop. Nothing has shipped here in 7 days.",
    question: 'How do you want to move on the first fleet metric?',
    branches: [
      {
        key: 'ship',
        label: 'Ship the first metric now',
        recommended: true,
        type: 'deliver',
        artifact: {
          title: 'Ship the first keep/discard fleet metric',
          target: 'core/.handoff/',
          closes: 'mc-brief-metric',
          align:
            'We agree the first metric is the keystone for closed-loop control. This brief ships exactly one metric — not a framework — so downstream work can unblock today.',
          task:
            'Define a single keep/discard signal for fleet beads, implement its computation in core, and wire it into the lane classifier so discardable work is auto-flagged in the Available lane.',
          criteria: [
            'One metric chosen, with a one-paragraph rationale recorded in the ADR',
            'Pure function in core/ + unit tests covering keep, discard, and edge cases',
            'Lane classifier consumes it and the cockpit Available lane shows the flag',
            'No new BeadStatus value introduced (reuse status + labels)',
          ],
        },
      },
      {
        key: 'spike',
        label: 'Spike two metric options first',
        recommended: false,
        type: 'deliver',
        artifact: {
          title: 'Spike two keep/discard metric candidates',
          target: 'core/.handoff/',
          closes: 'mc-brief-metric',
          align:
            'We are not yet sure which control signal is right. This de-risks by comparing two candidates over real history before committing to one.',
          task:
            'Prototype two candidate metrics against the last 60 days of bead history; quantify which discards better and recommend one, then draft the follow-up ship brief.',
          criteria: [
            'Both candidate metrics computed over historical beads',
            'One-page comparison: discard precision, false-kills',
            'A recommendation plus a drafted ship brief for the winner',
          ],
        },
      },
      {
        key: 'defer',
        label: 'Defer to next week',
        recommended: false,
        type: 'defer',
        cta: 'Snooze 7 days',
        outcome:
          'Snoozes the brief 7 days and logs the deferral on the bead. The two downstream core briefs and the cockpit liveness work stay blocked until then.',
        doneText: 'Snoozed 7 days — the bead resurfaces next Monday. Downstream briefs remain blocked.',
      },
    ],
  },
  {
    id: 'selfco',
    tag: 'stale',
    title: 'selfco-box — decide or kill',
    whyNow: '28 days stale · no owner, no repo',
    catchUp:
      'The selfco-box plan has sat in Pickup 28 days untouched — a spec-review + grounding brief with no owner and no repo yet. Staleness this deep usually means the idea is either wrong or waiting on a call only you can make.',
    question: "Twenty-eight days, zero movement. What's the verdict?",
    branches: [
      {
        key: 'fold',
        label: 'Fold it into core as a skill',
        recommended: true,
        type: 'deliver',
        artifact: {
          title: 'Fold selfco-box into core as a skill',
          target: 'core/.handoff/',
          closes: 'selfco-box-plan',
          align:
            'We agree selfco-box is reusable grounding, not a standalone product — it belongs where it is invoked rather than in its own repo.',
          task:
            'Port the selfco-box spec-review + grounding logic into a new core skill, retire the standalone plan, and link the closed plan bead to the skill.',
          criteria: [
            'New core skill implementing the grounding + spec-review steps',
            'Plan bead closed with a ref pointing to the new skill',
            'One example invocation documented in the skill README',
          ],
        },
      },
      {
        key: 'green',
        label: 'Greenlight as its own project',
        recommended: false,
        type: 'deliver',
        artifact: {
          title: 'Greenlight selfco-box as its own project',
          target: 'selfco-box/.handoff/',
          closes: 'selfco-box-plan',
          align:
            'We agree it is standalone enough to own a repo. This scaffolds the project and seeds its first real delivery bead with you as owner.',
          task:
            'Scaffold the selfco-box repo from node-template, write its CLAUDE.md + ROADMAP, and seed the first delivery bead with acceptance criteria.',
          criteria: [
            'Repo scaffolded from node-template, CI green on first push',
            'CLAUDE.md + ROADMAP committed',
            'First delivery bead seeded with its own acceptance criteria',
          ],
        },
      },
      {
        key: 'kill',
        label: 'Kill it',
        recommended: false,
        type: 'archive',
        cta: 'Archive bead',
        outcome:
          'Archives the bead and frees the Pickup lane. Fully reversible — you can re-seed the idea from chat later.',
        doneText: 'selfco-box archived — Pickup lane freed. Re-seed any time from a chat thread.',
      },
    ],
  },
  {
    id: 'stale4',
    tag: 'quickwin',
    title: 'Drain the 4 stale tasks',
    whyNow: 'All 59 days · skewing Available',
    catchUp:
      'Four tasks have been 59 days stale in Available — two in core (bead-emit tests, ADR-0041 convoy), two in shell (commands cleanup, /api/beads verification). They are skewing the available count and none has an owner.',
    question: 'Four maintenance tasks, all 59 days. Batch them?',
    branches: [
      {
        key: 'convoy',
        label: 'Batch into one cleanup convoy',
        recommended: true,
        type: 'deliver',
        artifact: {
          title: 'Cleanup convoy — drain the 4 stale tasks',
          target: 'core/.handoff/',
          closes: 'core+shell ×4 tasks',
          align:
            'We agree these four are related housekeeping. One owner clears them together under a convoy rather than four separate pickups.',
          task:
            'Orchestrate a convoy with the 4 stale tasks as slots: bead-emit tests, ADR-0041 convoy orchestration, shell commands cleanup, /api/beads live verification.',
          criteria: [
            'Convoy created with all 4 tasks as slots under one owner',
            'Each task either completed or explicitly archived with a reason',
            'Available lane returns to 0 stale items',
          ],
        },
      },
      {
        key: 'triage',
        label: 'Triage individually',
        recommended: false,
        type: 'deliver',
        artifact: {
          title: 'Triage the 4 stale tasks',
          target: 'core/.handoff/',
          closes: 'core+shell ×4 tasks',
          align:
            'We agree not all four are worth doing. Keep the load-bearing two, drop the rest — deliberately, with reasons.',
          task:
            'Review each of the four; keep /api/beads verification + bead-emit tests with an owner and a due window, archive the other two with a one-line rationale each.',
          criteria: [
            'Each task labeled keep or archive with a reason',
            'Kept tasks assigned an owner + due window',
            'Archived tasks closed with rationale recorded',
          ],
        },
      },
      {
        key: 'archall',
        label: 'Archive all four',
        recommended: false,
        type: 'archive',
        cta: 'Archive all 4',
        outcome:
          'Archives all four at once. Fastest, but you lose live /api/beads verification coverage — confirm that is acceptable.',
        doneText: 'Four tasks archived — Available lane cleared. /api/beads verification is no longer covered.',
      },
    ],
  },
  {
    id: 'events',
    tag: 'decision',
    title: 'Wire bead_events — the foundation',
    whyNow: 'Event log empty · liveness impossible',
    catchUp:
      'Here is the one that quietly blocks everything: bead_events has never been written to — zero rows. Every "is this agent live / did it run overnight" question is unanswerable until something emits to it. It is ranked #1 in your own coordination ADR.',
    question: 'The event log is empty. Start emitting now?',
    branches: [
      {
        key: 'ship',
        label: 'Ship the emitEvent helper',
        recommended: true,
        type: 'deliver',
        artifact: {
          title: 'Stand up the bead_events writer (emitEvent)',
          target: 'core/.handoff/',
          closes: 'bead-events-writer',
          align:
            'We agree this is the #1 foundational move — nothing about liveness, overnight, or the queue works until the empty event log gets a writer.',
          task:
            'Add emitEvent(pool,{event_type,bead_id,actor,summary,payload}) to bead-emit.mjs and call it from every mutating verb inside the same transaction as the bead write (no second DOLT_COMMIT).',
          criteria: [
            'emitEvent helper writes in a single transaction with the bead',
            'Called from session, task, pr, convoy, agent, and queue verbs',
            'bead_events goes from 0 rows to populated on the next write',
            'Liveness query (group by actor, MAX(timestamp)) returns real data',
          ],
        },
      },
      {
        key: 'bundle',
        label: 'Bundle with queue-post',
        recommended: false,
        type: 'deliver',
        artifact: {
          title: 'Ship emitEvent + queue-post together',
          target: 'core/.handoff/',
          closes: 'bead-events-writer + queue-post',
          align:
            'We agree to combine the foundation and the first queue producer into one push — one PR instead of two, slightly more scope.',
          task:
            'Implement emitEvent (as above) and the queue-post verb (status=created, hook=NULL, labels.queue=available); queue-post is the first emitEvent caller.',
          criteria: [
            'Both verbs land with tests',
            'Reserved labels (queue, kind) documented in bead.ts',
            'A posted queue bead appears in the cockpit Available lane',
          ],
        },
      },
      {
        key: 'wait',
        label: 'Wait for ADR-0002 acceptance',
        recommended: false,
        type: 'defer',
        cta: 'Snooze until ADR',
        outcome:
          'Blocks the whole coordination layer behind ADR-0002, which is not actually gating this work. Logged as deferred — not advised.',
        doneText: 'Deferred until ADR-0002. The coordination layer stays blocked — flagged as not advised.',
      },
    ],
  },
];
