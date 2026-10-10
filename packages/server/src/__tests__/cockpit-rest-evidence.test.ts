import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { CockpitSnapshot } from '@cockpit/shared';

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: () => ({
      query: vi.fn().mockResolvedValue([[], []]),
      end: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

let root: string;
let server: Server;
let url: string;
let sourceFile: string;

const BODY = `---
id: rest-fixture
type: brief
title: REST fixture brief
actor: authored-agent
to: authored-recipient
status: live
created_at: 2026-10-10T09:00:00Z
refs: []
---

private fixture body
`;

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'cockpit-rest-evidence-'));
  const dir = path.join(root, 'alpha', '.handoff');
  await mkdir(dir, { recursive: true });
  sourceFile = path.join(dir, 'brief.md');
  await writeFile(sourceFile, BODY);
  process.env.COCKPIT_REPO_ROOT = root;

  vi.resetModules();
  const { createApp } = await import('../app.js');
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  url = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  delete process.env.COCKPIT_REPO_ROOT;
  await rm(root, { recursive: true, force: true });
});

describe('GET /api/cockpit evidence integration', () => {
  it('collects the fixture through the real adapter and returns metadata only without writes', async () => {
    const before = createHash('sha256').update(await readFile(sourceFile)).digest('hex');
    const response = await fetch(`${url}/api/cockpit`);
    const snapshot = await response.json() as CockpitSnapshot;
    const after = createHash('sha256').update(await readFile(sourceFile)).digest('hex');

    expect(response.status).toBe(200);
    expect(snapshot.evidence?.standaloneUnansweredBriefs.total).toBe(1);
    expect(snapshot.evidence?.records[0]).toMatchObject({
      title: 'REST fixture brief',
      sourceRecord: { repository: 'alpha', nativeId: 'rest-fixture', sourcePath: '.handoff/brief.md' },
    });
    expect(JSON.stringify(snapshot.evidence)).not.toContain('private fixture body');
    expect(after).toBe(before);
  });
});
