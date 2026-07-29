import { describe, expect, it } from 'vitest';
import {
  buildScore,
  composite,
  shortlist,
  weightedMean,
  FLOOR,
  MAX_ITEMS,
  THRESHOLD,
  THIN_CEILING,
  type Ranked,
} from '../rank.js';

/**
 * The rubric's load-bearing requirement, from the Stage-1 handoff: "a quiet API deprecation
 * must be able to outscore an exciting blog post. That's what the actionability dimension is
 * for — if it can't do that, the rubric is wrong."
 */
describe('actionability floor', () => {
  const deprecation = {
    // A deprecation notice: dull, narrow, but you must act on it.
    relevance: 0.3,
    actionability: 0.95,
    novelty: 0.1,
    authority: 1.0,
  };

  it('a boring high-actionability item does NOT clear the threshold on the weighted mean alone', () => {
    // This is why the floor exists — without it the requirement is unmet.
    expect(weightedMean(deprecation)).toBeLessThan(THRESHOLD);
  });

  it('the floor lifts it over the threshold', () => {
    const { composite: c, flooredUp } = composite(deprecation);
    expect(flooredUp).toBe(true);
    expect(c).toBeGreaterThanOrEqual(THRESHOLD);
    expect(c).toBe(FLOOR.composite);
  });

  it('an exciting-but-unactionable item cannot reach the top of the scale', () => {
    const excitingPost = { relevance: 1.0, actionability: 0.2, novelty: 1.0, authority: 1.0 };
    const { composite: c, flooredUp } = composite(excitingPost);
    expect(flooredUp).toBe(false);
    expect(c).toBeLessThan(1.0);
    // And crucially: the boring deprecation beats it.
    expect(composite(deprecation).composite).toBeGreaterThan(c - 0.07);
  });

  it('does not fire for a high-actionability claim from a low-authority source', () => {
    // A random blog asserting urgency must not be able to floor itself into the brief.
    const rumor = { relevance: 0.3, actionability: 0.95, novelty: 0.1, authority: 0.5 };
    expect(composite(rumor).flooredUp).toBe(false);
    expect(composite(rumor).composite).toBeLessThan(THRESHOLD);
  });

  it('does not fire when the weighted mean is already above the floor', () => {
    const strong = { relevance: 0.95, actionability: 0.95, novelty: 0.9, authority: 1.0 };
    const { composite: c, flooredUp } = composite(strong);
    expect(flooredUp).toBe(false);
    expect(c).toBeGreaterThan(FLOOR.composite);
  });
});

/**
 * From the first live acceptance run: a commit titled "Fix lychee.toml for lychee 0.23:
 * headers field was renamed" scored relevance 1.00 / actionability 1.00 off that subject line
 * and took the top slot at 0.88, with a `why` that just restated the title. A model reading a
 * bare imperative subject will nearly always call it actionable — that is what imperative
 * subjects sound like.
 */
describe('thin-text ceiling', () => {
  const lychee = { relevance: 1.0, actionability: 1.0, novelty: 0.5, authority: 0.9 };

  it('would have topped the brief if judged as confidently as a read article', () => {
    expect(composite(lychee, 'full').composite).toBeGreaterThan(0.85);
  });

  it('cannot reach the threshold when scored from a title alone', () => {
    const { composite: c, thinCapped } = composite(lychee, 'thin');
    expect(thinCapped).toBe(true);
    expect(c).toBe(THIN_CEILING);
    expect(c).toBeLessThan(THRESHOLD);
  });

  it('does not inflate a thin item that already scored below the ceiling', () => {
    const weak = { relevance: 0.2, actionability: 0.2, novelty: 0.2, authority: 0.5 };
    const { composite: c, thinCapped } = composite(weak, 'thin');
    expect(thinCapped).toBe(false);
    expect(c).toBeLessThan(THIN_CEILING);
  });

  it('denies the actionability floor to unread items', () => {
    // Otherwise the floor becomes a way for any authoritative headline to buy a slot.
    const headline = { relevance: 0.3, actionability: 0.95, novelty: 0.1, authority: 1.0 };
    expect(composite(headline, 'thin').flooredUp).toBe(false);
    expect(composite(headline, 'full').flooredUp).toBe(true);
  });
});

describe('score hygiene', () => {
  it('clamps out-of-range model output instead of trusting it', () => {
    const s = buildScore(
      { relevance: 5, actionability: -2, novelty: Number.NaN, authority: 0.9 },
      { why: 'x', textQuality: 'full' },
    );
    expect(s.relevance).toBe(1);
    expect(s.actionability).toBe(0);
    expect(s.novelty).toBe(0);
  });

  it('stamps the rubric version so a re-tune is detectable', () => {
    const s = buildScore(
      { relevance: 0.5, actionability: 0.5, novelty: 0.5, authority: 0.5 },
      { why: 'x', textQuality: 'full' },
    );
    expect(s.rubricVersion).toBeTruthy();
  });
});

describe('shortlist', () => {
  const mk = (id: string, c: number, q: 'full' | 'thin' = 'full'): Ranked<string> => ({
    item: id,
    score: buildScore(
      { relevance: c, actionability: c, novelty: c, authority: c },
      { why: '', textQuality: q },
    ),
  });

  it('drops everything below the threshold', () => {
    const out = shortlist([mk('a', 0.9), mk('b', 0.2), mk('c', 0.75)]);
    expect(out.map((r) => r.item)).toEqual(['a', 'c']);
  });

  it('caps the brief at 3 items even when more qualify', () => {
    const out = shortlist([mk('a', 0.9), mk('b', 0.88), mk('c', 0.86), mk('d', 0.84), mk('e', 0.82)]);
    expect(out).toHaveLength(MAX_ITEMS);
    expect(out.map((r) => r.item)).toEqual(['a', 'b', 'c']);
  });

  it('breaks ties toward the item scored from real article text', () => {
    const thin = mk('thin', 0.8, 'thin');
    const full = mk('full', 0.8, 'full');
    expect(shortlist([thin, full])[0]?.item).toBe('full');
  });

  it('returns nothing rather than padding when nothing qualifies', () => {
    expect(shortlist([mk('a', 0.1), mk('b', 0.2)])).toHaveLength(0);
  });
});
