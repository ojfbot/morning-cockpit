import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CockpitSnapshot, WorkItem, WorkItemLane } from '@cockpit/shared';

// Controllable Ollama mock — per test we make it reject (→ deterministic floor) or resolve with raw
// LLM JSON, so both the fallback path AND the LLM path are exercised (the bug lived in the latter).
// vi.hoisted so the const exists before the hoisted vi.mock factory references it.
const { ollamaChat } = vi.hoisted(() => ({ ollamaChat: vi.fn() }));
vi.mock('../providers/ollama.js', () => ({ ollamaChat }));
vi.mock('../handoff-emit.js', () => ({
  listKnownRepos: vi.fn().mockResolvedValue(['core', 'cv-builder']),
}));

import { briefingFrames, generateBriefing } from '../briefing-generate.js';

function item(repo: string, lane: WorkItemLane, id: string, stale = false): WorkItem {
  return {
    id: `dolt-bead:${id}`, nativeId: id, source: 'dolt-bead', kind: 'task',
    status: stale ? 'stale' : 'open', lane, title: `${repo} ${id}`, repo,
    activityAt: '2026-06-27T00:00:00.000Z', staleDays: stale ? 30 : undefined,
    detail: { kind: 'generic' }, provenance: {},
  };
}

function snap(): CockpitSnapshot {
  const empty = { headline: '', bullets: [] as string[] };
  return {
    generatedAt: '2026-06-27T05:00:00.000Z', overnightSince: '2026-06-26T22:00:00.000Z',
    lanes: {
      overnight: [],
      pickup: [item('core', 'pickup', 'p1')],
      available: [item('cv-builder', 'available', 'a1', true), item('core', 'available', 'a2', true)],
    },
    health: [],
    summaries: {
      overnight: { ...empty, source: 'deterministic', lane: 'overnight', action: '' },
      pickup: { ...empty, source: 'deterministic', lane: 'pickup', action: '' },
      available: { ...empty, source: 'deterministic', lane: 'available', action: '' },
    },
    meta: { totalItems: 3, skipped: 0 },
  };
}

const llmThread = (repo: string, id: string) => ({
  id, tag: 'stale', title: `${repo} thread`, whyNow: '30d', catchUp: 'pre-read here',
  question: 'what do you want to do?',
  recommended: {
    label: 'Ship it', title: `Fix ${repo}`, repo, closes: id,
    align: 'we agree', task: 'do the work', criteria: ['done is done'],
  },
});

const AT = '2026-06-27T05:00:00.000Z';

describe('generateBriefing — repo scoping (F2)', () => {
  beforeEach(() => ollamaChat.mockReset());

  it('tags the briefing with the requested repo (deterministic floor)', async () => {
    ollamaChat.mockResolvedValue({ text: 'not json — forces the deterministic floor' });
    const b = await generateBriefing(snap(), AT, 'core');
    expect(b.repo).toBe('core');
    expect(b.threads.length).toBeGreaterThan(0);
  });

  it('drops LLM threads that target a different repo than the scoped one', async () => {
    // The bug: the model returned threads for cv-builder even when scoped to core.
    ollamaChat.mockResolvedValue({
      text: JSON.stringify({ threads: [llmThread('core', 'a2'), llmThread('cv-builder', 'a1')] }),
    });
    const b = await generateBriefing(snap(), AT, 'core');
    const targets = b.threads.map((t) => t.branches.find((br) => br.artifact)?.artifact?.target);
    expect(targets.every((t) => t?.startsWith('core/'))).toBe(true);
    expect(targets).not.toContain('cv-builder/.handoff/');
  });

  it('a quiet repo yields an honest empty briefing WITHOUT calling the LLM', async () => {
    ollamaChat.mockResolvedValue({ text: JSON.stringify({ threads: [llmThread('core', 'a2')] }) });
    const b = await generateBriefing(snap(), AT, 'no-such-repo');
    expect(b.repo).toBe('no-such-repo');
    expect(b.threads).toHaveLength(0);
    expect(ollamaChat).not.toHaveBeenCalled(); // empty scope short-circuits — no fabrication
  });
});

describe('briefingFrames — deterministic-first + async upgrade (ADR-0014)', () => {
  beforeEach(() => ollamaChat.mockReset());

  async function collect(repo: string) {
    const frames = [];
    for await (const f of briefingFrames(snap(), AT, repo)) frames.push(f);
    return frames;
  }

  it('yields ONLY the deterministic floor when the model gives junk', async () => {
    ollamaChat.mockResolvedValue({ text: 'not json' });
    const frames = await collect('core');
    expect(frames.map((f) => f.source)).toEqual(['deterministic']);
    expect(frames.every((f) => f.repo === 'core')).toBe(true);
  });

  it('yields the floor FIRST, then the llm upgrade when the model beats it', async () => {
    ollamaChat.mockResolvedValue({ text: JSON.stringify({ threads: [llmThread('core', 'a2')] }) });
    const frames = await collect('core');
    expect(frames.map((f) => f.source)).toEqual(['deterministic', 'llm']); // floor first, then upgrade
  });

  it('yields a single floor frame for a quiet repo (no redundant upgrade)', async () => {
    const frames = await collect('no-such-repo');
    expect(frames.map((f) => f.source)).toEqual(['deterministic']);
  });
});
