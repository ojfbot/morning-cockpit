import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
let evidenceStore: typeof import('../evidence-store.js').evidenceStore;
import type { CockpitSnapshot } from '@cockpit/shared';

vi.mock('mysql2/promise', () => ({
  default: {
    createPool: () => ({
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM beads')) {
          return [
            [
              {
                id: 'rest-fixture',
                type: 'task',
                status: 'created',
                title: 'REST fixture Dolt task',
                labels: JSON.stringify({ repo: 'dolt-alpha' }),
                actor: 'dolt-actor',
                hook: null,
                refs: '[]',
                created_at: '2026-10-10T08:00:00Z',
                updated_at: '2026-10-10T08:00:00Z',
                closed_at: null,
              },
            ],
            [],
          ];
        }
        return [[], []];
      }),
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
  evidenceStore = (await import('../evidence-store.js')).evidenceStore;
  const { createApp } = await import('../app.js');
  server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  url = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  delete process.env.COCKPIT_REPO_ROOT;
  await rm(root, { recursive: true, force: true });
});

describe('GET /api/cockpit evidence integration', () => {
  it('collects the fixture through the real adapter and returns metadata only without writes', async () => {
    const before = createHash('sha256')
      .update(await readFile(sourceFile))
      .digest('hex');
    const response = await fetch(`${url}/api/cockpit`);
    const snapshot = (await response.json()) as CockpitSnapshot;
    const after = createHash('sha256')
      .update(await readFile(sourceFile))
      .digest('hex');

    expect(response.status).toBe(200);
    expect(snapshot).not.toHaveProperty('evidence');
    expect(snapshot.evidenceSummary?.handoff.populationCount).toBe(1);
    const id = snapshot.evidenceSummary?.snapshotId;
    expect(id).toBeDefined();
    const index = evidenceStore.index(id ?? 'missing');
    const key =
      index.status === 'ready' && index.handoff.status === 'observed'
        ? index.handoff.records[0]?.sourceRecordKey
        : undefined;
    const detail = evidenceStore.record(id ?? 'missing', key ?? 'missing');
    expect(detail.status).toBe('ready');
    expect(detail.status === 'ready' ? detail.record : null).toMatchObject({
      title: 'REST fixture brief',
      sourceRecord: {
        repository: 'alpha',
        nativeId: 'rest-fixture',
        sourcePath: '.handoff/brief.md',
      },
    });
    const collidingItems = Object.values(snapshot.lanes)
      .flat()
      .filter((item) => item.nativeId === 'rest-fixture');
    expect(collidingItems).toHaveLength(2);
    expect(
      new Set(collidingItems.map((item) => item.sourceRecordKey)).size,
    ).toBe(2);
    expect(JSON.stringify(detail)).not.toContain('private fixture body');
    expect(after).toBe(before);
  });
});

it('serves pinned index/detail through the actual GraphQL facade and returns explicit expiry', async () => {
  const snapshot = await (await fetch(`${url}/api/cockpit`)).json();
  const query = async (query: string, variables: Record<string, string>) =>
    (
      await fetch(`${url}/graphql`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query, variables }),
      })
    ).json();
  const index = await query(
    'query($id:String!){ evidenceIndex(snapshotId:$id){ ... on EvidenceIndex { snapshotId handoff { ... on ObservedHandoffIndex { populationRecordKeys } } } } }',
    { id: snapshot.evidenceSummary.snapshotId },
  );
  expect(index.errors).toBeUndefined();
  expect(index.data.evidenceIndex.handoff.populationRecordKeys).toHaveLength(1);
  const detail = await query(
    'query($id:String!,$key:String!){ evidenceRecord(snapshotId:$id,sourceRecordKey:$key){ ... on EvidenceRecord { snapshotId record { ... on HandoffRecordEvidence { title documentProduction { ... on LegacyUnknownDocumentProduction { status reason } } } } } } }',
    {
      id: snapshot.evidenceSummary.snapshotId,
      key: index.data.evidenceIndex.handoff.populationRecordKeys[0],
    },
  );
  expect(detail.errors).toBeUndefined();
  expect(detail.data.evidenceRecord.record.documentProduction.status).toBe(
    'legacy_unknown',
  );
  const expired = await query(
    'query($id:String!){ evidenceIndex(snapshotId:$id){ ... on EvidenceRefreshRequired { status reason } } }',
    { id: 'missing-or-restarted' },
  );
  expect(expired.errors).toBeUndefined();
  expect(expired.data.evidenceIndex.status).toBe('refresh_required');
});
