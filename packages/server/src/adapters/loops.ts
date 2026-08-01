import { execFile } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  deriveControlPlane,
  parseLoopsRegistry,
  type AdapterHealth,
  type ControlPlaneSnapshot,
  type LoopEntry,
  type LoopEvidence,
} from '@cockpit/shared';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

/**
 * Control-plane adapter (read-only) — the ONLY I/O for pane 08. Reads core's loops registry
 * and resolves each entry's `evidence_ref:` to a last-run timestamp.
 *
 * Nothing else in this repo reads `decisions/loops/loops.md`. Fleet (01) derives repo liveness
 * from bead activity; Loop (07) reads skill-disposition telemetry. The registry — 30+ loops,
 * each declaring its trigger, cadence, verifier, stop rule and evidence pointer — had no
 * surface at all before this.
 *
 * Evidence schemes, mirroring core's `loops-liveness.mjs`:
 *
 *   file:<path>          mtime (`~` and core-relative paths both resolve)
 *   git-branch:<name>    last commit date of origin/<name>, local ref as fallback
 *   dolt:<table>         aliveness probe — TCP connect to the sql-server
 *   gh:<repo>:<wf>       needs an authenticated call; UNRESOLVED here by design
 *   script:<path>|none   no reader / declared none → unresolved, with the reason
 *
 * NEVER writes, never throws: each source degrades into its own `AdapterHealth` entry so one
 * unreadable spine cannot take the pane down. Matches `adapters/loop.ts`.
 *
 * VANTAGE: `~`-rooted evidence resolves against the host this server runs on. Evidence that
 * lives elsewhere reads `unverifiable` — a true statement about this vantage, not about the
 * loop. The snapshot carries `vantage` so the UI can say so.
 */

function expandPath(p: string, coreRoot: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return path.isAbsolute(p) ? p : path.join(coreRoot, p);
}

function tcpProbe(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function lastCommitIso(ref: string, cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%cI', ref], {
      cwd,
      timeout: 3_000,
    });
    const out = stdout.trim();
    return out || null;
  } catch {
    return null;
  }
}

async function resolveEvidence(entry: LoopEntry, coreRoot: string): Promise<LoopEvidence> {
  const ref = entry.evidenceRef ?? 'none';
  const idx = ref.indexOf(':');
  const scheme = idx === -1 ? ref : ref.slice(0, idx);
  const arg = idx === -1 ? '' : ref.slice(idx + 1);

  if (scheme === 'none' || ref === 'none') {
    return { scheme: 'none', at: null, reason: 'declared none — nothing to read' };
  }

  if (scheme === 'file') {
    const file = expandPath(arg, coreRoot);
    if (!existsSync(file)) {
      return { scheme, at: null, artifact: arg, reason: `not present on this host: ${arg}` };
    }
    try {
      return { scheme, at: new Date(statSync(file).mtimeMs).toISOString(), artifact: arg };
    } catch (err) {
      return {
        scheme,
        at: null,
        artifact: arg,
        reason: `unreadable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (scheme === 'git-branch') {
    for (const candidate of [`origin/${arg}`, arg]) {
      const iso = await lastCommitIso(candidate, coreRoot);
      if (iso) return { scheme, at: iso, artifact: arg };
    }
    return { scheme, at: null, artifact: arg, reason: `branch not present locally: ${arg}` };
  }

  if (scheme === 'dolt') {
    const { host, port } = config.controlPlane.doltProbe;
    const up = await tcpProbe(host, port, config.controlPlane.probeTimeoutMs);
    return up
      ? { scheme, at: new Date().toISOString(), artifact: arg }
      : { scheme, at: null, artifact: arg, reason: `sql-server unreachable on ${host}:${port}` };
  }

  if (scheme === 'gh') {
    // Deliberately not shelling out to `gh`: this adapter must stay read-only, offline and
    // fast. An authenticated workflow-run lookup belongs behind an explicit opt-in.
    return {
      scheme,
      at: null,
      artifact: arg.split(':').pop(),
      reason: 'needs an authenticated gh call — not resolved from the read-model',
    };
  }

  if (scheme === 'script') {
    return { scheme, at: null, artifact: arg, reason: 'script: scheme has no reader yet' };
  }

  return { scheme, at: null, artifact: arg || undefined, reason: `unknown evidence scheme "${scheme}"` };
}

export async function buildControlPlaneSnapshot(nowDate = new Date()): Promise<ControlPlaneSnapshot> {
  const { coreRoot } = config.controlPlane;
  const registryPath = path.join(coreRoot, 'decisions', 'loops', 'loops.md');
  const health: AdapterHealth[] = [];
  const registryHealth: AdapterHealth = { name: 'control-plane-registry', status: 'up', itemCount: 0 };

  let entries: LoopEntry[] = [];
  let parseSkipped = 0;

  try {
    if (!existsSync(registryPath)) {
      registryHealth.status = 'down';
      registryHealth.lastError = `registry not found at ${registryPath} — set COCKPIT_CORE_ROOT`;
    } else {
      const parsed = parseLoopsRegistry(readFileSync(registryPath, 'utf8'));
      entries = parsed.loops;
      parseSkipped = parsed.skipped;
      registryHealth.itemCount = entries.length;
      registryHealth.note = parseSkipped
        ? `${entries.length} loops · ${parseSkipped} entry/entries without a slug skipped`
        : `${entries.length} loops`;
      if (parseSkipped) registryHealth.status = 'degraded';
      if (!entries.length) {
        registryHealth.status = 'degraded';
        registryHealth.note = 'registry parsed but declared no loops';
      }
    }
  } catch (err) {
    registryHealth.status = 'down';
    registryHealth.lastError = err instanceof Error ? err.message : String(err);
  }
  health.push(registryHealth);

  // Resolve evidence concurrently; a rejection becomes an unresolved row, never a throw.
  const settled = await Promise.allSettled(entries.map((e) => resolveEvidence(e, coreRoot)));
  const evidence: Record<string, LoopEvidence> = {};
  let unresolved = 0;
  settled.forEach((s, i) => {
    const slug = entries[i]!.slug;
    if (s.status === 'fulfilled') {
      evidence[slug] = s.value;
      if (s.value.at == null) unresolved++;
    } else {
      evidence[slug] = { at: null, reason: `evidence probe failed: ${String(s.reason)}` };
      unresolved++;
    }
  });

  const evidenceHealth: AdapterHealth = {
    name: 'control-plane-evidence',
    status: unresolved && entries.length && unresolved === entries.length ? 'degraded' : 'up',
    itemCount: entries.length - unresolved,
    note: `${entries.length - unresolved}/${entries.length} evidence refs resolved from this host`,
  };
  health.push(evidenceHealth);

  const { rows, totals } = deriveControlPlane(entries, evidence, nowDate.getTime(), {
    parseSkipped,
    budgets: config.controlPlane.budgets,
  });

  return {
    generatedAt: nowDate.toISOString(),
    vantage: `${os.hostname()}:${coreRoot}`,
    source: registryPath,
    rows,
    totals,
    health,
  };
}
