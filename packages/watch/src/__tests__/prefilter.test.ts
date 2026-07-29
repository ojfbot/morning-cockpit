import { describe, expect, it } from 'vitest';
import { loadVocabulary, parseVocabulary, prefilter } from '../prefilter.js';
import type { FeedItem } from '../fetch.js';

const NOW = new Date('2026-07-28T12:00:00Z');

const item = (over: Partial<FeedItem> & { title: string }): FeedItem => ({
  id: over.title,
  url: `https://example.com/${encodeURIComponent(over.title)}`,
  sourceId: 'src',
  sourceTitle: 'Src',
  authority: 0.5,
  sourceClass: 'practitioner',
  fetchFullText: true,
  summary: '',
  publishedAt: NOW.toISOString(),
  ...over,
});

const VOCAB = parseVocabulary(`
### high-signal
agent skills
deprecat
mcp

### low-signal
funding
leaderboard
`);

describe('parseVocabulary', () => {
  it('reads both lists out of fleet-profile.md prose', () => {
    expect(VOCAB.highSignal).toEqual(['agent skills', 'deprecat', 'mcp']);
    expect(VOCAB.lowSignal).toEqual(['funding', 'leaderboard']);
  });

  it('parses the real fleet-profile.md', () => {
    const v = loadVocabulary();
    expect(v.highSignal.length).toBeGreaterThan(20);
    expect(v.lowSignal.length).toBeGreaterThan(5);
    expect(v.highSignal).toContain('agent skills');
  });
});

describe('prefilter', () => {
  it('ranks a title hit above a body-only hit', () => {
    const out = prefilter(
      [item({ title: 'Weekly notes', summary: 'we shipped agent skills' }), item({ title: 'Agent Skills update' })],
      VOCAB,
      NOW,
      10,
    );
    expect(out[0]?.item.title).toBe('Agent Skills update');
  });

  it('demotes low-signal items below neutral ones', () => {
    const out = prefilter(
      [item({ title: 'Anthropic funding round leaderboard' }), item({ title: 'Some neutral post' })],
      VOCAB,
      NOW,
      10,
    );
    expect(out[0]?.item.title).toBe('Some neutral post');
  });

  it('lets source authority outweigh a single vocabulary hit', () => {
    const out = prefilter(
      [item({ title: 'mcp mention', authority: 0.2 }), item({ title: 'Plain first-party post', authority: 1.0 })],
      VOCAB,
      NOW,
      10,
    );
    expect(out[0]?.item.title).toBe('Plain first-party post');
  });

  it('prefers fresher items when signal ties', () => {
    const old = item({ title: 'Old post', publishedAt: '2026-06-01T00:00:00Z' });
    const recent = item({ title: 'New post' });
    expect(prefilter([old, recent], VOCAB, NOW, 10)[0]?.item.title).toBe('New post');
  });

  it('caps the candidate set — this is what keeps a backfill from becoming 200 LLM calls', () => {
    const many = Array.from({ length: 50 }, (_, i) => item({ title: `post ${i}` }));
    expect(prefilter(many, VOCAB, NOW, 25)).toHaveLength(25);
  });

  it('reports which terms matched, so a bad ranking is debuggable', () => {
    const out = prefilter([item({ title: 'Agent Skills and MCP' })], VOCAB, NOW, 10);
    expect(out[0]?.hits).toEqual(expect.arrayContaining(['agent skills', 'mcp']));
  });
});

/**
 * The reserve exists because of a measured failure, not a hypothetical one. The Anthropic
 * first-party feeds ship near-empty summaries (Claude blog averages 65 chars, the Claude Code
 * changelog 0), so vocabulary ranking over title+summary is noise for exactly the sources this
 * poller was built to watch. The acceptance-test article scored zero hits and sorted 118th of
 * 162 — invisible to the cheap pass. See ADR-0017.
 */
describe('unjudgeable reserve', () => {
  const blind = (title: string, publishedAt: string) =>
    item({ title, publishedAt, authority: 1.0, summary: title });
  const chatty = (title: string) =>
    item({ title, authority: 0.5, summary: `agent skills mcp deprecat ${'filler '.repeat(40)}` });

  it('admits a high-authority item with no summary over keyword-rich low-authority noise', () => {
    const candidates = [
      ...Array.from({ length: 8 }, (_, i) => chatty(`keyword-stuffed ${i}`)),
      blind('Quiet first-party post', '2026-07-27T00:00:00Z'),
    ];
    const out = prefilter(candidates, VOCAB, NOW, 5);
    expect(out.map((c) => c.item.title)).toContain('Quiet first-party post');
  });

  it('labels those admissions so the path is auditable', () => {
    const out = prefilter(
      [...Array.from({ length: 8 }, (_, i) => chatty(`k ${i}`)), blind('Quiet post', '2026-07-27T00:00:00Z')],
      VOCAB,
      NOW,
      5,
    );
    expect(out.find((c) => c.item.title === 'Quiet post')?.admittedBy).toBe('unjudgeable');
  });

  it('orders the reserve by recency — the only honest signal when there is no text', () => {
    const out = prefilter(
      [
        blind('older', '2026-07-10T00:00:00Z'),
        blind('newest', '2026-07-27T00:00:00Z'),
        blind('middle', '2026-07-20T00:00:00Z'),
      ],
      VOCAB,
      NOW,
      2,
    );
    expect(out.map((c) => c.item.title)).toEqual(['newest', 'middle']);
  });

  it('does not reserve for a low-authority source with an empty summary', () => {
    // Otherwise any feed with terse summaries could buy its way into the read budget.
    const out = prefilter(
      [item({ title: 'Anon post', authority: 0.3, summary: 'Anon post' }), chatty('keyword rich')],
      VOCAB,
      NOW,
      1,
    );
    expect(out[0]?.item.title).toBe('keyword rich');
  });

  it('never exceeds the candidate budget', () => {
    const many = Array.from({ length: 60 }, (_, i) => blind(`p ${i}`, '2026-07-2Y'.replace('Y', String(i % 9))));
    expect(prefilter(many, VOCAB, NOW, 25)).toHaveLength(25);
  });

  it('leaves room for judgeable items rather than filling the whole budget', () => {
    const blinds = Array.from({ length: 40 }, (_, i) => blind(`b ${i}`, '2026-07-27T00:00:00Z'));
    const out = prefilter([...blinds, chatty('has real text')], VOCAB, NOW, 10);
    expect(out.filter((c) => c.admittedBy === 'unjudgeable').length).toBeLessThan(10);
    expect(out.map((c) => c.item.title)).toContain('has real text');
  });
});
