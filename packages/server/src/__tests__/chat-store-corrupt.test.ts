import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, readFile, readdir, rm, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ChatHistoryEntry } from '@cockpit/shared';

/**
 * The corrupt-file seam. An ABSENT chat-threads.json means "nothing written yet" and must still
 * migrate the v1 flat file into 'leo'. An UNREADABLE one means the threads are real but unseen —
 * and before this, both took the same branch, so the next message rewrote the file from an empty
 * map and every sibling thread was gone. These tests pin the two cases apart.
 */

let dataDir: string;

const entry = (role: 'user' | 'assistant', content: string): ChatHistoryEntry => ({
  id: `${role}-${content}`,
  role,
  content,
  createdAt: '2026-09-24T09:00:00Z',
});

const exists = async (p: string): Promise<boolean> =>
  access(p).then(
    () => true,
    () => false,
  );

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'cockpit-corrupt-'));
  process.env.COCKPIT_DATA_DIR = dataDir;
  vi.resetModules();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(dataDir, { recursive: true, force: true });
});

const threadsPath = () => path.join(dataDir, 'chat-threads.json');

describe('chat-store corrupt-file handling', () => {
  it('quarantines an unparseable thread file instead of reading it as empty', async () => {
    await writeFile(threadsPath(), '{"leo": [ truncated', 'utf8');
    const { listHistory } = await import('../chat-store.js');

    expect(await listHistory('leo')).toEqual([]);

    const aside = (await readdir(dataDir)).filter((f) => f.startsWith('chat-threads.corrupt-'));
    expect(aside).toHaveLength(1);
    const quarantined = aside[0];
    if (!quarantined) throw new Error('expected a quarantined thread file');
    // The only copy of those threads survives, byte for byte.
    expect(await readFile(path.join(dataDir, quarantined), 'utf8')).toBe('{"leo": [ truncated');
    expect(await exists(threadsPath())).toBe(false);
  });

  it('refuses every write while the thread file is unreadable', async () => {
    await writeFile(threadsPath(), 'not json at all', 'utf8');
    const { listHistory, appendExchange, clearHistory } = await import('../chat-store.js');

    await listHistory('leo'); // trips the quarantine

    await expect(appendExchange('leo', entry('user', 'q'), entry('assistant', 'a'))).rejects.toThrow(
      /read-only/,
    );
    await expect(clearHistory('northstar:core')).rejects.toThrow(/read-only/);
    // Refusing means refusing: no replacement file is left behind.
    expect(await exists(threadsPath())).toBe(false);
  });

  it('treats a wrong-shape thread file as unreadable, not as empty', async () => {
    await writeFile(threadsPath(), JSON.stringify([entry('user', 'v1-shape')]), 'utf8');
    const { listHistory, appendExchange } = await import('../chat-store.js');

    expect(await listHistory('leo')).toEqual([]);
    await expect(appendExchange('leo', entry('user', 'q'), entry('assistant', 'a'))).rejects.toThrow(
      /read-only/,
    );
  });

  it('an absent thread file still migrates v1 and then retires it', async () => {
    await writeFile(
      path.join(dataDir, 'chat-history.json'),
      JSON.stringify([entry('user', 'legacy-q'), entry('assistant', 'legacy-a')]),
      'utf8',
    );
    const { listHistory, appendExchange } = await import('../chat-store.js');

    expect((await listHistory('leo')).map((m) => m.content)).toEqual(['legacy-q', 'legacy-a']);

    await appendExchange('leo', entry('user', 'new-q'), entry('assistant', 'new-a'));

    expect((await listHistory('leo')).map((m) => m.content)).toEqual([
      'legacy-q',
      'legacy-a',
      'new-q',
      'new-a',
    ]);
    // Retired, not deleted — and the legacy path can never fire a second time.
    expect(await exists(path.join(dataDir, 'chat-history.json'))).toBe(false);
    expect(await exists(path.join(dataDir, 'chat-history.migrated.json'))).toBe(true);
  });

  it('keeps sibling threads intact across an ordinary write', async () => {
    await writeFile(
      threadsPath(),
      JSON.stringify({
        leo: [entry('user', 'leo-q')],
        'northstar:core': [entry('user', 'core-q')],
      }),
      'utf8',
    );
    const { appendExchange, listHistory } = await import('../chat-store.js');

    await appendExchange('northstar:morning-cockpit', entry('user', 'mc-q'), entry('assistant', 'mc-a'));

    expect((await listHistory('leo')).map((m) => m.content)).toEqual(['leo-q']);
    expect((await listHistory('northstar:core')).map((m) => m.content)).toEqual(['core-q']);
    expect((await listHistory('northstar:morning-cockpit')).map((m) => m.content)).toEqual([
      'mc-q',
      'mc-a',
    ]);
  });
});
