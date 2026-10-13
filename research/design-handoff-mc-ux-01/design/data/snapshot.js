// Representative snapshot of what Morning Cockpit knows — compiled 2026-10-08 from the repo itself:
// REPO_META (packages/server/src/fleet-config.ts), CRITICAL_CHAINS (same file), the eight beads in
// morning-cockpit/.handoff/, the 2026-08-08 registry read vendored in research/fleet-navigator/, the
// l1-morning-cockpit northstar figures quoted in .handoff/20260628-2015, and the Loop/Fleet counts the
// v2 audit read off the running app (edition no. 42, 8 Aug 2026). Everything carries an `origin` so
// prototypes can badge it: 'repo' (read from a committed file), 'audit' (read off screenshots of the
// live app), 'derived' (computed here), 'simulated' (interaction stub — labelled in the UI).
// No live Dolt / RSS / HF data is reachable from this project; those surfaces are summarised, not faked.

export const AS_OF = '2026-10-08T22:30:00Z';
export const LAST_LOOKED = '2026-10-08T07:40:00Z'; // simulated last-viewed timestamp (the app stores none today)

export const CLUSTERS = [
  { id: 'platform', label: 'Platform spine', hue: 'var(--c-platform)' },
  { id: 'frame-apps', label: 'Frame apps', hue: 'var(--c-apps)' },
  { id: 'f1', label: 'F1 stack', hue: 'var(--c-f1)' },
  { id: 'golf-geo', label: 'Golf · geo', hue: 'var(--c-golf)' },
  { id: 'dive', label: 'Dive pair', hue: 'var(--c-dive)' },
  { id: 'story', label: 'Story worlds', hue: 'var(--c-story)' },
  { id: 'play-well', label: 'Play-well (LEGO)', hue: 'var(--c-play)' },
  { id: 'corpus', label: 'Corpora · study', hue: 'var(--c-corpus)' },
  { id: 'client', label: 'Client work', hue: 'var(--c-client)' },
];

// name, role, phase: fleet-config.ts REPO_META (repo). cluster: registry (2026-08-08) or [judgment] for
// unregistered repos (navigator convention). registered: has a northstar in core's registry at that read.
// openCount / liveness / lastActivity: audit screenshots 2026-08-08 + repo-visible activity to 2026-10-08.
export const REPOS = [
  { name: 'core', role: 'Workflow engine — 30+ skills + bead store', phase: 'P2', cluster: 'platform', registered: true, openCount: 23, liveness: 'stale', lastDays: 4, slices: { ready: 0, queued: 7, merged: 11 } },
  { name: 'morning-cockpit', role: 'You are here — this command deck', phase: 'EXP', cluster: 'platform', registered: true, openCount: 8, liveness: 'live', lastDays: 0, here: true, slices: { ready: 4, queued: 4, merged: 1 } },
  { name: 'shell', role: 'Frame OS — MF host + agent gateway', phase: 'P1', cluster: 'platform', registered: true, openCount: 0, liveness: 'dark', lastDays: 41 },
  { name: 'switchboard', role: 'LLM gateway — budgets, failover, observability', phase: 'EXP', cluster: 'platform', registered: true, openCount: 2, liveness: 'stale', lastDays: 12, slices: { ready: 1, queued: 8, merged: 1 } },
  { name: 'daily-logger', role: 'Dev blog — cross-repo sweep → Claude', phase: 'P9', cluster: 'platform', registered: false, openCount: 1, liveness: 'live', lastDays: 0 },
  { name: 'gastown-pilot', role: 'Coordination dash — reads the bead store', phase: 'P4', cluster: 'platform', registered: false, openCount: 0, liveness: 'dark', lastDays: 60 },
  { name: 'core-reader', role: 'Docs viewer — renders core framework', phase: 'P3', cluster: 'platform', registered: false, openCount: 0, liveness: 'dark', lastDays: 88 },
  { name: 'github-actions', role: 'Fleet CI — shared reusable workflows', phase: 'P1', cluster: 'platform', registered: false, openCount: 0, liveness: 'dark', lastDays: 35 },
  { name: 'frame-ui-components', role: 'UI library — shared Carbon DS', phase: 'P2', cluster: 'frame-apps', registered: false, openCount: 0, liveness: 'dark', lastDays: 120 },
  { name: 'workstation-yuri', role: 'Workstation automation — Focus, wallpaper, launcher', phase: 'EXP', cluster: 'platform', registered: false, openCount: 0, liveness: 'dark', lastDays: 70 },
  { name: 'selfco-box', role: 'Vault runner — capture daemon (paused)', phase: 'EXP', cluster: 'platform', registered: false, openCount: 0, liveness: 'dark', lastDays: 48 },
  { name: 'cv-builder', role: 'Resume builder — multi-agent, visual-reg CI', phase: 'P6', cluster: 'frame-apps', registered: true, openCount: 0, liveness: 'dark', lastDays: 95 },
  { name: 'BlogEngine', role: 'Blog platform — daily-logger publishes here', phase: 'P5', cluster: 'frame-apps', registered: true, openCount: 0, liveness: 'dark', lastDays: 80 },
  { name: 'TripPlanner', role: 'Trip planner — 11-phase pipeline', phase: 'P3', cluster: 'frame-apps', registered: false, openCount: 0, liveness: 'dark', lastDays: 140 },
  { name: 'GroupThink', role: 'Tab grouping — LLM semantic treemap', phase: 'SHIP', cluster: 'frame-apps', registered: false, openCount: 0, liveness: 'dark', lastDays: 200 },
  { name: 'purefoy', role: 'Deakins KB — cinematography corpus', phase: 'P2', cluster: 'frame-apps', registered: false, openCount: 0, liveness: 'dark', lastDays: 110 },
  { name: 'lean-canvas', role: 'Lean canvas — business-model tool', phase: 'P1', cluster: 'frame-apps', registered: false, openCount: 0, liveness: 'dark', lastDays: 160 },
  { name: 'landing', role: 'jim.software — portfolio landing page', phase: 'SHIP', cluster: 'frame-apps', registered: false, openCount: 0, liveness: 'dark', lastDays: 30 },
  { name: 'f1-substrate', role: 'F1 telemetry substrate — DuckDB + FastAPI', phase: 'P1', cluster: 'f1', registered: true, openCount: 2, liveness: 'stale', lastDays: 9, slices: { ready: 2, queued: 7, merged: 2 } },
  { name: 'f1-pit-wall', role: 'F1 dashboard — telemetry literacy + claim grounding', phase: 'P1', cluster: 'f1', registered: true, openCount: 3, liveness: 'stale', lastDays: 11, slices: { ready: 2, queued: 14, merged: 3 } },
  { name: 'f1-press-room', role: 'F1 teaching studio — claim-checked articles', phase: 'EXP', cluster: 'f1', registered: true, openCount: 0, liveness: 'dark', lastDays: 33, slices: { ready: 0, queued: 10, merged: 2 } },
  { name: 'f1-doctrine', role: 'RAQG question layer — 33 bound questions', phase: 'EXP', cluster: 'f1', registered: true, openCount: 0, liveness: 'dark', lastDays: 40, slices: { ready: 0, queued: 4, merged: 2 } },
  { name: 'capture-agent', role: 'Golf capture agent — TX imagery → segmentation model → HF', phase: 'P1', cluster: 'golf-geo', registered: true, openCount: 1, liveness: 'stale', lastDays: 11 },
  { name: 'fairway', role: 'Golf digital twin — explorable twin surface', phase: 'P1', cluster: 'golf-geo', registered: true, openCount: 1, liveness: 'stale', lastDays: 9, slices: { ready: 0, queued: 5, merged: 0 } },
  { name: 'mirrorworld', role: 'Geospatial track — real places as three.js scenes', phase: 'EXP', cluster: 'golf-geo', registered: true, openCount: 0, liveness: 'dark', lastDays: 52, slices: { ready: 0, queued: 16, merged: 2 } },
  { name: 'golf-platform-scripts', role: 'Golf platform automation', phase: 'EXP', cluster: 'golf-geo', registered: false, openCount: 0, liveness: 'dark', lastDays: 44 },
  { name: 'dive-briefing', role: 'Dive RAG service — cited answers, tiered corpora', phase: 'EXP', cluster: 'dive', registered: true, openCount: 1, liveness: 'stale', lastDays: 14, slices: { ready: 1, queued: 7, merged: 1 } },
  { name: 'buddy-check', role: 'Dive Q&A eval lab — judge calibration, hybrid RAG', phase: 'P2', cluster: 'dive', registered: true, openCount: 0, liveness: 'dark', lastDays: 38 },
  { name: 'silicon-empires', role: 'AI-infra RTS — queues, capital, energy, silicon', phase: 'P1', cluster: 'story', registered: true, openCount: 0, liveness: 'dark', lastDays: 29, slices: { ready: 0, queued: 12, merged: 26 } },
  { name: 'virtualLight', role: 'Book-to-cinema pipeline — extraction + styled prompts', phase: 'EXP', cluster: 'story', registered: true, openCount: 0, liveness: 'dark', lastDays: 55, slices: { ready: 1, queued: 6, merged: 0 } },
  { name: 'beaverGame', role: 'Cozy beaver sim — consumes asset-foundry GLBs', phase: 'EXP', cluster: 'story', registered: false, openCount: 0, liveness: 'dark', lastDays: 90 },
  { name: 'lofi-beaver', role: 'Willow Bend — 1-bit isometric story-world', phase: 'EXP', cluster: 'story', registered: false, openCount: 0, liveness: 'dark', lastDays: 75 },
  { name: 'asset-foundry', role: 'Asset pipeline — parametric 3D foundry', phase: 'EXP', cluster: 'story', registered: false, openCount: 0, liveness: 'dark', lastDays: 66 },
  { name: 'foundry-recipes', role: 'Blender tutorial extraction — reels → BlenderRecipe records in Notion', phase: 'EXP', cluster: 'story', registered: false, openCount: 0, liveness: 'dark', lastDays: 50 },
  { name: 'lego-village-pipeline', role: 'play-well cluster — LEGO village digital twin + build harness', phase: 'P0', cluster: 'play-well', registered: false, openCount: 3, liveness: 'live', lastDays: 1 },
  { name: 'play-well-library', role: 'play-well cluster — canonical LEGO village content library', phase: 'P0', cluster: 'play-well', registered: false, openCount: 0, liveness: 'stale', lastDays: 8 },
  { name: 'bldgblog-corpus', role: 'BLDGBLOG ingest — corpus + deposit library', phase: 'EXP', cluster: 'corpus', registered: false, openCount: 0, liveness: 'dark', lastDays: 61 },
  { name: 'agent-anatomy', role: 'Orchestration atlas — article companion', phase: 'EXP', cluster: 'corpus', registered: false, openCount: 0, liveness: 'dark', lastDays: 57 },
  { name: 'seh-study', role: 'SEH study — NASA spaced repetition', phase: 'P2', cluster: 'corpus', registered: false, openCount: 0, liveness: 'dark', lastDays: 130 },
  { name: 'cca-prep', role: 'Multi-exam Claude-cert prep engine — generation-over-content drills', phase: 'P0', cluster: 'corpus', registered: false, openCount: 0, liveness: 'dark', lastDays: 36 },
  { name: 'jim-camera', role: 'jim.camera portfolio — Lightroom pipeline + manifest-fed gallery', phase: 'P0', cluster: 'client', registered: false, openCount: 0, liveness: 'dark', lastDays: 42 },
  { name: 'dealdesk', role: 'Client-work control plane — bids, proposals, engagements, AI proposal reviewer', phase: 'EXP', cluster: 'client', registered: false, openCount: 0, liveness: 'stale', lastDays: 13 },
];

// The eight beads in morning-cockpit/.handoff/ (repo). `open` follows the adapter rule: live + no report.
// `closes` is the S8 seam — 20260717-1755 closes 20260717-1717, which therefore folds under it (derived).
export const BRIEFS = [
  { id: '20260607-1530-brief-coordination-gaps', title: 'Coordination gaps — the Track R write-path', repo: 'morning-cockpit', actor: 'code-claude', to: 'code-claude', created: '2026-06-07', open: true, staleDays: 123, tag: 'stale', refs: ['adr:0002'] },
  { id: '20260609-2340-brief-implement-github-adapter-for-morning-cockpit', title: 'Implement the GitHub adapter (PRs + issues, Slice 1)', repo: 'morning-cockpit', actor: 'code-claude', to: 'code-claude', created: '2026-06-09', open: true, staleDays: 121, tag: 'stale' },
  { id: '20260618-brief-launchd-processes-panel', title: 'launchd processes panel', repo: 'morning-cockpit', actor: 'code-claude', to: 'code-claude', created: '2026-06-18', open: true, staleDays: 112, tag: 'stale' },
  { id: '20260628-2015-brief-northstar-control-surface', title: "Evolve morning-cockpit's northstar from read-model pane → operator control surface", repo: 'morning-cockpit', actor: 'code-claude', to: 'code-claude', created: '2026-06-28', open: true, staleDays: 102, tag: 'decision', refs: ['ns:l1-morning-cockpit'] },
  { id: '20260717-1717-brief-pick-up-evolve-morning-cockpit-s-northstar-from', title: "Pick up: evolve morning-cockpit's northstar from…", repo: 'morning-cockpit', actor: 'claude-design', to: 'code-claude', created: '2026-07-17', open: true, staleDays: 83, tag: 'decision', decidedInFlight: true },
  { id: '20260717-1755-brief-deliver-s8-decided-in-flight', title: 'Deliver rm:rm-l1-morning-cockpit#S8 — derive decided-in-flight from closes: refs', repo: 'morning-cockpit', actor: 'code-claude', to: 'code-claude', created: '2026-07-17', open: true, staleDays: 83, tag: 'decision', closes: '20260717-1717-brief-pick-up-evolve-morning-cockpit-s-northstar-from', refs: ['rm:rm-l1-morning-cockpit#S8'] },
  { id: '20260729-1233-brief-pick-up-deliver-rm-rm-l1-morning-cockpit-s8-deri', title: 'Pick up: deliver rm:rm-l1-morning-cockpit#S8 (derived…)', repo: 'morning-cockpit', actor: 'claude-design', to: 'code-claude', created: '2026-07-29', open: true, staleDays: 71, tag: 'quickwin' },
  { id: '20260808-2150-brief-cockpit-v2-instrument-shell-and-fleet-navigator', title: 'Cockpit v2: instrument shell + Fleet Navigator integration', repo: 'morning-cockpit', actor: 'claude-design-session', to: 'code-claude', created: '2026-08-08', open: true, staleDays: 61, tag: 'decision', refs: ['adr:0005', 'adr:0012', 'file:research/design-handoff-cockpit-v2/README.md'] },
];

// Hand-read chains, fleet-config.ts (repo, editorial).
export const CRITICAL = {
  intro: 'Three blockers stand between you and the coordination layer. The chokepoint is {the core keep/discard metric} — three downstream beads wait on it.',
  chains: [
    { id: 'metric', severity: 'high', title: 'core keep/discard metric', relation: 'BLOCKS', blocks: ['renumber ADR', 'resolve catalog', 'liveness binding'], impact: '3 / beads · core', briefId: 'metric', cta: 'Brief ↑' },
    { id: 'queue-verbs', severity: 'blocked', title: 'queue-post + queue-claim verbs', relation: 'BLOCKS', blocks: ['Available real source', 'Claim → dispatch', 'gastown WantedBoard'], impact: '3 / beads · 2 repos', briefId: 'events', cta: 'Brief ↑' },
    { id: 'adr-0002', severity: 'decision', title: 'ADR-0002 — human-pull vs. autonomous', relation: 'GATES', blocks: ['claim strictness', 'convergence direction', 'the whole layer'], impact: 'gates all', cta: 'Settle first' },
  ],
  note: 'Chains hand-read from coordination-design.md — wire live repo deps + bead refs to make this auto-update.',
};

// l1-morning-cockpit northstar as quoted in .handoff/20260628-2015 (repo); S8 proposes P2 50→56 at merge.
export const DELIVERY = {
  northstar: { slug: 'l1-morning-cockpit', app: 'morning-cockpit', tier: 'L1', firstCut: true, properties: [
    { id: 'P1', name: 'single legible pane', current: 60, target: 'one pane the operator reads instead of six tools' },
    { id: 'P2', name: 'coordination is real and ground-truth', current: 50, target: 'every count traces to a bead, a file or a merge' },
    { id: 'P3', name: 'pivots focus across the fleet', current: 55, target: 'any repo selected re-scopes every surface in < 100ms' },
  ] },
  roadmap: { slug: 'rm-l1-morning-cockpit', status: 'active', phases: [
    { id: 'PH1', name: 'Read-model floor', slices: [
      { id: 'S1', title: 'bead_events spine', status: 'merged', autonomy: 'auto' },
      { id: 'S2', title: 'derived agent liveness', status: 'merged', autonomy: 'auto' },
      { id: 'S4', title: 'claim affordance (queue-claim)', status: 'merged', autonomy: 'gated' } ] },
    { id: 'PH2', name: 'Decision → delivery seam', slices: [
      { id: 'S8', title: 'decided-in-flight derivation', status: 'claimed', autonomy: 'gated', advances: 'P2', from: 50, to: 56, repo: 'morning-cockpit', beadId: '20260717-1755' },
      { id: 'S9', title: 'per-unit northstar threads', status: 'merged', autonomy: 'auto', advances: 'P3', from: 55, to: 60 } ] },
    { id: 'PH3', name: 'Control plane', slices: [
      { id: 'S-a', title: 'registry adapter + /api/fleet-structure', status: 'ready', autonomy: 'gated', advances: 'P2' },
      { id: 'S-b', title: 'Fleet section, three modes', status: 'ready', autonomy: 'gated', advances: 'P1' },
      { id: 'S-c', title: 'thread keying (#340)', status: 'ready', autonomy: 'gated', advances: 'P3' },
      { id: 'S-d', title: 'instrument shell + since-you-last-looked', status: 'queued', autonomy: 'gated', advances: 'P1' } ] },
  ] },
  movements: [
    { date: '2026-07-04', ns: 'l1-morning-cockpit', prop: 'P2', from: 42, to: 50, evidence: 'S2 derived liveness merged; agent_status retired as truth', actor: 'code-claude' },
    { date: '2026-06-27', ns: 'l1-morning-cockpit', prop: 'P3', from: 40, to: 55, evidence: 'Focus-swap F1–F4 shipped; 45s → 1.3ms (ADR-0014)', actor: 'code-claude' },
  ],
};

// Loop telemetry as read off the live app in the 2026-08-08 audit (audit). Rates suppressed per ADR-0095.
export const LOOP = {
  capture: { total: 212, last7d: 80, newest: '2026-08-07', daysSinceLast: 1, stale: false },
  populations: [
    { population: 'installed', rows: { ignored: 169, engaged_no_act: 14, followed: 9, capture_miss: 3, acted: 6 } },
    { population: 'uninstalled', rows: { ignored: 8, engaged_no_act: 2, followed: 1, capture_miss: 0, acted: 0 } },
    { population: 'legacy', rows: { ignored: 0, engaged_no_act: 0, followed: 0, capture_miss: 0, acted: 0 } },
  ],
  skills: [ { skill: 'bead', total: 61, engaged: 9, followed: 6 }, { skill: 'northstar', total: 34, engaged: 5, followed: 2 }, { skill: 'handoff', total: 28, engaged: 4, followed: 1 } ],
  rateVerified: false,
  odometer: { movementCount: 2, last: '2026-07-04', daysSince: 96 },
  audit: { mtime: '2026-07-28', daysSince: 72 },
};

// Agents — liveness is DERIVED from bead_events recency (ADR-0008); these are the states the masthead tallies.
export const AGENTS = [
  // type: what kind of actor · task: the title of the bead / job it last touched (derived from its newest bead_event or brief).
  { id: 'code-claude', type: 'Code session', state: 'live', lastEvent: '2026-10-08T21:12:00Z', repo: 'lego-village-pipeline', task: 'Drafting Table — hub demo slice: validator + a11y gate', taskRef: 'file:apps/drafting-table/README.md' },
  { id: 'claude-design', type: 'Design session', state: 'live', lastEvent: '2026-10-08T22:10:00Z', repo: 'morning-cockpit', task: 'UX discovery + experimental redesign (MC-UX-01)', taskRef: 'file:handoff/README.md' },
  { id: 'daily-logger', type: 'Scheduled sweep', state: 'idle', lastEvent: '2026-10-08T06:00:00Z', repo: 'daily-logger', task: 'Nightly cross-repo log → log.jim.software', taskRef: 'file:daily-logger/collect-context.ts' },
  { id: 'watch-poll', type: 'Feed poller', state: 'idle', lastEvent: '2026-10-08T05:30:00Z', repo: 'morning-cockpit', task: 'Anthropic feeds scored against fleet-profile.md (≤3 shortlist)', taskRef: 'adr:0016' },
  { id: 'codex-hygiene', type: 'Vault heartbeat', state: 'stalled', lastEvent: '2026-10-03T02:00:00Z', repo: 'selfco', task: 'Selfco vault hygiene check (core#502 status CLI)', taskRef: 'adr:0001' },
  { id: 'leo', type: 'Chat assistant', state: 'live', lastEvent: '2026-10-08T22:20:00Z', repo: 'morning-cockpit', task: 'Global thread — grounded on today’s snapshot', taskRef: 'file:packages/server/src/chat-store.ts' },
];

// Who asked — the provenance behind an actor id (issue MC-UX-01/asked-by). Today a bead carries only `actor: code-claude`:
// that names the HARNESS (which tool) and nothing else. The proposal is actor = { harness, name, role, session, host } —
// a named process (Gas Town names its workers; Leo is the named runner this cockpit already has) on top of the harness.
// origin per actor: 'repo' = read off frontmatter · 'asserted' = classified from the id by judgment · 'simulated' = not on any bead.
export const WHO = {
  harnesses: {
    'claude-code':   { mark: 'CC', label: 'Claude Code',   kind: 'terminal session' },
    'claude-design': { mark: 'CD', label: 'Claude Design', kind: 'design session' },
    'codex':         { mark: 'CX', label: 'Codex',         kind: 'terminal session' },
    'chat':          { mark: 'CH', label: 'Claude chat',   kind: 'conversation' },
    'cowork':        { mark: 'CW', label: 'Cowork',        kind: 'desktop agent' },
    'launchd':       { mark: 'LD', label: 'launchd',       kind: 'scheduled job' },
    'cockpit':       { mark: 'MC', label: 'Cockpit server', kind: 'in-app runner' },
    'human':         { mark: 'H',  label: 'Human',         kind: 'operator' },
  },
  actors: {
    'code-claude':           { harness: 'claude-code',   name: null,  role: 'implementing_agent', session: null, host: null, origin: 'repo', note: 'The bead carries only the string code-claude — which window, which task, which machine is not recorded.' },
    'claude-design':         { harness: 'claude-design', name: null,  role: 'design_session',     session: null, host: null, origin: 'repo', note: 'Bare harness string.' },
    'claude-design-session': { harness: 'claude-design', name: null,  role: 'design_session',     session: 'cockpit-v2 handoff · 2026-08-08', host: null, origin: 'repo', note: 'Session named in the brief body, not in frontmatter.' },
    'leo':                   { harness: 'cockpit',       name: 'Leo', role: 'chief_of_staff',     session: 'global thread', host: 'packages/server', origin: 'repo', note: 'The one named runner the cockpit already has.' },
    'daily-logger':          { harness: 'launchd',       name: 'daily-logger', role: 'scheduled_sweep', session: null, host: null, origin: 'asserted', note: 'Harness inferred from the id; launchd label not read.' },
    'watch-poll':            { harness: 'launchd',       name: 'watch-poll',   role: 'feed_poller',     session: null, host: null, origin: 'asserted', note: 'Harness inferred from the id.' },
    'codex-hygiene':         { harness: 'codex',         name: null,  role: 'vault_heartbeat',    session: null, host: null, origin: 'asserted', note: 'Harness inferred from the id.' },
    'James':                 { harness: 'human',         name: 'James', role: 'operator',         session: null, host: null, origin: 'repo' },
  },
  // Target state — what a fully named actor would carry. NOT on any bead; the Design System sheet shows it as SIMULATED.
  proposed: {
    'code-claude':   { harness: 'claude-code', name: 'Ferrier', role: 'implementing_agent', session: '7f3a · lego-village-pipeline', host: 'mbp-14', origin: 'simulated', note: 'A named Claude Code process: name survives across sessions; session + host change.' },
    'codex-hygiene': { harness: 'codex',       name: 'Sexton',  role: 'vault_heartbeat',    session: 'nightly 02:00', host: 'mini', origin: 'simulated', note: 'A named Codex job.' },
  },
};

// Repo-to-repo relations, hand-read from REPO_META role text (origin: asserted). Not a dependency graph from
// package manifests — that would be `derived`; wire it to make these auto-update.
export const LINKS = [
  { from: 'morning-cockpit', to: 'core', rel: 'reads beads + registry' },
  { from: 'gastown-pilot', to: 'core', rel: 'reads the bead store' },
  { from: 'core-reader', to: 'core', rel: 'renders the framework' },
  { from: 'daily-logger', to: 'BlogEngine', rel: 'publishes to' },
  { from: 'beaverGame', to: 'asset-foundry', rel: 'consumes GLBs' },
  { from: 'f1-pit-wall', to: 'f1-substrate', rel: 'reads telemetry' },
  { from: 'f1-press-room', to: 'f1-doctrine', rel: 'binds questions' },
  { from: 'capture-agent', to: 'fairway', rel: 'feeds the twin' },
  { from: 'buddy-check', to: 'dive-briefing', rel: 'evaluates' },
  { from: 'lego-village-pipeline', to: 'play-well-library', rel: 'canonical content' },
  { from: 'shell', to: 'frame-ui-components', rel: 'hosts' },
];

// Artifacts a repo owns — ONLY files this project actually read (origin: repo) or wrote (origin: asserted, "not yet in the repo").
// Briefs are not repeated here; they live in BRIEFS. Repos with no entry were not read, which the UI says in words.
export const ARTIFACTS = [
  { id: 'ns:l1-morning-cockpit', kind: 'northstar', title: 'l1-morning-cockpit — the goal', repo: 'morning-cockpit', path: '.claude/northstar.md', date: '2026-06-28', by: 'James', origin: 'repo' },
  { id: 'rm:rm-l1-morning-cockpit', kind: 'roadmap', title: 'rm-l1-morning-cockpit — the plan', repo: 'morning-cockpit', path: '.claude/roadmap.md', date: '2026-07-17', by: 'code-claude', origin: 'repo' },
  { id: 'adr:0002', kind: 'adr', title: 'ADR-0002 — human-pull vs autonomous', repo: 'morning-cockpit', path: 'decisions/adr/0002', date: '2026-06-07', by: 'code-claude', origin: 'repo', status: 'draft — needs your decision' },
  { id: 'adr:0005', kind: 'adr', title: 'ADR-0005 — handoff emission (the one write)', repo: 'morning-cockpit', path: 'decisions/adr/0005', by: 'code-claude', origin: 'repo', status: 'accepted' },
  { id: 'adr:0008', kind: 'adr', title: 'ADR-0008 — agent liveness derived from bead_events', repo: 'morning-cockpit', path: 'decisions/adr/0008', by: 'code-claude', origin: 'repo', status: 'accepted' },
  { id: 'adr:0012', kind: 'adr', title: 'ADR-0012 — fleet selection re-scopes every surface', repo: 'morning-cockpit', path: 'decisions/adr/0012', by: 'code-claude', origin: 'repo', status: 'accepted' },
  { id: 'adr:0014', kind: 'adr', title: 'ADR-0014 — focus-swap F1–F4', repo: 'morning-cockpit', path: 'decisions/adr/0014', date: '2026-06-27', by: 'code-claude', origin: 'repo', status: 'accepted' },
  { id: 'adr:0016', kind: 'adr', title: 'ADR-0016 — watch-poll feed scoring', repo: 'morning-cockpit', path: 'decisions/adr/0016', by: 'code-claude', origin: 'repo', status: 'accepted' },
  { id: 'file:research/design-handoff-cockpit-v2/README.md', kind: 'handoff', title: 'Cockpit v2 design handoff', repo: 'morning-cockpit', path: 'research/design-handoff-cockpit-v2/', date: '2026-08-08', by: 'claude-design-session', origin: 'repo' },
  { id: 'file:research/fleet-navigator/fleet-navigator.template.html', kind: 'prototype', title: 'Fleet Navigator prototype', repo: 'morning-cockpit', path: 'research/fleet-navigator/', date: '2026-08-08', by: 'claude-design', origin: 'repo' },
  { id: 'file:packages/server/src/fleet-config.ts', kind: 'file', title: 'fleet-config.ts — REPO_META + CRITICAL_CHAINS', repo: 'morning-cockpit', path: 'packages/server/src/fleet-config.ts', date: '2026-09-24', by: 'code-claude', origin: 'repo' },
  { id: 'file:packages/server/src/chat-store.ts', kind: 'file', title: 'chat-store.ts — Leo’s threads', repo: 'morning-cockpit', path: 'packages/server/src/chat-store.ts', by: 'code-claude', origin: 'repo' },
  { id: 'file:handoff/README.md', kind: 'handoff', title: 'MC-UX-01 discovery bundle', repo: 'morning-cockpit', path: 'handoff/ (this design project)', date: '2026-10-08', by: 'claude-design', origin: 'asserted', status: 'not yet in the repo' },
  { id: 'file:core/decisions/northstar/README.md', kind: 'registry', title: 'Northstar registry', repo: 'core', path: 'decisions/northstar/README.md', date: '2026-08-08', by: 'James', origin: 'repo' },
  { id: 'ns:l2-ojfbot', kind: 'northstar', title: 'l2-ojfbot — the venture goal', repo: 'core', path: 'decisions/northstar/l2-ojfbot.md', by: 'James', origin: 'repo' },
  { id: 'file:core/decisions/fleet-runner/skill-observation-correspondence.md', kind: 'decision', title: 'Fleet-runner correspondence profile (Proposed · #495)', repo: 'core', path: 'decisions/fleet-runner/', by: 'code-claude', origin: 'repo', status: 'proposed' },
  { id: 'file:core/orient.py', kind: 'file', title: 'orient.py — the open-hook rule', repo: 'core', path: 'orient.py', by: 'code-claude', origin: 'repo' },
  { id: 'file:docs/design/H-01-R1/README.md', kind: 'handoff', title: 'H-01-R1 design handoff bundle', repo: 'lego-village-pipeline', path: 'docs/design/H-01-R1/', by: 'claude-design', origin: 'repo' },
  { id: 'file:docs/design/H-01-R1/dt/overlay.js', kind: 'file', title: 'Drafting Table overlay (DEC-032/033/035)', repo: 'lego-village-pipeline', path: 'docs/design/H-01-R1/dt/overlay.js', by: 'claude-design', origin: 'repo' },
  { id: 'file:tools/schemas/lego-pipe-memo.v2.schema.json', kind: 'schema', title: 'lego-pipe-memo v2 schema', repo: 'lego-village-pipeline', path: 'tools/schemas/', by: 'code-claude', origin: 'repo', status: 'ratified · register .13' },
  { id: 'file:docs/correspondence/CORR-LEGO-PIPE-021-correspondence-protocol.md', kind: 'memo', title: 'CORR-LEGO-PIPE-021 — correspondence protocol', repo: 'lego-village-pipeline', path: 'docs/correspondence/', date: '2026-09-17', by: 'code-claude', origin: 'repo' },
  { id: 'file:docs/correspondence/ROUTING-2026-09-17.md', kind: 'memo', title: 'Routing table 2026-09-17', repo: 'lego-village-pipeline', path: 'docs/correspondence/', date: '2026-09-17', by: 'code-claude', origin: 'repo' },
  { id: 'file:apps/drafting-table/README.md', kind: 'file', title: 'Drafting Table app', repo: 'lego-village-pipeline', path: 'apps/drafting-table/', by: 'code-claude', origin: 'repo' },
  { id: 'file:daily-logger/collect-context.ts', kind: 'file', title: 'collect-context.ts — the nightly sweep', repo: 'daily-logger', path: 'collect-context.ts', by: 'code-claude', origin: 'repo' },
];

// Terminology audit — the exact strings in the renderer today → plain-words proposal (origin: repo).
export const TERMS = [
  { tech: 'Beads', where: 'Section 04 title', plain: 'Work' },
  { tech: 'Overnight · ran or running since last evening', where: 'Lane subtitle', plain: 'Since you last looked' },
  { tech: 'Pickup · your queue — oldest first, rotten on top', where: 'Lane subtitle', plain: 'Waiting on you' },
  { tech: 'Available · unclaimed — pickable, stale floats up', where: 'Lane subtitle', plain: 'Nobody owns this yet' },
  { tech: 'synth', where: 'Card chip', plain: 'Guessed from open issues — not a real queue post' },
  { tech: 'decided → in flight', where: 'Card chain marker', plain: 'You decided this; delivery is under way' },
  { tech: 'Handoff Artifact · Draft', where: 'Briefing card', plain: 'Brief for the next session (draft)' },
  { tech: 'Approve & emit →', where: 'Briefing CTA', plain: 'Write this brief into <repo>' },
  { tech: 'deterministic · ↻', where: 'Briefing caption', plain: 'Rule-based summary · regenerate' },
  { tech: 'BEADS SCANNED · LIVE · IDLE · STALLED · ZOMBIE AGENTS', where: 'Masthead stats', plain: 'items read · agents working / resting / stuck' },
  { tech: 'northstar → roadmap → queue', where: 'Delivery caption', plain: 'goal → plan → next slices' },
  { tech: 'property gaps', where: 'Delivery block', plain: 'how far each goal has come' },
  { tech: 'status.jsonl · recorded at merge', where: 'Movement feed', plain: 'progress recorded when work merged' },
  { tech: 'shadow-mode skill dispositions', where: 'Loop caption', plain: 'did suggestions get used?' },
  { tech: 'ignored / engaged_no_act / followed / capture_miss / acted', where: 'Funnel rows', plain: 'skipped / looked / tried / not recorded / used' },
  { tech: 'rates unverified', where: 'Loop badge', plain: 'counts only — no percentages until capture quality is checked' },
  { tech: 'EDITORIAL', where: 'Critical path chip', plain: 'hand-written, not derived' },
  { tech: 'grounding context', where: 'Chat disclosure', plain: 'what Leo was told before answering' },
  { tech: 'Northstar tab', where: 'Chat tab', plain: '<repo>’s goals' },
  { tech: 'Ask the Chief of Staff', where: 'Collapsed chat rail', plain: 'Ask Leo' },
];

// Reading Room (2026-10-09, rev. same day). An aggregator: channels are kinds of source, each with its own way of taking it in (read · listen · scan).
// channel status: up | degraded | planned (in scope, no adapter) | later (operator: wired later, out of this scope).
// source status: wired | degraded | planned | suggested (a candidate for your curated list — not chosen by you).
// origin: 'repo' = read off the renderer/server source · 'operator' = named by you in chat · 'suggested' = a design-session candidate.
// items are always [] here: no feed, episode, post, course or book content is reachable from this project, and none is made up.
export const READING = {
  headings: [
    { t: 'LLM tooling', k: 'recent' }, { t: 'Multi-agent orchestration', k: 'domain' }, { t: 'RAG', k: 'domain' },
    { t: 'Evaluation harnesses', k: 'learning' },
  ],
  profile: [
    { t: 'Senior software engineering — TypeScript, distributed systems', k: 'strength' },
    { t: 'ojfbot fleet architecture (beads, convoys, Frame, Dolt)', k: 'strength' },
    { t: 'Evaluation harnesses', k: 'learning' }, { t: 'Cinematography', k: 'learning' },
    { t: 'LLM Tooling', k: 'recent' }, { t: 'Multi-agent orchestration', k: 'domain' }, { t: 'RAG', k: 'domain' },
  ],
  channels: [
    { id: 'news', label: 'News', mode: 'read', status: 'degraded', origin: 'repo', adapter: 'rss (packages/server)', where: 'ReadingSection.tsx · 05 — INTEL',
      what: 'Curated feeds, newest first, tiered T1/T2.', health: '2 sources unreachable at the 2026-08-08 audit', fits: ['first-light', 'short'],
      sources: [{ t: 'Anthropic Engineering', via: 'RSS', tier: 'T1', status: 'degraded', origin: 'repo' }, { t: 'Simon Willison', via: 'RSS', tier: 'T1', status: 'degraded', origin: 'repo' }, { t: 'Hugging Face Blog', via: 'RSS', tier: 'T2', status: 'wired', origin: 'repo' }],
      needs: ['which of the three are the unreachable two (the audit counts, it doesn’t name)', 'a place to keep the curated list that the server reads — today it is in code'], items: [] },
    { id: 'papers', label: 'Papers', mode: 'read', status: 'up', origin: 'repo', adapter: 'hf-daily-papers (packages/server)', where: 'PapersSection.tsx · 06 — SIGNAL',
      what: 'New papers, explained against your reader profile by the local model.', health: 'HF adapter up at audit; explainer needs the local model', fits: ['first-light', 'long'],
      sources: [{ t: 'HF Daily Papers', via: 'adapter · top 3 a day', tier: 'T1', status: 'wired', origin: 'repo' }, { t: 'arXiv listings', via: 'arXiv RSS / API, by category', tier: '—', status: 'planned', origin: 'operator' }],
      suggested: [{ t: 'arXiv cs.CL', via: 'category listing' }, { t: 'arXiv cs.LG', via: 'category listing' }, { t: 'arXiv cs.MA', via: 'category listing — multi-agent' }],
      needs: ['which arXiv categories (or saved queries) — the list is yours to curate', 'dedupe against HF Daily Papers so a paper shows once'], items: [] },
    { id: 'podcasts', label: 'Podcasts', mode: 'listen', status: 'planned', origin: 'operator', adapter: null,
      what: 'Episodes from the shows you follow. Listening, not reading — the sitting counts the episode’s length, and a takeaway is how it reaches the desk.', fits: ['first-light', 'long'],
      sources: [{ t: 'Practical AI', via: 'podcast RSS', tier: '—', status: 'planned', origin: 'operator' }, { t: 'Changelog', via: 'podcast RSS', tier: '—', status: 'planned', origin: 'operator' }, { t: 'Life with Machines', via: 'podcast RSS', tier: '—', status: 'planned', origin: 'operator' }],
      suggested: [{ t: 'Latent Space', via: 'podcast RSS' }],
      needs: ['the shows’ feed URLs (podcast RSS — no account needed)', 'where you actually listen — this room hands off to that player rather than becoming one', 'transcripts, if the show publishes them, so takeaways can quote'], items: [] },
    { id: 'community', label: 'Community', mode: 'scan', status: 'planned', origin: 'operator', adapter: null,
      what: 'What is being talked about under your headings, read for you as a digest. You never open Reddit or X — this channel is the only interface.', fits: ['first-light', 'short'],
      sources: [{ t: 'Reddit — a curated set of subreddits', via: 'per-subreddit RSS', tier: '—', status: 'planned', origin: 'operator' }, { t: 'X — a curated list of accounts', via: 'X API or a third-party bridge', tier: '—', status: 'planned', origin: 'operator' }],
      suggested: [{ t: 'r/LocalLLaMA', via: 'subreddit RSS' }, { t: 'r/MachineLearning', via: 'subreddit RSS' }],
      needs: ['the curated list — which subreddits, which accounts (nothing chosen yet)', 'a digest rule per heading: top threads in 24h, deduped against News and Papers', 'links open the digest’s summary, never reddit.com or x.com', 'an X access route — the official API is paid; bridges break'], items: [] },
    { id: 'course', label: 'Course', mode: 'read', status: 'later', origin: 'operator', adapter: null, provider: 'newline', title: 'AI Accelerator',
      what: 'Your newline AI Accelerator: where you are and what is next. Wired later, outside this design scope — until then, add the lesson you’re on by hand.', fits: ['long'], sources: [], items: [] },
    { id: 'textbooks', label: 'Textbooks', mode: 'read', status: 'later', origin: 'operator', adapter: null,
      what: 'Books you are working through, a chapter at a time. Wired later, outside this design scope — until then, add the chapter you’re on by hand.', fits: ['first-light', 'long'], sources: [], items: [] },
  ],
  sessions: [
    { id: 'first-light', label: 'Start of day', minutes: 20, tip: 'Before First Light: news, community, one paper — then the decisions.' },
    { id: 'short', label: 'Short break', minutes: 10, tip: 'One article or a scan. The desk keeps your place.' },
    { id: 'long', label: 'Long break', minutes: 30, tip: 'An episode, a lesson or a chapter.' },
  ],
};
