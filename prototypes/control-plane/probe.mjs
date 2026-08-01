#!/usr/bin/env node
/**
 * PROTOTYPE — throwaway. Delete after the verdict is recorded (see README.md).
 *
 * QUESTION: can "what's working and connected vs what isn't" be derived for the whole
 * fleet from committed files alone — and what does it actually show?
 *
 * Two columns, one of which nobody has today:
 *
 *   WORKING   — did this loop fire inside the budget its declared cadence allows?
 *               (this half exists: core/scripts/loops-liveness.mjs. Reimplemented here
 *               deliberately, standalone, to prove the read needs nothing but files.)
 *
 *   CONNECTED — does anything anywhere reference this loop's output artifact?
 *               A loop that runs perfectly and writes a file no script, skill, doc or
 *               pane ever names is producing into a void. Nothing measures this today.
 *
 * PORTABILITY (the operator's hard constraint): plain Node, no deps, no build step, no
 * vendor SDK, no network. Reads files and shells `git`/`rg`. Runs identically under a
 * Claude Routine, cron, systemd, GitHub Actions, or a human typing `node probe.mjs`.
 * Nothing it knows lives anywhere but the filesystem. That is the point — the trigger
 * is swappable because the body never depended on one.
 *
 *   node probe.mjs                      # table
 *   node probe.mjs --json               # the shape a cockpit pane would consume
 *   CP_CORE_ROOT=... CP_SCAN_ROOT=...   # override paths (default ~/ojfbot/core, ~/ojfbot)
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const CORE_ROOT = process.env.CP_CORE_ROOT ?? path.join(os.homedir(), 'ojfbot', 'core');
const SCAN_ROOT = process.env.CP_SCAN_ROOT ?? path.join(os.homedir(), 'ojfbot');
const REGISTRY = path.join(CORE_ROOT, 'decisions', 'loops', 'loops.md');
const NOW = Date.now();
const DAY = 86_400_000;

/** Cadence → how old the last-run evidence may be before it is STALE. */
const BUDGET_DAYS = { daily: 2, weekly: 10 };

// ─────────────────────────────────────────────────────────── registry parse ──

/**
 * Tolerant scanner over the registry's constrained frontmatter. Deliberately not a YAML
 * parser: zero deps is a portability property, and the schema is a flat list of scalars.
 * Unparseable lines are counted, never silently dropped (no silent denominators).
 */
function parseRegistry(text) {
  const lines = text.split('\n');
  const loops = [];
  let cur = null;
  let inFm = false;
  let skipped = 0;

  for (const raw of lines) {
    if (raw.trim() === '---') {
      if (!inFm) { inFm = true; continue; }
      break; // closing fence — registry body follows
    }
    if (!inFm) continue;
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) continue;

    const item = raw.match(/^ {2}- (\w+):\s*(.*)$/);
    if (item) {
      if (cur) loops.push(cur);
      cur = { [item[1]]: unquote(item[2]) };
      continue;
    }
    const field = raw.match(/^ {4}(\w+):\s*(.*)$/);
    if (field && cur) { cur[field[1]] = unquote(field[2]); continue; }
    // Registry-level keys, not loop data. Counting them as "skipped" cries wolf.
    if (/^(loops|type|version):/.test(raw)) continue;
    if (cur && raw.startsWith('    ')) continue; // continuation of a wrapped scalar
    if (raw.trim()) skipped++;
  }
  if (cur) loops.push(cur);
  return { loops, skipped };
}

const unquote = (v) => v.replace(/^["'](.*)["']$/, '$1').trim();

const expand = (p) =>
  p.startsWith('~/') ? path.join(os.homedir(), p.slice(2))
  : path.isAbsolute(p) ? p
  : path.join(CORE_ROOT, p);

// ────────────────────────────────────────────────────── WORKING: did it run ──

function tcpProbe(host, port, ms = 400) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    const done = (ok) => { s.destroy(); resolve(ok); };
    s.setTimeout(ms);
    s.once('connect', () => done(true));
    s.once('timeout', () => done(false));
    s.once('error', () => done(false));
    s.connect(port, host);
  });
}

/** Resolve `evidence_ref:` to a last-run timestamp, or say why it cannot be resolved. */
async function resolveEvidence(loop) {
  const ref = loop.evidence_ref ?? 'none';
  const [scheme, ...rest] = ref.split(':');
  const arg = rest.join(':');

  if (ref === 'none' || scheme === 'none') {
    return { at: null, reason: 'declared none — nothing to read', artifact: null };
  }
  if (scheme === 'file') {
    const f = expand(arg);
    if (!existsSync(f)) return { at: null, reason: `missing: ${arg}`, artifact: arg, absent: true };
    return { at: statSync(f).mtimeMs, artifact: arg };
  }
  if (scheme === 'git-branch') {
    for (const r of [`origin/${arg}`, arg]) {
      try {
        const out = execFileSync('git', ['log', '-1', '--format=%cI', r],
          { cwd: CORE_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (out) return { at: Date.parse(out), artifact: arg };
      } catch { /* try next ref */ }
    }
    return { at: null, reason: `branch not present locally: ${arg}`, artifact: arg, whole: true };
  }
  if (scheme === 'dolt') {
    const up = await tcpProbe('127.0.0.1', 3307);
    return { at: up ? NOW : null, reason: up ? undefined : 'sql-server not reachable on :3307', artifact: arg, probe: true };
  }
  if (scheme === 'gh') {
    // `gh:<owner/repo>:<workflow.yml>` — the searchable identity is the workflow file.
    const wf = arg.split(':').pop();
    return { at: null, reason: 'needs an authenticated gh call — unresolvable offline', artifact: wf };
  }
  if (scheme === 'script') {
    return { at: null, reason: 'script: scheme has no reader', artifact: arg };
  }
  return { at: null, reason: `unknown scheme "${scheme}"`, artifact: arg };
}

function verdictFor(loop, ev) {
  if (loop.status === 'disabled') return { verdict: 'EXCLUDED', why: 'deliberately parked' };
  if (loop.cadence === 'event' || loop.cadence === 'manual') {
    return { verdict: 'EXCLUDED', why: `cadence ${loop.cadence} — no schedule to breach` };
  }
  if (loop.cadence === 'always-on') {
    return ev.at ? { verdict: 'OK', why: 'probe reachable' }
                 : { verdict: 'DOWN', why: ev.reason ?? 'probe failed' };
  }
  if (ev.at == null) return { verdict: 'UNVERIFIABLE', why: ev.reason ?? 'no readable evidence' };
  const ageDays = (NOW - ev.at) / DAY;
  const budget = BUDGET_DAYS[loop.cadence] ?? 10;
  return ageDays > budget
    ? { verdict: 'STALE', why: `last ran ${ageDays.toFixed(0)}d ago, ${loop.cadence} allows ${budget}d`, ageDays }
    : { verdict: 'OK', why: `${ageDays.toFixed(1)}d old`, ageDays };
}

// ─────────────────────────────────────── CONNECTED: does anything read it? ──

/**
 * Does anything reference this loop's output artifact?
 *
 * Proxy for consumption, and an honest one only in the negative direction: a reference
 * does NOT prove anyone read the artifact, but ZERO references is strong evidence the
 * output goes nowhere. Reported as `refs`, never as "consumed" — see README's limits.
 *
 * Self-references are excluded: the registry entry that declares the artifact and the
 * script that writes it both name it, and neither is a consumer.
 */
function connectedness(loop, ev) {
  if (!ev.artifact) return { refs: 0, files: [], skipped: 'no artifact declared' };
  // A git branch is identified by its whole path (`telemetry/daily`); basename-ing it to
  // "daily" matches half the fleet and reports a fiction. Files keep their basename.
  const base = ev.whole ? ev.artifact : path.basename(ev.artifact);
  // Reject search terms too generic to mean anything — a common word returns the fleet,
  // which reads as "well connected" and is the most dangerous false negative here.
  if (!base || base.length < 6 || !/[./_-]/.test(base)) {
    return { refs: 0, files: [], skipped: `term "${base}" too generic to attribute` };
  }

  let out = '';
  try {
    out = execFileSync('rg', [
      '--files-with-matches', '--fixed-strings', '--no-messages',
      '--glob', '!**/node_modules/**', '--glob', '!**/.git/**',
      '--glob', '!**/dist/**', '--glob', '!**/*.lock', '--glob', '!**/pnpm-lock.yaml',
      base, SCAN_ROOT,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { /* rg exits 1 on no match */ }

  const selfScript = loop.trigger_ref ? path.basename(loop.trigger_ref) : null;
  const files = out.split('\n').filter(Boolean)
    .map((f) => path.relative(SCAN_ROOT, f))
    .filter((f) => !f.endsWith(path.join('decisions', 'loops', 'loops.md')))
    .filter((f) => !(selfScript && f.endsWith(selfScript)));

  return { refs: files.length, files: files.slice(0, 6) };
}

// ────────────────────────────────────────────────────────────────── report ──

const PAD = (s, n) => String(s ?? '').padEnd(n).slice(0, n);

async function main() {
  if (!existsSync(REGISTRY)) {
    console.error(`registry not found: ${REGISTRY}\nset CP_CORE_ROOT.`);
    process.exit(2); // mechanical failure — a finding is never a failure
  }
  const { loops, skipped } = parseRegistry(readFileSync(REGISTRY, 'utf8'));

  const rows = [];
  for (const loop of loops) {
    const ev = await resolveEvidence(loop);
    const v = verdictFor(loop, ev);
    const conn = connectedness(loop, ev);
    rows.push({
      slug: loop.slug, repo: loop.repo, trigger: loop.trigger, cadence: loop.cadence,
      status: loop.status, verdict: v.verdict, why: v.why,
      artifact: ev.artifact, artifactMissing: ev.absent ?? false,
      lastRun: ev.at ? new Date(ev.at).toISOString() : null,
      refs: conn.refs, refFiles: conn.files, refsSkipped: conn.skipped,
      hasVerifier: !!loop.verifier && loop.verifier !== 'none' && !loop.verifier.startsWith('none'),
      hasStopRule: !!loop.stop_rule,
    });
  }

  const tally = (k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] ?? 0) + 1), m), {});
  // "Orphan" = we could look for consumers and found none. Loops whose artifact could not
  // be searched are excluded from the count rather than assumed connected.
  const searchable = rows.filter((r) => !r.refsSkipped);
  const orphans = searchable.filter((r) => r.refs === 0);
  const noVerifier = rows.filter((r) => !r.hasVerifier);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: path.relative(os.homedir(), REGISTRY),
    scanRoot: SCAN_ROOT,
    counts: {
      loops: rows.length, parseSkipped: skipped,
      byVerdict: tally('verdict'), byTrigger: tally('trigger'),
      searchableArtifacts: searchable.length,
      orphanArtifacts: orphans.length,
      loopsWithoutVerifier: noVerifier.length,
    },
    rows,
  };

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\ncontrol-plane probe — ${rows.length} loops from ${payload.source}`);
  console.log(`scanned for consumers under ${SCAN_ROOT}\n`);
  const W = Math.max(20, ...rows.map((r) => (r.slug ?? '').length)); // never truncate a slug into a lie
  console.log(PAD('LOOP', W) + PAD('REPO', 22) + PAD('TRIG', 11) + PAD('CAD', 10) + PAD('VERDICT', 14) + 'REFS  DETAIL');
  console.log('─'.repeat(W + 80));
  const order = { DOWN: 0, STALE: 1, UNVERIFIABLE: 2, OK: 3, EXCLUDED: 4 };
  for (const r of [...rows].sort((a, b) => (order[a.verdict] - order[b.verdict]) || a.slug.localeCompare(b.slug))) {
    const refs = r.refsSkipped ? '  — ' : PAD(r.refs === 0 ? `0 !` : String(r.refs), 4);
    console.log(PAD(r.slug, W) + PAD(r.repo, 22) + PAD(r.trigger, 11) + PAD(r.cadence, 10) + PAD(r.verdict, 14) + refs + '  ' + (r.why ?? ''));
  }

  console.log('\n── what this says ──');
  console.log(`verdicts        ${JSON.stringify(payload.counts.byVerdict)}`);
  console.log(`triggers        ${JSON.stringify(payload.counts.byTrigger)}`);
  console.log(`orphan outputs  ${orphans.length}/${searchable.length} searchable artifacts have ZERO references outside the registry`);
  if (orphans.length) console.log(`                ${orphans.map((r) => r.slug).join(', ')}`);
  console.log(`no verifier     ${noVerifier.length}/${rows.length} loops declare no verifier`);
  if (skipped) console.log(`parse skipped   ${skipped} frontmatter line(s) the scanner did not understand`);
  console.log('\nvantage: file: refs under ~ resolve against THIS host. Evidence living on another');
  console.log('machine reads UNVERIFIABLE here — that is a true statement about this vantage,');
  console.log('not about the loop. Run it where the spines are, or have loops publish digests.\n');
}

main().catch((e) => { console.error(e); process.exit(2); });
