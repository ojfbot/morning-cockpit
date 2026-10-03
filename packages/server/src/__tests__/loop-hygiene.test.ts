import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let coreRoot: string;

beforeEach(() => {
  coreRoot = mkdtempSync(path.join(os.tmpdir(), 'cockpit-hygiene-'));
  vi.stubEnv('COCKPIT_CORE_ROOT', coreRoot);
  vi.stubEnv('COCKPIT_TRACKING_ROOT', coreRoot);
  vi.stubEnv('COCKPIT_AUDIT_FILE', path.join(coreRoot, 'absent-audit'));
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(coreRoot, { recursive: true, force: true });
});

function reader(source: string) {
  const scripts = path.join(coreRoot, 'scripts');
  mkdirSync(scripts, { recursive: true });
  writeFileSync(path.join(scripts, 'codex-automation-status.mjs'), source);
}

async function snapshot() {
  const { buildLoopSnapshot } = await import('../adapters/loop.js');
  return buildLoopSnapshot(new Date('2026-10-02T14:00:00.000Z'));
}

describe('hygiene CLI adapter', () => {
  it('reports a missing reader in status and health', async () => {
    const result = await snapshot();
    expect(result.hygiene.kind).toBe('unavailable');
    expect(result.health.hygiene).toMatchObject({ status: 'down', lastError: 'core Codex automation reader is not installed' });
  });

  it('reports malformed output in status and health', async () => {
    reader('process.stdout.write("not JSON")');
    const result = await snapshot();
    expect(result.hygiene).toEqual({ kind: 'unavailable', reason: 'Codex automation reader returned malformed data' });
    expect(result.health.hygiene).toMatchObject({ status: 'down', lastError: 'Codex automation reader returned malformed data' });
  });

  it('keeps the event loop responsive while the reader runs', async () => {
    reader(`await new Promise(resolve => setTimeout(resolve, 500));
      process.stdout.write(JSON.stringify({id:'selfco-vault-hygiene',scheduler:'codex',
      configured:'disabled',firing:'disabled'}))`);
    const { buildLoopSnapshot } = await import('../adapters/loop.js');
    const start = performance.now();
    const pending = buildLoopSnapshot(new Date('2026-10-02T14:00:00.000Z'));
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(performance.now() - start).toBeLessThan(350);
    const result = await pending;
    expect(result.hygiene).toEqual({ kind: 'disabled', reason: 'Codex automation is disabled' });
    expect(result.health.hygiene.status).toBe('up');
  });
});
