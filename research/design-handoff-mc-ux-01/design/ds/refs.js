// Cockpit reference chips + navigable hover-card (ported from lego-village-pipeline dt/overlay.js, DEC-032/033/035).
// One card open page-wide · click opens (pinned) — hover shows only the native tooltip, so dense chip lists never stack cards · the card is navigable:
// chips inside it push a new page onto a stack (breadcrumb + back) · ESC closes · every page ends in WHERE THIS CAME FROM.
// Usage from a DC logic class: componentDidMount → ckRefs.bind(this, React); after data loads → ckRefs.setData(d);
// in renderVals expose ckRefs.chip('repo','core') etc. and put {{ refCard }} = ckRefs.card() at the end of the template.
(function () {
  if (window.ckRefs) return;
  var R = function () { return (comp && comp.__React) || window.React; }; var comp = null;
  var D = null, layer = null, st = { stack: [], anchor: null, pinned: false, phase: 'closed' }, tOpen = null, tClose = null, over = false;
  // Peek — the hover layer for `who` chips only. One at a time · non-interactive · never while a card is pinned · never for chips inside the card.
  var pk = { id: null, proposed: false, anchor: null, open: false }, tPk = null, tPkClose = null;
  var mono = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";
  var HUE = { platform: 'var(--c-platform)', 'frame-apps': 'var(--c-apps)', f1: 'var(--c-f1)', 'golf-geo': 'var(--c-golf)', dive: 'var(--c-dive)', story: 'var(--c-story)', 'play-well': 'var(--c-play)', corpus: 'var(--c-corpus)', client: 'var(--c-client)' };
    function repo(n) { return (D.REPOS || []).find(function (r) { return r.name === n; }); }
  function brief(id) { return (D.BRIEFS || []).find(function (b) { return b.id === id || b.id.indexOf(id) === 0; }); }
  function agent(id) { return (D.AGENTS || []).find(function (a) { return a.id === id; }); }
  function cluster(id) { return (D.CLUSTERS || []).find(function (c) { return c.id === id; }); }
  function waiting(n) { return (D.BRIEFS || []).filter(function (b) { return b.repo === n && b.open && !b.decidedInFlight; }); }
  function dot(c) { return R().createElement('span', { style: { display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: c, flex: 'none' } }); }
  function liveColor(l) { return l === 'live' ? 'var(--live)' : l === 'stale' ? 'var(--warn)' : 'var(--rule-strong)'; }
  function who(id, proposed) { var W = D.WHO; if (!W) return null; return proposed ? W.proposed[id] : W.actors[id]; }
  function harness(w) { return w && D.WHO && D.WHO.harnesses[w.harness]; }
  function sinceWord(iso) { var h = Math.round((Date.now() - new Date(iso)) / 36e5); return h < 1 ? 'now' : h < 48 ? h + 'h ago' : Math.round(h / 24) + 'd ago'; }
  function liveWord(r) { return r.liveness === 'live' ? 'active now' : r.liveness === 'stale' ? 'quiet ' + r.lastDays + 'd' : r.lastDays > 60 ? 'silent ' + r.lastDays + 'd' : 'quiet ' + r.lastDays + 'd'; }

  // ── chips ───────────────────────────────────────────────────────────────────
  function chipBase(props, children) {
    var e = R().createElement; var page = props.page;
    return e('span', {
      tabIndex: 0, role: 'button', 'aria-label': props.aria || props.title, title: props.tip || '',
      
      onClick: function (ev) { ev.stopPropagation(); api.pin(page, ev.currentTarget); },
      onMouseEnter: props.peek ? function (ev) { api.peek(props.peek, ev.currentTarget); } : undefined,
      onMouseLeave: props.peek ? function () { api.unpeek(); } : undefined,
      onFocus: props.peek ? function (ev) { api.peek(props.peek, ev.currentTarget); } : undefined,
      onBlur: props.peek ? function () { api.unpeek(); } : undefined,
      onKeyDown: function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); api.pin(page, ev.currentTarget); } },
      style: Object.assign({ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: mono, fontSize: 10, lineHeight: '14px', padding: '1px 6px 1px 4px', border: '1px solid var(--rule-strong)', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer', whiteSpace: 'nowrap', verticalAlign: 'middle', textDecoration: 'none' }, props.style || {})
    }, children);
  }
  var chips = {
    // Repo chip — cluster hue bar · registration (solid/dashed) · liveness dot · name · waiting count (red) · phase
    repo: function (name, o) { o = o || {}; var r = repo(name); var e = R().createElement; if (!r) return e('span', { style: { fontFamily: mono, fontSize: 10 } }, name);
      var w = waiting(name).length;
      return chipBase({ page: { kind: 'repo', id: name }, title: name, tip: (r.registered ? 'registered' : 'NO GOAL ON RECORD') + ' · ' + liveWord(r) + (w ? ' · ' + w + ' waiting on you' : ''), style: { borderStyle: r.registered ? 'solid' : 'dashed', borderColor: r.registered ? 'var(--rule-strong)' : 'var(--ink-3)', color: r.registered ? 'var(--ink)' : 'var(--ink-2)' } }, [
        e('span', { key: 'h', style: { width: 3, alignSelf: 'stretch', background: HUE[r.cluster] || 'var(--ink-3)', margin: '-1px 0' } }),
        dot(liveColor(r.liveness)),
        e('b', { key: 'n', style: { fontWeight: 700 } }, name),
        w ? e('span', { key: 'w', style: { background: 'var(--decision)', color: 'var(--card)', fontWeight: 700, fontSize: 8.5, padding: '0 4px', lineHeight: '12px' } }, w) : null,
        o.phase === false ? null : e('span', { key: 'p', style: { color: 'var(--ink-3)', fontSize: 8.5, letterSpacing: '.06em' } }, r.phase)
      ]); },
    brief: function (id, o) { var b = brief(id); var e = R().createElement; if (!b) return e('span', { style: { fontFamily: mono, fontSize: 10, color: 'var(--ink-3)' } }, id);
      var label = (o && o.label) || (b.title.length > 42 ? b.title.slice(0, 41) + '…' : b.title);
      return chipBase({ page: { kind: 'brief', id: b.id }, title: b.title, tip: b.staleDays + ' days open · ' + (b.open ? 'waiting' : 'closed'), style: { borderLeft: '3px solid ' + (b.decidedInFlight ? 'var(--live)' : b.open ? 'var(--decision)' : 'var(--rule-strong)'), fontFamily: 'inherit', fontSize: 11 } }, [e('span', { key: 't' }, label)]); },
    agent: function (id) { var a = agent(id); var e = R().createElement; var c = a ? ({ live: 'var(--live)', idle: 'var(--ink-3)', stalled: 'var(--warn)' })[a.state] : 'var(--rule-strong)';
      return chipBase({ page: { kind: 'agent', id: id }, title: id, tip: a ? a.type + ' · ' + (a.state === 'live' ? 'working now' : a.state === 'idle' ? 'resting' : 'stuck') + ' · ' + a.task : 'human or session id on a bead' }, [dot(c), e('span', { key: 'n' }, id)]); },
    // Who chip — harness mark · state dot · process name (or the bare actor id, dimmed, when no name is on the bead). Hover peeks; click opens the agent card.
    who: function (id, o) { o = o || {}; var a = agent(id); var w = who(id, o.proposed); var h = harness(w); var e = R().createElement;
      var c = a ? ({ live: 'var(--live)', idle: 'var(--ink-3)', stalled: 'var(--warn)' })[a.state] : null; var name = w && w.name;
      return chipBase({ page: { kind: 'agent', id: id }, title: id, aria: (h ? h.label + ' · ' : '') + (name || id), peek: { id: id, proposed: !!o.proposed }, style: { padding: '1px 6px 1px 1px', borderStyle: o.proposed ? 'dashed' : 'solid' } }, [
        e('span', { key: 'm', style: { fontFamily: mono, fontSize: 8.5, fontWeight: 700, letterSpacing: '.04em', padding: '0 4px', lineHeight: '14px', margin: '-1px 0', alignSelf: 'stretch', display: 'flex', alignItems: 'center', background: h ? 'var(--ink)' : 'transparent', color: h ? 'var(--card)' : 'var(--ink-3)', borderRight: h ? 'none' : '1px dashed var(--ink-3)' } }, h ? h.mark : '??'),
        c ? dot(c) : null,
        e('span', { key: 'n', style: name ? { fontWeight: 700 } : { color: 'var(--ink-2)' } }, name || id)
      ]); },
    cluster: function (id) { var c = cluster(id); var e = R().createElement; if (!c) return null;
      return chipBase({ page: { kind: 'cluster', id: id }, title: c.label, style: { color: HUE[id], borderColor: HUE[id], letterSpacing: '.06em', textTransform: 'uppercase', fontSize: 9 } }, [e('span', { key: 's', style: { width: 8, height: 8, background: HUE[id] } }), e('span', { key: 'n' }, c.label)]); },
    ref: function (ref) { var e = R().createElement; var k = ref.split(':')[0];
      var col = { adr: 'var(--ev-asserted)', rm: 'var(--ev-derived)', ns: 'var(--ev-derived)', file: 'var(--ink-3)', closes: 'var(--live)', bead: 'var(--decision-ink)' }[k] || 'var(--ink-3)';
      if (k === 'closes' || k === 'bead') return chips.brief(ref.slice(k.length + 1), { label: (k === 'closes' ? 'closes: ' : 'bead: ') + ref.slice(k.length + 1, k.length + 14) + '…' });
      return chipBase({ page: { kind: 'ref', id: ref }, title: ref, style: { color: col, borderColor: col } }, [e('span', { key: 'n' }, ref.length > 44 ? ref.slice(0, 43) + '…' : ref)]); },
    evidence: function (kind) { var e = R().createElement; var col = { derived: 'var(--ev-derived)', asserted: 'var(--ev-asserted)', synth: 'var(--ev-synth)', simulated: 'var(--ev-simulated)' }[kind];
      return chipBase({ page: { kind: 'evidence', id: kind }, title: kind, style: { color: col, borderColor: col, fontSize: 8, letterSpacing: '.08em', padding: '0 4px', textTransform: 'uppercase' } }, [e('span', { key: 'n' }, kind)]); }
  };

  // ── pages (popover content) ─────────────────────────────────────────────────
  function row(label, body, ev) { var e = R().createElement; return e('div', { style: { padding: '7px 0', borderBottom: '1px solid var(--rule)' } }, [
    e('div', { key: 'l', style: { fontFamily: mono, fontSize: 9, letterSpacing: '.1em', color: 'var(--ink-3)', marginBottom: 3, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' } }, [e('span', { key: 't', style: { whiteSpace: 'nowrap' } }, label), ev ? chips.evidence(ev) : null]),
    e('div', { key: 'b', style: { fontSize: 12.5, lineHeight: 1.5, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' } }, body)]); }
  function source(text) { var e = R().createElement; return e('div', { style: { marginTop: 10, fontFamily: mono, fontSize: 9.5, color: 'var(--ink-2)', background: 'var(--paper-2)', border: '1px solid var(--rule)', padding: '5px 7px', wordBreak: 'break-all' } }, [e('div', { key: 'l', style: { fontSize: 8.5, letterSpacing: '.1em', color: 'var(--ink-3)', marginBottom: 2 } }, 'WHERE THIS CAME FROM'), text]); }
  var pages = {
    repo: function (name) { var r = repo(name); var e = R().createElement; var w = waiting(name); var ag = (D.AGENTS || []).filter(function (a) { return a.repo === name; });
      return { title: name, hue: HUE[r.cluster], kicker: (r.registered ? 'REGISTERED · ' : 'NO GOAL ON RECORD · ') + r.phase, body: [
        row('WHAT THIS IS', r.role, 'asserted'),
        row('CLUSTER', [chips.cluster(r.cluster), r.registered ? null : e('span', { key: 'j', style: { fontSize: 11, color: 'var(--ink-3)' } }, '— a judgment call, not registry fact')], r.registered ? 'derived' : 'asserted'),
        row('RIGHT NOW', [dot(liveColor(r.liveness)), ' ' + liveWord(r) + ' · ' + r.openCount + ' open item' + (r.openCount === 1 ? '' : 's')], 'derived'),
        row('WAITING ON YOU', w.length ? w.map(function (b) { return chips.brief(b.id); }) : 'Nothing.', 'derived'),
        row('WHO’S HERE', ag.length ? ag.map(function (a) { return chips.who(a.id); }) : 'No agent recently.', 'derived'),
        row('HOW FAR IT’S COME', r.slices ? r.slices.merged + ' merged · ' + r.slices.ready + ' ready · ' + r.slices.queued + ' queued' : r.registered ? 'Registered, no roadmap yet.' : 'Not measured — unregistered.', 'derived'),
        row('WHY IT EXISTS', r.registered ? ['l1-' + name + ' → ', chips.ref('ns:l2-ojfbot'), ' → l3-shared'] : 'No northstar; nothing above it.', 'derived')
      ], source: 'fleet-config.ts REPO_META · registry read 2026-08-08 · ' + name + '/.handoff/ · bead_events' }; },
    brief: function (id) { var b = brief(id); var e = R().createElement; var succ = (D.BRIEFS || []).filter(function (x) { return x.closes === b.id; });
      return { title: b.title, hue: b.decidedInFlight ? 'var(--live)' : 'var(--decision)', kicker: 'BRIEF · ' + b.created + ' · ' + b.staleDays + ' DAYS', body: [
        row('IN', [chips.repo(b.repo)]),
        row('FROM → TO', [chips.who(b.actor), e('span', { key: 'a', style: { color: 'var(--ink-3)' } }, '→'), chips.who(b.to)], 'derived'),
        row('STATE', b.decidedInFlight ? ['Decided; delivered by ', succ.map(function (s) { return chips.brief(s.id); })] : b.open ? 'Live, no report answers it — waiting.' : 'Closed.', 'derived'),
        b.closes ? row('CLOSES', [chips.brief(b.closes)], 'derived') : null,
        (b.refs && b.refs.length) ? row('CITES', b.refs.map(function (r) { return chips.ref(r); })) : null,
        row('HOW IT CLOSES', 'A report bead with responding_to: this id — or a one-line close-with-reason, which is also a report.')
      ], source: b.repo + '/.handoff/' + b.id + '.md · open-hook rule: adapters/handoff.ts (ported from core orient.py)' }; },
    agent: function (id) { var a = agent(id); var e = R().createElement; var bs = (D.BRIEFS || []).filter(function (b) { return b.actor === id || b.to === id; });
      var w = who(id), h = harness(w); var ev = w ? (w.origin === 'repo' ? 'derived' : w.origin) : null;
      var idRow = row('WHO, EXACTLY', w ? [e('span', { key: 'h', style: { fontFamily: mono, fontSize: 10 } }, (h ? h.label : '?') + ' › '), e('b', { key: 'n', style: w.name ? {} : { fontWeight: 400, color: 'var(--ink-3)', fontStyle: 'italic' } }, w.name || 'no process name on the bead'), e('span', { key: 'r', style: { fontFamily: mono, fontSize: 10, color: 'var(--ink-3)' } }, w.role ? ' · ' + w.role : ''), w.session ? e('span', { key: 's', style: { fontFamily: mono, fontSize: 10, color: 'var(--ink-2)' } }, ' · ' + w.session) : null] : 'Not in the WHO table — a bare string on a bead.', ev);
      if (!a) return { title: (w && w.name) || id, hue: 'var(--ink-3)', kicker: 'ACTOR', body: [idRow, row('WHO', 'A human or a session id on a bead — not an agent in bead_events.'), row('ON BRIEFS', bs.length ? bs.slice(0, 4).map(function (b) { return chips.brief(b.id); }) : 'none')], source: 'actor: / to: frontmatter · WHO table (proposed, MC-UX-01)' };
      return { title: (w && w.name) || id, hue: ({ live: 'var(--live)', idle: 'var(--ink-3)', stalled: 'var(--warn)' })[a.state], kicker: (h ? h.label.toUpperCase() + ' · ' : '') + (a.type || 'AGENT').toUpperCase() + ' · ' + ({ live: 'WORKING', idle: 'RESTING', stalled: 'STUCK' })[a.state], body: [
        idRow,
        row('WORKING ON', [a.task, a.taskRef ? chips.ref(a.taskRef) : null], 'derived'),
        row('LAST SEEN', a.lastEvent.replace('T', ' ').slice(0, 16) + ' UTC', 'derived'),
        row('IN', [chips.repo(a.repo)]),
        row('OWES / WROTE', bs.length ? bs.slice(0, 4).map(function (b) { return chips.brief(b.id); }) : 'No briefs name this agent.', 'derived'),
        row('LIVENESS RULE', 'Derived from agent-* bead_events recency (ADR-0008). agent_status is not truth.')
      ], source: 'bead_events (Dolt) · deriveAgentLiveness · ADR-0008' }; },
    cluster: function (id) { var c = cluster(id); var rs = (D.REPOS || []).filter(function (r) { return r.cluster === id; });
      return { title: c.label, hue: HUE[id], kicker: rs.filter(function (r) { return r.registered; }).length + '/' + rs.length + ' REGISTERED', body: [
        row('REPOS', rs.map(function (r) { return chips.repo(r.name, { phase: false }); })),
        row('WAITING ON YOU', String(rs.reduce(function (n, r) { return n + waiting(r.name).length; }, 0)) + ' briefs across the cluster', 'derived'),
        row('MEMBERSHIP', 'Registered repos: registry fact. Unregistered: assigned by judgment (dashed).', 'asserted')
      ], source: 'core/decisions/northstar/README.md (registry) · fleet-navigator data() 2026-08-08' }; },
    ref: function (ref) { var k = ref.split(':')[0]; var v = ref.slice(k.length + 1);
      var EXPL = { 'adr:0002': ['ADR-0002 — human-pull vs autonomous', 'Draft. Decides whether Available work is pulled by a human or dispatched autonomously; gates claim strictness and the whole coordination layer.', 'morning-cockpit/decisions/adr/0002-*'], 'adr:0005': ['ADR-0005 — Handoff Emission', 'The single write carve-out: the cockpit may write a brief into <repo>/.handoff/ after explicit per-emission approval.', 'decisions/adr/0005'], 'adr:0012': ['ADR-0012 — Fleet selection', 'Selecting a repo re-scopes the Briefing and the Northstar chat; selection is UI state, never a write.', 'decisions/adr/0012'], 'ns:l2-ojfbot': ['l2-ojfbot — the venture northstar', 'All registered L1 goals ladder here. This navigator serves its P2: “work is legible”.', 'core/decisions/northstar/l2-ojfbot.md'], 'ns:l1-morning-cockpit': ['l1-morning-cockpit', 'P1 single legible pane 60 · P2 coordination is ground-truth 50 · P3 pivots focus 55 — first-cut, asserted.', 'morning-cockpit/.claude/northstar.md'], 'rm:rm-l1-morning-cockpit#S8': ['S8 — decided-in-flight derivation', 'Derive, never mutate: a live bead an open brief closes: folds under its successor. Proposes P2 50→56 at merge.', '.claude/roadmap.md'] };
      var x = EXPL[ref] || [ref, k === 'file' ? 'A file in the repo.' : 'A reference carried in frontmatter.', v];
      return { title: x[0], hue: 'var(--ink-2)', kicker: k.toUpperCase() + ' REFERENCE', body: [row('WHAT IT MEANS', x[1], k === 'adr' ? 'asserted' : 'derived')], source: x[2] }; },
    evidence: function (kind) { var X = { derived: ['DERIVED', 'Computed in this app from files or events — bead frontmatter, bead_events, status.jsonl. Re-derives every poll.'], asserted: ['ASSERTED', 'A human wrote this value — editorial chains, northstar current:, cluster judgments. Trust it as an opinion with a date.'], synth: ['SYNTH', 'A model wrote this (local Ollama by default; cloud is opt-in). Grounded on the snapshot; never a verb.'], simulated: ['SIMULATED', 'Prototype stub. Not wired. The real path is named next to it.'] }[kind];
      return { title: X[0], hue: ({ derived: 'var(--ev-derived)', asserted: 'var(--ev-asserted)', synth: 'var(--ev-synth)', simulated: 'var(--ev-simulated)' })[kind], kicker: 'EVIDENCE AXIS', body: [row('MEANS', X[1])], source: 'ds/cockpit.css --ev-* · Drafting Table DEC-023 evidence axes' }; }
  };

  // ── card (rendered through the bound component: expose ckRefs.card() in renderVals as {{ refCard }}) ──
  function render() { if (comp) comp.forceUpdate(function () { requestAnimationFrame(function () { place(); placePeek(); }); }); }
  function card() { var e = R().createElement; return e(R().Fragment, null, cardEl(), peekEl()); }
  // Peek layer — 260px, pointer-events:none (it can never trap the pointer or fight the card), sits under the card's z.
  function peekEl() {
    var e = R().createElement; if (!D || !pk.open || !pk.id) return null; var id = pk.id, w = who(id, pk.proposed), h = harness(w), a = agent(id);
    var ev = w ? (w.origin === 'repo' ? 'derived' : w.origin) : 'asserted'; var evCol = { derived: 'var(--ev-derived)', asserted: 'var(--ev-asserted)', simulated: 'var(--ev-simulated)' }[ev];
    var line = function (l, v, dim) { return e('div', { key: l, style: { display: 'grid', gridTemplateColumns: '58px 1fr', gap: 8, padding: '2px 0', fontSize: 11.5, lineHeight: 1.4 } }, [e('span', { key: 'l', style: { fontFamily: mono, fontSize: 8.5, letterSpacing: '.1em', color: 'var(--ink-3)', paddingTop: 2 } }, l), e('span', { key: 'v', style: v ? { color: 'var(--ink)' } : { color: 'var(--ink-3)', fontStyle: 'italic' } }, v || dim || 'not on the bead')]); };
    return e('div', { id: 'ck-ref-peek', role: 'tooltip', 'aria-hidden': true, style: { position: 'fixed', left: 0, top: 0, zIndex: 2147482000, width: 260, maxWidth: 'calc(100vw - 16px)', pointerEvents: 'none', background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--rule-strong)', borderLeft: '3px solid ' + evCol, boxShadow: 'var(--shadow-md)', padding: '7px 10px 6px', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" } }, [
      e('div', { key: 'h', style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 } }, [
        e('span', { key: 'm', style: { fontFamily: mono, fontSize: 9, fontWeight: 700, padding: '1px 5px', background: h ? 'var(--ink)' : 'transparent', color: h ? 'var(--card)' : 'var(--ink-3)', border: h ? 'none' : '1px dashed var(--ink-3)' } }, h ? h.mark : '??'),
        e('b', { key: 'n', style: { fontSize: 13, fontWeight: 800, letterSpacing: '-.01em', color: w && w.name ? 'var(--ink)' : 'var(--ink-2)' } }, (w && w.name) || id),
        a ? e('span', { key: 's', style: { marginLeft: 'auto', fontFamily: mono, fontSize: 9, letterSpacing: '.08em', color: ({ live: 'var(--live)', idle: 'var(--ink-3)', stalled: 'var(--warn)' })[a.state] } }, ({ live: 'WORKING', idle: 'RESTING', stalled: 'STUCK' })[a.state]) : null
      ]),
      line('HARNESS', h ? h.label + ' · ' + h.kind : null, 'unknown tool'),
      line('PROCESS', w && w.name ? w.name : null, 'no name — only the harness is on the bead'),
      line('ROLE', w && w.role),
      line('SESSION', w && w.session),
      line('HOST', w && w.host),
      a ? line('LAST SEEN', sinceWord(a.lastEvent) + (a.repo ? ' in ' + a.repo : '')) : null,
      e('div', { key: 'f', style: { display: 'flex', gap: 6, alignItems: 'center', marginTop: 5, paddingTop: 4, borderTop: '1px solid var(--rule)', fontFamily: mono, fontSize: 8.5, letterSpacing: '.08em', color: 'var(--ink-3)' } }, [e('span', { key: 'e', style: { color: evCol, textTransform: 'uppercase' } }, ev), e('span', { key: 'c', style: { marginLeft: 'auto' } }, 'CLICK FOR THE FULL CARD')])
    ]);
  }
  function placePeek() { var a = pk.anchor, p = document.getElementById('ck-ref-peek'); if (!a || !p) return; var r = a.getBoundingClientRect(), W = 260, H = p.getBoundingClientRect().height || 120; var up = innerHeight - r.bottom < H + 12 && r.top > innerHeight - r.bottom; p.style.left = Math.max(8, Math.min(r.left, innerWidth - W - 8)) + 'px'; p.style.top = (up ? Math.max(8, r.top - H - 6) : r.bottom + 6) + 'px'; }
  function closePeek() { clearTimeout(tPk); clearTimeout(tPkClose); if (!pk.open && !pk.id) return; pk.open = false; pk.id = null; pk.anchor = null; render(); }
  function cardEl() {
    var e = R().createElement; if (!D || st.phase === 'closed' || !st.stack.length) return null;
    var pg = st.stack[st.stack.length - 1]; var model = pages[pg.kind](pg.id); var open = st.phase === 'open';
    return e('div', { id: 'ck-ref-card', role: 'dialog', 'aria-label': model.title, onMouseEnter: function () { over = true; clearTimeout(tClose); }, onMouseLeave: function () { over = false; if (!st.pinned) api.leave(); }, onClick: function (ev) { ev.stopPropagation(); }, onMouseDown: function (ev) { ev.stopPropagation(); },
      style: { position: 'fixed', left: 0, top: 0, zIndex: 2147483000, width: 340, maxWidth: 'calc(100vw - 16px)', maxHeight: '70vh', overflowY: 'auto', background: 'var(--card)', color: 'var(--ink)', border: '1px solid var(--rule-strong)', borderTop: '3px solid ' + (model.hue || 'var(--ink)'), boxShadow: 'var(--shadow-lg)', padding: '10px 14px 12px', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", pointerEvents: open ? 'auto' : 'none', opacity: open ? 1 : 0, transform: open ? 'none' : 'translateY(-3px)', transition: 'opacity .14s ease-out, transform .14s ease-out' } }, [
      e('div', { key: 'nav', style: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontFamily: mono, fontSize: 9, letterSpacing: '.08em', color: 'var(--ink-3)' } }, [
        st.stack.length > 1 ? e('button', { key: 'b', onClick: api.back, style: { cursor: 'pointer', border: '1px solid var(--rule-strong)', background: 'none', color: 'var(--ink-2)', fontFamily: mono, fontSize: 9, padding: '1px 6px', whiteSpace: 'nowrap' } }, '← BACK') : null,
        e('span', { key: 'c', style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, st.stack.map(function (p) { return p.kind.toUpperCase() + ' › ' + p.id; }).join('  /  ')),
        e('span', { key: 'p', style: { color: 'var(--ink-3)', whiteSpace: 'nowrap' } }, 'click chips to go deeper'),
        e('button', { key: 'x', onClick: function () { api.close(true); }, style: { cursor: 'pointer', border: '1px solid var(--rule-strong)', background: 'none', color: 'var(--ink-2)', fontFamily: mono, fontSize: 9, padding: '1px 6px' } }, 'ESC')
      ]),
      e('div', { key: 'k', style: { fontFamily: mono, fontSize: 9, letterSpacing: '.1em', color: model.hue || 'var(--ink-3)' } }, model.kicker),
      e('h3', { key: 't', style: { margin: '2px 0 4px', fontSize: 15, fontWeight: 800, lineHeight: 1.25, letterSpacing: '-.01em' } }, model.title),
      e('div', { key: 'body' }, model.body),
      source(model.source)
    ]);
  }
  function place() { var a = st.anchor, p = document.getElementById('ck-ref-card'); if (!a || !p) return; var r = a.getBoundingClientRect(), W = 340, H = Math.max(120, p.getBoundingClientRect().height); var up = innerHeight - r.bottom < H + 16 && r.top > innerHeight - r.bottom; p.style.left = Math.max(8, Math.min(r.left, innerWidth - W - 8)) + 'px'; p.style.top = (up ? Math.max(8, r.top - H - 8) : r.bottom + 8) + 'px'; }
  function setPhase(ph) { st.phase = ph; render(); }
  var api = {
    setData: function (d) { D = d; }, extend: function (x) { Object.assign(pages, x.pages || {}); Object.assign(chips, x.chips || {}); }, chipBase: chipBase, row: row, source: source, bind: function (c, react) { comp = c; comp.__React = react || comp.__React; }, card: card, chip: function (kind, id, o) { return D ? chips[kind](id, o) : null; }, chips: chips,
    hover: function (page, el) { if (st.pinned) return; clearTimeout(tClose); clearTimeout(tOpen); var same = st.stack.length && st.stack[0].kind === page.kind && st.stack[0].id === page.id && st.anchor === el; tOpen = setTimeout(function () { st.stack = same ? st.stack : [page]; st.anchor = el; setPhase('opening'); setTimeout(function () { if (st.phase === 'opening') setPhase('open'); }, 40); }, st.phase === 'closed' ? 120 : 0); },
    leave: function () { if (st.pinned) return; clearTimeout(tOpen); clearTimeout(tClose); tClose = setTimeout(function () { if (over) return; api.close(); }, 180); },
    // Peek rules: 220ms intent delay cold, 40ms warm (moving chip→chip) · one peek page-wide, a new hover replaces · never while a card is pinned · never for a chip inside the card · leaving closes after 120ms · click / scroll / ESC close it at once.
    peek: function (p, el) { if (st.pinned) return; var cardEl = document.getElementById('ck-ref-card'); if (cardEl && cardEl.contains(el)) return; clearTimeout(tPkClose); clearTimeout(tPk); var warm = pk.open; tPk = setTimeout(function () { pk.id = p.id; pk.proposed = !!p.proposed; pk.anchor = el; pk.open = true; render(); }, warm ? 40 : 220); },
    unpeek: function () { clearTimeout(tPk); clearTimeout(tPkClose); tPkClose = setTimeout(closePeek, 120); },
    pin: function (page, el) { closePeek(); clearTimeout(tOpen); clearTimeout(tClose); var cardEl = document.getElementById('ck-ref-card'); var inside = cardEl && cardEl.contains(el); if (st.phase !== 'closed' && inside) { st.stack.push(page); } else { st.stack = [page]; st.anchor = el; } st.pinned = true; setPhase('open'); },
    back: function () { if (st.stack.length > 1) { st.stack.pop(); render(); } },
    close: function (now) { clearTimeout(tOpen); clearTimeout(tClose); st.pinned = false; over = false; if (st.phase === 'closed') return; setPhase('closing'); setTimeout(function () { if (st.phase === 'closing') { st.stack = []; setPhase('closed'); } }, now ? 0 : 150); }
  };
  addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { closePeek(); api.close(true); } });
  addEventListener('mousedown', function () { closePeek(); if (st.pinned) api.close(true); });
  addEventListener('scroll', function () { place(); closePeek(); }, true); addEventListener('resize', function () { place(); placePeek(); });
  window.ckRefs = api;
})();
