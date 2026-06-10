import { describe, it, expect } from 'vitest';
import { isNewSince, readingCutoff, readingDigestFloor } from '../reading.js';
import type { ReadingSource } from '../reading.js';

const NOW = new Date('2026-06-07T12:00:00Z');
const cutoff = readingCutoff(NOW, 48); // 2026-06-05T12:00:00Z

describe('isNewSince', () => {
  it('true at/after cutoff, false before', () => {
    expect(isNewSince('2026-06-07T00:00:00Z', cutoff)).toBe(true);
    expect(isNewSince('2026-06-04T00:00:00Z', cutoff)).toBe(false);
  });
  it('missing/garbage dates are not new', () => {
    expect(isNewSince(undefined, cutoff)).toBe(false);
    expect(isNewSince('whenever', cutoff)).toBe(false);
  });
});

const src = (title: string, items: { title: string; isNew: boolean; publishedAt?: string }[], error?: string): ReadingSource => ({
  title,
  feedUrl: `https://x/${title}`,
  items: items.map((i) => ({ id: `${title}:${i.title}`, title: i.title, url: 'u', source: title, isNew: i.isNew, publishedAt: i.publishedAt })),
  error,
});

describe('readingDigestFloor', () => {
  it('reports empty window with an action', () => {
    const d = readingDigestFloor([src('A', [{ title: 'old', isNew: false }])]);
    expect(d.source).toBe('deterministic');
    expect(d.headline).toMatch(/no new/i);
    expect(d.action).toBeTruthy();
  });

  it('counts new posts by source and names the freshest', () => {
    const d = readingDigestFloor([
      src('Willison', [
        { title: 'newer', isNew: true, publishedAt: '2026-06-07T09:00:00Z' },
        { title: 'older', isNew: true, publishedAt: '2026-06-06T09:00:00Z' },
      ]),
      src('Yegge', [{ title: 'y1', isNew: true, publishedAt: '2026-06-06T08:00:00Z' }]),
    ]);
    expect(d.headline).toMatch(/3 new posts across 2 sources/);
    expect(d.bullets.join(' ')).toContain('Willison: 2');
    expect(d.action).toContain('newer');
  });

  it('surfaces unreachable feeds', () => {
    const d = readingDigestFloor([
      src('Good', [{ title: 'n', isNew: true, publishedAt: '2026-06-07T09:00:00Z' }]),
      src('Bad', [], 'ECONNREFUSED'),
    ]);
    expect(d.bullets.join(' ')).toMatch(/unreachable/);
  });
});
