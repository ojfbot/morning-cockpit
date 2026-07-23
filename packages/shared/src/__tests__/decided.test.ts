import { describe, it, expect } from 'vitest';
import {
  deriveDecidedInFlight,
  foldedChainFor,
  parseClosesRefs,
  type DecidedBead,
} from '../decided.js';

// The real operator-verified pair (2026-07-17), projected from the on-disk .handoff frontmatter:
// the northstar brief stayed live after Approve & emit wrote a successor closing it.
const PREDECESSOR: DecidedBead = {
  id: '20260628-2015-brief-northstar-control-surface',
  status: 'live',
  open: true,
  refs: [],
  createdAt: '2026-06-28T20:15:00.000Z',
};
const SUCCESSOR: DecidedBead = {
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
    expect(decided.get(PREDECESSOR.id!)).toBe(SUCCESSOR.id);
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
      id: 'ouroboros',
      status: 'live',
      open: true,
      refs: ['closes:ouroboros'],
    };
    expect(deriveDecidedInFlight([selfCloser]).size).toBe(0);
  });

  it('two open successors closing the same bead → the latest created_at wins', () => {
    const earlier: DecidedBead = {
      id: 'succ-earlier',
      status: 'live',
      open: true,
      refs: [`closes:${PREDECESSOR.id}`],
      createdAt: '2026-07-10T09:00:00.000Z',
    };
    const decided = deriveDecidedInFlight([PREDECESSOR, earlier, SUCCESSOR]);
    expect(decided.get(PREDECESSOR.id!)).toBe(SUCCESSOR.id);
    // Order-independent: same winner when the later successor is scanned first.
    const reversed = deriveDecidedInFlight([SUCCESSOR, earlier, PREDECESSOR]);
    expect(reversed.get(PREDECESSOR.id!)).toBe(SUCCESSOR.id);
  });

  it('derives every link of a transitive chain (the live 2026-07-17 triple)', () => {
    // The S8 delivery brief closes the pick-up brief, which closes the northstar brief:
    // both predecessors are decided-in-flight; only the newest brief surfaces.
    const s8Brief: DecidedBead = {
      id: '20260717-1755-brief-deliver-s8-decided-in-flight',
      status: 'live',
      open: true,
      refs: ['rm:rm-l1-morning-cockpit#S8', `closes:${SUCCESSOR.id}`],
      createdAt: '2026-07-17T22:55:00.000Z',
    };
    const decided = deriveDecidedInFlight([PREDECESSOR, SUCCESSOR, s8Brief]);
    expect(decided.get(PREDECESSOR.id!)).toBe(SUCCESSOR.id);
    expect(decided.get(SUCCESSOR.id!)).toBe(s8Brief.id);
  });

  it('non-closes ref kinds never derive', () => {
    const other: DecidedBead = {
      id: 'referencer',
      status: 'live',
      open: true,
      refs: [`supersedes:${PREDECESSOR.id}`],
    };
    expect(deriveDecidedInFlight([PREDECESSOR, other]).size).toBe(0);
  });
});

describe('foldedChainFor', () => {
  it('returns the transitive folded stack, nearest link first', () => {
    const decided = new Map([
      [PREDECESSOR.id!, SUCCESSOR.id!],
      [SUCCESSOR.id!, 'deliver-s8'],
    ]);
    expect(foldedChainFor('deliver-s8', decided)).toEqual([SUCCESSOR.id, PREDECESSOR.id]);
  });

  it('is empty for an item that folds nothing', () => {
    const decided = new Map([[PREDECESSOR.id!, SUCCESSOR.id!]]);
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
