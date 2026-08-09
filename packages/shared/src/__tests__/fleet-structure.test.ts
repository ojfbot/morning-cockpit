import { describe, it, expect } from 'vitest';
import {
  buildDeferredNodes,
  buildEdges,
  buildRegisteredNodes,
  buildStats,
  buildUnregisteredNodes,
  tallySlices,
  EMPTY_TALLY,
  type FleetAuthoredData,
  type LoadedNorthstar,
  type LoadedRoadmap,
  type WayfinderMapInfo,
} from '../fleet-structure.js';

const AUTHORED: FleetAuthoredData = {
  census: {
    asOf: '2026-07-25',
    source: 'test-record',
    repos: ['core', 'alpha', 'old-name', '~/vault', 'stray'],
    aliases: { 'old-name': 'renamed-app', '~/vault': 'l2-vault' },
  },
  clusters: {
    core: 'platform',
    alpha: 'edge',
    'renamed-app': 'edge',
    'l2-fleet': 'apex',
    // 'stray' deliberately has no cluster → residual.
  },
  prose: {
    'l1-core': { desc: 'engine room', novice: 'novice text' },
    alpha: { desc: 'unregistered alpha' },
    'ghost-annotation': { desc: 'matches nothing — must never become a node' },
  },
  deferred: [
    {
      slug: 'l2-vault',
      tier: 'L2',
      name: 'vault venture',
      cluster: 'vault',
      path: '~/vault/northstar.md',
      ladder: 'l2-fleet',
    },
  ],
  vaultLayers: [
    { slug: 'wiki-sources', label: 'sources', wikiDir: 'sources', desc: 'source pages' },
    { slug: 'raw', label: 'raw/', desc: 'append-only' },
  ],
  wayfinderProse: { 'map-a': 'the a map' },
};

/** First element, asserted present — keeps noUncheckedIndexedAccess happy in one place. */
function one<T>(list: T[]): T {
  expect(list).toHaveLength(1);
  return list[0]!;
}

function ns(
  slug: string,
  extra: Partial<LoadedNorthstar> & { entry?: Record<string, unknown> } = {},
): LoadedNorthstar {
  const { entry, ...rest } = extra;
  return {
    entry: { slug, tier: 'L1', app: slug.replace(/^l1-/, ''), path: `../${slug}/x.md`, ladders_up_to: 'l2-fleet', ...entry } as LoadedNorthstar['entry'],
    fm: { slug, status: 'active' },
    missing: false,
    unreachable: false,
    ...rest,
  };
}

describe('tallySlices', () => {
  it('counts by status and totals unknown statuses without inventing buckets', () => {
    const tally = tallySlices([
      { id: 'S1', status: 'ready' },
      { id: 'S2', status: 'ready' },
      { id: 'S3', status: 'merged' },
      { id: 'S4', status: 'queued' },
      { id: 'S5', status: 'someday' }, // unknown — total only
      { id: 'S6' }, // absent — total only
    ]);
    expect(tally).toEqual({
      ready: 2,
      queued: 1,
      dispatched: 0,
      delivered: 0,
      merged: 1,
      dropped: 0,
      total: 6,
    });
  });
});

describe('buildRegisteredNodes', () => {
  it('joins registry + northstar + roadmap tally with per-field provenance', () => {
    const northstars = [ns('l1-core', { entry: { app: 'core' } })];
    const roadmaps: LoadedRoadmap[] = [
      {
        slug: 'rm-l1-core',
        northstar: 'l1-core',
        fm: {},
        tally: { ...EMPTY_TALLY, ready: 1, merged: 2, total: 3 },
        missing: false,
        unreachable: false,
      },
    ];
    const node = one(buildRegisteredNodes(northstars, roadmaps, AUTHORED));
    expect(node.slug).toBe('l1-core');
    expect(node.name).toBe('core');
    expect(node.registered).toBe(true);
    expect(node.cluster).toBe('platform');
    expect(node.roadmap).toBe('rm-l1-core');
    expect(node.slices?.merged).toBe(2);
    expect(node.desc).toBe('engine room');
    expect(node.provenance).toEqual({
      membership: 'derived',
      cluster: 'judgment',
      prose: 'authored',
      slices: 'derived',
    });
    expect(node.degraded).toBeUndefined();
  });

  it('degrades a missing northstar file at the ENTRY, keeping registry identity', () => {
    const node = one(buildRegisteredNodes([ns('l1-gone', { fm: null, missing: true })], [], AUTHORED));
    expect(node.slug).toBe('l1-gone');
    expect(node.registered).toBe(true);
    expect(node.degraded).toContain('northstar file missing');
  });

  it('degrades an absent sibling checkout distinctly (vantage, not a registry lie)', () => {
    const node = one(
      buildRegisteredNodes([ns('l1-away', { fm: null, missing: true, unreachable: true })], [], AUTHORED),
    );
    expect(node.degraded).toContain('sibling checkout absent');
  });

  it('folds a missing roadmap into the node note and sums multiple present roadmaps', () => {
    const roadmaps: LoadedRoadmap[] = [
      {
        slug: 'rm-a',
        northstar: 'l1-core',
        fm: {},
        tally: { ...EMPTY_TALLY, ready: 1, total: 1 },
        missing: false,
        unreachable: false,
      },
      { slug: 'rm-b', northstar: 'l1-core', fm: null, tally: null, missing: true, unreachable: false },
    ];
    const node = one(buildRegisteredNodes([ns('l1-core')], roadmaps, AUTHORED));
    expect(node.slices?.ready).toBe(1);
    expect(node.degraded).toContain('roadmap rm-b');
  });

  it('annotations that match no registry entry never create nodes', () => {
    const nodes = buildRegisteredNodes([ns('l1-core')], [], AUTHORED);
    expect(nodes.map((n) => n.slug)).toEqual(['l1-core']);
    expect(nodes.find((n) => n.slug === 'ghost-annotation')).toBeUndefined();
  });
});

describe('buildDeferredNodes', () => {
  it('keeps a deferred node with authored membership and flags an on-disk-but-unregistered file', () => {
    const node = one(buildDeferredNodes(AUTHORED, new Set(), () => true));
    expect(node.deferred).toBe(true);
    expect(node.provenance.membership).toBe('authored');
    expect(node.degraded).toContain('registry is behind');
  });

  it('is superseded the moment the registry carries the slug', () => {
    expect(buildDeferredNodes(AUTHORED, new Set(['l2-vault']), () => false)).toEqual([]);
  });
});

describe('buildUnregisteredNodes (census − registry, TD-007 rendered)', () => {
  const registeredApps = new Set(['core', 'renamed-app', 'post-census-app']);
  const deferredSlugs = new Set(['l2-vault']);

  it('derives unregistered membership and splits placed vs residual', () => {
    const { nodes, disagreement } = buildUnregisteredNodes(AUTHORED, registeredApps, deferredSlugs);
    expect(nodes.map((n) => n.slug)).toEqual(['alpha', 'stray']);
    expect(disagreement.unregistered).toEqual(['alpha', 'stray']);
    expect(disagreement.residual).toEqual(['stray']); // no cluster judgment → honest long tail
    const alpha = nodes.find((n) => n.slug === 'alpha')!;
    expect(alpha.cluster).toBe('edge');
    expect(alpha.provenance).toEqual({
      membership: 'derived',
      cluster: 'judgment',
      prose: 'authored',
      slices: null,
    });
  });

  it('resolves aliases as renames/coverage, never fake disagreement', () => {
    const { disagreement } = buildUnregisteredNodes(AUTHORED, registeredApps, deferredSlugs);
    expect(disagreement.renamed).toEqual([
      { census: 'old-name', node: 'renamed-app' },
      { census: '~/vault', node: 'l2-vault' },
    ]);
  });

  it('reports registered apps the census never saw', () => {
    const { disagreement } = buildUnregisteredNodes(AUTHORED, registeredApps, deferredSlugs);
    expect(disagreement.registeredNotInCensus).toEqual(['post-census-app']);
  });
});

describe('buildEdges', () => {
  const wayfinder: WayfinderMapInfo[] = [
    { slug: 'map-a', status: 'working', northstar: 'l2-fleet' },
    { slug: 'map-orphan', status: 'charting', northstar: 'ns-not-a-node' },
  ];

  it('emits ladder, ladder-deferred, orbit, and wayfinder-feed edges with provenance', () => {
    const nodes = [
      ...buildRegisteredNodes(
        [ns('l2-fleet', { entry: { tier: 'L2', app: null, ladders_up_to: 'l2-vault' } }), ns('l1-core')],
        [],
        AUTHORED,
      ),
      ...buildDeferredNodes(AUTHORED, new Set(), () => false),
      ...buildUnregisteredNodes(AUTHORED, new Set(['core']), new Set(['l2-vault'])).nodes,
    ];
    const edges = buildEdges(nodes, wayfinder);
    const byType = (t: string) => edges.filter((e) => e.type === t);

    expect(byType('ladder')).toEqual([
      expect.objectContaining({ from: 'l1-core', to: 'l2-fleet', provenance: 'derived' }),
    ]);
    // Deferred on EITHER end → intent, not enforceable fact: dotted ladder-deferred.
    expect(byType('ladder-deferred')).toEqual([
      expect.objectContaining({ from: 'l2-fleet', to: 'l2-vault', dotted: true }),
      expect.objectContaining({ from: 'l2-vault', to: 'l2-fleet', dotted: true, provenance: 'authored' }),
    ]);
    // orbit only for cluster-placed unregistered nodes; residual (stray) gets none.
    expect(byType('orbit')).toEqual([
      expect.objectContaining({ from: 'alpha', to: 'cluster:edge', provenance: 'judgment' }),
    ]);
    // wayfinder-feed only when the target northstar is a real node.
    expect(byType('wayfinder-feed')).toEqual([
      expect.objectContaining({ from: 'map-a', to: 'l2-fleet' }),
    ]);
  });
});

describe('buildStats', () => {
  it('rolls up counts from the payload, never from literals', () => {
    const registered = buildRegisteredNodes(
      [ns('l1-core')],
      [
        {
          slug: 'rm-l1-core',
          northstar: 'l1-core',
          fm: {},
          tally: { ...EMPTY_TALLY, ready: 2, queued: 3, total: 5 },
          missing: false,
          unreachable: false,
        },
      ],
      AUTHORED,
    );
    const { nodes: unreg, disagreement } = buildUnregisteredNodes(
      AUTHORED,
      new Set(['core']),
      new Set(['l2-vault']),
    );
    const stats = buildStats(
      [...registered, ...unreg],
      [{ slug: 'map-a', status: 'working' }],
      [
        { slug: 'wiki-sources', label: 'sources · 4', count: 4, desc: 'x' },
        { slug: 'raw', label: 'raw/', desc: 'y' },
      ],
      disagreement,
      AUTHORED.census,
    );
    expect(stats).toEqual({
      northstars: 1,
      roadmaps: 1,
      slices: { ...EMPTY_TALLY, ready: 2, queued: 3, total: 5 },
      // old-name's alias resolves to nothing here (renamed-app is not registered in this
      // fixture), so it correctly stays a census repo: unregistered + residual.
      unregisteredPlaced: 1,
      residual: 2,
      wayfinderMaps: 1,
      vaultPages: 4,
      censusRepos: 5,
      censusAsOf: '2026-07-25',
    });
  });
});
