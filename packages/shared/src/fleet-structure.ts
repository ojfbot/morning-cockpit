/**
 * Fleet-structure read-model (roadmap S10, read-only) — the strategy layer the cockpit has
 * never seen: northstar ladder, roadmap slice states, wayfinder decision frontier, selfco
 * vault layers, and the registration gaps between the census and the registry (TD-007
 * rendered, never hidden).
 *
 * Pure pieces only (no fs/net): joins, tallies, edge derivation, disagreement computation.
 * The server adapter (packages/server/src/adapters/fleet-structure.ts) does the file reads
 * and calls these.
 *
 * Provenance discipline (RFI C17): every surfaced element declares how it was produced —
 *   derived   read live off disk this request (registry entries, slice tallies, vault counts)
 *   judgment  a human call that presentation needs but no file records (cluster assignment)
 *   authored  hand-written prose or a dated hand-made record (novice text, the census list)
 *
 * Membership discipline (RFI C18 / TD-007): registered membership joins to the REGISTRY,
 * never REPO_META; unregistered membership derives from census − registry at request time.
 * Authored annotations join by slug and NEVER create nodes — an annotation whose key matches
 * nothing is reported in health, not surfaced as a card (that would be hand list #5).
 */

import type { AdapterHealth } from './work-item.js';
import type { Frontmatter, FrontmatterItem } from './delivery.js';

export type Provenance = 'derived' | 'judgment' | 'authored';

// ── Slice tallies ───────────────────────────────────────────────────────────

/** Counts by roadmap-file `status:` — the same vocabulary delivery.ts validates. */
export interface SliceTally {
  ready: number;
  queued: number;
  dispatched: number;
  delivered: number;
  merged: number;
  dropped: number;
  total: number;
}

const TALLY_KEYS = ['ready', 'queued', 'dispatched', 'delivered', 'merged', 'dropped'] as const;

/** Tally slice `status:` values. Unknown statuses count toward total only (never invented). */
export function tallySlices(slices: FrontmatterItem[]): SliceTally {
  const tally: SliceTally = {
    ready: 0,
    queued: 0,
    dispatched: 0,
    delivered: 0,
    merged: 0,
    dropped: 0,
    total: 0,
  };
  for (const s of slices) {
    const status = typeof s.status === 'string' ? s.status : undefined;
    tally.total += 1;
    if (status && (TALLY_KEYS as readonly string[]).includes(status)) {
      tally[status as (typeof TALLY_KEYS)[number]] += 1;
    }
  }
  return tally;
}

export function addTallies(a: SliceTally, b: SliceTally): SliceTally {
  return {
    ready: a.ready + b.ready,
    queued: a.queued + b.queued,
    dispatched: a.dispatched + b.dispatched,
    delivered: a.delivered + b.delivered,
    merged: a.merged + b.merged,
    dropped: a.dropped + b.dropped,
    total: a.total + b.total,
  };
}

export const EMPTY_TALLY: SliceTally = {
  ready: 0,
  queued: 0,
  dispatched: 0,
  delivered: 0,
  merged: 0,
  dropped: 0,
  total: 0,
};

// ── Authored/judgment input (the ONLY non-derived layer; server data module) ─

/** The dated hand-made fleet census record (RFI C17: stale-capable, badge-worthy). */
export interface CensusRecord {
  /** When the census walk was recorded, e.g. "2026-07-25". */
  asOf: string;
  /** Where the record lives, for the provenance footer. */
  source: string;
  /** Repo names exactly as the census enumerated them. */
  repos: string[];
  /**
   * Census name → node slug it corresponds to today (renames, path-form names). A resolved
   * alias is reported as `renamed`/covered, never as fake disagreement.
   */
  aliases?: Record<string, string>;
}

/** A northstar declared (e.g. as a registry comment) whose file does not exist yet. */
export interface DeferredNorthstar {
  slug: string;
  tier: string;
  name: string;
  cluster: string;
  /** Where the file will live when it lands (probed live by the adapter). */
  path: string;
  ladder?: string;
}

export interface FleetAuthoredData {
  census: CensusRecord;
  /** Node name → cluster. JUDGMENT — no file records this. */
  clusters: Record<string, string>;
  /** Node slug/name → authored prose. Never creates nodes. */
  prose: Record<string, { desc?: string; novice?: string }>;
  /** Declared-but-deferred northstars; superseded the moment the slug appears in the registry. */
  deferred: DeferredNorthstar[];
  /** Vault layers: label + prose authored; `wikiDir` names a subdir whose live count is derived. */
  vaultLayers: Array<{ slug: string; label: string; wikiDir?: string; desc: string }>;
  /** Wayfinder map slug → authored one-line description. Never creates maps. */
  wayfinderProse: Record<string, string>;
}

// ── Loaded (adapter-side) intermediate shapes ───────────────────────────────

/** One registry entry with its northstar file as loaded (or honestly not) by the adapter. */
export interface LoadedNorthstar {
  entry: FrontmatterItem;
  fm: Frontmatter | null;
  missing: boolean;
  /** The repo root itself is absent from this vantage — a checkout gap, not a registry lie. */
  unreachable: boolean;
}

/** One roadmap-registry entry with its slice tally as loaded (or honestly not). */
export interface LoadedRoadmap {
  slug: string;
  northstar: string;
  fm: Frontmatter | null;
  tally: SliceTally | null;
  missing: boolean;
  unreachable: boolean;
}

// ── Output shapes ───────────────────────────────────────────────────────────

export interface NodeProvenance {
  membership: Provenance;
  cluster: Provenance | null;
  prose: Provenance | null;
  slices: Provenance | null;
}

export interface FleetNode {
  /** Registry slug for registered/deferred nodes; census repo name for unregistered. */
  slug: string;
  /** Display name: registry `app` (repo name) or slug. */
  name: string;
  registered: boolean;
  deferred?: boolean;
  tier?: string;
  /** null = census repo with no cluster judgment (residual). */
  cluster: string | null;
  ladder?: string | null;
  posture?: string;
  status?: string;
  path?: string;
  roadmap?: string;
  slices?: SliceTally;
  desc?: string;
  novice?: string;
  /**
   * Entry-level degradation note (missing file / absent sibling checkout). The NODE degrades;
   * the snapshot never does (S10 success criterion).
   */
  degraded?: string;
  provenance: NodeProvenance;
}

export type FleetEdgeType = 'ladder' | 'ladder-deferred' | 'orbit' | 'wayfinder-feed';

export interface FleetEdge {
  id: string;
  type: FleetEdgeType;
  /** Node slug (or wayfinder map slug for wayfinder-feed). */
  from: string;
  /** Target node slug; for `orbit` edges this is `cluster:<name>` (a gap marker, not a node). */
  to: string;
  dotted?: boolean;
  provenance: Provenance;
}

export interface WayfinderMapInfo {
  slug: string;
  status: string;
  northstar?: string;
  trackerIssue?: string;
  desc?: string;
}

export interface VaultLayerInfo {
  slug: string;
  label: string;
  /** Live file count for wiki layers; absent for non-counted layers. DERIVED. */
  count?: number;
  desc: string;
}

/** TD-007 rendered: where the census record and the live registry disagree. */
export interface CensusDisagreement {
  /** Registered apps the census never saw (post-date the record, or census gap). */
  registeredNotInCensus: string[];
  /** Census names resolved by alias to a registered/deferred node (e.g. renames). */
  renamed: Array<{ census: string; node: string }>;
  /** Census repos with no registry entry — the unregistered set, derived at request time. */
  unregistered: string[];
  /** Unregistered census repos with no cluster judgment either — the honest long tail. */
  residual: string[];
}

export interface FleetStats {
  northstars: number;
  roadmaps: number;
  slices: SliceTally;
  unregisteredPlaced: number;
  residual: number;
  wayfinderMaps: number;
  vaultPages: number;
  censusRepos: number;
  censusAsOf: string;
}

export interface FleetStructureSnapshot {
  generatedAt: string;
  nodes: FleetNode[];
  edges: FleetEdge[];
  wayfinder: WayfinderMapInfo[];
  vault: VaultLayerInfo[];
  stats: FleetStats;
  census: { record: CensusRecord; disagreement: CensusDisagreement };
  health: {
    registry: AdapterHealth;
    roadmaps: AdapterHealth;
    wayfinder: AdapterHealth;
    vault: AdapterHealth;
  };
}

// ── Builders (pure) ─────────────────────────────────────────────────────────

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function proseFor(
  authored: FleetAuthoredData,
  key: string,
): { desc?: string; novice?: string; provenance: Provenance | null } {
  const p = authored.prose[key];
  return p ? { ...p, provenance: 'authored' } : { provenance: null };
}

/**
 * Registered nodes from the registry join. A missing/unreachable northstar file keeps its
 * registry identity and gains a `degraded` note — the entry degrades, never the snapshot.
 */
export function buildRegisteredNodes(
  northstars: LoadedNorthstar[],
  roadmaps: LoadedRoadmap[],
  authored: FleetAuthoredData,
): FleetNode[] {
  const roadmapsByNs = new Map<string, LoadedRoadmap[]>();
  for (const rm of roadmaps) {
    const list = roadmapsByNs.get(rm.northstar) ?? [];
    list.push(rm);
    roadmapsByNs.set(rm.northstar, list);
  }

  const nodes: FleetNode[] = [];
  for (const ns of northstars) {
    const slug = str(ns.entry.slug);
    if (!slug) continue;
    const name = str(ns.entry.app) ?? slug;
    const prose = proseFor(authored, slug);
    const cluster = authored.clusters[name] ?? authored.clusters[slug] ?? null;

    let degraded: string | undefined;
    if (ns.unreachable) {
      degraded = `sibling checkout absent — ${str(ns.entry.path) ?? 'path unknown'} unreachable from this vantage`;
    } else if (ns.missing) {
      degraded = `northstar file missing at ${str(ns.entry.path) ?? '?'}`;
    }

    const nsRoadmaps = roadmapsByNs.get(slug) ?? [];
    let tally: SliceTally | undefined;
    let roadmapSlug: string | undefined;
    for (const rm of nsRoadmaps) {
      if (rm.tally) {
        tally = tally ? addTallies(tally, rm.tally) : rm.tally;
        roadmapSlug = roadmapSlug ?? rm.slug;
      } else {
        const note = `roadmap ${rm.slug} ${rm.unreachable ? 'unreachable (sibling checkout absent)' : 'file missing'}`;
        degraded = degraded ? `${degraded} · ${note}` : note;
      }
    }

    nodes.push({
      slug,
      name,
      registered: true,
      tier: str(ns.fm?.tier as unknown) ?? str(ns.entry.tier),
      cluster,
      ladder: str(ns.fm?.ladders_up_to as unknown) ?? str(ns.entry.ladders_up_to) ?? null,
      posture: str(ns.entry.posture),
      status: str(ns.fm?.status as unknown),
      path: str(ns.entry.path),
      roadmap: roadmapSlug,
      slices: tally,
      desc: prose.desc,
      novice: prose.novice,
      degraded,
      provenance: {
        membership: 'derived',
        cluster: cluster !== null ? 'judgment' : null,
        prose: prose.provenance,
        slices: tally ? 'derived' : null,
      },
    });
  }
  return nodes;
}

/**
 * Deferred nodes from the authored record. A deferred slug the registry now carries is
 * superseded — the registry wins, silently (the authored record just became stale).
 * `fileExists` is the adapter's live probe of the declared path.
 */
export function buildDeferredNodes(
  authored: FleetAuthoredData,
  registeredSlugs: Set<string>,
  fileExists: (path: string) => boolean,
): FleetNode[] {
  const nodes: FleetNode[] = [];
  for (const d of authored.deferred) {
    if (registeredSlugs.has(d.slug)) continue;
    const prose = proseFor(authored, d.slug);
    const exists = fileExists(d.path);
    nodes.push({
      slug: d.slug,
      name: d.name,
      registered: false,
      deferred: true,
      tier: d.tier,
      cluster: d.cluster,
      ladder: d.ladder ?? null,
      path: d.path,
      desc: prose.desc,
      novice: prose.novice,
      degraded: exists
        ? `file exists at ${d.path} but is not registered — registry is behind`
        : undefined,
      provenance: {
        membership: 'authored',
        cluster: 'judgment',
        prose: prose.provenance,
        slices: null,
      },
    });
  }
  return nodes;
}

/**
 * Unregistered nodes = census − registry, derived at request time (never a hand list).
 * Aliases resolve renames to their node before the subtraction; what remains splits into
 * placed (has a cluster judgment) and residual (no claim — cluster null).
 */
export function buildUnregisteredNodes(
  authored: FleetAuthoredData,
  registeredApps: Set<string>,
  coveredSlugs: Set<string>,
): { nodes: FleetNode[]; disagreement: CensusDisagreement } {
  const aliases = authored.census.aliases ?? {};
  const renamed: CensusDisagreement['renamed'] = [];
  const unregistered: string[] = [];
  const residual: string[] = [];
  const nodes: FleetNode[] = [];
  const censusCovered = new Set<string>();

  for (const name of authored.census.repos) {
    const alias = aliases[name];
    if (alias && (registeredApps.has(alias) || coveredSlugs.has(alias))) {
      renamed.push({ census: name, node: alias });
      censusCovered.add(alias);
      continue;
    }
    if (registeredApps.has(name)) {
      censusCovered.add(name);
      continue;
    }
    const cluster = authored.clusters[name] ?? null;
    const prose = proseFor(authored, name);
    unregistered.push(name);
    if (cluster === null) residual.push(name);
    nodes.push({
      slug: name,
      name,
      registered: false,
      cluster,
      desc: prose.desc,
      novice: prose.novice,
      provenance: {
        membership: 'derived',
        cluster: cluster !== null ? 'judgment' : null,
        prose: prose.provenance,
        slices: null,
      },
    });
  }

  const registeredNotInCensus = [...registeredApps].filter((app) => !censusCovered.has(app)).sort();
  return { nodes, disagreement: { registeredNotInCensus, renamed, unregistered, residual } };
}

/**
 * Semantic edges only — every edge here restates a fact some file records (or, for orbit
 * gap markers, a judgment the payload labels as such). View-level summary edges
 * (cluster-feed, vault-feed) are the renderer's to draw from node attributes.
 */
export function buildEdges(nodes: FleetNode[], wayfinder: WayfinderMapInfo[]): FleetEdge[] {
  const bySlug = new Map(nodes.map((n) => [n.slug, n]));
  const edges: FleetEdge[] = [];
  let seq = 0;
  const push = (e: Omit<FleetEdge, 'id'>) => edges.push({ id: `e${seq++}`, ...e });

  for (const n of nodes) {
    if (n.ladder) {
      const target = bySlug.get(n.ladder);
      if (target) {
        // A ladder touching a deferred node on EITHER end is intent, not enforceable fact —
        // the lint can't check a file that isn't there (prototype's l2-selfco edge).
        const deferred = Boolean(n.deferred || target.deferred);
        push({
          type: deferred ? 'ladder-deferred' : 'ladder',
          from: n.slug,
          to: n.ladder,
          ...(deferred ? { dotted: true } : {}),
          provenance: deferred ? 'authored' : 'derived',
        });
      }
      // ladder to a slug that is no node at all: dropped silently here; the registry lint
      // owns dangling-ladder errors — the read model does not duplicate the lint.
    }
    if (!n.registered && !n.deferred && n.cluster) {
      push({ type: 'orbit', from: n.slug, to: `cluster:${n.cluster}`, dotted: true, provenance: 'judgment' });
    }
  }
  for (const m of wayfinder) {
    if (m.northstar && bySlug.has(m.northstar)) {
      push({ type: 'wayfinder-feed', from: m.slug, to: m.northstar, dotted: true, provenance: 'derived' });
    }
  }
  return edges;
}

export function buildStats(
  nodes: FleetNode[],
  wayfinder: WayfinderMapInfo[],
  vault: VaultLayerInfo[],
  disagreement: CensusDisagreement,
  census: CensusRecord,
): FleetStats {
  const registered = nodes.filter((n) => n.registered);
  const slices = registered.reduce((acc, n) => (n.slices ? addTallies(acc, n.slices) : acc), EMPTY_TALLY);
  return {
    northstars: registered.length,
    roadmaps: registered.filter((n) => n.roadmap).length,
    slices,
    unregisteredPlaced: disagreement.unregistered.length - disagreement.residual.length,
    residual: disagreement.residual.length,
    wayfinderMaps: wayfinder.length,
    vaultPages: vault.reduce((acc, l) => acc + (l.count ?? 0), 0),
    censusRepos: census.repos.length,
    censusAsOf: census.asOf,
  };
}
