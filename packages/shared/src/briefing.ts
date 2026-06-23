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
  threads: BriefingThread[];
  /** Honesty flag, like SynthSummary.source: 'llm' when the Chief of Staff generated it. */
  source: 'llm' | 'deterministic';
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
