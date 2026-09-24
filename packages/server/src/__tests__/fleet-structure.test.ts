import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { FleetAuthoredData } from '@cockpit/shared';
import { buildFleetStructureSnapshot } from '../adapters/fleet-structure.js';

/**
 * Fixture fleet: a fake core root (registry + one in-tree L2 + one reachable sibling app
 * with a roadmap + one registered app whose sibling checkout is ABSENT + a wayfinder dir)
 * and a fake vault root. The absent sibling is the S10 success criterion: its entry
 * degrades with a health note, the snapshot never does.
 */
let root: string;
let coreRoot: string;
let vaultRoot: string;

const AUTHORED: FleetAuthoredData = {
  census: {
    asOf: '2026-07-25',
    source: 'test-record',
    repos: ['present-app', 'absent-app', 'loose-repo', 'old-name'],
    aliases: { 'old-name': 'present-app' },
  },
  clusters: { 'present-app': 'platform', 'absent-app': 'platform', 'loose-repo': 'edge', 'l2-fleet': 'apex' },
  prose: { 'l1-present-app': { desc: 'the present one' }, 'loose-repo': { desc: 'unregistered' } },
  deferred: [],
  vaultLayers: [
    { slug: 'wiki-sources', label: 'sources', wikiDir: 'sources', desc: 'source pages' },
    { slug: 'wiki-ghosts', label: 'ghosts', wikiDir: 'ghosts', desc: 'missing dir counts 0' },
    { slug: 'raw', label: 'raw/', desc: 'uncounted layer' },
  ],
  wayfinderProse: { 'map-a': 'authored map prose' },
};

const REGISTRY = `---
registry:
  - slug: l2-fleet
    tier: L2
    path: decisions/northstar/l2-fleet.md
    ladders_up_to: null
  - slug: l1-present-app
    tier: L1
    app: present-app
    path: ../present-app/.claude/northstar.md
    ladders_up_to: l2-fleet
  - slug: l1-absent-app
    tier: L1
    app: absent-app
    path: ../absent-app/.claude/northstar.md
    ladders_up_to: l2-fleet
roadmaps:
  - slug: rm-l1-present-app
    northstar: l1-present-app
    path: ../present-app/.claude/roadmap.md
  - slug: rm-l1-absent-app
    northstar: l1-absent-app
    path: ../absent-app/.claude/roadmap.md
---
# Registry
`;

const NORTHSTAR = (slug: string) => `---
type: northstar
slug: ${slug}
tier: L1
status: active
ladders_up_to: l2-fleet
---
# ${slug}
`;

const ROADMAP = `---
type: roadmap
slug: rm-l1-present-app
northstar: l1-present-app
status: active
slices:
  - id: S1
    status: merged
  - id: S2
    status: ready
  - id: S3
    status: queued
---
# Roadmap
`;

const WAYFINDER_MAP = `---
type: wayfinder-map
slug: map-a
northstar: l2-fleet
tracker_issue: "#1"
status: working
---
# Map
`;

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'fleet-structure-'));
  coreRoot = path.join(root, 'core');
  vaultRoot = path.join(root, 'vault');

  await mkdir(path.join(coreRoot, 'decisions', 'northstar'), { recursive: true });
  await mkdir(path.join(coreRoot, 'decisions', 'wayfinder'), { recursive: true });
  await writeFile(path.join(coreRoot, 'decisions', 'northstar', 'README.md'), REGISTRY);
  await writeFile(
    path.join(coreRoot, 'decisions', 'northstar', 'l2-fleet.md'),
    `---\ntype: northstar\nslug: l2-fleet\ntier: L2\nstatus: active\n---\n`,
  );
  await writeFile(path.join(coreRoot, 'decisions', 'wayfinder', 'map-a.md'), WAYFINDER_MAP);
  await writeFile(path.join(coreRoot, 'decisions', 'wayfinder', 'README.md'), '# not a map\n');

  // present-app sibling checkout exists; absent-app deliberately does NOT.
  await mkdir(path.join(root, 'present-app', '.claude'), { recursive: true });
  await writeFile(
    path.join(root, 'present-app', '.claude', 'northstar.md'),
    NORTHSTAR('l1-present-app'),
  );
  await writeFile(path.join(root, 'present-app', '.claude', 'roadmap.md'), ROADMAP);

  await mkdir(path.join(vaultRoot, 'wiki', 'sources'), { recursive: true });
  await writeFile(path.join(vaultRoot, 'wiki', 'sources', 'a.md'), 'a');
  await writeFile(path.join(vaultRoot, 'wiki', 'sources', 'b.md'), 'b');
  await writeFile(path.join(vaultRoot, 'wiki', 'sources', 'not-a-page.txt'), 'x');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

function snapshot() {
  return buildFleetStructureSnapshot({
    coreRoot,
    vaultRoot,
    authored: AUTHORED,
    now: new Date('2026-08-08T12:00:00Z'),
  });
}

describe('buildFleetStructureSnapshot', () => {
  it('serves the full node/edge/stat payload from live files', () => {
    const snap = snapshot();
    expect(snap.generatedAt).toBe('2026-08-08T12:00:00.000Z');

    const present = snap.nodes.find((n) => n.slug === 'l1-present-app')!;
    expect(present.registered).toBe(true);
    expect(present.roadmap).toBe('rm-l1-present-app');
    expect(present.slices).toMatchObject({ merged: 1, ready: 1, queued: 1, total: 3 });
    expect(present.degraded).toBeUndefined();

    expect(snap.edges).toContainEqual(
      expect.objectContaining({ type: 'ladder', from: 'l1-present-app', to: 'l2-fleet' }),
    );
    expect(snap.edges).toContainEqual(
      expect.objectContaining({ type: 'wayfinder-feed', from: 'map-a', to: 'l2-fleet' }),
    );

    expect(snap.stats.northstars).toBe(3);
    expect(snap.stats.roadmaps).toBe(1); // only present-app's roadmap is on disk
    expect(snap.stats.slices.total).toBe(3);
    expect(snap.stats.wayfinderMaps).toBe(1);
    expect(snap.stats.vaultPages).toBe(2); // .md only — the .txt never counts
  });

  it('degrades an absent sibling checkout at the ENTRY with a health note, never the snapshot', () => {
    const snap = snapshot();
    const absent = snap.nodes.find((n) => n.slug === 'l1-absent-app')!;
    expect(absent.registered).toBe(true);
    expect(absent.degraded).toContain('sibling checkout absent');
    expect(absent.degraded).toContain('roadmap rm-l1-absent-app unreachable');
    expect(absent.slices).toBeUndefined();

    expect(snap.health.registry.status).toBe('degraded');
    expect(snap.health.registry.note).toContain('l1-absent-app (checkout absent)');
    expect(snap.health.roadmaps.status).toBe('degraded');
    // The snapshot itself still carries every other source.
    expect(snap.nodes.length).toBeGreaterThan(1);
    expect(snap.stats.vaultPages).toBe(2);
  });

  it('renders census/registry disagreement (TD-007) instead of hiding it', () => {
    const snap = snapshot();
    expect(snap.census.disagreement.renamed).toEqual([{ census: 'old-name', node: 'present-app' }]);
    expect(snap.census.disagreement.unregistered).toEqual(['loose-repo']);
    expect(snap.census.disagreement.registeredNotInCensus).toEqual([]);
    const loose = snap.nodes.find((n) => n.slug === 'loose-repo')!;
    expect(loose.registered).toBe(false);
    expect(loose.provenance.membership).toBe('derived');
  });

  it('parses wayfinder maps, skipping non-map files, and joins authored prose', () => {
    const snap = snapshot();
    expect(snap.wayfinder).toEqual([
      { slug: 'map-a', status: 'working', northstar: 'l2-fleet', trackerIssue: '#1', desc: 'authored map prose' },
    ]);
    expect(snap.health.wayfinder.note).toContain('1 non-map file(s) skipped');
  });

  it('counts vault layers live and degrades a missing layer dir to 0 with a note', () => {
    const snap = snapshot();
    const sources = snap.vault.find((l) => l.slug === 'wiki-sources')!;
    expect(sources.count).toBe(2);
    expect(sources.label).toBe('sources · 2');
    const ghosts = snap.vault.find((l) => l.slug === 'wiki-ghosts')!;
    expect(ghosts.count).toBe(0);
    const raw = snap.vault.find((l) => l.slug === 'raw')!;
    expect(raw.count).toBeUndefined();
    expect(snap.health.vault.status).toBe('degraded');
    expect(snap.health.vault.note).toContain('missing dir(s): ghosts');
  });

  it('degrades to a truthful empty registry when the core root is absent — never throws', () => {
    const snap = buildFleetStructureSnapshot({
      coreRoot: path.join(root, 'no-such-core'),
      vaultRoot,
      authored: AUTHORED,
    });
    expect(snap.health.registry.status).toBe('down');
    expect(snap.nodes.filter((n) => n.registered)).toEqual([]);
    // Census-derived nodes and vault counts still render — the deterministic floor.
    expect(snap.nodes.filter((n) => !n.registered).length).toBeGreaterThan(0);
    expect(snap.stats.vaultPages).toBe(2);
  });
});
