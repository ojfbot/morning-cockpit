import type { LaneSummary, PaperItem, ReadingItem, ReaderProfile, WorkItem, WorkItemLane } from '@cockpit/shared';

/** Shared prompt construction + defensive JSON parsing for all synthesis providers. */

const LANE_MEANING: Record<WorkItemLane, string> = {
  overnight: 'work that ran or completed since last evening — what the user should know happened while away',
  pickup: 'human-in-the-loop items the user should act on TODAY (open briefs, review-ready PRs, top priorities)',
  available: 'unclaimed, pickable work; stale items have rotted and should be triaged or closed',
};

function workItemDigest(items: WorkItem[]): string {
  return JSON.stringify(
    items.map((i) => ({ title: i.title, repo: i.repo, kind: i.kind, status: i.status, staleDays: i.staleDays, actor: i.actor })),
  );
}

function readingItemDigest(items: ReadingItem[]): string {
  return JSON.stringify(
    items.map((i) => ({ title: i.title, source: i.source, author: i.author, publishedAt: i.publishedAt })),
  );
}

/** Bead-lane executive-summary prompt. */
export function buildPrompt(
  lane: WorkItemLane,
  items: WorkItem[],
  deterministic: LaneSummary,
): { system: string; user: string } {
  const system =
    `You are an engineering chief-of-staff writing a morning EXECUTIVE SUMMARY for a solo ` +
    `developer who runs many projects in parallel. Summarize one "lane" of their dashboard. ` +
    `The "${lane}" lane is: ${LANE_MEANING[lane]}.\n\n` +
    `Write a substantive briefing of roughly 400-500 words — a real executive summary, NOT a ` +
    `terse list and NOT a restatement of the baseline. Be concrete and specific: name the repos, ` +
    `the item titles, their ages, and what each one actually requires. Explain WHY items matter, ` +
    `what is blocking or rotting, how they relate, and where the leverage is. Close with a clear, ` +
    `prioritized recommendation.\n\n` +
    `Respond with ONLY a JSON object with these keys:\n` +
    `  "headline": string — one line capturing the lane's state.\n` +
    `  "overview": string — a 2-4 sentence prose paragraph framing the overall situation.\n` +
    `  "bullets": string[] — 4 to 8 items, EACH A COMPLETE SENTENCE describing one pending thing, ` +
    `its context, and what's at stake (not a bare phrase).\n` +
    `  "action": string — 2-4 sentences giving the recommended next moves in priority order.\n` +
    `Aim for ~450 words across overview + bullets + action combined.`;
  const user =
    `Lane: ${lane}\nItem count: ${items.length}\nItems (JSON):\n${workItemDigest(items)}\n\n` +
    `Deterministic baseline for grounding (do NOT just echo it — expand into a real briefing):\n` +
    `headline: ${deterministic.headline}\nbullets: ${deterministic.bullets.join(' | ')}\naction: ${deterministic.action}`;
  return { system, user };
}

/** Reading-digest prompt: "what's worth your attention and why" over new feed items. */
export function buildReadingDigestPrompt(
  items: ReadingItem[],
  baselineHeadline: string,
): { system: string; user: string } {
  const system =
    `You are a sharp technical reading curator for a developer who works on AI agents and ` +
    `developer tooling and likes Steve Yegge, Andrej Karpathy, and applied-AI writing. ` +
    `Given today's NEW posts from their curated feeds, write a concise briefing (~300-450 words) ` +
    `on what is worth their attention and WHY — group related posts, flag the one or two must-reads, ` +
    `and skip the noise. Be specific: name the post titles and sources.\n\n` +
    `Respond with ONLY a JSON object:\n` +
    `  "headline": string — one line on the day's reading.\n` +
    `  "overview": string — 2-3 sentence prose framing of the themes.\n` +
    `  "bullets": string[] — 3 to 7 items, each a complete sentence: a post (or cluster) and why it matters.\n` +
    `  "action": string — what to read FIRST, and what to skip.`;
  const user = `New posts (JSON):\n${readingItemDigest(items)}\n\nBaseline: ${baselineHeadline}`;
  return { system, user };
}

/** Compact, model-facing serialization of the reader profile (with the node keys to cite). */
function profileDigest(profile: ReaderProfile): string {
  const nodes = (label: string, ns: ReaderProfile['domains']) =>
    `${label}: ` + ns.map((n) => `${n.key}${n.recent ? '*' : ''} (${n.label})`).join('; ');
  return [
    nodes('STRENGTHS', profile.strengths),
    nodes('LEARNING', profile.learning),
    nodes('DOMAINS', profile.domains),
    '(* = currently active in their working notes)',
  ].join('\n');
}

const PAPER_JSON_SCHEMA =
  `Respond with ONLY a JSON object:\n` +
  `  "headline": string — one plain-language line: what this paper actually is.\n` +
  `  "overview": string — 3-5 sentences in plain language: the problem, the core idea, and why it matters — pitched to THIS reader.\n` +
  `  "bullets": string[] — complete sentences covering: key claims/contributions, the method in intuitive terms, and limitations/caveats. Be concrete.\n` +
  `  "action": string — your honest take: is this worth their time, and what to read first (or skip)?\n` +
  `  "relatedNodes": string[] — the profile node KEYS (from STRENGTHS/LEARNING/DOMAINS above) this paper genuinely connects to. Only real connections; [] if none.\n` +
  `  "prerequisites": string[] — 2-4 concepts they'd want to understand first to follow it (named concretely).`;

/** Local abstract-level explainer: make an out-of-depth paper legible, anchored to the reader. */
export function buildPaperExplainerPrompt(
  paper: PaperItem,
  profile: ReaderProfile,
): { system: string; user: string } {
  const system =
    `You are a sharp research tutor for ONE specific developer. You are given a paper's ABSTRACT ` +
    `(not the full text) plus a profile of what the reader already commands, is actively learning, ` +
    `and researches. Your job: make a paper that may be over their head legible WITHOUT dumbing it ` +
    `down — explain what it is, why it matters, and explicitly RELATE it to concepts they already ` +
    `have mastery with (name their domains). Surface key claims, the method intuitively, and honest ` +
    `caveats. You only have the abstract, so do not invent specific results, numbers, or figures.\n\n` +
    PAPER_JSON_SCHEMA;
  const user =
    `READER PROFILE:\n${profileDigest(profile)}\n\n` +
    `PAPER\nTitle: ${paper.title}\nAuthors: ${paper.authors.join(', ') || 'n/a'}\n` +
    `HF upvotes: ${paper.upvotes ?? 'n/a'}\nAbstract:\n${paper.abstract || '(no abstract available)'}`;
  return { system, user };
}

/** Full-PDF deep-dive (Claude): the reader pasted-method breakdown, leveled to the reader. */
export function buildPaperDeepDivePrompt(
  paper: PaperItem,
  profile: ReaderProfile,
): { system: string; user: string } {
  const system =
    `You are a sharp research tutor for ONE specific developer. You are given the FULL PDF of a ` +
    `paper plus a profile of what the reader commands, is learning, and researches. Do a genuine ` +
    `deep read and break the paper down FOR THIS READER: the main findings and novel contributions; ` +
    `the methodology in intuitive terms; the most important figures/tables and what they show; ` +
    `limitations and threats to validity; future work; and a critical take on strengths and ` +
    `weaknesses. Throughout, RELATE it to concepts they already have mastery with (name their ` +
    `domains) and flag what's genuinely new to them. Be specific and cite the paper's actual content.\n\n` +
    PAPER_JSON_SCHEMA.replace(
      '"bullets": string[] — complete sentences covering: key claims/contributions, the method in intuitive terms, and limitations/caveats. Be concrete.',
      '"bullets": string[] — 5-9 complete sentences: contributions, method, key figures/tables and what they show, limitations, and a critical strength/weakness. Be concrete and cite the paper.',
    );
  const user =
    `READER PROFILE:\n${profileDigest(profile)}\n\n` +
    `PAPER (full PDF attached)\nTitle: ${paper.title}\nAuthors: ${paper.authors.join(', ') || 'n/a'}\n` +
    `Read the attached PDF and produce the leveled deep-dive as specified.`;
  return { system, user };
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object in model output');
  return JSON.parse(raw.slice(start, end + 1));
}

export interface SynthFields {
  headline: string;
  overview?: string;
  bullets: string[];
  action?: string;
  /** Paper-explainer extras: profile node keys this connects to + prerequisite concepts. */
  relatedNodes?: string[];
  prerequisites?: string[];
}

function stringArray(v: unknown, cap: number): string[] | undefined {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, cap) : undefined;
}

/** Parse a model's JSON text into the common synth fields, per-field falling back. */
export function parseSynthFields(
  text: string,
  fallback: { headline: string; bullets: string[]; action?: string },
): SynthFields {
  const parsed = extractJson(text) as {
    headline?: unknown;
    overview?: unknown;
    bullets?: unknown;
    action?: unknown;
    relatedNodes?: unknown;
    prerequisites?: unknown;
  };
  const headline = typeof parsed.headline === 'string' ? parsed.headline : fallback.headline;
  const overview = typeof parsed.overview === 'string' && parsed.overview.trim() ? parsed.overview.trim() : undefined;
  const bullets = Array.isArray(parsed.bullets)
    ? parsed.bullets.filter((b): b is string => typeof b === 'string').slice(0, 8)
    : fallback.bullets;
  const action = typeof parsed.action === 'string' ? parsed.action : fallback.action;
  return {
    headline,
    overview,
    bullets,
    action,
    relatedNodes: stringArray(parsed.relatedNodes, 8),
    prerequisites: stringArray(parsed.prerequisites, 8),
  };
}
