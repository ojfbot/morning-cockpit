/**
 * The scorer. Local-first per ADR-0003: Ollama only, and a local failure degrades to the
 * deterministic floor — it never cascades to the cloud. There is no API key in this package
 * and no cloud client; that is a property of the code, not a configuration choice.
 *
 * Three of the four dimensions are model-scored. `authority` is NOT: it is read from
 * sources.yaml. Asking a 7b model to rate the authority of its own inputs is a self-grading
 * loop with no ground truth, and it would let a confident blog post claim first-party weight.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Candidate } from './prefilter.js';
import type { Extraction } from './extract.js';
import { buildScore, RUBRIC_VERSION, type Dimensions, type ScoreBreakdown } from './rank.js';
import { repoRoot } from './sources.js';

export interface ScorerOptions {
  url: string;
  model: string;
  timeoutMs: number;
  /** Chars of article text shown to the model. */
  maxTextChars: number;
}

export const DEFAULT_SCORER: ScorerOptions = {
  url: process.env.COCKPIT_OLLAMA_URL ?? 'http://127.0.0.1:11434',
  model: process.env.COCKPIT_WATCH_MODEL ?? 'qwen2.5:7b',
  // Generous by design. This is a batch job that runs at 06:15, not an interactive request,
  // and a local model on a loaded machine is slow — a trivial round-trip was measured at 2
  // minutes wall-clock with the fleet's agents running. Too short a timeout does not fail
  // loudly; it silently degrades every item to the deterministic floor, which looks like a
  // working run that simply found nothing interesting.
  timeoutMs: Number(process.env.COCKPIT_WATCH_TIMEOUT_MS ?? 300_000),
  maxTextChars: Number(process.env.COCKPIT_WATCH_TEXT_CHARS ?? 8_000),
};

/** The prose half of fleet-profile.md, minus the machine-parsed vocabulary lists. */
export function loadFleetProse(path = resolve(repoRoot(), 'fleet-profile.md')): string {
  const md = readFileSync(path, 'utf8');
  const cut = md.indexOf('## Vocabulary');
  return (cut === -1 ? md : md.slice(0, cut)).trim();
}

const SYSTEM = `You score technical articles for a solo engineer running a fleet of ~45 repos.

You will be given a fleet profile, then one article with its real fetched text.
Score THREE dimensions, each a number from 0.0 to 1.0:

  relevance     Does this touch the operator's tools, methods, or subject matter?
                Judge against BOTH what they build and what they build it with. The fleet
                runs on Claude Code and the Claude API, so first-party guidance on working
                with these models is highly relevant even when it names no repo. Do NOT
                require a literal name match against the component list.
  actionability Would this change something the operator does or must fix? A deprecation,
                a breaking change, a new primitive that replaces hand-rolled scaffolding
                all score HIGH here even if they are dull. General interest scores LOW.
  novelty       Is this new information, or a restatement of something well known?

Do NOT score authority — it is supplied deterministically and is not your job.

CALIBRATION. Match the article to the nearest example and score near it:

  "A field guide to getting better results from Claude models"
      relevance 0.9  actionability 0.8  — this operator uses these tools every working hour;
      technique guidance changes how all their work gets done. HIGH, despite naming no repo.
  "Choosing a model and effort level in Claude Code"
      relevance 0.9  actionability 0.9  — a direct, immediately applicable operating decision.
  "Deprecating the v1 endpoint on 1 March"
      relevance 0.6  actionability 1.0  — dull, narrow, and they MUST act. This is the case
      the brief exists for. Never score a deprecation low just because it is boring.
  "New agent SDK primitive for scheduling"
      relevance 0.8  actionability 0.7  — may replace scaffolding they hand-rolled.
  "Customer X built a chatbot with Claude"
      relevance 0.2  actionability 0.1  — a case study about someone else's product.
  "Anthropic raises $N billion"
      relevance 0.0  actionability 0.0  — company news, changes nothing they do.
  "Fix config file for linter 0.23"
      relevance 0.1  actionability 0.1  — routine repo churn in a project they do not maintain.

A first-party post about using Claude models or Claude Code should almost never score
relevance below 0.7. If you are about to, re-read the substrate section above first.

Also write "why": ONE sentence, under 30 words, saying what this means for the operator.
It MUST be grounded in the supplied article text. Do not speculate about content you were
not given. If the supplied text is only a title or a stub, say so plainly in the why.

Respond with JSON only:
{"relevance": 0.0, "actionability": 0.0, "novelty": 0.0, "why": "..."}`;

interface RawScore {
  relevance?: unknown;
  actionability?: unknown;
  novelty?: unknown;
  why?: unknown;
}

function num(v: unknown): number | undefined {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : undefined;
}

/** Pull a JSON object out of the response even when the model wraps it in prose or a fence. */
export function parseScoreJson(text: string): { relevance: number; actionability: number; novelty: number; why: string } {
  let candidate = text.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(candidate);
  if (fence?.[1]) candidate = fence[1].trim();
  if (!candidate.startsWith('{')) {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) candidate = candidate.slice(start, end + 1);
  }

  const raw = JSON.parse(candidate) as RawScore;
  const relevance = num(raw.relevance);
  const actionability = num(raw.actionability);
  const novelty = num(raw.novelty);
  if (relevance === undefined || actionability === undefined || novelty === undefined) {
    throw new Error(
      `missing or out-of-range dimensions (got relevance=${String(raw.relevance)}, actionability=${String(raw.actionability)}, novelty=${String(raw.novelty)})`,
    );
  }
  const why = typeof raw.why === 'string' ? raw.why.trim() : '';
  if (!why) throw new Error('missing "why"');
  return { relevance, actionability, novelty, why };
}

async function ollamaJson(system: string, user: string, opts: ScorerOptions): Promise<string> {
  const res = await fetch(`${opts.url}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      stream: false,
      format: 'json',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      options: { temperature: 0.2, num_predict: 400 },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs),
  });
  if (!res.ok) throw new Error(`ollama ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { message?: { content?: string } };
  const text = data.message?.content ?? '';
  if (!text) throw new Error('ollama returned empty content');
  return text;
}

function userPrompt(c: Candidate, text: Extraction, fleet: string, maxChars: number): string {
  const clipped = text.text.slice(0, maxChars);
  return [
    '# Fleet profile',
    fleet,
    '',
    '# Article',
    `Source: ${c.item.sourceTitle} (${c.item.sourceClass})`,
    `Title: ${c.item.title}`,
    `Published: ${c.item.publishedAt ?? 'unknown'}`,
    `URL: ${c.item.url}`,
    `Text quality: ${text.quality === 'full' ? 'full article text' : 'STUB — feed metadata only, no article body was retrievable'}`,
    '',
    '## Text',
    clipped || '(no text available)',
  ].join('\n');
}

/**
 * Deterministic floor. Used when the local model is unreachable or will not produce valid
 * JSON. Derives conservative dimensions from the prefilter's evidence so the run still
 * completes with an honest, if blunt, ranking. Never a silent cloud call.
 */
export function deterministicScore(c: Candidate, text: Extraction): ScoreBreakdown {
  const hits = c.hits.length;
  const relevance = Math.min(0.6, hits * 0.12);
  const dims: Dimensions = {
    relevance,
    // Cannot be judged without reading. Kept below FLOOR.actionability so the deterministic
    // path can never trip the actionability floor by accident.
    actionability: 0.3,
    novelty: 0.3,
    authority: c.item.authority,
  };
  return buildScore(dims, {
    why: `Scored deterministically (local model unavailable) — ${hits} fleet-vocabulary match${hits === 1 ? '' : 'es'}: ${c.hits.slice(0, 5).join(', ') || 'none'}.`,
    textQuality: text.quality,
  });
}

export interface ScoreOutcome {
  score: ScoreBreakdown;
  provider: string;
}

/**
 * Score one candidate. One repair attempt on malformed JSON — the error is fed back so the
 * model can correct it — then the deterministic floor.
 */
export async function scoreCandidate(
  c: Candidate,
  text: Extraction,
  fleet: string,
  opts: ScorerOptions = DEFAULT_SCORER,
): Promise<ScoreOutcome> {
  const user = userPrompt(c, text, fleet, opts.maxTextChars);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const system =
        attempt === 0
          ? SYSTEM
          : `${SYSTEM}\n\nYour previous reply could not be parsed. Reply with ONLY the JSON object, no prose, no code fence.`;
      const raw = await ollamaJson(system, user, opts);
      const parsed = parseScoreJson(raw);
      return {
        score: buildScore(
          { ...parsed, authority: c.item.authority },
          { why: parsed.why, textQuality: text.quality },
        ),
        provider: `ollama:${opts.model}:${RUBRIC_VERSION}`,
      };
    } catch {
      /* retry once, then fall through to the deterministic floor */
    }
  }

  return { score: deterministicScore(c, text), provider: 'deterministic' };
}
