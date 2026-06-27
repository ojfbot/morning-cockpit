/**
 * Briefing console (decisions/adr/0007) — the bead-specific Chief-of-Staff console where every
 * discussion resolves into an approvable Handoff Artifact. These are the view-models the renderer
 * consumes; in production they come from `GET /api/briefing` (an LLM pass grounded on the snapshot,
 * Slice 3) with a typed mock standing in until then.
 *
 * A `deliver` branch carries a `BriefingArtifact` that maps onto the existing handoff write path
 * (handoff-brief.ts BriefCandidate/BriefBody) — so "Approve & emit" reuses ADR-0005, no new write.
 */

import type { BriefCandidate } from './handoff-brief.js';
import type { CockpitSnapshot } from './work-item.js';

/**
 * Scope a snapshot to a single repo (F2, ADR-0012) — keep only lane items whose `repo` matches.
 * Pure: returns a new snapshot, never mutates the input. The briefing generator + deterministic
 * fallback then produce a per-repo First Move with no generator rewrite (one code path, global vs
 * scoped). A repo with no items yields empty lanes → an honest empty briefing.
 */
export function scopeSnapshotToRepo(snapshot: CockpitSnapshot, repo: string): CockpitSnapshot {
  const byRepo = (items: CockpitSnapshot['lanes']['overnight']) => items.filter((i) => i.repo === repo);
  return {
    ...snapshot,
    lanes: {
      overnight: byRepo(snapshot.lanes.overnight),
      pickup: byRepo(snapshot.lanes.pickup),
      available: byRepo(snapshot.lanes.available),
    },
  };
}

export type BriefingTag = 'decision' | 'stale' | 'quickwin';
export type BranchType = 'deliver' | 'defer' | 'archive';

export interface BriefingArtifact {
  title: string;
  /** Emission target, e.g. "core/.handoff/". The repo is the leading path segment. */
  target: string;
  /** The bead id this delivery closes. */
  closes: string;
  /** Shared intent — what operator + agent agree is true (→ brief Context). */
  align: string;
  /** The imperative prompt to the agent (→ brief Goal). */
  task: string;
  /** Acceptance checklist (→ brief Acceptance criteria). */
  criteria: string[];
}

export interface BriefingBranch {
  key: string;
  label: string;
  recommended: boolean;
  type: BranchType;
  /** Present on `deliver` branches. */
  artifact?: BriefingArtifact;
  /** Terminal copy for `defer` / `archive` branches. */
  cta?: string;
  outcome?: string;
  doneText?: string;
}

export interface BriefingThread {
  id: string;
  tag: BriefingTag;
  title: string;
  /** The mono "why now" line. */
  whyNow: string;
  /** The assistant's pre-read summary of the bead. */
  catchUp: string;
  question: string;
  branches: BriefingBranch[];
}

export interface BriefingSnapshot {
  generatedAt: string;
  /** The repo this briefing is scoped to (F2, ADR-0012); undefined = global/unscoped. */
  repo?: string;
  threads: BriefingThread[];
  /** Honesty flag, like SynthSummary.source: 'llm' when the Chief of Staff generated it. */
  source: 'llm' | 'deterministic';
}

/**
 * Deterministic fallback (the always-present floor, like summarizeLane). Builds honest threads
 * from real lane data when the Chief-of-Staff LLM is unavailable or returns junk — every thread
 * points at a real bead, with a generic-but-true deliver artifact + a defer branch. No fabrication.
 */
export function briefingFallback(snapshot: CockpitSnapshot, generatedAt: string): BriefingSnapshot {
  // Most-stale available first (rot floats up), then pickup — the items most wanting a decision.
  const stale = snapshot.lanes.available
    .filter((i) => i.status === 'stale')
    .sort((a, b) => (b.staleDays ?? 0) - (a.staleDays ?? 0));
  const picks = [...stale, ...snapshot.lanes.pickup].slice(0, 4);

  const threads: BriefingThread[] = picks.map((item) => {
    const repo = item.repo ?? 'core';
    const isStale = item.status === 'stale';
    const why = isStale
      ? `${item.staleDays ?? '?'}d stale · ${repo}`
      : `pickup · ${repo}`;
    return {
      id: `fb-${item.nativeId}`,
      tag: isStale ? 'stale' : 'decision',
      title: item.title,
      whyNow: why,
      catchUp: `${item.title} is ${isStale ? `${item.staleDays ?? '?'} days stale` : 'open for pickup'} in ${repo}. (Deterministic brief — the local Chief-of-Staff model was unavailable, so this is read straight from the lane data.)`,
      question: `How do you want to move on "${truncate(item.title, 60)}"?`,
      branches: [
        {
          key: 'pickup',
          label: 'Pick it up now',
          recommended: true,
          type: 'deliver',
          artifact: {
            title: `Pick up: ${item.title}`,
            target: `${repo}/.handoff/`,
            closes: item.nativeId,
            align: `We agree this ${isStale ? 'stale ' : ''}item needs an owner. This brief hands it to a session with clear acceptance criteria.`,
            task: `Investigate and resolve "${item.title}" in ${repo}; either complete it or close it with a recorded rationale.`,
            criteria: [
              'Item investigated and a clear decision recorded (complete or close)',
              'If completed: change verified; if closed: one-line rationale on the bead',
            ],
          },
        },
        deferBranch(),
      ],
    };
  });

  return { generatedAt, threads, source: 'deterministic' };
}

const deferBranch = (): BriefingBranch => ({
  key: 'defer',
  label: 'Defer 7 days',
  recommended: false,
  type: 'defer',
  cta: 'Snooze 7 days',
  outcome: 'Snoozes the item 7 days and logs the deferral on the bead.',
  doneText: 'Snoozed 7 days — the bead resurfaces next week.',
});

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Repo name from an artifact target ("core/.handoff/" → "core"). */
export function artifactRepo(target: string): string {
  return target.replace(/\/?\.handoff\/?$/, '').replace(/\/+$/, '').trim();
}

/**
 * Map a Briefing artifact onto the handoff-brief candidate shape so it flows through the existing
 * validateBriefDraft → renderBriefMarkdown write path unchanged. `closes` is recorded as a ref.
 */
export function artifactToCandidate(artifact: BriefingArtifact, to = 'code-claude'): BriefCandidate {
  return {
    repo: artifactRepo(artifact.target),
    to,
    title: artifact.title,
    context: artifact.align,
    goal: artifact.task,
    acceptance: artifact.criteria,
    references: artifact.closes ? [`closes:${artifact.closes}`] : [],
    flagBack: 'Meet the acceptance criteria to close the bead; surface blockers rather than redefining scope.',
  };
}
