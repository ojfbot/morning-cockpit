/**
 * The rubric (ADR-0017, plan D2). Four dimensions, a weighted composite, and one deliberate
 * non-linearity.
 *
 * THE NON-LINEARITY IS THE POINT. The Stage-1 handoff requires that a quiet API deprecation
 * be able to outscore an exciting blog post. A weighted mean cannot express that: a
 * deprecation notice scores near-zero on novelty and often low on relevance-to-fleet, so it
 * loses to anything shiny no matter how the weights are set. Hence an explicit floor —
 * high actionability from an authoritative source clears the threshold on its own.
 *
 * If this floor is ever removed, the "reward important-but-boring" requirement goes with it.
 */

import type { TextQuality } from './extract.js';

/** Bump on any weight, floor, or prompt change so a re-tune is detectable, not silent. */
export const RUBRIC_VERSION = 'watch-rubric-2';

export const WEIGHTS = {
  relevance: 0.35,
  actionability: 0.3,
  novelty: 0.2,
  authority: 0.15,
} as const;

/** Composite at/above this is eligible for the brief. */
export const THRESHOLD = 0.6;

/** Hard cap on brief length — a shortlist, never a digest. */
export const MAX_ITEMS = 3;

/** An authoritative, highly actionable item clears the bar on actionability alone. */
export const FLOOR = { actionability: 0.9, authority: 0.8, composite: 0.7 } as const;

/**
 * Ceiling on an item scored without real article text.
 *
 * The handoff's rule — never summarize from titles alone — is not only about the summary
 * text; it is about how much confidence a title-only judgement deserves. Observed on the
 * first live acceptance run: a commit titled "Fix lychee.toml for lychee 0.23: headers field
 * was renamed" scored relevance 1.00 / actionability 1.00 from that subject line alone and
 * took the top slot at 0.88, with a `why` that merely restated the title. A link-checker
 * config fix in a cookbook repo.
 *
 * A model reading a bare imperative subject line will nearly always call it actionable —
 * that is what imperative subject lines sound like. So a thin-text score is capped below a
 * confident one, and cannot trip the actionability floor. Read it or rank it lower.
 */
export const THIN_CEILING = 0.55;

export interface Dimensions {
  relevance: number;
  actionability: number;
  novelty: number;
  authority: number;
}

export interface ScoreBreakdown extends Dimensions {
  composite: number;
  rubricVersion: string;
  why: string;
  textQuality: TextQuality;
  /** True when the actionability floor lifted this above its weighted mean. */
  flooredUp: boolean;
  /** True when a title-only judgement was capped at THIN_CEILING. */
  thinCapped: boolean;
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function weightedMean(d: Dimensions): number {
  return (
    clamp01(d.relevance) * WEIGHTS.relevance +
    clamp01(d.actionability) * WEIGHTS.actionability +
    clamp01(d.novelty) * WEIGHTS.novelty +
    clamp01(d.authority) * WEIGHTS.authority
  );
}

export function composite(
  d: Dimensions,
  textQuality: TextQuality = 'full',
): { composite: number; flooredUp: boolean; thinCapped: boolean } {
  const mean = weightedMean(d);

  // Judged without real text: cap it below the threshold. It can still be recorded and
  // inspected, but it cannot claim a slot in a three-item brief over something we read.
  if (textQuality === 'thin') {
    return { composite: Math.min(mean, THIN_CEILING), flooredUp: false, thinCapped: mean > THIN_CEILING };
  }

  const qualifies =
    clamp01(d.actionability) >= FLOOR.actionability && clamp01(d.authority) >= FLOOR.authority;
  if (qualifies && mean < FLOOR.composite) {
    return { composite: FLOOR.composite, flooredUp: true, thinCapped: false };
  }
  return { composite: mean, flooredUp: false, thinCapped: false };
}

export function buildScore(
  d: Dimensions,
  meta: { why: string; textQuality: TextQuality },
): ScoreBreakdown {
  const { composite: c, flooredUp, thinCapped } = composite(d, meta.textQuality);
  return {
    relevance: clamp01(d.relevance),
    actionability: clamp01(d.actionability),
    novelty: clamp01(d.novelty),
    authority: clamp01(d.authority),
    composite: c,
    rubricVersion: RUBRIC_VERSION,
    why: meta.why,
    textQuality: meta.textQuality,
    flooredUp,
    thinCapped,
  };
}

export interface Ranked<T> {
  item: T;
  score: ScoreBreakdown;
}

/**
 * Threshold, then cap. Sorted by composite descending; ties break toward the item whose
 * score came from real article text rather than feed metadata.
 */
export function shortlist<T>(scored: Ranked<T>[], max = MAX_ITEMS): Ranked<T>[] {
  return scored
    .filter((s) => s.score.composite >= THRESHOLD)
    .sort((a, b) => {
      const d = b.score.composite - a.score.composite;
      if (Math.abs(d) > 1e-9) return d;
      const qa = a.score.textQuality === 'full' ? 1 : 0;
      const qb = b.score.textQuality === 'full' ? 1 : 0;
      return qb - qa;
    })
    .slice(0, max);
}
