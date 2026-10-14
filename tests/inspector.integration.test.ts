import {
  beforeEach,
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { tmpdir } from 'node:os';
import { mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { createYoga } from 'graphql-yoga';
const audit =
  process.env.COCKPIT_INSPECTOR_RECEIPT_DIR ??
  (await mkdtemp(path.join(tmpdir(), 'cockpit-inspector-')));
function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Required fixture value absent');
  return value;
}
const facts: Record<string, unknown> = {};
const now = new Date('2026-10-13T12:00:00Z');
const ctx = {
  now,
  overnightSince: '2026-10-12T23:00:00Z',
  staleThresholdDays: 14,
};
let serial = 0;
function task(extra = {}) {
  return {
    id: 'core-task-native',
    type: 'task',
    status: 'live',
    title: 'Producer-shaped task',
    labels: JSON.stringify({
      app: 'core',
      queue: 'available',
      roadmap_ref: 'rm:fixture#S1',
      trace_id: 'existing-trace',
    }),
    actor: 'day-runner-fixture',
    hook: null,
    refs: '[]',
    created_at: '2026-10-13T11:50:00Z',
    updated_at: '2026-10-13T11:59:00Z',
    closed_at: null,
    ...extra,
  };
}
const production = {
  schemaVersion: 1,
  interactions: [
    {
      kind: 'model-generation',
      interactionId: 'fixture-interaction',
      parentInteractionId: null,
      principalId: null,
      agentId: 'agent-core-worker',
      runtimeId: 'runtime:v1:16732e41-8295-4f8e-929c-d2b1b7a01730',
      sessionProvider: 'codex',
      sessionId: 'fixture-session',
      modelProvider: 'openai',
      modelId: 'exact-fixture-model',
      traceId: null,
      hostId: 'fixture-host',
      startedAt: '2026-10-13T11:50:00Z',
      completedAt: '2026-10-13T11:59:00Z',
    },
  ],
};
async function boot(
  rows: unknown[],
  documents: Array<Record<string, unknown>> = [],
  options: {
    failDolt?: boolean;
    missingRoot?: boolean;
    malformed?: boolean;
  } = {},
) {
  vi.resetModules();
  const root = path.join(audit, 'fixtures', String(++serial));
  if (!options.missingRoot) await mkdir(root, { recursive: true });
  for (const doc of documents) {
    const dir = path.join(root, String(doc.repo ?? 'core'), '.handoff');
    await mkdir(dir, { recursive: true });
    const authored = Object.fromEntries(
      Object.entries(doc).filter(([key]) => key !== 'repo'),
    );
    await writeFile(
      path.join(dir, `${doc.id}.md`),
      `---
${Object.entries(authored)
  .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
  .join('\n')}
---

PRIVATE_FIXTURE_BODY
`,
    );
  }
  if (options.malformed) {
    const dir = path.join(root, 'core', '.handoff');
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.join(dir, 'malformed.md'),
      `---
not: [
`,
    );
  }
  process.env.COCKPIT_REPO_ROOT = root;
  process.env.COCKPIT_PROFILE_FILE = path.join(root, 'missing-profile.json');
  const sql: string[] = [];
  vi.doMock('mysql2/promise', () => ({
    default: {
      createPool: () => ({
        query: async (query: string) => {
          sql.push(query);
          if (options.failDolt) throw new Error('Owned SQL boundary failure');
          return [/FROM beads\b/.test(query) ? rows : [], []];
        },
        end: async () => {},
      }),
    },
  }));
  const { buildSnapshot } = await import('../packages/server/src/aggregate.js');
  const { fetchHandoff } =
    await import('../packages/server/src/adapters/handoff.js');
  const { evidenceStore } =
    await import('../packages/server/src/evidence-store.js');
  const { buildReadModelGraphSchema } =
    await import('../packages/server/src/schema/graph.js');
  const snapshot = await buildSnapshot(now);
  const source = {
    snapshot: async () => snapshot,
    evidenceSummary: async () => {
      if (!snapshot.evidenceSummary) throw new Error('Missing fixture summary');
      return snapshot.evidenceSummary;
    },
    evidenceIndex: (id: string) => evidenceStore.index(id),
    evidenceRecord: (id: string, key: string) => evidenceStore.record(id, key),
    briefing: async () => ({
      generatedAt: now.toISOString(),
      source: 'deterministic' as const,
      threads: [],
    }),
    agentEvents: async () => [],
    agentLiveness: async () => [],
  };
  const yoga = createYoga({ schema: buildReadModelGraphSchema(source) });
  async function query(query: string, variables = {}) {
    const response = await yoga.fetch('http://controlled.local/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    return response.json();
  }
  const reader = await import('../packages/renderer/src/evidence-reader.js');
  vi.stubGlobal('fetch', (url: string, options: RequestInit) =>
    yoga.fetch('http://controlled.local' + url, options),
  );
  return { snapshot, query, source, fetchHandoff, sql, root, reader };
}
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  await writeFile(
    path.join(audit, 'pipeline-observations.json'),
    JSON.stringify(facts, null, 2) + '\n',
  );
  if (!process.env.COCKPIT_INSPECTOR_RECEIPT_DIR)
    await rm(audit, { recursive: true, force: true });
});
describe('frozen-candidate integration audit; SQL boundary fake, no sockets or producer execution', () => {
  it('supported Dolt task travels through adapter/aggregate/GraphQL but should be inspectable', async () => {
    const app = await boot([task()]);
    const item = app.snapshot.lanes.available[0];
    expect(item?.nativeId).toBe('core-task-native');
    const wire = await app.query(
      `query($id:String!,$key:String!){ workItems(lane:"available"){id sourceRecordKey inspectionTarget { __typename ... on AvailableInspectionTarget { snapshotId sourceRecordKey } } sourceRecord{__typename ... on DoltBeadSourceRecord { kind repository nativeId }}} evidenceIndex(snapshotId:$id){... on EvidenceIndex{dolt { ... on ObservedDoltIndex { records{sourceRecordKey} } }}} evidenceRecord(snapshotId:$id,sourceRecordKey:$key){__typename} }`,
      {
        id: required(app.snapshot.evidenceSummary).snapshotId,
        key: required(item).sourceRecordKey,
      },
    );
    const decoded = await app.reader.fetchEvidenceRecord(
      required(app.snapshot.evidenceSummary).snapshotId,
      required(required(item).sourceRecordKey),
    );
    expect(decoded).toMatchObject({
      status: 'ready',
      record: {
        native: { type: 'task' },
        sourceRecord: { source: 'dolt-bead', sourcePath: null },
      },
    });
    const decodedIndex = await app.reader.fetchEvidenceIndex(
      required(app.snapshot.evidenceSummary).snapshotId,
    );
    expect(decodedIndex).toMatchObject({
      dolt: {
        status: 'observed',
        records: [{ sourceRecordKey: required(item).sourceRecordKey }],
      },
    });
    expect(required(item).inspectionTarget).toMatchObject({
      snapshotId: required(app.snapshot.evidenceSummary).snapshotId,
      sourceRecordKey: required(item).sourceRecordKey,
    });
    facts.doltInspector = {
      item,
      summary: app.snapshot.evidenceSummary,
      wire,
      sql: app.sql,
    };
    expect(wire.errors).toBeUndefined();
    expect(app.sql.every((sql) => /^SELECT/.test(sql))).toBe(true);
    expect(wire.data.evidenceRecord.__typename).toBe('EvidenceRecord');
  });
  it('Dolt failure should not claim complete combined Dolt/handoff inspector coverage', async () => {
    const app = await boot(
      [],
      [{ id: 'brief', type: 'brief', status: 'live', title: 'Valid handoff' }],
      { failDolt: true },
    );
    facts.doltFailure = {
      health: app.snapshot.health,
      summary: app.snapshot.evidenceSummary,
    };
    expect(
      app.snapshot.health.find((health) => health.name === 'dolt-bead')?.status,
    ).toBe('down');
    expect(required(app.snapshot.evidenceSummary).dolt.coverage.status).toBe(
      'unavailable',
    );
    expect(required(app.snapshot.evidenceSummary).dolt.total).toBeNull();
    expect(
      required(app.snapshot.evidenceSummary).handoff.inventory.coverage.status,
    ).toBe('complete');
  });
  it('handoff failure degrades honestly and preserves supported Dolt lanes', async () => {
    const app = await boot([task()], [], { missingRoot: true });
    facts.handoffFailure = {
      health: app.snapshot.health,
      summary: app.snapshot.evidenceSummary,
      items: app.snapshot.lanes.available,
    };
    expect(
      required(app.snapshot.evidenceSummary).handoff.inventory.coverage.status,
    ).toBe('unavailable');
    expect(app.snapshot.lanes.available).toHaveLength(1);
  });
  it('malformed handoff marks partial coverage without losing valid observations', async () => {
    const app = await boot(
      [],
      [{ id: 'valid', type: 'brief', status: 'live', title: 'Valid' }],
      { malformed: true },
    );
    facts.partialCoverage = {
      summary: app.snapshot.evidenceSummary,
      index: app.source.evidenceIndex(
        required(app.snapshot.evidenceSummary).snapshotId,
      ),
    };
    expect(
      required(app.snapshot.evidenceSummary).handoff.inventory.coverage.status,
    ).toBe('partial');
    expect(required(app.snapshot.evidenceSummary).handoff.populationCount).toBe(
      1,
    );
  });
  it('an observed closed predecessor is not a missing target and must not hide its live successor', async () => {
    const app = await boot(
      [],
      [
        {
          id: 'prior',
          type: 'brief',
          status: 'closed',
          title: 'Observed closed predecessor',
        },
        {
          id: 'next',
          type: 'brief',
          status: 'live',
          title: 'Live successor',
          refs: ['closes:prior'],
        },
      ],
    );
    const result = await app.fetchHandoff(ctx);
    facts.closedPredecessor = {
      items: result.items,
      evidence: result.evidence,
    };
    expect(
      result.evidence.records.some(
        (row) => row.sourceRecord.nativeId === 'prior',
      ),
    ).toBe(true);
    expect(result.evidence.unresolvedRelations).toEqual([]);
    expect(result.items.some((item) => item.nativeId === 'next')).toBe(true);
  });
  it('Dolt task/handoff crosslink is unresolved even while the task is visible', async () => {
    const app = await boot(
      [task()],
      [
        {
          id: 'response',
          type: 'report',
          status: 'closed',
          title: 'Task response',
          responding_to: 'core-task-native',
        },
      ],
    );
    const index = app.source.evidenceIndex(
      required(app.snapshot.evidenceSummary).snapshotId,
    );
    facts.taskCrosslink = { items: app.snapshot.lanes.available, index };
    expect(
      app.snapshot.lanes.available.some(
        (item) => item.nativeId === 'core-task-native',
      ),
    ).toBe(true);
    expect(index).toMatchObject({
      status: 'ready',
      handoff: {
        unresolvedRelations: [
          {
            reason: 'target-not-observed',
            relation: 'responding_to',
            targetNativeId: 'core-task-native',
          },
        ],
      },
    });
  });
  it('resource namespace separates handoff and Dolt equal native IDs', async () => {
    const app = await boot(
      [task()],
      [
        {
          id: 'core-task-native',
          type: 'brief',
          status: 'live',
          title: 'Equal native document',
        },
      ],
    );
    const all = Object.values(app.snapshot.lanes).flat();
    const keys = all.map((item) => item.sourceRecordKey);
    facts.crossSourceIdentity = all;
    expect(all).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });
  it('missing authored Dolt repository should remain unknown rather than guessed from ID', async () => {
    const app = await boot([
      task({ id: 'unmapped-opaque-native', labels: '{}' }),
      task({ id: 'empty-repo-task', labels: JSON.stringify({ repo: '' }) }),
      task({
        id: 'hq-session-fixture',
        type: 'session',
        labels: JSON.stringify({
          session_id: 'day-run-fixture',
          skill: 'day-run',
          repos_touched: '[]',
          task_count: '0',
        }),
      }),
    ]);
    const items = Object.values(app.snapshot.lanes).flat();
    const item = items.find((row) => row.nativeId === 'unmapped-opaque-native');
    facts.missingRepository = items;
    expect(item?.sourceRecord?.repository).toBeNull();
  });
  it('expired hook still projects running; quarantine/expired no-hook rows still project available', async () => {
    const app = await boot([
      task({
        id: 'claimed',
        hook: 'agent-stale',
        labels: JSON.stringify({
          app: 'core',
          queue: 'claimed',
          lease_until: '2026-10-13T11:58:00Z',
        }),
      }),
      task({
        id: 'expired',
        labels: JSON.stringify({ app: 'core', queue: 'expired' }),
      }),
      task({
        id: 'quarantined',
        labels: JSON.stringify({ app: 'core', queue: 'quarantined' }),
      }),
      task({
        id: 'late-post',
        labels: JSON.stringify({
          app: 'core',
          queue: 'available',
          expires_at: '2026-10-13T11:58:00Z',
        }),
      }),
    ]);
    facts.leaseAndQueue = {
      lanes: app.snapshot.lanes,
      health: app.snapshot.health,
    };
    expect(
      app.snapshot.lanes.overnight.some(
        (item) => item.nativeId === 'claimed' && item.status === 'running',
      ),
    ).toBe(true);
    expect(
      app.snapshot.lanes.available.map((item) => item.nativeId).sort(),
    ).toEqual(['expired', 'late-post', 'quarantined']);
    const literals: Record<string, unknown> = {};
    for (const item of Object.values(app.snapshot.lanes).flat()) {
      const detail = await app.reader.fetchEvidenceRecord(
        required(app.snapshot.evidenceSummary).snapshotId,
        required(item.sourceRecordKey),
      );
      if (detail.status !== 'ready' || !('native' in detail.record))
        throw Error('Missing native detail');
      literals[item.nativeId] = {
        hook: detail.record.native.hook,
        labels: detail.record.literalLabels,
      };
      expect(detail.record).not.toHaveProperty('labels');
    }
    expect(literals).toMatchObject({
      claimed: {
        hook: 'agent-stale',
        labels: {
          queueDisposition: 'claimed',
          claimedByKind: null,
          leaseUntil: '2026-10-13T11:58:00Z',
          expiresAt: null,
        },
      },
      expired: {
        labels: {
          queueDisposition: 'expired',
          leaseUntil: null,
          claimedByKind: null,
          expiresAt: null,
        },
      },
      quarantined: { labels: { queueDisposition: 'quarantined' } },
      'late-post': {
        labels: {
          queueDisposition: 'available',
          expiresAt: '2026-10-13T11:58:00Z',
        },
      },
    });
    facts.leaseAndQueueLiterals = literals;
  });
  it('closed report and recorded generation answer correspondence but do not settle a Dolt task', async () => {
    const original = task();
    const app = await boot(
      [original],
      [
        { id: 'brief', type: 'brief', status: 'live', title: 'Correspondence' },
        {
          id: 'report',
          type: 'report',
          status: 'closed',
          title: 'Authored report',
          responding_to: 'brief',
          document_production: production,
        },
      ],
    );
    const index = app.source.evidenceIndex(
      required(app.snapshot.evidenceSummary).snapshotId,
    );
    facts.reportVersusSettlement = {
      summary: app.snapshot.evidenceSummary,
      lanes: app.snapshot.lanes,
      index,
      producerRowUnchanged: original.status === 'live',
    };
    expect(required(app.snapshot.evidenceSummary).handoff.populationCount).toBe(
      0,
    );
    expect(
      app.snapshot.lanes.available.find(
        (item) => item.nativeId === 'core-task-native',
      )?.status,
    ).toBe('open');
    expect(original.status).toBe('live');
  });
  it('pinned record survives active document edits; expiry and restart fail closed', async () => {
    const app = await boot(
      [],
      [{ id: 'active', type: 'brief', status: 'live', title: 'Before' }],
    );
    const id = required(app.snapshot.evidenceSummary).snapshotId;
    const index = app.source.evidenceIndex(id);
    if (index.status !== 'ready') throw Error('Fixture missing');
    if (index.handoff.status !== 'observed') throw Error('Fixture unavailable');
    const key = required(index.handoff.records[0]).sourceRecordKey;
    await writeFile(
      path.join(app.root, 'core/.handoff/active.md'),
      `---
id: active
type: brief
status: live
title: After
---
`,
    );
    expect(app.source.evidenceRecord(id, key)).toMatchObject({
      status: 'ready',
      record: { title: 'Before' },
    });
    const { EvidenceStore } =
      await import('../packages/server/src/evidence-store.js');
    let tick = 0;
    const store = new EvidenceStore(10, 1, () => tick);
    const observed = await app.fetchHandoff(ctx);
    const old = store.capture(
      {
        dolt: {
          status: 'unavailable',
          source: 'dolt-bead',
          scope: 'Fixture scope',
          reason: 'Fixture absent',
        },
        handoff: observed.evidence,
        handoffCollectedAt: now.toISOString(),
      },
      now.toISOString(),
    );
    const fresh = store.capture(
      {
        dolt: {
          status: 'unavailable',
          source: 'dolt-bead',
          scope: 'Fixture scope',
          reason: 'Fixture absent',
        },
        handoff: observed.evidence,
        handoffCollectedAt: now.toISOString(),
      },
      now.toISOString(),
    );
    expect(store.record(old.snapshotId, key).status).toBe('refresh-required');
    tick = 10;
    expect(store.index(fresh.snapshotId).status).toBe('refresh-required');
    expect(new EvidenceStore().index(id).status).toBe('refresh-required');
    facts.pinning = {
      oldTitle: 'Before',
      editedTitle: 'After',
      eviction: 'refresh-required',
      exactExpiry: 'refresh-required',
      restart: 'refresh-required',
    };
  });
});
const taskLink = (nativeId: string) => ({
  schemaVersion: 1,
  relation: 'task-document',
  target: { source: 'dolt-bead', nativeId },
});
const documentLink = (repository: string, sourcePath: string) => ({
  schemaVersion: 1,
  relation: 'task-document',
  target: { source: 'handoff-bead', repository, sourcePath },
});
describe('declared navigation is physically bound and source scoped', () => {
  it('resolves document to task through real GraphQL/codec without inventing a reverse declaration or settlement', async () => {
    const original = task();
    const app = await boot(
      [original],
      [
        {
          id: 'linked',
          type: 'report',
          status: 'closed',
          title: 'Declared report',
          source_links: [taskLink(original.id)],
          document_production: production,
        },
        {
          id: original.id,
          type: 'brief',
          status: 'live',
          title: 'Colliding document',
        },
      ],
    );
    const summary = await app.reader.fetchEvidenceSummary();
    expect(summary.dolt.total).toBe(1);
    expect(summary.handoff.inventory.total).toBe(2);
    expect(summary.handoff.populationCount).toBe(1);
    const index = await app.reader.fetchEvidenceIndex(summary.snapshotId);
    if (
      index.status !== 'ready' ||
      index.handoff.status !== 'observed' ||
      index.dolt.status !== 'observed'
    )
      throw Error('Fixture collections absent');
    const document = index.handoff.records.find(
      (record) => record.title === 'Declared report',
    );
    if (!document) throw Error('Fixture document absent');
    const result = await app.reader.fetchEvidenceRecord(
      summary.snapshotId,
      document.sourceRecordKey,
    );
    if (result.status !== 'ready' || !('literal' in result.record))
      throw Error('Fixture detail absent');
    expect(result.record.documentProduction.status).toBe('recorded');
    expect(result.record.declaredLinks).toMatchObject([
      {
        status: 'resolved',
        referrer: document.sourceRecord,
        fieldPath: 'frontmatter.source_links[0]',
        taskRecordKey: required(index.dolt.records[0]).sourceRecordKey,
        documentRecordKey: document.sourceRecordKey,
      },
    ]);
    const taskDetail = await app.reader.fetchEvidenceRecord(
      summary.snapshotId,
      required(index.dolt.records[0]).sourceRecordKey,
    );
    expect(taskDetail).toMatchObject({
      record: { declaredLinks: [], native: { status: 'live' } },
    });
    expect(original.status).toBe('live');
    expect(JSON.stringify(result)).not.toContain('PRIVATE_FIXTURE_BODY');
    expect(JSON.stringify(taskDetail)).not.toContain('roadmap_ref');
  });
  it('resolves a physically declared task to document without a reverse declaration', async () => {
    const row = task({
      labels: JSON.stringify({
        app: 'core',
        source_links: JSON.stringify([documentLink('core', '.handoff/doc.md')]),
        password: 'PRIVATE_CREDENTIAL',
        arbitrary: 'PRIVATE_LABEL',
      }),
    });
    const app = await boot(
      [row],
      [{ id: 'doc', type: 'brief', status: 'live', title: 'Declared target' }],
    );
    const target = app.snapshot.lanes.available.find(
      (item) => item.source === 'dolt-bead',
    )?.inspectionTarget;
    if (!target || !('snapshotId' in target))
      throw Error('Missing minted target');
    const detail = await app.reader.fetchEvidenceRecord(
      target.snapshotId,
      target.sourceRecordKey,
    );
    expect(detail).toMatchObject({
      record: {
        declaredLinks: [
          {
            status: 'resolved',
            fieldPath: 'labels.source_links[0]',
            referrer: { source: 'dolt-bead' },
            target: { source: 'handoff-bead', sourcePath: '.handoff/doc.md' },
          },
        ],
      },
    });
    if (detail.status === 'ready')
      expect(detail.record).not.toHaveProperty('labels');
    expect(JSON.stringify(detail)).not.toMatch(
      /PRIVATE_CREDENTIAL|PRIVATE_LABEL|PRIVATE_FIXTURE_BODY/,
    );
  });
  it.each([
    ['outage', [], { failDolt: true }, 'target-source-unavailable'],
    ['absence', [], {}, 'target-not-observed-in-scope'],
    ['wrong kind', [task({ type: 'session' })], {}, 'target-kind-incompatible'],
    [
      'ambiguity',
      [task({ labels: '{"app":"core"}' }), task({ labels: '{"app":"other"}' })],
      {},
      'target-ambiguous',
    ],
  ])(
    'retains %s as a distinct same-capture declared-target result',
    async (_label, rows, options, expected) => {
      const app = await boot(
        rows,
        [
          {
            id: 'doc',
            type: 'brief',
            status: 'live',
            title: 'Declared origin',
            source_links: [taskLink('core-task-native')],
          },
        ],
        options,
      );
      const index = app.source.evidenceIndex(
        required(app.snapshot.evidenceSummary).snapshotId,
      );
      if (index.status !== 'ready' || index.handoff.status !== 'observed')
        throw Error('Missing handoff');
      const result = await app.reader.fetchEvidenceRecord(
        index.snapshotId,
        required(index.handoff.records[0]).sourceRecordKey,
      );
      expect(result).toMatchObject({
        record: {
          declaredLinks: [
            { status: expected, fieldPath: 'frontmatter.source_links[0]' },
          ],
        },
      });
    },
  );
  it('rejects forged origin, unsupported version/direction and invalid paths; bare refs never join stores', async () => {
    const app = await boot(
      [task()],
      [
        {
          id: 'doc',
          type: 'brief',
          status: 'live',
          title: 'Declared origin',
          refs: ['core-task-native'],
          source_links: [
            { ...taskLink('core-task-native'), referrer: 'forged' },
            { ...taskLink('core-task-native'), schemaVersion: 2 },
            documentLink('core', '../escape.md'),
          ],
        },
      ],
    );
    const index = app.source.evidenceIndex(
      required(app.snapshot.evidenceSummary).snapshotId,
    );
    if (index.status !== 'ready' || index.handoff.status !== 'observed')
      throw Error('Missing handoff');
    const detail = await app.reader.fetchEvidenceRecord(
      index.snapshotId,
      required(index.handoff.records[0]).sourceRecordKey,
    );
    expect(detail).toMatchObject({
      record: {
        declaredLinks: [
          { status: 'invalid-declaration' },
          { status: 'invalid-declaration' },
          { status: 'invalid-declaration' },
        ],
      },
    });
  });
  it('returns canonical null for missing, invalid, empty or conflicting repo metadata while retaining display fallback', async () => {
    const app = await boot([
      task({ id: 'opaque-missing', labels: '{}' }),
      task({ id: 'opaque-empty', labels: '{"repo":""}' }),
      task({ id: 'opaque-invalid', labels: '{"app":"../bad"}' }),
      task({ id: 'opaque-conflict', labels: '{"app":"core","repo":"other"}' }),
      task({ id: 'opaque-valid', labels: '{"app":"core","repo":"core"}' }),
    ]);
    const all = Object.values(app.snapshot.lanes).flat();
    expect(all.find((item) => item.nativeId === 'opaque-missing')?.repo).toBe(
      'opaque',
    );
    for (const id of ['missing', 'empty', 'invalid', 'conflict']) {
      const item = all.find((item) => item.nativeId === 'opaque-' + id);
      expect(item?.sourceRecord?.repository).toBeNull();
      const detail = await app.reader.fetchEvidenceRecord(
        required(app.snapshot.evidenceSummary).snapshotId,
        required(required(item).sourceRecordKey),
      );
      expect(
        detail.status === 'ready' && 'native' in detail.record
          ? detail.record.coordinateDiagnostics.length
          : 0,
      ).toBeGreaterThan(0);
    }
    expect(
      all.find((item) => item.nativeId === 'opaque-valid')?.sourceRecord
        ?.repository,
    ).toBe('core');
  });
  it('captures supported metadata before lane filtering and marks malformed/unsupported rows as partial', async () => {
    const app = await boot([
      task({
        id: 'old-session',
        type: 'session',
        updated_at: '2026-01-01',
        created_at: '2026-01-01',
      }),
      task({ id: 'unsupported', type: 'alien' }),
      { id: 'malformed' },
    ]);
    expect(app.snapshot.lanes.overnight).toHaveLength(0);
    expect(required(app.snapshot.evidenceSummary).dolt).toMatchObject({
      total: 1,
      coverage: { status: 'partial', skippedRecords: 2 },
    });
    const index = app.source.evidenceIndex(
      required(app.snapshot.evidenceSummary).snapshotId,
    );
    expect(index).toMatchObject({
      dolt: { records: [{ title: 'Producer-shaped task' }] },
    });
  });
  it('binds summary and both lane aliases to one request-local capture and starts a fresh capture for the next request', async () => {
    const app = await boot([task()]);
    const { buildSnapshot } =
      await import('../packages/server/src/aggregate.js');
    const { buildReadModelGraphSchema } =
      await import('../packages/server/src/schema/graph.js');
    let captures = 0;
    const source = {
      ...app.source,
      snapshot: async () => {
        captures++;
        return buildSnapshot(now);
      },
      evidenceSummary: async () => {
        throw Error('Must use request capture');
      },
    };
    const yoga = createYoga({
      schema: buildReadModelGraphSchema(source),
      context: () => ({}),
    });
    const q =
      '{ evidenceSummary { snapshotId } workItems(lane:"available") { inspectionTarget { ... on AvailableInspectionTarget { snapshotId sourceRecordKey } } } other:workItems(lane:"overnight") { id } }';
    const run = async () =>
      (
        await yoga.fetch('http://controlled.local/graphql', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: q }),
        })
      ).json();
    const first = await run();
    expect(first.errors).toBeUndefined();
    expect(captures).toBe(1);
    expect(first.data.workItems[0].inspectionTarget.snapshotId).toBe(
      first.data.evidenceSummary.snapshotId,
    );
    const second = await run();
    expect(captures).toBe(2);
    expect(second.data.evidenceSummary.snapshotId).not.toBe(
      first.data.evidenceSummary.snapshotId,
    );
  });
});
function wireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw Error('Fixture wire object absent');
  return Object.fromEntries(Object.entries(value));
}
describe('actual GraphQL and selected-field codec boundaries', () => {
  it.each([
    'omitted-null',
    'unknown-result',
    'unknown-source',
    'wrong-source',
    'wrong-key',
    'wrong-pin',
    'non-null-path',
  ])('rejects %s in a real selected detail response', async (failure) => {
    const app = await boot([task()]);
    const item = required(app.snapshot.lanes.available[0]);
    const transport = globalThis.fetch;
    vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
      const response = await transport(url, options);
      const body = wireObject(await response.json());
      const data = wireObject(body.data);
      const result = wireObject(data.evidenceRecord);
      const record = wireObject(result.record);
      const source = wireObject(record.sourceRecord);
      if (failure === 'omitted-null') {
        const native = wireObject(record.native);
        delete native.hook;
        record.native = native;
      }
      if (failure === 'unknown-result') result.__typename = 'FutureResult';
      if (failure === 'unknown-source') source.__typename = 'FutureSource';
      if (failure === 'wrong-source') source.doltSource = 'handoff_bead';
      if (failure === 'wrong-key') record.sourceRecordKey = 'mismatch';
      if (failure === 'wrong-pin') result.snapshotId = 'other-pin';
      if (failure === 'non-null-path') source.doltPath = 'some/path';
      record.sourceRecord = source;
      result.record = record;
      data.evidenceRecord = result;
      body.data = data;
      return Response.json(body);
    });
    await expect(
      app.reader.fetchEvidenceRecord(
        required(app.snapshot.evidenceSummary).snapshotId,
        required(item.sourceRecordKey),
      ),
    ).rejects.toThrow();
  });
  it('the served null-only scalar rejects a non-null Dolt path', async () => {
    const app = await boot([task()]);
    const item = required(app.snapshot.lanes.available[0]);
    const id = required(app.snapshot.evidenceSummary).snapshotId;
    const result = app.source.evidenceRecord(
      id,
      required(item.sourceRecordKey),
    );
    if (result.status !== 'ready') throw Error('Missing fixture detail');
    Reflect.set(result.record.sourceRecord, 'sourcePath', 'invalid-path');
    const { buildReadModelGraphSchema } =
      await import('../packages/server/src/schema/graph.js');
    const yoga = createYoga({
      schema: buildReadModelGraphSchema({
        ...app.source,
        evidenceRecord: () => result,
      }),
    });
    const response = await yoga.fetch('http://controlled.local/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query:
          'query($id:String!,$key:String!){ evidenceRecord(snapshotId:$id,sourceRecordKey:$key) { ... on EvidenceRecord { record { ... on DoltRecordEvidence { sourceRecord { sourcePath } } } } } }',
        variables: { id, key: item.sourceRecordKey },
      }),
    });
    const body = await response.json();
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].path).toEqual([
      'evidenceRecord',
      'record',
      'sourceRecord',
      'sourcePath',
    ]);
    expect(body.data.evidenceRecord.record.sourceRecord.sourcePath).toBeNull();
  });
  it('keeps legacy-unknown, unavailable and fully explicit human/emission production distinct through the real codec', async () => {
    const human = {
      ...required(production.interactions[0]),
      kind: 'human-approval',
      interactionId: 'human',
      principalId: 'self-recorded-human',
      agentId: null,
      modelProvider: null,
      modelId: null,
    };
    const emission = {
      ...human,
      kind: 'emission',
      interactionId: 'emit',
      principalId: null,
    };
    const app = await boot(
      [],
      [
        { id: 'legacy', type: 'brief', status: 'live' },
        {
          id: 'bad',
          type: 'brief',
          status: 'live',
          document_production: { schemaVersion: 99 },
        },
        {
          id: 'recorded',
          type: 'brief',
          status: 'live',
          document_production: {
            schemaVersion: 1,
            interactions: [human, emission],
          },
        },
      ],
    );
    const index = app.source.evidenceIndex(
      required(app.snapshot.evidenceSummary).snapshotId,
    );
    if (index.status !== 'ready' || index.handoff.status !== 'observed')
      throw Error('Missing fixture index');
    const states = new Map<string | null, string>();
    for (const record of index.handoff.records) {
      const detail = await app.reader.fetchEvidenceRecord(
        index.snapshotId,
        record.sourceRecordKey,
      );
      if (detail.status !== 'ready' || !('documentProduction' in detail.record))
        throw Error('Missing fixture production');
      states.set(
        record.sourceRecord.nativeId,
        detail.record.documentProduction.status,
      );
    }
    expect(Object.fromEntries(states)).toEqual({
      bad: 'unavailable',
      legacy: 'legacy-unknown',
      recorded: 'recorded',
    });
  });
});
it('retains established claim-kind labels literally, separately from the WorkItem projection', async () => {
  const app = await boot([
    task({
      hook: 'agent-current-fixture',
      labels: JSON.stringify({
        app: 'core',
        queue: 'claimed',
        claimed_by_kind: 'agent',
        lease_until: '2026-10-13T11:58:00Z',
      }),
    }),
  ]);
  const item = required(app.snapshot.lanes.overnight[0]);
  expect(item).toMatchObject({ claimedByKind: 'agent', status: 'running' });
  const detail = await app.reader.fetchEvidenceRecord(
    required(app.snapshot.evidenceSummary).snapshotId,
    required(item.sourceRecordKey),
  );
  expect(detail).toMatchObject({
    record: {
      native: { hook: 'agent-current-fixture' },
      literalLabels: {
        queueDisposition: 'claimed',
        claimedByKind: 'agent',
        leaseUntil: '2026-10-13T11:58:00Z',
        expiresAt: null,
      },
    },
  });
});
