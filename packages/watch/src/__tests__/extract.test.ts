import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractText, MIN_ARTICLE_CHARS } from '../extract.js';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Golden test against REAL markup from the acceptance-test article
 * (claude.com/blog/a-field-guide-to-claude-fable-finding-your-unknowns, fetched 2026-07-28,
 * trimmed for size). Not a hand-built fixture: the failure this guards against is site chrome
 * leaking into the model's context, and only real markup can prove that doesn't happen.
 */
describe('extractText — claude.com field guide (golden)', () => {
  const html = readFileSync(resolve(here, 'fixtures/claude-blog-field-guide.html'), 'utf8');
  const text = extractText(html);

  it('recovers a substantial body of article prose', () => {
    expect(text.length).toBeGreaterThan(2000);
  });

  it('drops the site navigation run', () => {
    // Raw tag-stripping of this page opens with the whole product nav. If this string
    // survives, the model is reading marketing chrome as if it were the article.
    expect(text).not.toContain('Claude by Anthropic Meet Claude Products');
    expect(text).not.toContain('Console login');
  });

  it('drops script and style content', () => {
    expect(text).not.toMatch(/function\s*\(/);
    expect(text).not.toMatch(/\{[^}]*font-family\s*:/);
  });

  it('keeps the article title', () => {
    expect(text).toContain('Finding your unknowns');
  });

  it('resolves HTML entities rather than leaking them', () => {
    expect(text).not.toMatch(/&(amp|lt|gt|quot|nbsp|#\d+);/);
  });

  it('preserves paragraph structure instead of one run-on line', () => {
    expect(text.split('\n').filter((l) => l.trim().length > 40).length).toBeGreaterThan(5);
  });
});

describe('extractText — degradation', () => {
  it('returns little enough from a chrome-only page to trip the thin threshold', () => {
    const shell = '<html><body><nav>Home About Login</nav><main></main><footer>© 2026</footer></body></html>';
    expect(extractText(shell).length).toBeLessThan(MIN_ARTICLE_CHARS);
  });

  it('falls back to the whole body when there is no main or article container', () => {
    const plain = `<html><body><p>${'word '.repeat(200)}</p></body></html>`;
    expect(extractText(plain).length).toBeGreaterThan(MIN_ARTICLE_CHARS);
  });

  it('ignores an empty main shell and uses the surrounding body', () => {
    // A JS-rendered page can ship <main></main> with the content elsewhere.
    const shell = `<html><body><main></main><div><p>${'word '.repeat(200)}</p></div></body></html>`;
    expect(extractText(shell).length).toBeGreaterThan(MIN_ARTICLE_CHARS);
  });
});
