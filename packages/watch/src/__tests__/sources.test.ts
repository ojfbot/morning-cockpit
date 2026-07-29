import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { parseRegistry, sourcesFor } from '@cockpit/shared';
import { loadRegistry } from '../sources.js';

/** The validator takes an already-parsed document (see @cockpit/shared/sources.ts). */
const fromYaml = (text: string) => parseRegistry(parse(text));

const MIN = `
version: 1
defaults:
  user_agent: "ua"
  fetch_timeout_ms: 1234
sources:
  - id: a
    title: A
    feed_url: https://example.com/a.xml
    authority: 1.0
    pods: [watch]
    fetch_full_text: true
    verified: 2026-07-28
  - id: b
    title: B
    feed_url: https://example.com/b.xml
    tier: '1'
    authority: 0.7
    pods: [watch, reading]
    verified: inherited
quarantine:
  - id: dead
    feed_url: https://example.com/dead.xml
    checked: 2026-07-28
    reason: "404 under two user agents"
`;

describe('parseRegistry', () => {
  it('parses defaults, sources, and quarantine', () => {
    const r = fromYaml(MIN);
    expect(r.defaults).toEqual({ userAgent: 'ua', fetchTimeoutMs: 1234 });
    expect(r.sources).toHaveLength(2);
    expect(r.quarantine[0]?.reason).toContain('404');
  });

  it('defaults fetch_full_text to false rather than fetching everything', () => {
    expect(fromYaml(MIN).sources[1]?.fetchFullText).toBe(false);
  });

  // A silently-dropped source is indistinguishable from a source that published nothing.
  // Every one of these must be a hard error, not a skip.
  it.each([
    ['a missing feed_url', 'feed_url: https://example.com/a.xml', 'x_feed: 1'],
    ['a missing id', 'id: a', 'x_id: a'],
    ['a missing title', 'title: A', 'x_title: A'],
  ])('throws on %s', (_label, from, to) => {
    expect(() => fromYaml(MIN.replace(from, to))).toThrow();
  });

  it('throws on an unknown pod rather than silently excluding the source', () => {
    expect(() => fromYaml(MIN.replace('pods: [watch]', 'pods: [wathc]'))).toThrow(/unknown pod/i);
  });

  it('throws on an out-of-range authority', () => {
    expect(() => fromYaml(MIN.replace('authority: 1.0', 'authority: 7'))).toThrow(/0\.\.1/);
  });

  it('throws on a duplicate source id — it would corrupt the ledger key space', () => {
    expect(() => fromYaml(MIN.replace('id: b', 'id: a'))).toThrow(/duplicate/i);
  });

  it('throws on a quarantine entry with no reason', () => {
    // The whole point of the quarantine block is that the reason is on record.
    expect(() => fromYaml(MIN.replace('    reason: "404 under two user agents"', ''))).toThrow(
      /reason/i,
    );
  });
});

describe('sourcesFor — the absorb mechanism (ADR-0015)', () => {
  it('selects per pod, with shared sources appearing in both', () => {
    const r = fromYaml(MIN);
    expect(sourcesFor(r, 'watch').map((s) => s.id)).toEqual(['a', 'b']);
    expect(sourcesFor(r, 'reading').map((s) => s.id)).toEqual(['b']);
  });
});

describe('the real sources.yaml', () => {
  const r = loadRegistry();

  it('loads and validates', () => {
    expect(r.sources.length).toBeGreaterThan(10);
  });

  it('still carries all 12 feeds the Reading pod shipped with', () => {
    // Guards the config.ts repoint: losing a feed here silently empties a pod in the UI.
    expect(sourcesFor(r, 'reading')).toHaveLength(12);
  });

  it('includes the acceptance-test source, with full-text fetch enabled', () => {
    const claude = r.sources.find((s) => s.id === 'claude-blog');
    expect(claude?.feedUrl).toContain('feed_claude.xml');
    // The feed's <description> is 54 bytes — the title repeated. Without this flag the
    // scorer would be summarizing from a headline.
    expect(claude?.fetchFullText).toBe(true);
    expect(claude?.authority).toBe(1);
  });

  it('keeps the YouTube feed quarantined with its reason, not deleted', () => {
    const yt = r.quarantine.find((q) => q.id === 'anthropic-youtube');
    expect(yt).toBeDefined();
    expect(yt?.reason).toMatch(/404/);
    // The ID was right; the endpoint was wrong. That distinction has to survive.
    expect(yt?.reason).toMatch(/channel_id is CORRECT/i);
  });

  it('gives every source a non-empty verification marker', () => {
    for (const s of r.sources) expect(s.verified).not.toBe('unverified');
  });
});
