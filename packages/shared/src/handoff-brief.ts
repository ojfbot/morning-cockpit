/**
 * Handoff Emission — the chat's single action verb (ADR-0005). Pure string logic for drafting,
 * validating, and rendering an orient-compatible brief bead. The annotate.ts discipline applied
 * to a write: the LLM proposes, a deterministic validator gates, a human approves.
 *
 * Output must round-trip through BOTH parsers of `.handoff/*.md`:
 *   core/.claude/skills/bead/scripts/orient.py  (open hook: type=brief, status=live, no report)
 *   packages/server/src/adapters/handoff.ts     (same contract — the loop-closure check)
 */

export interface BriefBody {
  context: string;
  goal: string;
  acceptance: string[];
  references: string[];
  flagBack?: string;
}

export interface HandoffDraft {
  /** Draft id (uuid) — NOT the bead id; the bead id is the filename stem, stamped at approve. */
  id: string;
  repo: string;
  to: string;
  title: string;
  slug: string;
  filename: string;
  beadId: string;
  body: BriefBody;
  status: 'staged' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  writtenPath?: string;
  /** Provenance of the draft text (which model proposed it). */
  provider: string;
  model: string;
}

/** What the LLM is asked to return (JSON) before validation. */
export interface BriefCandidate {
  repo?: unknown;
  to?: unknown;
  title?: unknown;
  context?: unknown;
  goal?: unknown;
  acceptance?: unknown;
  references?: unknown;
  flagBack?: unknown;
}

const SLUG_MAX = 48;

/** Filename-safe slug from a title. Empty result means the title is unusable. */
export function briefSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
}

/** `YYYYMMDD-HHMM-brief-<slug>.md` (local time — matches the existing beads in ~/ojfbot). */
export function briefFilename(now: Date, slug: string): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}`;
  return `${stamp}-brief-${slug}.md`;
}

/** A repo name must be a plain directory name — no separators, no dot-escapes. */
export function isSafeRepoName(name: string): boolean {
  return name !== '.' && name !== '..' && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name);
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : [];

export interface BriefValidation {
  ok: boolean;
  errors: string[];
}

/**
 * Deterministic gate on the LLM's proposed brief (accumulates ALL errors — the preview card
 * shows every problem at once). `knownRepos` = actual directories under the repo root.
 */
export function validateBriefDraft(candidate: BriefCandidate, knownRepos: string[]): BriefValidation {
  const errors: string[] = [];
  const repo = str(candidate.repo);
  const title = str(candidate.title);

  if (!repo) errors.push('repo is required');
  else if (!isSafeRepoName(repo)) errors.push(`repo "${repo}" is not a safe directory name`);
  else if (!knownRepos.includes(repo)) errors.push(`repo "${repo}" does not exist under the repo root`);

  if (!str(candidate.to)) errors.push('to (recipient) is required');
  if (!title) errors.push('title is required');
  else if (!briefSlug(title)) errors.push('title produces an empty slug');

  if (!str(candidate.context)) errors.push('body.context is required');
  if (!str(candidate.goal)) errors.push('body.goal is required');
  if (strList(candidate.acceptance).length === 0) errors.push('at least one acceptance criterion is required');

  return { ok: errors.length === 0, errors };
}

/** Normalize a validated candidate into the typed body (drops empties, trims). */
export function candidateBody(candidate: BriefCandidate): BriefBody {
  return {
    context: str(candidate.context),
    goal: str(candidate.goal),
    acceptance: strList(candidate.acceptance),
    references: strList(candidate.references),
    flagBack: str(candidate.flagBack) || undefined,
  };
}

const yamlQuote = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * Render the real bead markdown. Frontmatter is orient-compatible: id = filename stem,
 * type: brief, status: live, actor: morning-cockpit-chat — so the cockpit's own handoff
 * adapter picks it up as an open hook on the next poll (the built-in loop-closure check).
 */
export function renderBriefMarkdown(draft: HandoffDraft, sessionId: string, createdAtIso: string): string {
  const fm = [
    '---',
    `id: ${draft.beadId}`,
    'type: brief',
    `title: ${yamlQuote(draft.title)}`,
    'actor: morning-cockpit-chat',
    `to: ${draft.to}`,
    `session_id: ${sessionId}`,
    'status: live',
    `created_at: ${createdAtIso}`,
    ...(draft.body.references.length
      ? ['refs:', ...draft.body.references.map((r) => `  - ${r}`)]
      : []),
    'labels:',
    `  project: ${draft.repo}`,
    '  emitted_by: morning-cockpit-chat',
    '---',
  ];
  const body = [
    '',
    '## Context',
    '',
    draft.body.context,
    '',
    '## Goal',
    '',
    draft.body.goal,
    '',
    '## Acceptance criteria',
    '',
    ...draft.body.acceptance.map((a) => `- [ ] ${a}`),
    '',
    '## References',
    '',
    ...(draft.body.references.length ? draft.body.references.map((r) => `- ${r}`) : ['- (none)']),
    '',
    '## Flag back',
    '',
    draft.body.flagBack ?? 'Surface questions in the next session rather than deciding unilaterally.',
    '',
  ];
  return [...fm, ...body].join('\n');
}
