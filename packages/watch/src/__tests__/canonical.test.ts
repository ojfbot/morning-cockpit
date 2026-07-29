import { describe, expect, it } from 'vitest';
import { canonicalUrl, itemId } from '../canonical.js';

describe('canonicalUrl', () => {
  it('treats tracking-tagged copies of a story as the same document', () => {
    const a = canonicalUrl('https://claude.com/blog/a-field-guide?utm_source=twitter&utm_medium=social');
    const b = canonicalUrl('https://www.claude.com/blog/a-field-guide/#section-2');
    expect(a).toBe(b);
  });

  it('drops www, lowercases the host, and strips the fragment', () => {
    expect(canonicalUrl('HTTPS://WWW.Example.COM/Path#frag')).toBe('https://example.com/Path');
  });

  it('preserves path case — paths are case-sensitive, hosts are not', () => {
    expect(canonicalUrl('https://example.com/CaseSensitive')).toContain('/CaseSensitive');
  });

  it('keeps meaningful query params and orders them stably', () => {
    const a = canonicalUrl('https://example.com/s?b=2&a=1');
    const b = canonicalUrl('https://example.com/s?a=1&b=2');
    expect(a).toBe(b);
    expect(a).toContain('a=1');
    expect(a).toContain('b=2');
  });

  it('keeps a bare origin slash but strips a trailing path slash', () => {
    expect(canonicalUrl('https://example.com/')).toBe('https://example.com/');
    expect(canonicalUrl('https://example.com/blog/')).toBe('https://example.com/blog');
  });

  it('returns unparseable input rather than discarding the item', () => {
    expect(canonicalUrl('  not a url  ')).toBe('not a url');
  });
});

describe('itemId', () => {
  it('keys GitHub commits on the sha so URL shape changes do not re-surface them', () => {
    expect(itemId('https://github.com/anthropics/claude-code/commit/ABC1234DEF5678')).toBe(
      'gh:abc1234def5678',
    );
  });

  it('keys arXiv papers on the id, ignoring version and abs/pdf', () => {
    expect(itemId('https://arxiv.org/abs/2501.12345v3')).toBe('arxiv:2501.12345');
    expect(itemId('https://arxiv.org/pdf/2501.12345')).toBe('arxiv:2501.12345');
  });

  it('keys HN stories on the objectID', () => {
    expect(itemId('https://news.ycombinator.com/item?id=44556677')).toBe('hn:44556677');
  });

  it('falls back to the canonical URL for ordinary articles', () => {
    expect(itemId('https://claude.com/blog/x?utm_source=q')).toBe('https://claude.com/blog/x');
  });

  it('falls back to the guid when a feed item carries no link', () => {
    expect(itemId('', 'tag:example.com,2026:1')).toBe('guid:tag:example.com,2026:1');
  });
});
