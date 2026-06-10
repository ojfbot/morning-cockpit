import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { candidateBody, type HandoffDraft } from '@cockpit/shared';

let tmpRoot: string;
let dataDir: string;

const CAND = {
  repo: 'myrepo',
  to: 'code-claude',
  title: 'Do the emitted thing',
  context: 'ctx',
  goal: 'goal',
  acceptance: ['it works'],
  references: ['file:src/x.ts'],
};

function mkDraft(over: Partial<HandoffDraft> = {}): HandoffDraft {
  return {
    id: `d-${Math.random().toString(36).slice(2)}`,
    repo: 'myrepo',
    to: 'code-claude',
    title: 'Do the emitted thing',
    slug: 'do-the-emitted-thing',
    filename: 'provisional.md',
    beadId: 'provisional',
    body: candidateBody(CAND),
    status: 'staged',
    createdAt: new Date().toISOString(),
    provider: 'ollama',
    model: 'test',
    ...over,
  };
}

beforeAll(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'cockpit-emit-'));
  dataDir = await mkdtemp(path.join(os.tmpdir(), 'cockpit-emit-data-'));
  await mkdir(path.join(tmpRoot, 'myrepo'), { recursive: true }); // repo exists, NO .handoff yet
  await mkdir(path.join(tmpRoot, 'otherrepo', '.handoff'), { recursive: true });
  process.env.COCKPIT_REPO_ROOT = tmpRoot;
  process.env.COCKPIT_DATA_DIR = dataDir;
});

afterAll(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
  await rm(dataDir, { recursive: true, force: true });
});

describe('handoff emission (ADR-0005 write gate)', () => {
  it('approve writes the real bead, creating .handoff/ when missing', async () => {
    const { approveDraft } = await import('../handoff-emit.js');
    const { saveDraft } = await import('../chat-store.js');
    const draft = mkDraft();
    await saveDraft(draft);

    const result = await approveDraft(draft.id);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.path).toMatch(new RegExp(`^${tmpRoot}/myrepo/\\.handoff/\\d{8}-\\d{4}-brief-do-the-emitted-thing\\.md$`));
    const text = await readFile(result.path, 'utf8');
    expect(text).toContain('type: brief');
    expect(text).toContain('status: live');
    expect(text).toContain('actor: morning-cockpit-chat');
    expect(text).toContain(`id: ${result.beadId}`);
  });

  it('approve applies edits and recomputes the slug from the edited title', async () => {
    const { approveDraft } = await import('../handoff-emit.js');
    const { saveDraft } = await import('../chat-store.js');
    const draft = mkDraft({ repo: 'otherrepo' });
    await saveDraft(draft);

    const result = await approveDraft(draft.id, { title: 'Renamed at approve', body: { goal: 'edited goal' } });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.path).toContain('brief-renamed-at-approve.md');
    const text = await readFile(result.path, 'utf8');
    expect(text).toContain('edited goal');
    expect(text).toContain('title: "Renamed at approve"');
  });

  it('refuses a repo that does not exist (never creates repos)', async () => {
    const { approveDraft } = await import('../handoff-emit.js');
    const { saveDraft } = await import('../chat-store.js');
    const draft = mkDraft({ repo: 'ghost-repo' });
    await saveDraft(draft);
    const result = await approveDraft(draft.id);
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.errors.join(' ')).toMatch(/does not exist/);
    const entries = await readdir(tmpRoot);
    expect(entries).not.toContain('ghost-repo');
  });

  it('refuses unsafe repo names (path escape)', async () => {
    const { approveDraft } = await import('../handoff-emit.js');
    const { saveDraft } = await import('../chat-store.js');
    const draft = mkDraft({ repo: '../outside' });
    await saveDraft(draft);
    const result = await approveDraft(draft.id);
    expect(result.status).toBe('invalid');
  });

  it('refuses to overwrite an existing target file', async () => {
    const { approveDraft } = await import('../handoff-emit.js');
    const { saveDraft } = await import('../chat-store.js');
    const { briefFilename } = await import('@cockpit/shared');
    const draft = mkDraft({ title: 'Collision case' });
    await saveDraft(draft);
    // Pre-create the file the approve would write (same minute → same name).
    const filename = briefFilename(new Date(), 'collision-case');
    await writeFile(path.join(tmpRoot, 'myrepo', '.handoff', filename), 'occupied');
    const result = await approveDraft(draft.id);
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') return;
    expect(result.errors.join(' ')).toMatch(/already exists/);
    expect(await readFile(path.join(tmpRoot, 'myrepo', '.handoff', filename), 'utf8')).toBe('occupied');
  });

  it('reject tombstones the draft and writes NOTHING upstream', async () => {
    const { rejectDraft } = await import('../handoff-emit.js');
    const { saveDraft, getDraft } = await import('../chat-store.js');
    const before = (await readdir(path.join(tmpRoot, 'otherrepo', '.handoff'))).length;
    const draft = mkDraft({ repo: 'otherrepo', title: 'Never written' });
    await saveDraft(draft);
    expect(await rejectDraft(draft.id)).toBe(true);
    expect((await getDraft(draft.id))?.status).toBe('rejected');
    expect((await readdir(path.join(tmpRoot, 'otherrepo', '.handoff'))).length).toBe(before);
    // a rejected draft cannot be approved later
    const { approveDraft } = await import('../handoff-emit.js');
    const result = await approveDraft(draft.id);
    expect(result.status).toBe('invalid');
  });
});
