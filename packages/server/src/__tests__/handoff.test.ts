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

// The real S8 regression pair, frontmatter verbatim from morning-cockpit/.handoff (2026-07-17):
// after Approve & emit both beads are live; the successor's closes: ref must fold the pair.
const PREDECESSOR_ID = '20260628-2015-brief-northstar-control-surface';
const SUCCESSOR_ID = '20260717-1717-brief-pick-up-evolve-morning-cockpit-s-northstar-from';

const REAL_PREDECESSOR = `---
id: ${PREDECESSOR_ID}
type: brief
title: "Evolve morning-cockpit's northstar from read-model pane → operator control surface"
actor: code-claude
to: code-claude
session_id: northstar-offsite-2026-06-28
refs: []
hook: "Refine the existing l1-morning-cockpit northstar toward 'control surface' (observe → act, via core verbs), land it, lint green"
status: live
created_at: 2026-06-28T20:15:00
labels:
  project: ojfbot-northstar
---

## Context

Northstar evolution brief body.
`;

const REAL_SUCCESSOR = `---
id: ${SUCCESSOR_ID}
type: brief
title: "Pick up: Evolve morning-cockpit's northstar from read-model pane → operator control surface"
actor: morning-cockpit-chat
to: code-claude
session_id: 2026-07-17T22:17:34.693Z
status: live
created_at: 2026-07-17T22:17:34.693Z
refs:
  - closes:${PREDECESSOR_ID}
labels:
  project: morning-cockpit
  emitted_by: morning-cockpit-chat
---

## Context

Emitted successor brief body.
`;

const DANGLING_BRIEF = `---
id: 20260701-0900-brief-dangler
type: brief
title: Brief with a dangling closes ref
actor: chat-claude
to: code-claude
status: live
created_at: 2026-07-01T09:00:00Z
refs:
  - closes:does-not-exist-anywhere
---

body
`;

// Reversion universe (distinct ids — the decided index is global across repos): same pair shape,
// but a report responds to the successor, i.e. delivery happened.
const REVERT_PREDECESSOR = REAL_PREDECESSOR.replaceAll(PREDECESSOR_ID, `${PREDECESSOR_ID}-rev`);
const REVERT_SUCCESSOR = REAL_SUCCESSOR.replaceAll(PREDECESSOR_ID, `${PREDECESSOR_ID}-rev`).replaceAll(
  SUCCESSOR_ID,
  `${SUCCESSOR_ID}-rev`,
);
// Transitive-chain universe (distinct ids): C closes B closes A, all live — mirrors the real
// on-disk state after the S8 delivery brief was emitted on top of the pair.
const TRIPLE_A = REAL_PREDECESSOR.replaceAll(PREDECESSOR_ID, 'triple-a');
const TRIPLE_B = REAL_SUCCESSOR.replaceAll(PREDECESSOR_ID, 'triple-a').replaceAll(SUCCESSOR_ID, 'triple-b');
const TRIPLE_C = `---
id: triple-c
type: brief
title: Deliver the slice
actor: code-claude
to: code-claude
status: live
created_at: 2026-07-17T22:55:00Z
refs:
  - rm:rm-l1-morning-cockpit#S8
  - closes:triple-b
---

body
`;

const REVERT_REPORT = `---
id: 20260718-0800-report-delivered
type: report
title: Delivered the successor
actor: code-claude
status: done
created_at: 2026-07-18T08:00:00Z
responding_to: ${SUCCESSOR_ID}-rev
---

Done.
`;

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

  const pair = path.join(tmpRoot, 'pairrepo', '.handoff');
  await mkdir(pair, { recursive: true });
  await writeFile(path.join(pair, 'predecessor.md'), REAL_PREDECESSOR);
  await writeFile(path.join(pair, 'successor.md'), REAL_SUCCESSOR);

  const dangle = path.join(tmpRoot, 'danglerepo', '.handoff');
  await mkdir(dangle, { recursive: true });
  await writeFile(path.join(dangle, 'dangler.md'), DANGLING_BRIEF);

  const triple = path.join(tmpRoot, 'triplerepo', '.handoff');
  await mkdir(triple, { recursive: true });
  await writeFile(path.join(triple, 'a.md'), TRIPLE_A);
  await writeFile(path.join(triple, 'b.md'), TRIPLE_B);
  await writeFile(path.join(triple, 'c.md'), TRIPLE_C);

  const revert = path.join(tmpRoot, 'revertrepo', '.handoff');
  await mkdir(revert, { recursive: true });
  await writeFile(path.join(revert, 'predecessor.md'), REVERT_PREDECESSOR);
  await writeFile(path.join(revert, 'successor.md'), REVERT_SUCCESSOR);
  await writeFile(path.join(revert, 'report.md'), REVERT_REPORT);

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

describe('handoff adapter — decided-in-flight (S8)', () => {
  const ctxAt = async (iso: string) => {
    const { overnightWindowStart } = await import('@cockpit/shared');
    const now = new Date(iso);
    return { now, overnightSince: overnightWindowStart(now).toISOString(), staleThresholdDays: 14 };
  };

  it('folds the real pair into one chained pickup item and counts it in the health note', async () => {
    const { fetchHandoff } = await import('../adapters/handoff.js');
    const { items, health } = await fetchHandoff(await ctxAt('2026-06-07T10:00:00Z'));

    // The predecessor is decided-in-flight: no standalone item, anywhere.
    expect(items.find((i) => i.nativeId === PREDECESSOR_ID)).toBeUndefined();

    // The successor is the one pickup item, carrying the folded predecessor.
    const successor = items.find((i) => i.nativeId === SUCCESSOR_ID);
    expect(successor).toBeDefined();
    expect(successor!.lane).toBe('pickup');
    expect(successor!.chain).toMatchObject([
      {
        nativeId: PREDECESSOR_ID,
        title: "Evolve morning-cockpit's northstar from read-model pane → operator control surface",
        state: 'decided-in-flight',
      },
    ]);
    expect(successor!.provenance.refs).toEqual([`closes:${PREDECESSOR_ID}`]);

    // 1 folded in pairrepo + 2 in triplerepo; revertrepo folds nothing.
    expect(health.note).toContain('3 decided-in-flight folded');
  });

  it('a dangling closes: ref derives nothing — the brief surfaces normally, no crash, no phantom', async () => {
    const { fetchHandoff } = await import('../adapters/handoff.js');
    const { items, health } = await fetchHandoff(await ctxAt('2026-06-07T10:00:00Z'));

    expect(health.status).toBe('up');
    const dangler = items.find((i) => i.nativeId === '20260701-0900-brief-dangler');
    expect(dangler).toBeDefined();
    expect(dangler!.lane).toBe('pickup');
    expect(dangler!.chain).toBeUndefined();
  });

  it('folds a transitive chain under the newest brief, nearest link first', async () => {
    const { fetchHandoff } = await import('../adapters/handoff.js');
    const { items } = await fetchHandoff(await ctxAt('2026-06-07T10:00:00Z'));

    expect(items.find((i) => i.nativeId === 'triple-a')).toBeUndefined();
    expect(items.find((i) => i.nativeId === 'triple-b')).toBeUndefined();
    const top = items.find((i) => i.nativeId === 'triple-c');
    expect(top).toBeDefined();
    expect(top!.lane).toBe('pickup');
    expect(top!.chain?.map((p) => p.nativeId)).toEqual(['triple-b', 'triple-a']);
  });

  it('reverts when the successor closes at delivery: the predecessor reads normally again', async () => {
    const { fetchHandoff } = await import('../adapters/handoff.js');
    const { items } = await fetchHandoff(await ctxAt('2026-06-07T10:00:00Z'));

    // The responded successor is done (dropped from lanes); no fold happens.
    expect(items.find((i) => i.nativeId === `${SUCCESSOR_ID}-rev`)).toBeUndefined();
    const predecessor = items.find((i) => i.nativeId === `${PREDECESSOR_ID}-rev`);
    expect(predecessor).toBeDefined();
    expect(predecessor!.lane).toBe('pickup');
    expect(predecessor!.chain).toBeUndefined();
  });
});
