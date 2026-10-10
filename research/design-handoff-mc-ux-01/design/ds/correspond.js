// Correspondence-aware text fields. Inputs in the cockpit are often pasted from another agent session, so a field
// is not a blank box: it detects the speech act (fleet-runner skill-observation-correspondence profile, core PR #495
// D1–D12), reads lego-pipe-memo/v2 frontmatter when present, lifts refs/findings/repos/agents into chips, and
// insists that anything asking someone to act names its recipient (D2). Preparation ≠ delivery (D6).
// Usage: ckCorr.analyze(text, { fieldKind: 'report'|'notes', inReplyTo, scopeRepo, operator }) → model for the template.
(function () {
  if (window.ckCorr) return;
  var R = function () { return window.React; };
  var mono = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";
  var ACTS = {
    observation: ['OBSERVATION', 'var(--ev-derived)', 'A bounded event with a cursor and a result — what a tool returned. It can say bytes came back; it cannot say the work was useful.'],
    claim: ['CLAIM', 'var(--ev-synth)', 'A proposition by an identified agent about a run or a skill. A claimed application is not a verified one.'],
    report: ['REPORT · INFORMATIONAL', 'var(--ink-2)', 'Findings, evidence, gaps, observed dispositions. Creates no work order and asks nobody to act (D1). Rendered from a pinned revision.'],
    request: ['REQUEST · BINDING', 'var(--decision)', 'Asks someone to fix, decide or accept. A different speech act from a report (D2): it must name its recipient and route through the operative correspondence contract.'],
    decision: ['DECISION · AUTHORITY', 'var(--ev-asserted)', 'A ruling. Shared-account authorship is not proof of a human decision (D7, Proposed); until a mechanism exists it is recorded as asserted, not verified.'],
    disposition: ['DISPOSITION', 'var(--live)', 'accepted · declined · deferred · acknowledged, in reply to a named subject. An agent accepting a suggestion is not a human authorising work.']
  };
  var SCHEMA = { title: 'lego-pipe-memo/v2 · fleet-runner profile', body: 'Frontmatter keys (14 required): correspondence_schema · memo · revision · status · memo_type · title · date · thread · from{actor,role} · to[{actor,role}] · argument ("In which…") · provenance · authority{decision_owner} · register. Conditional: parts (handoff, work_order) · findings (when R/N/X/S/Q/K-nn are cited). Relations are closed: derived_from · supports/refutes · in_reply_to · supersedes · reports_on · published_as · authorized_by.', source: 'lego-village-pipeline tools/schemas/lego-pipe-memo.v2.schema.json · core decisions/fleet-runner/skill-observation-correspondence.md · core PR #495 (Proposed)' };

  function parseFrontmatter(text) {
    var m = /^\s*---\n([\s\S]*?)\n---/.exec(text); if (!m) return null;
    var fm = {}; var cur = null;
    m[1].split('\n').forEach(function (l) {
      var kv = /^([a-z_]+):\s*(.*)$/.exec(l);
      if (kv) { cur = kv[1]; fm[cur] = kv[2].replace(/^["']|["']$/g, ''); return; }
      var sub = /^\s+-?\s*(actor|role|handle):\s*(.*)$/.exec(l); if (sub && cur) { fm[cur] = (fm[cur] ? fm[cur] + ' ' : '') + sub[1] + '=' + sub[2].replace(/^["']|["']$/g, ''); }
      var ar = /^\s+-\s+(.+)$/.exec(l); if (ar && cur && !sub) { fm[cur] = (fm[cur] ? fm[cur] + ', ' : '') + ar[1].trim(); }
    });
    return fm;
  }
  function uniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }

  window.ckCorr = {
    ACTS: ACTS, SCHEMA: SCHEMA,
    analyze: function (text, ctx) {
      ctx = ctx || {}; text = text || ''; var D = ctx.data || {};
      var fm = parseFrontmatter(text); var body = fm ? text.replace(/^\s*---\n[\s\S]*?\n---/, '') : text;
      var lower = body.toLowerCase();
      var requestish = /\b(please|must|should|needs? to|decide|approve|ratify|confirm|can you|could you|request|work order|by (mon|tue|wed|thu|fri|tomorrow|eod))\b|\?\s*$/m.test(body);
      var decisionish = /\b(ruled|ruling|decided|decision:|accept(ed)? as|rejected|ratif)/i.test(body);
      var dispositionish = /\b(accepted|declined|deferred|acknowledged|not today|snooze)\b/i.test(body) && body.length < 400;
      var observationish = /\b(returned|exit code|bytes|sha256|merged|ran at|\d{2}:\d{2}|commit [0-9a-f]{7})/i.test(body);
      var act = fm && fm.memo_type ? ({ handoff: 'request', work_order: 'request', review: 'report', review_response: 'report', decision: 'decision', findings: 'report', correspondence: 'report', addendum: 'report' })[fm.memo_type] || 'report'
        : requestish ? 'request' : decisionish ? 'decision' : dispositionish ? 'disposition' : observationish ? 'observation' : ctx.fieldKind === 'notes' ? 'claim' : 'report';
      if (!body.trim() && !fm) act = ctx.fieldKind === 'notes' ? 'claim' : 'report';
      var refs = uniq((body.match(/\b(adr|rm|ns|bead|closes|file):[\w\-#./]+/g) || []).concat((text.match(/\b\d{8}-\d{4}-brief-[\w-]+/g) || []).map(function (b) { return 'bead:' + b; })));
      var findings = uniq(body.match(/\b(?:R|N|X|S|Q|K)-\d{2}\b/g) || []);
      var memos = uniq(text.match(/\b(?:HANDOFF|CORR|REVIEW)-LEGO-PIPE-\d{3}(?:-R\d+)?/g) || []);
      var repos = uniq((D.REPOS || []).map(function (r) { return r.name; }).filter(function (n) { return new RegExp('\\b' + n.replace(/[-]/g, '\\-') + '\\b', 'i').test(text); }));
      var agents = uniq((D.AGENTS || []).map(function (a) { return a.id; }).filter(function (n) { return new RegExp('\\b' + n + '\\b', 'i').test(text); }).concat(fm && /actor=([\w .()-]+)/.exec(fm.from || '') ? [/actor=([\w .()-]+)/.exec(fm.from)[1].trim()] : []));
      var generated = !!fm || /^\s*\[[\w-]+\]/.test(text) || /^(from|generated by|session):/im.test(text) || agents.length > 0 && /\b(session|wrote|emitted|reported)\b/i.test(body);
      var fromAgent = fm && /actor=([^ ]+(?: [A-Z][\w()]+)?)/.exec(fm.from || '') ? /actor=([^ ]+(?: [A-Z][\w()]+)?)/.exec(fm.from)[1] : (/^\s*\[([\w-]+)\]/.exec(text) || [])[1] || (agents[0] || null);
      var recipients = ctx.recipients || [];
      var toNamed = (fm && fm.to) ? [fm.to] : recipients;
      var warnings = [];
      if (act === 'request' && toNamed.length === 0) warnings.push({ id: 'D2', t: 'This asks someone to act — a request must name its recipient (D2). Pick who it goes to, or reword it as a report.' });
      if (act === 'decision') warnings.push({ id: 'D7', t: 'A decision from a shared account is recorded as ASSERTED, not a verified human ruling (D7, Proposed).' });
      if (fm && fm.argument && !/^In which/.test(fm.argument)) warnings.push({ id: 'arg', t: 'argument: must begin "In which" (schema error).' });
      if (findings.length && !(fm && fm.findings)) warnings.push({ id: 'F', t: 'Cites finding IDs (' + findings.join(', ') + ') — declare them in a findings: block.' });
      if (fm && fm.correspondence_schema && fm.correspondence_schema !== 'lego-pipe-memo/v2') warnings.push({ id: 'schema', t: 'Written in ' + fm.correspondence_schema + '; v2 is operative since register .13 — treat as a draft.' });
      var memoType = act === 'request' ? 'work_order' : act === 'decision' ? 'decision' : act === 'disposition' ? 'review_response' : 'findings';
      var preview = [
        'correspondence_schema: lego-pipe-memo/v2', 'memo: ' + (fm && fm.memo ? fm.memo : 'CORR-OJF-COCKPIT-### (register allocates)'), 'revision: R0', 'status: draft',
        'memo_type: ' + memoType, 'date: ' + new Date().toISOString().slice(0, 10), 'thread: ' + (ctx.thread || 'cockpit-daily-review'),
        'from: { actor: ' + (fromAgent || ctx.operator || 'James') + ', role: ' + (fromAgent && fromAgent !== 'James' ? 'reporting_agent' : 'operator') + ' }',
        'to: [' + toNamed.map(function (t) { return '{ actor: ' + t + ' }'; }).join(', ') + ']',
        ctx.inReplyTo ? 'in_reply_to: ' + ctx.inReplyTo : null, ctx.reportsOn && ctx.reportsOn.length ? 'reports_on: [' + ctx.reportsOn.join(', ') + ']' : null,
        'argument: "In which ' + (body.trim().split(/\n/)[0] || '…').replace(/^[A-Z]/, function (c) { return c.toLowerCase(); }).slice(0, 90) + '"',
        'provenance: { source: ' + (generated ? 'pasted_from_session' : 'typed_in_cockpit') + (fromAgent ? ', agent: ' + fromAgent : '') + ' }',
        'authority: { decision_owner: James }', 'register: { number: pending, allocated_by: register }'
      ].filter(Boolean).join('\n');
      return { act: act, actLabel: ACTS[act][0], actColor: ACTS[act][1], actWhy: ACTS[act][2], fm: fm, generated: generated, fromAgent: fromAgent, refs: refs, findings: findings, memos: memos, repos: repos, agents: agents, recipients: toNamed, warnings: warnings, memoType: memoType, preview: preview, empty: !text.trim() };
    },
    // Register popover pages + chips with ckRefs so act/schema/memo badges open the navigable card.
    install: function () {
      var CK = window.ckRefs; if (!CK || CK.__corr) return; CK.__corr = true; var e = function () { return R().createElement.apply(R(), arguments); };
      CK.extend({
        pages: {
          act: function (id) { var a = ACTS[id]; return { title: a[0], hue: a[1], kicker: 'SPEECH ACT · FLEET-RUNNER PROFILE', body: [CK.row('MEANS', a[2]), CK.row('RULE', id === 'request' ? 'D2: a report and a binding request are different acts. Name the recipient.' : id === 'decision' ? 'D7 (Proposed): shared-account authorship is insufficient proof of a human ruling.' : id === 'report' ? 'D1/D4: informational; rendered from a pinned report revision; asks nobody to act.' : 'Typed truth: an agent may not write verified_application or delivery_confirmed (SC01).')], source: 'core/decisions/fleet-runner/skill-observation-correspondence.md · core PR #495' }; },
          schema: function () { return { title: SCHEMA.title, hue: 'var(--ink-2)', kicker: 'OPERATIVE SINCE REGISTER .13 (2026-09-18)', body: [CK.row('KEYS AND RELATIONS', SCHEMA.body), CK.row('TRANSFER RULE', 'Attach, don’t paste. Identity is prefix + number + revision; transfer identity is the sha256 of the bytes. A paste has no hash — record received, never issued (F-01).')], source: SCHEMA.source }; },
          memo: function (id) { return { title: id, hue: 'var(--ink-2)', kicker: 'MEMO · REGISTER ROW', body: [CK.row('IDENTITY', 'prefix + number + revision — not the filename (invariant 2).'), CK.row('WHERE IT LIVES', 'docs/correspondence/REGISTER.md is the authority; everything else is a mirror (invariant 1).')], source: 'lego-village-pipeline docs/correspondence/REGISTER.md' }; },
          rule: function (id) { var X = { D2: ['D2 — report ≠ request', 'If a comment asks anyone to act, answer or decide, it is a binding speech act with a named to:, under the operative correspondence contract. An informational label cannot exempt it.'], D6: ['D6 — preparation ≠ delivery', 'A rendered memo is prepared. Delivery is established only by independent remote readback of that exact revision; a local success message is insufficient.'], D7: ['D7 — human authority (Proposed)', 'Shared-account authorship is rejected as sufficient proof of a human ruling; the mechanism is open. Until then a decision is ASSERTED.'], F: ['Finding IDs', 'R/N/X/S/Q/K-nn, two digits. Sheet letters (A C F H J P) are not findings. Every cited ID is declared in findings:.'], arg: ['argument: "In which…"', 'The one-paragraph argument must start with “In which” — schema error otherwise.'], schema: ['Operative vs proposed', 'Until the operator ratifies, the prior contract is operative; a memo in the proposed one is a draft and cannot act (F-04).'] }[id] || [id, '']; return { title: X[0], hue: 'var(--ev-asserted)', kicker: 'RULE', body: [CK.row('MEANS', X[1])], source: 'CORR-LEGO-PIPE-021 §A–D · core PR #495' }; }
        },
        chips: {
          act: function (id) { var a = ACTS[id]; return CK.chipBase({ page: { kind: 'act', id: id }, title: a[0], style: { color: a[1], borderColor: a[1], fontSize: 8.5, letterSpacing: '.1em', padding: '1px 6px' } }, [e('span', { key: 'n' }, a[0])]); },
          schema: function () { return CK.chipBase({ page: { kind: 'schema', id: 'v2' }, title: 'schema', style: { color: 'var(--ink-3)', borderColor: 'var(--rule-strong)', fontSize: 8.5, letterSpacing: '.06em', padding: '1px 6px' } }, [e('span', { key: 'n' }, 'lego-pipe-memo/v2')]); },
          memo: function (id) { return CK.chipBase({ page: { kind: 'memo', id: id }, title: id, style: { color: 'var(--ink)', borderColor: 'var(--ink-2)', fontSize: 9.5 } }, [e('span', { key: 'n' }, id)]); },
          rule: function (id) { return CK.chipBase({ page: { kind: 'rule', id: id }, title: id, style: { color: 'var(--ev-asserted)', borderColor: 'var(--ev-asserted)', fontSize: 8.5, padding: '0 5px' } }, [e('span', { key: 'n' }, id)]); },
          finding: function (id) { return CK.chipBase({ page: { kind: 'rule', id: 'F' }, title: id, style: { color: 'var(--ink-2)', borderColor: 'var(--rule-strong)', fontSize: 9.5, fontWeight: 700 } }, [e('span', { key: 'n' }, id)]); }
        }
      });
    }
  };
})();
