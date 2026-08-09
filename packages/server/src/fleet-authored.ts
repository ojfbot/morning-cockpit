import type { FleetAuthoredData } from '@cockpit/shared';

/**
 * The AUTHORED/JUDGMENT layer of the fleet-structure snapshot (roadmap S10) — everything
 * here is either hand-written prose, a human presentation judgment, or a dated hand-made
 * record. Nothing in this file is membership truth: registered membership joins to core's
 * registry live, unregistered membership derives from `census − registry` at request time,
 * and annotation keys that match nothing surface NOTHING (RFI C18 — never hand list #5).
 *
 *   census    the 2026-07-25 fleet-census walk (44 ~/ojfbot repos + ~/selfco = 45), from
 *             ~/.claude/plans/output-a-full-report-sequential-prism.md Documents 1–3.
 *             Stale-capable by design (RFI C17): repos born after the walk are invisible
 *             until the next census record — disclosed via stats.censusAsOf, not papered.
 *   clusters  hand cluster assignment [JUDGMENT] — presentation-level; no file records it.
 *   prose     desc/novice text vendored from the fleet-navigator prototype (2026-08-08),
 *             where it was authored for the "explain the fleet to a guest" reading.
 *   deferred  l2-selfco — declared in the registry only as a comment; the file's landing
 *             spot is probed live so the card flips honest the day it exists.
 */
export const FLEET_AUTHORED: FleetAuthoredData = {
  census: {
    asOf: '2026-07-25',
    source: '~/.claude/plans/output-a-full-report-sequential-prism.md (Documents 1–3)',
    repos: [
      'core',
      '~/selfco',
      'agent-anatomy',
      'github-actions',
      'ojfbot',
      'shell',
      'morning-cockpit',
      'core-reader',
      'gastown-pilot',
      'frame-ui-components',
      'f1-substrate',
      'f1-pit-wall',
      'f1-doctrine',
      'f1-press-room',
      'buddy-check',
      'dive-briefing',
      'switchboard',
      'diy-repair-qa-eval',
      'jocdive-sdi-mcp',
      'daily-logger',
      'blogengine',
      'purefoy',
      'bldgblog-corpus',
      'selfco-box',
      'silicon-empires',
      'mirrorworld',
      'virtualLight',
      'gcgcca',
      'asset-foundry',
      'foundry-recipes',
      'core-library',
      'beaverGame',
      'lofi-beaver',
      'cv-builder',
      'TripPlanner',
      'lean-canvas',
      'mrplug',
      'todo-todo',
      'landing',
      'workstation-yuri',
      'seh-study',
      'golf-platform-scripts',
      'newline-ai-course',
      'GroupThink',
      'hailstone',
    ],
    aliases: {
      // capture-agent was gcgcca until the 2026-07-30 rename; ~/selfco is the deferred L2.
      gcgcca: 'capture-agent',
      '~/selfco': 'l2-selfco',
    },
  },

  clusters: {
    // Registered (keyed by app name; slug-keyed for the core-internal L2/L3 files).
    'l3-shared': 'apex',
    'l2-ojfbot': 'apex',
    core: 'platform',
    shell: 'platform',
    'morning-cockpit': 'platform',
    switchboard: 'platform',
    'cv-builder': 'frame-apps',
    blogengine: 'frame-apps',
    'f1-substrate': 'f1',
    'f1-pit-wall': 'f1',
    'f1-press-room': 'f1',
    'f1-doctrine': 'f1',
    mirrorworld: 'golf-geo',
    fairway: 'golf-geo',
    'capture-agent': 'golf-geo',
    'buddy-check': 'dive',
    'dive-briefing': 'dive',
    'silicon-empires': 'story',
    virtualLight: 'story',
    'fieldwork-1': 'client',
    // Unregistered census repos placed by hand.
    'daily-logger': 'platform',
    'gastown-pilot': 'platform',
    'core-reader': 'platform',
    'github-actions': 'platform',
    'frame-ui-components': 'platform',
    'workstation-yuri': 'platform',
    'selfco-box': 'platform',
    TripPlanner: 'frame-apps',
    'lean-canvas': 'frame-apps',
    purefoy: 'frame-apps',
    mrplug: 'frame-apps',
    landing: 'frame-apps',
    GroupThink: 'frame-apps',
    'build-golf': 'golf-geo',
    'golf-platform-scripts': 'golf-geo',
    'jocdive-sdi-mcp': 'dive',
    'diy-repair-qa-eval': 'dive',
    'lofi-beaver': 'story',
    beaverGame: 'story',
    'asset-foundry': 'story',
    'foundry-recipes': 'story',
    'bldgblog-corpus': 'corpus',
    'newline-ai-course': 'corpus',
    'agent-anatomy': 'corpus',
    'seh-study': 'corpus',
    // ojfbot (org README), core-library, todo-todo, hailstone: no cluster claim — they
    // derive into the residual set. Absence here IS the record.
  },

  prose: {
    'l3-shared': {
      desc: 'The ojfbot ⊕ selfco apex northstar.',
      novice:
        "The single vision statement everything else answers to. There is exactly one L3; both ventures — the ojfbot build fleet and the selfco knowledge vault — declare that their goals serve it. If you're lost anywhere in this graph, walking 'up' the edges always ends here.",
    },
    'l2-ojfbot': {
      desc: 'The fleet venture northstar; all L1s ladder here.',
      novice:
        "The venstar for the whole ~/ojfbot fleet — a vision paragraph plus measured properties with completion percentages. Every app's L1 northstar names which property here its work advances (this navigator serves P2, 'work is legible'). Its own roadmap holds fleet-wide plumbing: registries, lints, the dispatch pipeline.",
    },
    'l2-selfco': {
      desc: 'Declared-but-deferred L2 for the vault.',
      novice:
        "A placeholder for the second venture: the selfco knowledge vault. It's declared in the registry only as a comment — the file doesn't exist yet, which is why this card is dashed. When it lands it will live inside the vault itself (tracking/northstar-selfco.md), owned by selfco and merely referenced by core.",
    },
    'l1-core': {
      desc: 'Registry, skills, hooks, telemetry, delivery pipeline.',
      novice:
        "The fleet's engine room. It holds the skill catalog Claude sessions run on, the northstar/roadmap registry this very page reads, the telemetry hooks, and the delivery pipeline. Its own product bet is the 'skill loop': honestly measuring whether skill suggestions get followed, then improving them against a frozen evaluation.",
    },
    'l1-shell': {
      desc: 'MF host compositor + frame-agent LLM gateway.',
      novice:
        "The web host that composes the Frame apps (cv-builder, blogengine, …) into one surface using Module Federation, and fronts the LLM gateway they share. Registered northstar but no roadmap yet — that's why it shows no slice counts.",
    },
    'l1-morning-cockpit': {
      desc: 'Local-first morning dashboard; Cockpit Chat = Leo.',
      novice:
        'The dashboard you open in the morning: lanes of work-items (beads) gathered from every repo, a reading pod, and Cockpit Chat — whose global assistant thread is Leo, the same local model the fleet popover chat talks to.',
    },
    'l1-switchboard': {
      desc: 'Fleet LLM gateway — budgets, labeled failover, OTel.',
      novice:
        'One gateway every fleet app will eventually call instead of hitting LLM providers directly: per-app budgets, failover that is never silent, and metrics. Python/FastAPI on port 8600.',
    },
    'l1-cv-builder': {
      desc: 'AI resume builder, MF remote.',
      novice:
        'The oldest Frame app — an AI resume builder that runs as a Module Federation remote inside shell. Registered but roadmap-less.',
    },
    'l1-blogengine': {
      desc: 'AI blog dashboard w/ Notion integration.',
      novice:
        'An AI blog dashboard with Notion integration — drafting, tone-checking, media handling. One of the original Frame apps; publishes prose the writing pipeline produces.',
    },
    'l1-f1-substrate': {
      desc: 'DuckDB FastF1 store + FastAPI query layer.',
      novice:
        'Ground truth for the F1 stack: it loads official timing data into DuckDB and serves computed facts (gaps, stints) over an API. House rule: everything else in the F1 cluster may only say what substrate can back with data.',
    },
    'l1-f1-pit-wall': {
      desc: 'Race-engineering dashboard, claim-grounding harness.',
      novice:
        "The dashboard that displays substrate's telemetry like a race engineer's screen. Its defining discipline: the engineer persona starts empty and only ever speaks claim-grounded facts — no fabricated racecraft, ever.",
    },
    'l1-f1-press-room': {
      desc: 'Teaching studio off the f1 export seam.',
      novice:
        "Turns the F1 stack's outputs into teaching content — articles and video shorts where every claim is checked against substrate's export before publishing. The 'content' seat of the four-repo stack.",
    },
    'l1-f1-doctrine': {
      desc: 'RAQG question layer — 33 bound questions.',
      novice:
        "The question layer: a registry of 33 strategist questions ('should we undercut?'), each bound to a real substrate API call. It suggests WHICH question to ask at a given race moment — it never computes an answer itself. Its phase-keyed retrieval already passed a pre-registered evaluation gate.",
    },
    'l1-mirrorworld': {
      desc: 'Real places as three.js scenes; producer for fairway.',
      novice:
        "Turns real places into explorable three.js scenes from public imagery and elevation data. It's the producer side of the golf pair — fairway consumes what it makes. Open caution: the imagery-overlay alignment is still unverified, which blocks trusting the pretty pictures for measurements.",
    },
    'l1-fairway': {
      desc: 'Golf digital twin — consumer of mirrorworld + capture-agent.',
      novice:
        "The golf digital-twin product: an explorable course surface built from mirrorworld's scenes plus capture-agent's imagery. Split out of mirrorworld on 2026-07-30 (producer/consumer separation). Which exact parent property it ladders to is still an open operator question.",
    },
    'l1-capture-agent': {
      desc: 'USGS imagery corpus → segmentation model → HF.',
      novice:
        'Acquires golf-course aerial imagery through a USGS Earth Explorer CLI, builds a Texas corpus, and trains a segmentation model for release on Hugging Face. The formalization of a years-long golf-capture lineage (firstTxGolf → txGolf → this).',
    },
    'buddy-check': {
      desc: 'Dive Q&A eval lab, 13,194 products.',
      novice:
        "The private lab of the dive pair: scuba-gear Q&A over a 13,194-product catalog, with SME-calibrated judges for evaluating answer quality. The retrieval science is proven here before dive-briefing serves it publicly. (Bare slug, no 'l1-' prefix — slugs are immutable identity.)",
    },
    'l1-dive-briefing': {
      desc: 'Public dive-Q&A RAG service, per-claim citations.',
      novice:
        'The public face of the dive pair: a Q&A service that retrieves from tiered corpus packs and verifies every claim citation before answering. Runs on port 8610; buddy-check is its private sibling where the machinery gets calibrated.',
    },
    'l1-silicon-empires': {
      desc: 'AoE-style RTS of the AI-infra complex; SPEC-canon.',
      novice:
        "A playable real-time-strategy game about the AI-infrastructure economy — fabs, power, capital, silicon — with a fully deterministic simulation (same inputs, same game, always). It's a 'SPEC-canon' repo: the spec documents are the product and the code proves them.",
    },
    'l1-virtuallight': {
      desc: 'Book-to-cinema pipeline; Gibson packs private.',
      novice:
        'Book-to-cinema: deterministically extracts passages from novels and renders cinematography-styled video prompts from them. The pipeline is the product; the William Gibson corpus stays private while a public-domain demo fronts it. Revived 2026-07-23 after a dormant spell.',
    },
    'l1-fieldwork-1': {
      desc: 'First field engagement (texas-rr), private repo.',
      novice:
        'The first paid client engagement (a Texas railroad), kept as its own private dossier + delivery workspace. Deliberately temporary and numbered: it retires when the engagement ends, and the next client mints fieldwork-2.',
    },
    // Unregistered census repos (keyed by census/repo name).
    'daily-logger': {
      desc: 'Auto-committed dev log at log.jim.software — collects fleet activity nightly, drafts with a council of expert personas, publishes. Active daily.',
    },
    'gastown-pilot': { desc: 'Gas Town 6-tab dashboard piloting bead-adapter patterns. Scaffold.' },
    'core-reader': { desc: 'A browser over core itself — commands + ADRs tabs (port 3015).' },
    'github-actions': { desc: 'Shared CI workflows every fleet repo reuses (ADR-0067).' },
    'frame-ui-components': {
      desc: 'Shared Carbon Design System component library for the Frame apps.',
    },
    'workstation-yuri': {
      desc: 'macOS workspace orchestrator (Focus modes, wallpapers, iTerm2, Hammerspoon); paused mid-MVP.',
    },
    'selfco-box': {
      desc: "The vault's capture daemon — Notion/PLAUD pollers running LIVE on the Pi on a 15-minute timer. The repo itself carries no northstar.",
    },
    TripPlanner: {
      desc: 'AI trip planner with an 11-phase SSE pipeline. One of the original Frame apps.',
    },
    'lean-canvas': { desc: '9-section AI business canvas. Scaffold.' },
    purefoy: {
      desc: 'Roger Deakins cinematography RAG knowledge base. Known depth gap: zero eval scenarios.',
    },
    mrplug: { desc: 'Chrome extension (MV3) for AI UI/UX analysis of any page.' },
    landing: { desc: 'Personal portfolio landing page.' },
    GroupThink: {
      desc: "LLM tab-grouping Chrome extension with a semantic treemap. SHIPPED — the fleet's one finished consumer artifact.",
    },
    'golf-platform-scripts': { desc: 'Golf platform automation scripts. Active, unregistered.' },
    'jocdive-sdi-mcp': {
      desc: 'Read-only Playwright MCP server over the SDI/TDI instructor portal; parked, blocked on an account email.',
    },
    'diy-repair-qa-eval': {
      desc: "DIY-repair Q&A evaluation — scaffold sibling of buddy-check's eval track.",
    },
    'lofi-beaver': {
      desc: "1-bit isometric 'Willow Bend' story-world with a Blender sprite pipeline. Four slices shipped in a day, then parked.",
    },
    beaverGame: {
      desc: "Cozy 3D beaver simulator (Babylon.js) — consumes asset-foundry's .glb assets.",
    },
    'asset-foundry': {
      desc: 'AI-driven Blender asset pipeline (LangGraph + bpy) feeding the game repos.',
    },
    'foundry-recipes': { desc: 'Recipe library for asset-foundry.' },
    'bldgblog-corpus': {
      desc: 'Deterministic ingest of the full BLDGBLOG archive (2,512 posts, verified) + a 296-post annotated subset.',
    },
    'newline-ai-course': {
      desc: 'Newline AI Accelerator coursework workspace — 18 courses mapped, 13 ingested. Local-only.',
    },
    'agent-anatomy': {
      desc: "'Anatomy of the fleet's multi-agent system' — article companion repo. Registers as an L1 once its article is outlined.",
    },
    'seh-study': {
      desc: 'NASA Systems Engineering Handbook glossary with Leitner spaced repetition.',
    },
  },

  deferred: [
    {
      slug: 'l2-selfco',
      tier: 'L2',
      name: 'selfco venture',
      cluster: 'selfco',
      path: '~/selfco/tracking/northstar-selfco.md',
      ladder: 'l3-shared',
    },
  ],

  vaultLayers: [
    {
      slug: 'wiki-sources',
      label: 'sources',
      wikiDir: 'sources',
      desc: 'One wiki page per ingested source — videos, articles, papers, podcasts.',
    },
    {
      slug: 'wiki-entities',
      label: 'entities',
      wikiDir: 'entities',
      desc: 'People, repos, orgs, tools — including one page per ojfbot repo, auto-registered at spawn (ADR-0088).',
    },
    {
      slug: 'wiki-concepts',
      label: 'concepts',
      wikiDir: 'concepts',
      desc: 'Ideas that recur across sources.',
    },
    {
      slug: 'wiki-synthesis',
      label: 'synthesis',
      wikiDir: 'synthesis',
      desc: 'LLM-authored cross-cutting essays, e.g. the proto-ojfbot lineage.',
    },
    {
      slug: 'raw',
      label: 'raw/',
      desc: 'Append-only source layer — never edited, only consumed by /vault.',
    },
    {
      slug: 'tracking',
      label: 'tracking/',
      desc: 'Delivery-adjacent state, outside wiki lint; the future home of l2-selfco.',
    },
    {
      slug: 'teach',
      label: 'teach/',
      desc: 'Fleet teach corpus — /teach deposits lessons and evidence here.',
    },
    {
      slug: 'diagrams',
      label: 'diagrams/',
      desc: 'Standing fleet maps — fleet-map.md and the navigator file live here.',
    },
    {
      slug: 'selfco-box',
      label: 'selfco-box (Pi)',
      desc: 'Live capture transport on the Raspberry Pi — Notion/PLAUD pollers on a 15-minute systemd timer.',
    },
  ],

  wayfinderProse: {
    'diagram-first-output':
      'Regular diagram output across the fleet — Mermaid canon, canvas surface. The fleet navigator is a prototype from this very map.',
    'f1-learning-studio': 'Decision map for the F1 learning studio.',
    'neistat-ai-bulletin': "Camera Program 'Bulletin AI/04' — Van Neistat as living precedent.",
    'operating-surface-bonded-pair':
      "'Arcade' — the operating surface over the ojfbot⊕selfco pair.",
    'teach-in-the-loop': 'ZPD-calibrated teaching woven into the delivery loop.',
    'cockpit-northstar-conversation': 'The northstar conversation surface inside the cockpit.',
    'fde-operating-presence': 'FDE operating presence — career-lens map.',
    'teach-persistence': 'Where lessons live long-term.',
    'texas-rr-engagement': 'First FDE client engagement map — parent of fieldwork-1.',
  },
};
