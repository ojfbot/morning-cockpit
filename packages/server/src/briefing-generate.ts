import {
  artifactToCandidate,
  briefingFallback,
  scopeSnapshotToRepo,
  validateBriefDraft,
  type BriefingArtifact,
  type BriefingBranch,
  type BriefingSnapshot,
  type BriefingTag,
  type BriefingThread,
  type CockpitSnapshot,
  type WorkItem,
} from '@cockpit/shared';
import { config } from './config.js';
import { ollamaChat } from './providers/ollama.js';
import { listKnownRepos } from './handoff-emit.js';

/**
 * Chief-of-Staff briefing generator (ADR-0007). The Ollama-ONLY discipline of ADR-0006 applied to
 * a richer output: ground on the snapshot → the local model proposes decision threads → a
 * deterministic gate validates every emit artifact (repo must exist, criteria present) → invalid
 * threads are dropped, and if nothing survives we fall back to briefingFallback (real lane data).
 * No cloud cascade; the generator only proposes — every emit is still human-approved.
 *
 * To keep a 7B model reliable, the model emits ONE recommended action per thread (not a nested
 * branch tree); we attach a deterministic defer branch. The UX (recommended deliver + defer) holds.
 */

const MAX_THREADS = 4;

const SYSTEM = (repos: string[]) =>
  [
    'You are the Chief of Staff for a solo developer running a fleet of repos. You have read the',
    "overnight bead scan. Pick the items that most want a DECISION today and turn each into one",
    'briefing thread. Respond with ONLY a JSON object — no prose:',
    '{"threads":[{"id":string,"tag":"decision"|"stale"|"quickwin","title":string,"whyNow":string,',
    '"catchUp":string,"question":string,"recommended":{"label":string,"title":string,"repo":string,',
    '"closes":string,"align":string,"task":string,"criteria":string[]}}]}',
    `Produce at most ${MAX_THREADS} threads, most important first.`,
    `recommended.repo MUST be one of: ${repos.join(', ')}.`,
    'whyNow: one terse line (e.g. "28 days stale · no owner"). catchUp: 2-3 sentences of pre-read,',
    'written to the operator who has NOT seen the beads. question: the decision you need from them.',
    'recommended is the action you advise: label is a short button ("Ship it now"); title is an',
    'imperative brief title; align is the shared intent (1-2 sentences); task is one concrete',
    'paragraph for a coding session; criteria is 2-4 testable acceptance items; closes is the bead',
    'id it resolves. Use ONLY facts from the scan — do not invent repos, files, or work.',
  ].join('\n');

/** Compact grounding: the lanes as titled lines + the deterministic lane headlines. */
function groundingFacts(snapshot: CockpitSnapshot): string {
  const line = (i: WorkItem) =>
    `- [${i.kind}] ${i.title} — repo:${i.repo ?? '?'} id:${i.nativeId}${i.staleDays ? ` (${i.staleDays}d stale)` : ''}`;
  const block = (label: string, items: WorkItem[]) =>
    items.length ? `${label}:\n${items.map(line).join('\n')}` : `${label}: (none)`;
  return [
    block('PICKUP (human-in-the-loop, act today)', snapshot.lanes.pickup),
    block('AVAILABLE (unclaimed, stale floats up)', snapshot.lanes.available),
    `OVERNIGHT summary: ${snapshot.summaries.overnight.headline}`,
    `PICKUP summary: ${snapshot.summaries.pickup.headline}`,
  ].join('\n\n');
}

interface RawThread {
  id?: unknown;
  tag?: unknown;
  title?: unknown;
  whyNow?: unknown;
  catchUp?: unknown;
  question?: unknown;
  recommended?: {
    label?: unknown;
    title?: unknown;
    repo?: unknown;
    closes?: unknown;
    align?: unknown;
    task?: unknown;
    criteria?: unknown;
  };
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : [];
const TAGS: BriefingTag[] = ['decision', 'stale', 'quickwin'];

const deferBranch = (): BriefingBranch => ({
  key: 'defer',
  label: 'Defer 7 days',
  recommended: false,
  type: 'defer',
  cta: 'Snooze 7 days',
  outcome: 'Snoozes the item 7 days and logs the deferral on the bead.',
  doneText: 'Snoozed 7 days — the bead resurfaces next week.',
});

/** Validate one raw thread into a BriefingThread, or null if its recommended artifact is unusable. */
function toThread(raw: RawThread, repos: string[], i: number): BriefingThread | null {
  const rec = raw.recommended;
  if (!rec) return null;
  const artifact: BriefingArtifact = {
    title: str(rec.title),
    target: `${str(rec.repo)}/.handoff/`,
    closes: str(rec.closes),
    align: str(rec.align),
    task: str(rec.task),
    criteria: strList(rec.criteria),
  };
  // Reuse the handoff gate — a thread whose recommended emit could never write is dropped.
  const v = validateBriefDraft(artifactToCandidate(artifact), repos);
  if (!v.ok) return null;
  if (!str(raw.title) || !str(raw.question) || !str(raw.catchUp)) return null;

  const tag = TAGS.includes(raw.tag as BriefingTag) ? (raw.tag as BriefingTag) : 'decision';
  return {
    id: str(raw.id) || `cos-${i}`,
    tag,
    title: str(raw.title),
    whyNow: str(raw.whyNow) || 'flagged by the Chief of Staff',
    catchUp: str(raw.catchUp),
    question: str(raw.question),
    branches: [
      { key: 'ship', label: str(rec.label) || 'Approve this move', recommended: true, type: 'deliver', artifact },
      deferBranch(),
    ],
  };
}

/**
 * Generate (or fall back to) the briefing for a snapshot. Caller owns caching. When `repo` is set
 * the snapshot is scoped to that repo first (F2, ADR-0012) — the LLM grounding + the deterministic
 * fallback then see only that repo's items, and the result is tagged with `repo`. A quiet repo
 * scopes to empty lanes → an honest empty briefing (no threads).
 */
export async function generateBriefing(
  snapshot: CockpitSnapshot,
  generatedAt: string,
  repo?: string,
): Promise<BriefingSnapshot> {
  const scoped = repo ? scopeSnapshotToRepo(snapshot, repo) : snapshot;
  const tag = (b: BriefingSnapshot): BriefingSnapshot => (repo ? { ...b, repo } : b);

  // Truthful empty (F2/F4): a repo scoped to no items gets the deterministic empty — never an LLM
  // pass, which could fabricate threads for other repos from its allowed-repo list.
  const scopedEmpty =
    scoped.lanes.overnight.length === 0 &&
    scoped.lanes.pickup.length === 0 &&
    scoped.lanes.available.length === 0;
  if (config.summary.provider === 'off' || scopedEmpty) return tag(briefingFallback(scoped, generatedAt));

  // When scoped, constrain the model + the emit-gate to ONLY that repo, so threads can't leak in
  // for other repos (the bug the global allowed-list caused).
  const known = await listKnownRepos();
  const repos = repo ? known.filter((r) => r === repo) : known;
  let raw: string;
  try {
    const res = await ollamaChat(SYSTEM(repos), `Overnight scan:\n\n${groundingFacts(scoped)}`);
    raw = res.text;
  } catch {
    return tag(briefingFallback(scoped, generatedAt));
  }

  let parsed: { threads?: unknown };
  try {
    parsed = JSON.parse(raw) as { threads?: unknown };
  } catch {
    return tag(briefingFallback(scoped, generatedAt));
  }

  const rawThreads = Array.isArray(parsed.threads) ? (parsed.threads as RawThread[]) : [];
  const threads = rawThreads
    .slice(0, MAX_THREADS)
    .map((t, i) => toThread(t, repos, i))
    .filter((t): t is BriefingThread => t !== null);

  if (threads.length === 0) return tag(briefingFallback(scoped, generatedAt));
  return tag({ generatedAt, threads, source: 'llm' });
}
