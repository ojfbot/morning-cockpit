import { describe, it, expect } from 'vitest';
import {
  briefFilename,
  briefSlug,
  candidateBody,
  isSafeRepoName,
  renderBriefMarkdown,
  validateBriefDraft,
  type HandoffDraft,
} from '../handoff-brief.js';

const KNOWN = ['core', 'lofi-beaver', 'morning-cockpit'];

const CAND = {
  repo: 'lofi-beaver',
  to: 'code-claude',
  title: 'Wire the GitHub adapter',
  context: 'The cockpit has dolt+handoff adapters; github is slice 1.',
  goal: 'Implement adapters/github.ts using gh CLI collectors.',
  acceptance: ['gh PRs appear in lanes', 'health bar reports the adapter'],
  references: ['file:packages/server/src/adapters/handoff.ts'],
};

describe('briefSlug', () => {
  it('lowercases, hyphenates, strips punctuation/unicode, caps length', () => {
    expect(briefSlug('Wire the GitHub adapter')).toBe('wire-the-github-adapter');
    expect(briefSlug('Grill: SWAMP vs SUBURBS — AoE-style!!')).toBe('grill-swamp-vs-suburbs-aoe-style');
    expect(briefSlug('x'.repeat(100)).length).toBeLessThanOrEqual(48);
    expect(briefSlug('---')).toBe('');
    expect(briefSlug('日本語のみ')).toBe('');
  });
});

describe('briefFilename', () => {
  it('matches <YYYYMMDD>-<HHMM>-brief-<slug>.md in local time', () => {
    const f = briefFilename(new Date(2026, 5, 9, 7, 5), 'wire-the-github-adapter');
    expect(f).toBe('20260609-0705-brief-wire-the-github-adapter.md');
  });
});

describe('isSafeRepoName', () => {
  it('accepts plain directory names, rejects escapes and separators', () => {
    expect(isSafeRepoName('lofi-beaver')).toBe(true);
    expect(isSafeRepoName('f1-pit-wall')).toBe(true);
    expect(isSafeRepoName('..')).toBe(false);
    expect(isSafeRepoName('.')).toBe(false);
    expect(isSafeRepoName('.hidden')).toBe(false);
    expect(isSafeRepoName('a/b')).toBe(false);
    expect(isSafeRepoName('a\\b')).toBe(false);
    expect(isSafeRepoName('')).toBe(false);
  });
});

describe('validateBriefDraft', () => {
  it('passes a complete candidate against known repos', () => {
    expect(validateBriefDraft(CAND, KNOWN)).toEqual({ ok: true, errors: [] });
  });

  it('accumulates ALL errors at once', () => {
    const v = validateBriefDraft({ repo: 'nope', title: '!!!', acceptance: [] }, KNOWN);
    expect(v.ok).toBe(false);
    expect(v.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('does not exist'),
        expect.stringContaining('to (recipient) is required'),
        expect.stringContaining('empty slug'),
        expect.stringContaining('body.context'),
        expect.stringContaining('body.goal'),
        expect.stringContaining('acceptance criterion'),
      ]),
    );
  });

  it('rejects unsafe repo names before checking existence', () => {
    const v = validateBriefDraft({ ...CAND, repo: '../escape' }, KNOWN);
    expect(v.errors.some((e) => e.includes('not a safe directory name'))).toBe(true);
  });
});

describe('renderBriefMarkdown — orient/adapter round-trip', () => {
  // Same parsing regime as packages/server/src/adapters/handoff.ts (and orient.py).
  const FRONTMATTER_RE = /^---\n([\s\S]+?)\n---\n/;

  const draft: HandoffDraft = {
    id: 'uuid-1',
    repo: 'lofi-beaver',
    to: 'code-claude',
    title: 'Wire the GitHub adapter',
    slug: 'wire-the-github-adapter',
    filename: '20260609-0705-brief-wire-the-github-adapter.md',
    beadId: '20260609-0705-brief-wire-the-github-adapter',
    body: candidateBody(CAND),
    status: 'staged',
    createdAt: '2026-06-09T07:05:00.000Z',
    provider: 'ollama',
    model: 'qwen2.5:7b',
  };

  it('frontmatter parses with id = filename stem, type brief, status live, cockpit actor', () => {
    const md = renderBriefMarkdown(draft, '2026-06-09T07:05:00Z', '2026-06-09T07:05:00.000Z');
    const m = FRONTMATTER_RE.exec(md);
    expect(m).not.toBeNull();
    const fm = m![1]!;
    expect(fm).toContain('id: 20260609-0705-brief-wire-the-github-adapter');
    expect(fm).toContain('type: brief');
    expect(fm).toContain('status: live');
    expect(fm).toContain('actor: morning-cockpit-chat');
    expect(fm).toContain('to: code-claude');
    expect(fm).toContain('created_at: 2026-06-09T07:05:00.000Z');
    expect(fm).toContain('  project: lofi-beaver');
    expect(fm).toContain('  - file:packages/server/src/adapters/handoff.ts');
  });

  it('quotes/escapes titles safely for YAML', () => {
    const md = renderBriefMarkdown(
      { ...draft, title: 'He said "ship: it" \\ now' },
      's',
      '2026-06-09T07:05:00.000Z',
    );
    expect(md).toContain('title: "He said \\"ship: it\\" \\\\ now"');
  });

  it('body carries the required brief sections with checkbox acceptance criteria', () => {
    const md = renderBriefMarkdown(draft, 's', '2026-06-09T07:05:00.000Z');
    for (const h of ['## Context', '## Goal', '## Acceptance criteria', '## References', '## Flag back']) {
      expect(md).toContain(h);
    }
    expect(md).toContain('- [ ] gh PRs appear in lanes');
  });
});
