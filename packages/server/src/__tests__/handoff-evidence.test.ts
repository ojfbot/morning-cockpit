import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const roots: string[] = [];

function brief(id: string, title: string, refs: string[] = [], createdAt = '2026-10-10T09:00:00Z'): string {
  return `---
id: ${id}
type: brief
title: ${title}
actor: authored-agent
to: authored-recipient
status: live
created_at: ${createdAt}
refs:
${refs.map((ref) => `  - ${ref}`).join('\n')}
---

body that the inspector must not expose
`;
}

async function rootWith(records: Array<{ repo: string; file: string; body: string }>): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cockpit-evidence-'));
  roots.push(root);
  for (const record of records) {
    const dir = path.join(root, record.repo, '.handoff');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, record.file), record.body);
  }
  return root;
}

async function collect(root: string) {
  process.env.COCKPIT_REPO_ROOT = root;
  vi.resetModules();
  const { fetchHandoff } = await import('../adapters/handoff.js');
  const now = new Date('2026-10-10T12:00:00.000Z');
  return fetchHandoff({ now, overnightSince: '2026-10-09T18:00:00.000Z', staleThresholdDays: 14 });
}

afterEach(async () => {
  delete process.env.COCKPIT_REPO_ROOT;
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('handoff REST evidence contract', () => {
  it('preserves colliding native ids and derives one named population with literal counts', async () => {
    const root = await rootWith([
      { repo: 'alpha', file: 'brief.md', body: brief('same-id', 'Alpha brief') },
      { repo: 'beta', file: 'brief.md', body: brief('same-id', 'Beta brief') },
    ]);
    const result = await collect(root);

    expect(result.items).toHaveLength(2);
    expect(new Set(result.items.map((item) => item.sourceRecordKey)).size).toBe(2);
    expect(result.evidence.coverage.status).toBe('complete');
    expect(result.evidence.standaloneUnansweredBriefs).toMatchObject({
      name: 'standaloneUnansweredBriefs',
      total: 2,
      byRepository: [
        { repository: 'alpha', count: 1 },
        { repository: 'beta', count: 1 },
      ],
    });
    expect(result.evidence.standaloneUnansweredBriefs.records).toHaveLength(2);
    expect(result.evidence.records[0]?.sourceRecord.sourcePath).toBe('.handoff/brief.md');
    expect(JSON.stringify(result.evidence)).not.toContain('body that the inspector must not expose');
  });

  it('reports an ambiguous bare closes target and excludes every affected record from lanes and counts', async () => {
    const root = await rootWith([
      { repo: 'alpha', file: 'target.md', body: brief('shared-target', 'Alpha target') },
      { repo: 'beta', file: 'target.md', body: brief('shared-target', 'Beta target') },
      { repo: 'gamma', file: 'successor.md', body: brief('successor', 'Successor', ['closes:shared-target']) },
    ]);
    const result = await collect(root);

    expect(result.items).toHaveLength(0);
    expect(result.evidence.standaloneUnansweredBriefs.total).toBe(0);
    expect(result.evidence.unresolvedRelations).toEqual([
      expect.objectContaining({
        reason: 'target-matches-multiple-records',
        relation: 'closes',
        targetNativeId: 'shared-target',
      }),
    ]);
    expect(result.evidence.unresolvedRelations[0]?.affectedSourceRecordKeys).toHaveLength(3);
  });

  it('distinguishes an unavailable root from a readable complete-empty root', async () => {
    const emptyRoot = await rootWith([]);
    const empty = await collect(emptyRoot);
    expect(empty.health.status).toBe('up');
    expect(empty.evidence.coverage).toEqual({ status: 'complete', repositoriesObserved: 0, skippedRecords: 0 });

    const unavailable = await collect(path.join(emptyRoot, 'missing'));
    expect(unavailable.health.status).toBe('down');
    expect(unavailable.evidence.coverage.status).toBe('unavailable');
  });
});
