import { existsSync, readFileSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildDeferredNodes,
  buildEdges,
  buildRegisteredNodes,
  buildStats,
  buildUnregisteredNodes,
  parseFrontmatter,
  tallySlices,
  type AdapterHealth,
  type FleetAuthoredData,
  type FleetStructureSnapshot,
  type Frontmatter,
  type FrontmatterItem,
  type LoadedNorthstar,
  type LoadedRoadmap,
  type WayfinderMapInfo,
  type VaultLayerInfo,
} from '@cockpit/shared';
import { config } from '../config.js';
import { FLEET_AUTHORED } from '../fleet-authored.js';

/**
 * Fleet-structure adapter (roadmap S10, read-only) — assembles the strategy layer from four
 * independent local-file sources, each degrading gracefully into its own health entry
 * (RFI A9/C15: every source is a local file read; no gh, no network, no write path):
 *
 *   registry   core/decisions/northstar/README.md frontmatter (`registry:` + `roadmaps:`)
 *              and every referenced northstar file — across sibling repos via the
 *              registry's ../<app>/ paths
 *   roadmaps   each registered roadmap file's `slices:` list, tallied by `status:`
 *   wayfinder  core/decisions/wayfinder/*.md frontmatter — the decision frontier
 *   vault      ~/selfco/wiki/{sources,entities,concepts,synthesis} live file counts
 *              (precedent: adapters/loop.ts crossing into ~/selfco)
 *
 * A missing sibling repo degrades THAT entry with a health note, never the snapshot.
 * Served by /api/fleet-structure (REST beside the aggregate — not the G1 facade, RFI C16).
 * NEVER writes.
 */

// Mirrors core/scripts/lib/northstar-fm.mjs resolvePath @ 2026-08-08 (ADR-0001 posture:
// mirror, never import across repos; delivery.ts carries the same mirror).
function resolvePath(p: string, coreRoot: string): string {
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1).replace(/^\//, ''));
  if (path.isAbsolute(p)) return p;
  return path.resolve(coreRoot, p);
}

// Mirrors core/scripts/lib/northstar-fm.mjs repoRootOf @ 2026-08-08: the repo root a
// registry path lives in, so an absent sibling CHECKOUT (vantage problem) reads
// differently from a repo that is present but missing the file.
function repoRootOf(p: string, coreRoot: string): string {
  if (p.startsWith('~')) {
    const seg = p.slice(1).replace(/^\//, '').split('/')[0];
    return seg ? path.join(os.homedir(), seg) : os.homedir();
  }
  if (path.isAbsolute(p)) return path.dirname(p);
  const parts = path.normalize(p).split(path.sep);
  if (parts[0] === '..' && parts[1]) return path.resolve(coreRoot, parts[0], parts[1]);
  return coreRoot;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function readFm(abs: string): Frontmatter | null {
  if (!existsSync(abs)) return null;
  return parseFrontmatter(readFileSync(abs, 'utf8'));
}

interface RegistryRead {
  northstars: LoadedNorthstar[];
  roadmaps: LoadedRoadmap[];
  registryHealth: AdapterHealth;
  roadmapsHealth: AdapterHealth;
}

/** Load the registry + every registered northstar/roadmap file, entry-level degradation. */
function readRegistry(coreRoot: string): RegistryRead {
  const registryHealth: AdapterHealth = { name: 'fleet-structure-registry', status: 'up', itemCount: 0 };
  const roadmapsHealth: AdapterHealth = { name: 'fleet-structure-roadmaps', status: 'up', itemCount: 0 };
  const northstars: LoadedNorthstar[] = [];
  const roadmaps: LoadedRoadmap[] = [];
  try {
    const readme = path.join(coreRoot, 'decisions', 'northstar', 'README.md');
    const fm = readFm(readme);
    if (!fm) {
      registryHealth.status = 'down';
      registryHealth.lastError = `registry not found at ${readme}`;
      roadmapsHealth.status = 'down';
      roadmapsHealth.lastError = registryHealth.lastError;
      return { northstars, roadmaps, registryHealth, roadmapsHealth };
    }

    const degradedNs: string[] = [];
    for (const entry of (fm.registry as FrontmatterItem[] | undefined) ?? []) {
      const relPath = str(entry.path);
      if (!str(entry.slug) || !relPath) continue;
      const abs = resolvePath(relPath, coreRoot);
      const missing = !existsSync(abs);
      const unreachable = missing && !existsSync(repoRootOf(relPath, coreRoot));
      if (missing) degradedNs.push(`${str(entry.slug)}${unreachable ? ' (checkout absent)' : ''}`);
      northstars.push({ entry, fm: missing ? null : readFm(abs), missing, unreachable });
    }
    registryHealth.itemCount = northstars.length;
    registryHealth.note =
      `${northstars.length} registered northstar(s)` +
      (degradedNs.length ? ` · degraded: ${degradedNs.join(', ')}` : '');
    if (degradedNs.length) registryHealth.status = 'degraded';

    const degradedRm: string[] = [];
    for (const entry of (fm.roadmaps as FrontmatterItem[] | undefined) ?? []) {
      const slug = str(entry.slug);
      const northstar = str(entry.northstar);
      const relPath = str(entry.path);
      if (!slug || !northstar || !relPath) continue;
      const abs = resolvePath(relPath, coreRoot);
      const missing = !existsSync(abs);
      const unreachable = missing && !existsSync(repoRootOf(relPath, coreRoot));
      const rmFm = missing ? null : readFm(abs);
      const slices = (rmFm?.slices as FrontmatterItem[] | undefined) ?? [];
      if (missing) degradedRm.push(`${slug}${unreachable ? ' (checkout absent)' : ''}`);
      roadmaps.push({
        slug,
        northstar,
        fm: rmFm,
        tally: rmFm ? tallySlices(slices) : null,
        missing,
        unreachable,
      });
    }
    roadmapsHealth.itemCount = roadmaps.length;
    roadmapsHealth.note =
      `${roadmaps.length} registered roadmap(s)` +
      (degradedRm.length ? ` · degraded: ${degradedRm.join(', ')}` : '');
    if (degradedRm.length) roadmapsHealth.status = 'degraded';

    return { northstars, roadmaps, registryHealth, roadmapsHealth };
  } catch (err) {
    registryHealth.status = 'down';
    registryHealth.lastError = err instanceof Error ? err.message : String(err);
    roadmapsHealth.status = 'down';
    roadmapsHealth.lastError = registryHealth.lastError;
    return { northstars, roadmaps, registryHealth, roadmapsHealth };
  }
}

/** Wayfinder frontier: every decisions/wayfinder/*.md with wayfinder-map frontmatter. */
function readWayfinder(
  coreRoot: string,
  authored: FleetAuthoredData,
): { maps: WayfinderMapInfo[]; health: AdapterHealth } {
  const health: AdapterHealth = { name: 'fleet-structure-wayfinder', status: 'up', itemCount: 0 };
  const maps: WayfinderMapInfo[] = [];
  const dir = path.join(coreRoot, 'decisions', 'wayfinder');
  try {
    if (!existsSync(dir)) {
      health.note = `no wayfinder directory at ${dir}`;
      return { maps, health };
    }
    let skipped = 0;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
      const fm = readFm(path.join(dir, file));
      const slug = str(fm?.slug as unknown);
      const status = str(fm?.status as unknown);
      if (str(fm?.type as unknown) !== 'wayfinder-map' || !slug || !status) {
        skipped += 1; // README or a non-map doc — not an error, just not a map
        continue;
      }
      maps.push({
        slug,
        status,
        northstar: str(fm?.northstar as unknown),
        trackerIssue: str(fm?.tracker_issue as unknown),
        desc: authored.wayfinderProse[slug],
      });
    }
    health.itemCount = maps.length;
    health.note = `${maps.length} map(s)` + (skipped ? ` · ${skipped} non-map file(s) skipped` : '');
    return { maps, health };
  } catch (err) {
    health.status = 'down';
    health.lastError = err instanceof Error ? err.message : String(err);
    return { maps, health };
  }
}

/** Live wiki-layer counts. A missing layer dir counts 0 with a note — never a throw. */
function readVault(
  vaultRoot: string,
  authored: FleetAuthoredData,
): { layers: VaultLayerInfo[]; health: AdapterHealth } {
  const health: AdapterHealth = { name: 'fleet-structure-vault', status: 'up', itemCount: 0 };
  const layers: VaultLayerInfo[] = [];
  const missing: string[] = [];
  try {
    for (const layer of authored.vaultLayers) {
      if (!layer.wikiDir) {
        layers.push({ slug: layer.slug, label: layer.label, desc: layer.desc });
        continue;
      }
      const dir = path.join(vaultRoot, 'wiki', layer.wikiDir);
      let count = 0;
      if (existsSync(dir)) {
        count = readdirSync(dir).filter((f) => f.endsWith('.md')).length;
      } else {
        missing.push(layer.wikiDir);
      }
      layers.push({ slug: layer.slug, label: `${layer.label} · ${count}`, count, desc: layer.desc });
    }
    health.itemCount = layers.reduce((acc, l) => acc + (l.count ?? 0), 0);
    health.note =
      `${health.itemCount} wiki page(s) across ${authored.vaultLayers.filter((l) => l.wikiDir).length} layer(s)` +
      (missing.length ? ` · missing dir(s): ${missing.join(', ')}` : '');
    if (missing.length) health.status = 'degraded';
    return { layers, health };
  } catch (err) {
    health.status = 'down';
    health.lastError = err instanceof Error ? err.message : String(err);
    return { layers, health };
  }
}

export interface FleetStructureOptions {
  coreRoot?: string;
  vaultRoot?: string;
  authored?: FleetAuthoredData;
  now?: Date;
}

export function buildFleetStructureSnapshot(opts: FleetStructureOptions = {}): FleetStructureSnapshot {
  const coreRoot = opts.coreRoot ?? config.delivery.coreRoot;
  const vaultRoot = opts.vaultRoot ?? config.profile.vaultRoot;
  const authored = opts.authored ?? FLEET_AUTHORED;
  const now = opts.now ?? new Date();

  const { northstars, roadmaps, registryHealth, roadmapsHealth } = readRegistry(coreRoot);
  const { maps, health: wayfinderHealth } = readWayfinder(coreRoot, authored);
  const { layers, health: vaultHealth } = readVault(vaultRoot, authored);

  const registeredNodes = buildRegisteredNodes(northstars, roadmaps, authored);
  const registeredSlugs = new Set(registeredNodes.map((n) => n.slug));
  const deferredNodes = buildDeferredNodes(authored, registeredSlugs, (p) =>
    existsSync(resolvePath(p, coreRoot)),
  );
  const { nodes: unregisteredNodes, disagreement } = buildUnregisteredNodes(
    authored,
    appNames(registeredNodes),
    new Set(deferredNodes.map((n) => n.slug)),
  );

  const nodes = [...registeredNodes, ...deferredNodes, ...unregisteredNodes];
  const edges = buildEdges(nodes, maps);
  const stats = buildStats(nodes, maps, layers, disagreement, authored.census);

  return {
    generatedAt: now.toISOString(),
    nodes,
    edges,
    wayfinder: maps,
    vault: layers,
    stats,
    census: { record: authored.census, disagreement },
    health: {
      registry: registryHealth,
      roadmaps: roadmapsHealth,
      wayfinder: wayfinderHealth,
      vault: vaultHealth,
    },
  };
}

/** Repo names the registry claims: entries that carry `app:` (the census-joinable set). */
function appNames(registered: Array<{ slug: string; name: string }>): Set<string> {
  return new Set(registered.filter((n) => n.name !== n.slug).map((n) => n.name));
}
