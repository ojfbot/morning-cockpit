import { describe, it, expect } from 'vitest';
import {
  deriveDecidedInFlight,
  resolveDecidedInFlight,
  foldedChainFor,
  parseClosesRefs,
  type DecidedBead,
} from '../decided.js';

// The real operator-verified pair (2026-07-17), projected from the on-disk .handoff frontmatter:
// the northstar brief stayed live after Approve & emit wrote a successor closing it.
const PREDECESSOR: DecidedBead = {
  sourceRecordKey: 'alpha/predecessor.md',
  id: '20260628-2015-brief-northstar-control-surface',
  status: 'live',
  open: true,
  refs: [],
  createdAt: '2026-06-28T20:15:00.000Z',
};
const SUCCESSOR: DecidedBead = {
  sourceRecordKey: 'alpha/successor.md',
  id: '20260717-1717-brief-pick-up-evolve-morning-cockpit-s-northstar-from',
  status: 'live',
  open: true,
  refs: ['closes:20260628-2015-brief-northstar-control-surface'],
  createdAt: '2026-07-17T22:17:34.693Z',
};

describe('parseClosesRefs', () => {
  it('extracts closes: targets and ignores other kinds, blanks, and non-strings', () => {
    expect(
      parseClosesRefs(['closes:a-bead', 'supersedes:x', 'closes:', '  ', 'closes:another']),
    ).toEqual(['a-bead', 'another']);
  });

  it('is empty for undefined or empty refs', () => {
    expect(parseClosesRefs(undefined)).toEqual([]);
    expect(parseClosesRefs([])).toEqual([]);
  });
});

describe('deriveDecidedInFlight', () => {
  it('derives the real pair: the live predecessor folds under its open successor', () => {
    const decided = deriveDecidedInFlight([PREDECESSOR, SUCCESSOR]);
    expect(decided.size).toBe(1);
    expect(decided.get(PREDECESSOR.sourceRecordKey)).toBe(SUCCESSOR.sourceRecordKey);
  });

  it('a dangling closes: ref (target not in the scan) derives nothing — no phantom', () => {
    expect(deriveDecidedInFlight([SUCCESSOR]).size).toBe(0);
  });

  it('a closed successor ends the derivation — the predecessor reverts to normal', () => {
    const closedSuccessor: DecidedBead = { ...SUCCESSOR, open: false };
    expect(deriveDecidedInFlight([PREDECESSOR, closedSuccessor]).size).toBe(0);
  });

  it('a predecessor that is not live cannot derive decided-in-flight', () => {
    const donePredecessor: DecidedBead = { ...PREDECESSOR, status: 'done', open: false };
    expect(deriveDecidedInFlight([donePredecessor, SUCCESSOR]).size).toBe(0);
  });

  it('ignores self-references', () => {
    const selfCloser: DecidedBead = {
      sourceRecordKey: 'alpha/ouroboros.md',
      id: 'ouroboros',
      status: 'live',
      open: true,
      refs: ['closes:ouroboros'],
    };
    expect(deriveDecidedInFlight([selfCloser]).size).toBe(0);
  });

  it('two open successors closing the same bead → the latest created_at wins', () => {
    const earlier: DecidedBead = {
      sourceRecordKey: 'alpha/earlier.md',
      id: 'succ-earlier',
      status: 'live',
      open: true,
      refs: [`closes:${PREDECESSOR.id}`],
      createdAt: '2026-07-10T09:00:00.000Z',
    };
    const decided = deriveDecidedInFlight([PREDECESSOR, earlier, SUCCESSOR]);
    expect(decided.get(PREDECESSOR.sourceRecordKey)).toBe(SUCCESSOR.sourceRecordKey);
    // Order-independent: same winner when the later successor is scanned first.
    const reversed = deriveDecidedInFlight([SUCCESSOR, earlier, PREDECESSOR]);
    expect(reversed.get(PREDECESSOR.sourceRecordKey)).toBe(SUCCESSOR.sourceRecordKey);
  });

  it('derives every link of a transitive chain (the live 2026-07-17 triple)', () => {
    // The S8 delivery brief closes the pick-up brief, which closes the northstar brief:
    // both predecessors are decided-in-flight; only the newest brief surfaces.
    const s8Brief: DecidedBead = {
      sourceRecordKey: 'alpha/s8.md',
      id: '20260717-1755-brief-deliver-s8-decided-in-flight',
      status: 'live',
      open: true,
      refs: ['rm:rm-l1-morning-cockpit#S8', `closes:${SUCCESSOR.id}`],
      createdAt: '2026-07-17T22:55:00.000Z',
    };
    const decided = deriveDecidedInFlight([PREDECESSOR, SUCCESSOR, s8Brief]);
    expect(decided.get(PREDECESSOR.sourceRecordKey)).toBe(SUCCESSOR.sourceRecordKey);
    expect(decided.get(SUCCESSOR.sourceRecordKey)).toBe(s8Brief.sourceRecordKey);
  });

  it('non-closes ref kinds never derive', () => {
    const other: DecidedBead = {
      sourceRecordKey: 'alpha/referencer.md',
      id: 'referencer',
      status: 'live',
      open: true,
      refs: [`supersedes:${PREDECESSOR.id}`],
    };
    expect(deriveDecidedInFlight([PREDECESSOR, other]).size).toBe(0);
  });
});

describe('resolveDecidedInFlight diagnostics', () => {
  it('reports a self-reference as a relation cycle', () => {
    const result = resolveDecidedInFlight([{
      sourceRecordKey: 'alpha/self.md',
      id: 'self',
      status: 'live',
      open: true,
      refs: ['closes:self'],
      createdAt: '2026-10-10T09:00:00Z',
    }]);
    expect(result.decided.size).toBe(0);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ reason: 'relation-cycle', affectedSourceRecordKeys: ['alpha/self.md'] }),
    ]);
  });

  it('folds nothing when successor timestamps tie', () => {
    const first = { ...SUCCESSOR, sourceRecordKey: 'alpha/first.md', id: 'first' };
    const second = { ...SUCCESSOR, sourceRecordKey: 'alpha/second.md', id: 'second' };
    const result = resolveDecidedInFlight([PREDECESSOR, first, second]);
    expect(result.decided.size).toBe(0);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        reason: 'successor-order-unresolved',
        targetNativeId: PREDECESSOR.id,
        affectedSourceRecordKeys: ['alpha/first.md', 'alpha/predecessor.md', 'alpha/second.md'],
      }),
    ]);
  });

  it('reports every known record when a bare target matches multiple live observations', () => {
    const duplicate = { ...PREDECESSOR, sourceRecordKey: 'beta/predecessor.md' };
    const result = resolveDecidedInFlight([PREDECESSOR, duplicate, SUCCESSOR]);
    expect(result.decided.size).toBe(0);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        reason: 'target-matches-multiple-records',
        affectedSourceRecordKeys: ['alpha/predecessor.md', 'alpha/successor.md', 'beta/predecessor.md'],
      }),
    ]);
  });
});

describe('foldedChainFor', () => {
  it('returns the transitive folded stack, nearest link first', () => {
    const decided = new Map([
      [PREDECESSOR.sourceRecordKey, SUCCESSOR.sourceRecordKey],
      [SUCCESSOR.sourceRecordKey, 'deliver-s8'],
    ]);
    expect(foldedChainFor('deliver-s8', decided)).toEqual([SUCCESSOR.sourceRecordKey, PREDECESSOR.sourceRecordKey]);
  });

  it('is empty for an item that folds nothing', () => {
    const decided = new Map([[PREDECESSOR.sourceRecordKey, SUCCESSOR.sourceRecordKey]]);
    expect(foldedChainFor('unrelated', decided)).toEqual([]);
  });

  it('collects multiple direct predecessors deterministically (sorted within a depth)', () => {
    const decided = new Map([
      ['pred-b', 'succ'],
      ['pred-a', 'succ'],
    ]);
    expect(foldedChainFor('succ', decided)).toEqual(['pred-a', 'pred-b']);
  });

  it('survives a cycle without looping', () => {
    const decided = new Map([
      ['a', 'b'],
      ['b', 'a'],
    ]);
    expect(foldedChainFor('a', decided)).toEqual(['b']);
  });
});
