import {
  paperExplainerFloor,
  profileNodeKeys,
  type LaneSummary,
  type PaperExplainer,
  type PaperItem,
  type ReaderProfile,
  type ReadingItem,
  type SynthSummary,
  type WorkItem,
  type WorkItemLane,
} from '@cockpit/shared';
import { config } from './config.js';
import { ollamaChat } from './providers/ollama.js';
import { claudeChat, claudeDeepDive } from './providers/claude.js';
import {
  buildPaperDeepDivePrompt,
  buildPaperExplainerPrompt,
  buildPrompt,
  buildReadingDigestPrompt,
  parseSynthFields,
} from './providers/prompt.js';

/**
 * Provider selector for all synthesis (lane summaries + reading digest). Local-first
 * (ADR-0003): default Ollama; Claude explicit opt-in; 'off' disables. No automatic cloud
 * cascade — callers fall back to the deterministic summary on any throw.
 */

export function summaryProvider(): 'ollama' | 'claude' | 'off' {
  return config.summary.provider;
}

export function summaryEnabled(): boolean {
  const p = config.summary.provider;
  if (p === 'off') return false;
  if (p === 'claude') return Boolean(config.summary.claude.apiKey);
  return true; // ollama: attempt; failures degrade to deterministic at call time
}

export function disabledReason(): string {
  const p = config.summary.provider;
  if (p === 'off') return 'summary provider is off (set COCKPIT_SUMMARY_PROVIDER=ollama)';
  if (p === 'claude') return 'ANTHROPIC_API_KEY not set';
  return '';
}

/** Run the selected transport. Throws if provider is off or the backend fails. */
async function chat(system: string, user: string): Promise<{ text: string; provider: string; model: string }> {
  switch (config.summary.provider) {
    case 'ollama': {
      const { text, model } = await ollamaChat(system, user);
      return { text, provider: 'ollama', model };
    }
    case 'claude': {
      const { text, model } = await claudeChat(system, user);
      return { text, provider: 'claude', model };
    }
    default:
      throw new Error('summary provider is off');
  }
}

export async function synthesizeLane(
  lane: WorkItemLane,
  items: WorkItem[],
  deterministic: LaneSummary,
): Promise<LaneSummary> {
  const { system, user } = buildPrompt(lane, items, deterministic);
  const { text, provider, model } = await chat(system, user);
  const f = parseSynthFields(text, deterministic);
  return {
    lane,
    source: 'llm',
    headline: f.headline,
    overview: f.overview,
    bullets: f.bullets,
    action: f.action ?? deterministic.action,
    provider,
    model,
    generatedAt: new Date().toISOString(),
  };
}

export async function synthesizeReadingDigest(
  items: ReadingItem[],
  deterministic: SynthSummary,
): Promise<SynthSummary> {
  const { system, user } = buildReadingDigestPrompt(items, deterministic.headline);
  const { text, provider, model } = await chat(system, user);
  const f = parseSynthFields(text, { headline: deterministic.headline, bullets: deterministic.bullets, action: deterministic.action });
  return {
    source: 'llm',
    headline: f.headline,
    overview: f.overview,
    bullets: f.bullets,
    action: f.action,
    provider,
    model,
    generatedAt: new Date().toISOString(),
  };
}

/** Keep only relatedNodes that name a real profile node key. */
function validRelated(keys: string[] | undefined, profile: ReaderProfile): string[] {
  if (!keys?.length) return [];
  const valid = profileNodeKeys(profile);
  return keys.filter((k) => valid.has(k));
}

/** True when the opt-in Claude deep-dive can run (needs an API key, independent of summary provider). */
export function deepDiveEnabled(): boolean {
  return Boolean(config.summary.claude.apiKey);
}

/**
 * Local abstract-level paper explainer — uses the ADR-0003 provider selector (Ollama default).
 * Throws on backend failure; the route falls back to the deterministic floor.
 */
export async function explainPaper(paper: PaperItem, profile: ReaderProfile): Promise<PaperExplainer> {
  const floor = paperExplainerFloor(paper);
  const { system, user } = buildPaperExplainerPrompt(paper, profile);
  const { text, provider, model } = await chat(system, user);
  const f = parseSynthFields(text, { headline: floor.headline, bullets: floor.bullets, action: floor.action });
  return {
    paperId: paper.id,
    tier: 'local',
    source: 'llm',
    headline: f.headline,
    overview: f.overview,
    bullets: f.bullets,
    action: f.action ?? floor.action,
    relatedNodes: validRelated(f.relatedNodes, profile),
    prerequisites: f.prerequisites,
    provider,
    model,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Full-PDF Claude deep-dive — always Claude Sonnet (the strong tier), independent of the local
 * summary provider. Throws if no API key or the call fails; the route falls back to the floor.
 */
export async function deepDivePaper(paper: PaperItem, profile: ReaderProfile): Promise<PaperExplainer> {
  const floor = paperExplainerFloor(paper);
  const { system, user } = buildPaperDeepDivePrompt(paper, profile);
  const { text, model } = await claudeDeepDive(paper.pdfUrl, system, user, {
    model: config.papers.deepDive.model,
    maxTokens: config.papers.deepDive.maxTokens,
    timeoutMs: config.papers.deepDive.timeoutMs,
  });
  const f = parseSynthFields(text, { headline: floor.headline, bullets: floor.bullets, action: floor.action });
  return {
    paperId: paper.id,
    tier: 'deep',
    source: 'llm',
    headline: f.headline,
    overview: f.overview,
    bullets: f.bullets,
    action: f.action ?? floor.action,
    relatedNodes: validRelated(f.relatedNodes, profile),
    prerequisites: f.prerequisites,
    provider: 'claude',
    model,
    generatedAt: new Date().toISOString(),
  };
}
