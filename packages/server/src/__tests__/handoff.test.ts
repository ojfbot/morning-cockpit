import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let tmpRoot: string;

const VALID_BRIEF = `---
id: 20260607-0900-brief-do-the-thing
type: brief
title: Do the thing
actor: chat-claude
to: code-claude
status: live
created_at: 2026-06-07T09:00:00Z
---

Context: please do the thing.
`;

const MALFORMED = `no frontmatter here, just prose that should be skipped`;

const BAD_YAML = `---
id: x
type: brief
title: "unterminated
status: live
---

body
`;

beforeAll(async () => {
  tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'cockpit-handoff-'));
  const handoff = path.join(tmpRoot, 'myrepo', '.handoff');
  await mkdir(handoff, { recursive: true });
  await writeFile(path.join(handoff, 'valid.md'), VALID_BRIEF);
  await writeFile(path.join(handoff, 'broken.md'), MALFORMED);
  await writeFile(path.join(handoff, 'badyaml.md'), BAD_YAML);
  await writeFile(path.join(handoff, 'README.md'), '# ignore me');
  process.env.COCKPIT_REPO_ROOT = tmpRoot;
});

afterAll(async () => {
  await rm(tmpRoot, { recursive: true, force: true });
});

describe('handoff adapter', () => {
  it('surfaces the open brief in pickup and skips malformed files without throwing', async () => {
    const { fetchHandoff } = await import('../adapters/handoff.js');
    const { overnightWindowStart } = await import('@cockpit/shared');
    const now = new Date('2026-06-07T10:00:00Z');
    const ctx = {
      now,
      overnightSince: overnightWindowStart(now).toISOString(),
      staleThresholdDays: 14,
    };

    const { items, health } = await fetchHandoff(ctx);

    expect(health.status).toBe('up');
    const brief = items.find((i) => i.nativeId === '20260607-0900-brief-do-the-thing');
    expect(brief).toBeDefined();
    expect(brief!.lane).toBe('pickup');
    expect(brief!.detail).toMatchObject({ kind: 'brief', openHook: true });
    // broken.md (no frontmatter) + badyaml.md (invalid yaml) skipped; README.md filtered out.
    expect(health.note).toContain('skipped');
  });
});
