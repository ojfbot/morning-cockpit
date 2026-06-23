import { describe, it, expect } from 'vitest';
import {
  artifactRepo,
  artifactToCandidate,
  briefingFallback,
  validateBriefDraft,
  type BriefingArtifact,
  type CockpitSnapshot,
  type WorkItem,
} from '../index.js';

const ARTIFACT: BriefingArtifact = {
  title: 'Ship the first keep/discard fleet metric',
  target: 'core/.handoff/',
  closes: 'mc-brief-metric',
  align: 'We agree the first metric is the keystone.',
  task: 'Define one keep/discard signal and wire it into the lane classifier.',
  criteria: ['One metric chosen', 'Pure function + tests'],
};

describe('artifactRepo', () => {
  it('strips the .handoff suffix to the repo name', () => {
    expect(artifactRepo('core/.handoff/')).toBe('core');
    expect(artifactRepo('selfco-box/.handoff')).toBe('selfco-box');
    expect(artifactRepo('core')).toBe('core');
  });
});

describe('artifactToCandidate', () => {
  it('maps an artifact onto the handoff candidate shape and validates against known repos', () => {
    const cand = artifactToCandidate(ARTIFACT);
    expect(cand.repo).toBe('core');
    expect(cand.to).toBe('code-claude');
    expect(cand.context).toBe(ARTIFACT.align);
    expect(cand.goal).toBe(ARTIFACT.task);
    expect(cand.acceptance).toEqual(ARTIFACT.criteria);
    expect(cand.references).toEqual(['closes:mc-brief-metric']);
    expect(validateBriefDraft(cand, ['core', 'shell']).ok).toBe(true);
  });

  it('fails validation when the target repo does not exist', () => {
    const cand = artifactToCandidate({ ...ARTIFACT, target: 'selfco-box/.handoff/' });
    expect(validateBriefDraft(cand, ['core', 'shell']).ok).toBe(false);
  });
});

function workItem(over: Partial<WorkItem>): WorkItem {
  return {
    id: `dolt-bead:${over.nativeId ?? 'x'}`,
    nativeId: 'x',
    source: 'dolt-bead',
    kind: 'task',
    status: 'open',
    lane: 'available',
    title: 'Untitled',
    activityAt: '2026-06-01T00:00:00Z',
    detail: { kind: 'generic' },
    provenance: {},
    ...over,
  };
}

const SNAPSHOT = (): CockpitSnapshot => ({
  generatedAt: '2026-06-22T06:00:00Z',
  overnightSince: '2026-06-21T18:00:00Z',
  lanes: {
    overnight: [],
    pickup: [workItem({ nativeId: 'p1', lane: 'pickup', kind: 'brief', title: 'Pick up corpus', repo: 'core' })],
    available: [
      workItem({ nativeId: 'a1', status: 'stale', staleDays: 59, title: 'bead-emit tests', repo: 'core' }),
      workItem({ nativeId: 'a2', status: 'stale', staleDays: 30, title: 'commands cleanup', repo: 'shell' }),
    ],
  },
  health: [],
  summaries: {
    overnight: { source: 'deterministic', lane: 'overnight', headline: 'Quiet', bullets: [], action: 'none' },
    pickup: { source: 'deterministic', lane: 'pickup', headline: 'One brief', bullets: [], action: 'go' },
    available: { source: 'deterministic', lane: 'available', headline: 'Two stale', bullets: [], action: 'drain' },
  },
  meta: { totalItems: 3, skipped: 0 },
});

describe('briefingFallback', () => {
  it('builds honest threads from real lane data, most-stale first', () => {
    const fb = briefingFallback(SNAPSHOT(), '2026-06-22T06:00:00Z');
    expect(fb.source).toBe('deterministic');
    expect(fb.threads.length).toBe(3); // 2 stale + 1 pickup
    // most-stale available floats to the top
    expect(fb.threads[0]?.title).toBe('bead-emit tests');
    expect(fb.threads[0]?.tag).toBe('stale');
    // every thread has a recommended deliver branch pointing at the item's real repo + a defer
    const t0 = fb.threads[0]!;
    const deliver = t0.branches.find((b) => b.type === 'deliver');
    expect(deliver?.recommended).toBe(true);
    expect(deliver?.artifact?.target).toBe('core/.handoff/');
    expect(deliver?.artifact?.closes).toBe('a1');
    expect(t0.branches.some((b) => b.type === 'defer')).toBe(true);
  });
});
