import { describe, it, expect } from 'vitest';
import {
  buildChatRegistry,
  buildChatSystemPrompt,
  buildDayGoalBrief,
  buildIndexSkeleton,
  chatFallbackText,
  formatAttachmentBlock,
} from '../chat.js';
import { summarizeLane } from '../summarize.js';
import type { CockpitSnapshot, WorkItem } from '../work-item.js';
import type { ReadingSnapshot } from '../reading.js';
import type { PapersSnapshot } from '../papers.js';

const mk = (over: Partial<WorkItem>): WorkItem => ({
  id: 'x',
  nativeId: 'x',
  source: 'dolt-bead',
  kind: 'task',
  status: 'open',
  lane: 'available',
  title: 't',
  activityAt: '2026-06-09T00:00:00Z',
  detail: { kind: 'generic' },
  provenance: {},
  ...over,
});

function mkSnapshot(lanes: Partial<CockpitSnapshot['lanes']> = {}): CockpitSnapshot {
  const full = { overnight: [], pickup: [], available: [], ...lanes };
  return {
    generatedAt: '2026-06-09T07:00:00.000Z',
    overnightSince: '2026-06-08T18:00:00.000Z',
    lanes: full,
    health: [],
    summaries: {
      overnight: summarizeLane('overnight', full.overnight),
      pickup: summarizeLane('pickup', full.pickup),
      available: summarizeLane('available', full.available),
    },
    meta: { totalItems: full.overnight.length + full.pickup.length + full.available.length, skipped: 0 },
  };
}

const READING: ReadingSnapshot = {
  generatedAt: '2026-06-09T07:00:00.000Z',
  since: '2026-06-07T07:00:00.000Z',
  sources: [
    {
      title: 'Simon Willison',
      feedUrl: 'https://example.com/feed',
      items: [
        { id: 'sw:1', title: 'Prompt injection redux', url: 'https://example.com/1', source: 'Simon Willison', isNew: true },
        { id: 'sw:2', title: 'Old post', url: 'https://example.com/2', source: 'Simon Willison', isNew: false },
      ],
    },
    { title: 'Quiet Feed', feedUrl: 'https://example.com/q', items: [] },
  ],
  health: [],
  digest: { source: 'deterministic', headline: 'h', bullets: [] },
};

const PAPERS: PapersSnapshot = {
  generatedAt: '2026-06-09T07:00:00.000Z',
  papers: [
    {
      id: '2606.01000',
      title: 'Scaling Laws for Beavers',
      authors: ['A. Author'],
      url: 'https://huggingface.co/papers/2606.01000',
      pdfUrl: 'https://arxiv.org/pdf/2606.01000',
      abstract: 'We study beavers.',
      upvotes: 42,
      source: 'hf-daily',
    },
  ],
  profile: { generatedAt: '2026-06-09T07:00:00.000Z', strengths: [], learning: [], domains: [] },
  health: [],
};

describe('buildIndexSkeleton', () => {
  it('outlines all three lanes with repo, title, kind/status', () => {
    const snap = mkSnapshot({
      overnight: [mk({ kind: 'pr', status: 'done', repo: 'core', title: 'Merge loader discipline', lane: 'overnight' })],
      pickup: [mk({ kind: 'brief', status: 'open', repo: 'lofi-beaver', title: 'Grill the verb system', lane: 'pickup', staleDays: 2 })],
    });
    const s = buildIndexSkeleton(snap, READING, PAPERS);
    expect(s).toContain('### Overnight (1)');
    expect(s).toContain('[core] "Merge loader discipline" — pr/done');
    expect(s).toContain('[lofi-beaver] "Grill the verb system" — brief/open (2d stale)');
    expect(s).toContain('### Available (0)');
    expect(s).toContain('- (none)');
  });

  it('lists only NEW reading posts and papers with upvotes', () => {
    const s = buildIndexSkeleton(mkSnapshot(), READING, PAPERS);
    expect(s).toContain('Simon Willison: "Prompt injection redux"');
    expect(s).not.toContain('Old post');
    expect(s).not.toContain('Quiet Feed');
    expect(s).toContain('"Scaling Laws for Beavers" (▲42)');
  });

  it('is honest about cold caches — no fetch, just "(not loaded yet)"', () => {
    const s = buildIndexSkeleton(mkSnapshot());
    expect(s).toContain('## Reading\n- (not loaded yet)');
    expect(s).toContain('## Research papers\n- (not loaded yet)');
  });

  it('caps each lane deterministically and reports the remainder', () => {
    const many = Array.from({ length: 15 }, (_, i) => mk({ nativeId: `t${i}`, title: `task ${i}`, lane: 'available' }));
    const s = buildIndexSkeleton(mkSnapshot({ available: many }), undefined, undefined, 12);
    expect(s).toContain('### Available (15)');
    expect(s).toContain('"task 11"');
    expect(s).not.toContain('"task 12"');
    expect(s).toContain('… and 3 more');
  });

  it('truncates very long titles', () => {
    const long = 'x'.repeat(200);
    const s = buildIndexSkeleton(mkSnapshot({ pickup: [mk({ title: long, lane: 'pickup' })] }));
    expect(s).not.toContain(long);
    expect(s).toContain('…');
  });
});

describe('buildChatRegistry', () => {
  it('flattens beads from all lanes + reading items + papers with typed rows', () => {
    const snap = mkSnapshot({
      overnight: [mk({ id: 'dolt-bead:pr-1', kind: 'pr', status: 'done', repo: 'core', title: 'merged PR', lane: 'overnight' })],
      pickup: [mk({ id: 'handoff-bead:b-1', kind: 'brief', status: 'open', repo: 'lofi-beaver', title: 'a brief', lane: 'pickup' })],
    });
    const reg = buildChatRegistry(snap, READING, PAPERS);
    const byType = (t: string) => reg.filter((r) => r.type === t);
    expect(byType('bead').map((r) => r.id)).toEqual(['dolt-bead:pr-1', 'handoff-bead:b-1']);
    expect(byType('bead')[0]).toMatchObject({ repo: 'core', subtitle: 'pr · done' });
    // ALL reading items are attachable (not just new ones)
    expect(byType('reading').map((r) => r.id)).toEqual(['sw:1', 'sw:2']);
    expect(byType('reading')[0]?.subtitle).toBe('Simon Willison');
    expect(byType('paper')).toEqual([
      { id: '2606.01000', type: 'paper', title: 'Scaling Laws for Beavers', subtitle: '▲42' },
    ]);
  });

  it('tolerates missing reading/papers snapshots', () => {
    expect(buildChatRegistry(mkSnapshot())).toEqual([]);
  });
});

describe('formatAttachmentBlock', () => {
  it('renders typed fenced blocks bracketed by attached-context markers', () => {
    const block = formatAttachmentBlock([
      { type: 'paper', title: 'Scaling Laws for Beavers', content: 'Abstract: we study beavers.' },
      { type: 'bead', title: 'a brief', content: '---\ntype: brief\n---\nbody' },
    ]);
    expect(block).toMatch(/^\[Attached context\]/);
    expect(block).toContain('### paper: "Scaling Laws for Beavers"');
    expect(block).toContain('Abstract: we study beavers.');
    expect(block).toContain('### bead: "a brief"');
    expect(block).toContain('[End attached context]');
  });

  it('is empty for no attachments', () => {
    expect(formatAttachmentBlock([])).toBe('');
  });
});

describe('buildDayGoalBrief', () => {
  it('frames previous day from Overnight and today from Pickup (+ action)', () => {
    const snap = mkSnapshot({
      overnight: [mk({ kind: 'pr', status: 'done', repo: 'core', lane: 'overnight' })],
      pickup: [mk({ kind: 'brief', status: 'open', repo: 'core', title: 'fresh', lane: 'pickup' })],
    });
    const b = buildDayGoalBrief(snap.summaries);
    expect(b).toContain('## Since last evening');
    expect(b).toContain(snap.summaries.overnight.headline);
    expect(b).toContain('## Today');
    expect(b).toContain(snap.summaries.pickup.headline);
    expect(b).toContain(`→ ${snap.summaries.pickup.action}`);
  });
});

describe('buildChatSystemPrompt / chatFallbackText', () => {
  const preload = {
    generatedAt: '2026-06-09T07:00:00.000Z',
    indexSkeleton: buildIndexSkeleton(mkSnapshot(), READING, PAPERS),
    dayGoalBrief: buildDayGoalBrief(mkSnapshot().summaries),
  };

  it('system prompt carries the grounding rules and both preload blocks', () => {
    const p = buildChatSystemPrompt(preload);
    expect(p).toMatch(/ground every answer only/i);
    expect(p).toMatch(/never invent/i);
    expect(p).toContain(preload.dayGoalBrief);
    expect(p).toContain(preload.indexSkeleton);
    expect(p).toContain(preload.generatedAt);
  });

  it('fallback is honest and still carries the deterministic state', () => {
    const f = chatFallbackText(preload);
    expect(f).toMatch(/unavailable/i);
    expect(f).toContain(preload.dayGoalBrief);
    expect(f).toContain(preload.indexSkeleton);
  });
});
