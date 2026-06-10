import { describe, it, expect } from 'vitest';
import {
  normalizeHfDaily,
  assembleProfile,
  paperExplainerFloor,
  profileNodeKeys,
} from '../papers.js';
import type { PaperItem } from '../papers.js';

const hfEntry = (id: string, upvotes: number, title = `Paper ${id}`) => ({
  title,
  summary: `Abstract for ${id}.`,
  publishedAt: '2026-06-08T00:00:00.000Z',
  paper: { id, upvotes, authors: [{ name: 'Ada L.' }, { name: 'Grace H.' }] },
});

describe('normalizeHfDaily', () => {
  it('maps fields and builds arxiv URLs', () => {
    const [p] = normalizeHfDaily([hfEntry('2606.01000', 5)], 3);
    expect(p).toMatchObject({
      id: '2606.01000',
      url: 'https://huggingface.co/papers/2606.01000',
      pdfUrl: 'https://arxiv.org/pdf/2606.01000',
      authors: ['Ada L.', 'Grace H.'],
      upvotes: 5,
      source: 'hf-daily',
    });
    expect(p!.abstract).toBe('Abstract for 2606.01000.');
  });

  it('sorts by upvotes desc and caps at count', () => {
    const out = normalizeHfDaily([hfEntry('a', 1), hfEntry('b', 9), hfEntry('c', 4)], 2);
    expect(out.map((p) => p.id)).toEqual(['b', 'c']);
  });

  it('drops entries with no paper id and tolerates junk', () => {
    expect(normalizeHfDaily([{ title: 'no paper' }, null, 'x'], 3)).toEqual([]);
    expect(normalizeHfDaily('not an array', 3)).toEqual([]);
  });
});

describe('assembleProfile', () => {
  const inputs = {
    generatedAt: '2026-06-09T00:00:00Z',
    hotText: '# hot\n- worked on llm-tooling and the se-competency-engine today\n',
    seedStrengths: [{ key: 'ts', label: 'TypeScript & distributed systems' }],
    seedLearning: [{ key: 'ml', label: 'ML internals' }],
    domains: [
      { key: 'llm-tooling', label: 'LLM Tooling', vaultPath: 'wiki/concepts/llm-tooling.md', status: 'growing' },
      { key: 'undersea-datacenters', label: 'Undersea Datacenters', vaultPath: 'wiki/concepts/undersea-datacenters.md' },
    ],
  };

  it('assigns kinds and flags recent domains from _hot', () => {
    const p = assembleProfile(inputs);
    expect(p.strengths[0]).toMatchObject({ kind: 'strength', key: 'ts' });
    expect(p.learning[0]).toMatchObject({ kind: 'learning', key: 'ml' });
    const llm = p.domains.find((d) => d.key === 'llm-tooling')!;
    const subsea = p.domains.find((d) => d.key === 'undersea-datacenters')!;
    expect(llm).toMatchObject({ kind: 'domain', recent: true, note: 'vault: growing' });
    expect(subsea.recent).toBe(false);
  });

  it('profileNodeKeys covers all three buckets', () => {
    const keys = profileNodeKeys(assembleProfile(inputs));
    expect([...keys].sort()).toEqual(['llm-tooling', 'ml', 'ts', 'undersea-datacenters']);
  });
});

describe('paperExplainerFloor', () => {
  const paper: PaperItem = {
    id: '2606.02000',
    title: 'A Long Title',
    authors: ['A', 'B', 'C', 'D'],
    url: 'u',
    pdfUrl: 'p',
    abstract: 'x'.repeat(400),
    upvotes: 1,
    source: 'hf-daily',
  };

  it('is deterministic, truncates abstract, abbreviates authors', () => {
    const f = paperExplainerFloor(paper);
    expect(f.source).toBe('deterministic');
    expect(f.tier).toBe('local');
    expect(f.relatedNodes).toEqual([]);
    expect(f.bullets[0]).toBe('A, B, C et al.');
    expect(f.bullets.join(' ')).toContain('1 upvote');
    expect(f.bullets.some((b) => b.endsWith('…'))).toBe(true);
  });
});
