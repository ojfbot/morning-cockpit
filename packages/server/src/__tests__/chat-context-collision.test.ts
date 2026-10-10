import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ChatAttachment, CockpitSnapshot, ResolvedAttachment, WorkItem } from '@cockpit/shared';

let root: string;
let resolveAttachments: (attachments: ChatAttachment[], now: number) => Promise<ResolvedAttachment[]>;

const alphaKey = '["handoff-bead","alpha","same-id",".handoff/brief.md"]';
const betaKey = '["handoff-bead","beta","same-id",".handoff/brief.md"]';

function handoffItem(repository: string, sourceRecordKey: string, sourcePath: string): WorkItem {
  return {
    id: 'handoff-bead:same-id',
    nativeId: 'same-id',
    sourceRecordKey,
    sourceRecord: {
      source: 'handoff-bead',
      repository,
      nativeId: 'same-id',
      sourcePath: '.handoff/brief.md',
    },
    source: 'handoff-bead',
    kind: 'brief',
    status: 'open',
    lane: 'pickup',
    title: `${repository} brief`,
    repo: repository,
    activityAt: '2026-10-10T09:00:00.000Z',
    detail: { kind: 'brief', openHook: true },
    provenance: { sourcePath },
  };
}

let snapshot: CockpitSnapshot;

vi.mock('../aggregate.js', () => ({
  buildSnapshot: async () => snapshot,
}));
vi.mock('../routes/reading.js', () => ({
  getReading: async () => { throw new Error('reading unavailable in fixture'); },
}));
vi.mock('../routes/papers.js', () => ({
  getPapers: async () => { throw new Error('papers unavailable in fixture'); },
}));

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'cockpit-chat-collision-'));
  const alphaPath = path.join(root, 'alpha', '.handoff', 'brief.md');
  const betaPath = path.join(root, 'beta', '.handoff', 'brief.md');
  await mkdir(path.dirname(alphaPath), { recursive: true });
  await mkdir(path.dirname(betaPath), { recursive: true });
  await writeFile(alphaPath, 'alpha private body');
  await writeFile(betaPath, 'beta private body');
  process.env.COCKPIT_REPO_ROOT = root;

  snapshot = {
    generatedAt: '2026-10-10T12:00:00.000Z',
    overnightSince: '2026-10-09T18:00:00.000Z',
    lanes: {
      overnight: [],
      pickup: [
        handoffItem('alpha', alphaKey, alphaPath),
        handoffItem('beta', betaKey, betaPath),
      ],
      available: [],
    },
    health: [],
    summaries: {
      overnight: { source: 'deterministic', lane: 'overnight', headline: '', bullets: [], action: '' },
      pickup: { source: 'deterministic', lane: 'pickup', headline: '', bullets: [], action: '' },
      available: { source: 'deterministic', lane: 'available', headline: '', bullets: [], action: '' },
    },
    meta: { totalItems: 2, skipped: 0 },
  };

  vi.resetModules();
  ({ resolveAttachments } = await import('../chat-context.js'));
});

afterAll(async () => {
  delete process.env.COCKPIT_REPO_ROOT;
  await rm(root, { recursive: true, force: true });
});

describe('chat attachment source-record identity', () => {
  it('resolves the selected repository body when native ids collide', async () => {
    const [resolved] = await resolveAttachments([{ id: betaKey, type: 'bead' }], Date.now());

    expect(resolved?.title).toBe('beta brief');
    expect(resolved?.content).toContain('beta private body');
    expect(resolved?.content).not.toContain('alpha private body');
  });
});
