import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { config } from './config.js';

/**
 * Queue-claim trigger (ADR-0010, coordination S4). The cockpit is read-only over Dolt; the ONE
 * exception is the ADR-0005 filesystem handoff. A claim is a Dolt write, so per CLAUDE.md ("writes
 * belong in the bead system") the CAS+lease lives in core `bead-emit.mjs queue-claim` — this module
 * just SHELLS OUT to it (the cockpit never opens a Dolt write connection) and parses the JSON result.
 *
 * Uses execFile (no shell) — beadId is passed as a literal arg, so there is no shell-injection
 * surface even though it is user-supplied. DOLT_PORT is forwarded so the verb writes the SAME Dolt
 * the cockpit reads (matters when COCKPIT_DOLT_PORT points at a non-default server).
 */
const execFileAsync = promisify(execFile);

/** Who the cockpit claims as. Single-user local app; overridable. Always a human (bypasses autonomy). */
const CLAIMER = process.env.COCKPIT_CLAIMER ?? 'human:cockpit';

export interface ClaimResult {
  status: 'ok' | 'lost' | 'error';
  beadId: string;
  hook?: string;
  leaseUntil?: string;
  error?: string;
}

function beadEmitPath(): string {
  // The cockpit already reaches into ~/ojfbot/<repo> for the handoff write (config.handoff.repoRoot).
  return path.join(config.handoff.repoRoot, 'core', 'scripts', 'hooks', 'bead-emit.mjs');
}

export async function claimTask(beadId: string): Promise<ClaimResult> {
  if (!beadId || typeof beadId !== 'string') return { status: 'error', beadId: String(beadId), error: 'beadId required' };
  try {
    const { stdout } = await execFileAsync(
      'node',
      [beadEmitPath(), 'queue-claim', `--bead-id=${beadId}`, `--claimer=${CLAIMER}`, '--human=true'],
      { timeout: 10_000, env: { ...process.env, DOLT_PORT: String(config.dolt.port) } },
    );
    // bead-emit prints one JSON line; take the last non-empty line defensively.
    const line = stdout.trim().split('\n').filter(Boolean).pop() ?? '{}';
    const out = JSON.parse(line) as { status?: string; hook?: string; lease_until?: string };
    if (out.status === 'claimed') return { status: 'ok', beadId, hook: out.hook, leaseUntil: out.lease_until };
    if (out.status === 'lost') return { status: 'lost', beadId };
    return { status: 'error', beadId, error: `unexpected queue-claim output: ${line}` };
  } catch (err) {
    return { status: 'error', beadId, error: err instanceof Error ? err.message : String(err) };
  }
}
