import { randomUUID } from 'node:crypto';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  artifactToCandidate,
  briefFilename,
  briefSlug,
  candidateBody,
  renderBriefMarkdown,
  validateBriefDraft,
  type BriefBody,
  type BriefCandidate,
  type BriefingArtifact,
  type ChatMessage,
  type HandoffDraft,
} from '@cockpit/shared';
import { config } from './config.js';
import { ollamaChat } from './providers/ollama.js';
import { getDraft, saveDraft, updateDraft } from './chat-store.js';
import { isPathInside } from './chat-context.js';

/**
 * Handoff Emission (ADR-0005) — the cockpit's ONLY upstream write path, carved out of
 * ADR-0001's read-only posture. annotate.ts discipline applied to a write:
 *   facts (conversation + known repos) → LLM draft → deterministic validate → human Approve.
 * Nothing touches a target repo until approveDraft; Reject writes nothing upstream. An action
 * verb must not fabricate deterministically, so there is NO draft floor — Ollama down means
 * an honest `unavailable`, never a templated guess (and never a cloud cascade).
 */

export type DraftResult =
  | { status: 'ok'; draft: HandoffDraft }
  | { status: 'failed_validation'; errors: string[]; raw: string }
  | { status: 'unavailable'; reason: string };

export type ApproveResult =
  | { status: 'ok'; path: string; beadId: string; draft: HandoffDraft }
  | { status: 'invalid'; errors: string[] };

/** Actual directories under the repo root — the only legal emission targets. Repos are never created. */
export async function listKnownRepos(): Promise<string[]> {
  const root = config.handoff.repoRoot;
  const out: string[] = [];
  for (const name of await readdir(root)) {
    if (name.startsWith('.')) continue;
    try {
      if ((await stat(path.join(root, name))).isDirectory()) out.push(name);
    } catch {
      /* race: entry vanished */
    }
  }
  return out.sort();
}

const DRAFT_SYSTEM = (repos: string[]) =>
  [
    'You distill a conversation into a work brief for a future coding session. Respond with',
    'ONLY a JSON object — no prose — with exactly these fields:',
    '{"repo": string, "to": string, "title": string, "context": string, "goal": string,',
    ' "acceptance": string[], "references": string[], "flagBack": string}',
    `repo MUST be one of: ${repos.join(', ')}.`,
    'to is the recipient (default "code-claude" unless the conversation names another).',
    'title: imperative, scannable, under 80 chars. context: what is already true — the receiver',
    'has NOT seen this conversation. goal: one concrete paragraph. acceptance: 2-5 testable',
    'checklist items. references: typed URIs (file:…, adr:…, url:…) mentioned in the',
    'conversation, or []. flagBack: what NOT to decide unilaterally. Use only facts from the',
    'conversation — do not invent repos, files, or requirements.',
  ].join('\n');

function transcript(messages: ChatMessage[]): string {
  return messages
    .slice(-config.chat.maxTurns)
    .map((m) => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
    .join('\n\n');
}

/** facts → LLM → validate. Returns a STAGED draft (persisted) or an honest failure. */
export async function draftFromConversation(messages: ChatMessage[]): Promise<DraftResult> {
  if (config.summary.provider === 'off') {
    return { status: 'unavailable', reason: 'summary provider is off (set COCKPIT_SUMMARY_PROVIDER=ollama)' };
  }
  const repos = await listKnownRepos();

  let raw: string;
  let model: string;
  try {
    const res = await ollamaChat(DRAFT_SYSTEM(repos), `Conversation:\n\n${transcript(messages)}`);
    raw = res.text;
    model = res.model;
  } catch (err) {
    return { status: 'unavailable', reason: `ollama unreachable: ${err instanceof Error ? err.message : String(err)}` };
  }

  let candidate: BriefCandidate;
  try {
    candidate = JSON.parse(raw) as BriefCandidate;
  } catch {
    return { status: 'failed_validation', errors: ['model did not return valid JSON'], raw };
  }

  const v = validateBriefDraft(candidate, repos);
  if (!v.ok) return { status: 'failed_validation', errors: v.errors, raw };

  const now = new Date();
  const title = String(candidate.title).trim();
  const slug = briefSlug(title);
  const filename = briefFilename(now, slug); // provisional preview — recomputed at approve
  const draft: HandoffDraft = {
    id: randomUUID(),
    repo: String(candidate.repo).trim(),
    to: String(candidate.to).trim(),
    title,
    slug,
    filename,
    beadId: filename.replace(/\.md$/, ''),
    body: candidateBody(candidate),
    status: 'staged',
    createdAt: now.toISOString(),
    provider: 'ollama',
    model,
  };
  await saveDraft(draft);
  return { status: 'ok', draft };
}

export interface DraftEdits {
  title?: string;
  to?: string;
  body?: Partial<BriefBody>;
}

/**
 * The gated write. Applies edits, recomputes slug/filename/beadId at approve time (the file is
 * born now, not at draft time), re-validates, enforces path safety, then writes the REAL bead
 * into `<repoRoot>/<repo>/.handoff/`. Creates `.handoff/` if missing; never creates the repo;
 * refuses to overwrite an existing bead.
 */
export async function approveDraft(draftId: string, edits?: DraftEdits): Promise<ApproveResult> {
  const draft = await getDraft(draftId);
  if (!draft) return { status: 'invalid', errors: [`unknown draft: ${draftId}`] };
  if (draft.status !== 'staged') return { status: 'invalid', errors: [`draft is ${draft.status}, not staged`] };

  const merged: HandoffDraft = {
    ...draft,
    title: edits?.title?.trim() || draft.title,
    to: edits?.to?.trim() || draft.to,
    body: {
      ...draft.body,
      ...Object.fromEntries(Object.entries(edits?.body ?? {}).filter(([, v]) => v !== undefined)),
    },
  };

  const repos = await listKnownRepos();
  const v = validateBriefDraft({ ...merged, ...merged.body }, repos);
  if (!v.ok) return { status: 'invalid', errors: v.errors };

  const now = new Date();
  merged.slug = briefSlug(merged.title);
  merged.filename = briefFilename(now, merged.slug);
  merged.beadId = merged.filename.replace(/\.md$/, '');

  const root = config.handoff.repoRoot;
  const repoDir = path.join(root, merged.repo);
  const target = path.resolve(repoDir, '.handoff', merged.filename);
  if (!isPathInside(root, target)) return { status: 'invalid', errors: ['target path escapes the repo root'] };
  try {
    if (!(await stat(repoDir)).isDirectory()) return { status: 'invalid', errors: [`${merged.repo} is not a directory`] };
  } catch {
    return { status: 'invalid', errors: [`repo "${merged.repo}" does not exist`] };
  }
  try {
    await stat(target);
    return { status: 'invalid', errors: [`${merged.filename} already exists in ${merged.repo}/.handoff` ] };
  } catch {
    /* good — target is free */
  }

  const createdAtIso = now.toISOString();
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, renderBriefMarkdown(merged, createdAtIso, createdAtIso), { encoding: 'utf8', flag: 'wx' });

  const approved: HandoffDraft = { ...merged, status: 'approved', approvedAt: createdAtIso, writtenPath: target };
  await updateDraft(approved);
  return { status: 'ok', path: target, beadId: approved.beadId, draft: approved };
}

/**
 * Briefing emit (ADR-0007) — the deliver-branch "Approve & emit". The artifact is already a fully
 * specified, human-reviewed brief (no LLM drafting needed), so we stage it deterministically and
 * immediately approve through the SAME gated write path as the chat (approveDraft): validate →
 * path-safe → write `<repo>/.handoff/`, never overwrite, never create a repo. The explicit Approve
 * click in the decision tree IS the ADR-0005 per-emission human gate.
 */
export async function emitArtifact(artifact: BriefingArtifact): Promise<ApproveResult> {
  const repos = await listKnownRepos();
  const candidate: BriefCandidate = artifactToCandidate(artifact);
  const v = validateBriefDraft(candidate, repos);
  if (!v.ok) return { status: 'invalid', errors: v.errors };

  const now = new Date();
  const title = String(candidate.title).trim();
  const slug = briefSlug(title);
  const filename = briefFilename(now, slug);
  const draft: HandoffDraft = {
    id: randomUUID(),
    repo: String(candidate.repo).trim(),
    to: String(candidate.to).trim(),
    title,
    slug,
    filename,
    beadId: filename.replace(/\.md$/, ''),
    body: candidateBody(candidate),
    status: 'staged',
    createdAt: now.toISOString(),
    provider: 'briefing',
    model: 'artifact',
  };
  await saveDraft(draft);
  return approveDraft(draft.id);
}

/** Reject: tombstone in cockpit .data/ only — zero upstream writes. */
export async function rejectDraft(draftId: string): Promise<boolean> {
  const draft = await getDraft(draftId);
  if (!draft || draft.status !== 'staged') return false;
  await updateDraft({ ...draft, status: 'rejected' });
  return true;
}
