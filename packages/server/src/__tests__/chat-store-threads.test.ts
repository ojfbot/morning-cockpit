import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ChatHistoryEntry } from '@cockpit/shared';

/**
 * Thread-keyed chat history (roadmap S9). Two things must hold: threads are isolated (clearing
 * one Northstar conversation must not touch Leo's or another unit's), and the v1 flat file
 * migrates into 'leo' so an existing conversation survives the upgrade rather than vanishing.
 */

let dataDir: string;

const entry = (role: 'user' | 'assistant', content: string): ChatHistoryEntry => ({
  id: `${role}-${content}`,
  role,
  content,
  createdAt: '2026-08-01T09:00:00Z',
});

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'cockpit-threads-'));
  // A pre-S9 conversation, written in the v1 flat-array format.
  await writeFile(
    path.join(dataDir, 'chat-history.json'),
    JSON.stringify([entry('user', 'legacy-q'), entry('assistant', 'legacy-a')], null, 2),
    'utf8',
  );
  process.env.COCKPIT_DATA_DIR = dataDir;
});

afterAll(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

describe('chat-store thread keying', () => {
  it('migrates the v1 flat history into the leo thread', async () => {
    const { listHistory } = await import('../chat-store.js');
    const leo = await listHistory('leo');
    expect(leo.map((m) => m.content)).toEqual(['legacy-q', 'legacy-a']);
  });

  it('reads an untouched thread as empty rather than throwing', async () => {
    const { listHistory } = await import('../chat-store.js');
    expect(await listHistory('northstar:never-opened')).toEqual([]);
  });

  it('appends to one thread without leaking into another', async () => {
    const { appendExchange, listHistory } = await import('../chat-store.js');
    await appendExchange('northstar:demo', entry('user', 'demo-q'), entry('assistant', 'demo-a'));
    await appendExchange('northstar:other', entry('user', 'other-q'), entry('assistant', 'other-a'));

    expect((await listHistory('northstar:demo')).map((m) => m.content)).toEqual(['demo-q', 'demo-a']);
    expect((await listHistory('northstar:other')).map((m) => m.content)).toEqual(['other-q', 'other-a']);
    // The migrated legacy thread survives the first v2 write.
    expect((await listHistory('leo')).map((m) => m.content)).toEqual(['legacy-q', 'legacy-a']);
  });

  it('clears exactly one thread and leaves the rest intact', async () => {
    const { appendExchange, clearHistory, listHistory } = await import('../chat-store.js');
    await appendExchange('leo', entry('user', 'leo-q'), entry('assistant', 'leo-a'));

    await clearHistory('northstar:demo');

    expect(await listHistory('northstar:demo')).toEqual([]);
    expect((await listHistory('northstar:other')).map((m) => m.content)).toEqual(['other-q', 'other-a']);
    expect((await listHistory('leo')).map((m) => m.content)).toEqual([
      'legacy-q',
      'legacy-a',
      'leo-q',
      'leo-a',
    ]);
  });

  it('persists as a keyed map, not an array', async () => {
    const raw: unknown = JSON.parse(await readFile(path.join(dataDir, 'chat-threads.json'), 'utf8'));
    expect(Array.isArray(raw)).toBe(false);
    expect(Object.keys(raw as object).sort()).toEqual(['leo', 'northstar:demo', 'northstar:other']);
  });
});
