import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mysql from 'mysql2/promise';
import {
  deriveSliceState,
  parseFrontmatter,
  parseMovementLines,
  parseJsonColumn,
  type AdapterHealth,
  type DeliveryNorthstar,
  type DeliveryRoadmap,
  type DeliverySlice,
  type DeliverySnapshot,
  type Frontmatter,
  type FrontmatterItem,
  type Movement,
  type QueueProjection,
  type RoadmapPhase,
  type SliceFileStatus,
} from '@cockpit/shared';
import { config } from '../config.js';

/**
 * Delivery adapter (roadmap S5, read-only) — assembles the northstar→roadmap→queue
 * pipeline from three independent sources, each degrading gracefully into its own
 * health entry (same posture as the cockpit snapshot fan-out):
 *
 *   files     the northstar/roadmap registry (core/decisions/northstar/README.md
 *             frontmatter: `registry:` + `roadmaps:` lists) and each referenced file's
 *             constrained frontmatter
 *   movement  core/decisions/northstar/status.jsonl — the append-only odometer;
 *             absent file → empty feed, truthfully labeled
 *   queue     read-only Dolt query for compiled slice beads (labels.roadmap_ref)
 *
 * Only northstars that have a registered roadmap are surfaced — no roadmap means no
 * decomposed delivery plan yet, and this pane is about delivery. NEVER writes.
 */

const SLICE_FILE_STATUSES = new Set<SliceFileStatus>([
  'queued',
  'ready',
  'dispatched',
  'delivered',
  'merged',
  'dropped',
]);

/** Resolve a registry path (core-root-relative, ~-prefixed, or absolute) to an absolute path. */
// Mirrors core/scripts/lib/northstar-fm.mjs resolvePath @ 2026-07-02.
function resolvePath(p: string, coreRoot: string): string {
  if (p.startsWith('~')) return path.join(os.homedir(), p.slice(1).replace(/^\//, ''));
  if (path.isAbsolute(p)) return p;
  return path.resolve(coreRoot, p);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v !== '' ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function readFrontmatter(abs: string): Frontmatter | null {
  if (!existsSync(abs)) return null;
  return parseFrontmatter(readFileSync(abs, 'utf8'));
}

interface QueueRow {
  id: string;
  title: string;
  hook: string | null;
  labels: unknown;
}

/** Read-only Dolt query: compiled slice beads, keyed by their `rm:<slug>#S<n>` ref. */
async function fetchQueueProjections(
  now: Date,
): Promise<{ byRef: Map<string, QueueProjection>; health: AdapterHealth }> {
  const health: AdapterHealth = { name: 'delivery-queue', status: 'down', itemCount: 0 };
  let pool: mysql.Pool | undefined;
  try {
    pool = mysql.createPool({
      host: config.dolt.host,
      port: config.dolt.port,
      user: config.dolt.user,
      password: config.dolt.password,
      database: config.dolt.database,
      connectTimeout: config.dolt.connectTimeoutMs,
      connectionLimit: 1,
    });
    const [rows] = (await pool.query(
      `SELECT id, title, hook, labels FROM beads
        WHERE JSON_EXTRACT(labels, '$.roadmap_ref') IS NOT NULL`,
    )) as unknown as [QueueRow[], unknown];

    const byRef = new Map<string, QueueProjection>();
    for (const row of rows) {
      const labels = parseJsonColumn<Record<string, string>>(row.labels, {});
      const ref = labels['roadmap_ref'];
      if (!ref) continue;
      const queue = labels['queue'];
      const expiresAt = labels['expires_at'] ? Date.parse(labels['expires_at']) : NaN;
      let queueState: QueueProjection['queueState'];
      if (row.hook || queue === 'claimed') queueState = 'claimed';
      else if (queue === 'expired') queueState = 'expired';
      else if (queue === 'available') {
        queueState = Number.isFinite(expiresAt) && expiresAt < now.getTime() ? 'expired' : 'available';
      } else continue; // not a queue projection (e.g. incubating) — no state to merge
      byRef.set(ref, { beadId: row.id, queueState });
    }
    health.status = 'up';
    health.itemCount = byRef.size;
    health.note = `${rows.length} roadmap_ref beads scanned`;
    return { byRef, health };
  } catch (err) {
    health.lastError = err instanceof Error ? err.message : String(err);
    health.note = `Dolt unreachable at ${config.dolt.host}:${config.dolt.port}/${config.dolt.database}`;
    return { byRef: new Map(), health };
  } finally {
    await pool?.end().catch(() => {});
  }
}

/** Read status.jsonl — the movement odometer. Absent → empty feed, truthfully labeled. */
function readMovements(coreRoot: string): { movements: Movement[]; health: AdapterHealth } {
  const health: AdapterHealth = { name: 'delivery-movement', status: 'up', itemCount: 0 };
  const file = path.join(coreRoot, 'decisions', 'northstar', 'status.jsonl');
  try {
    if (!existsSync(file)) {
      health.note = 'status.jsonl does not exist yet — no movement recorded';
      return { movements: [], health };
    }
    const { movements, skipped } = parseMovementLines(readFileSync(file, 'utf8'));
    health.itemCount = movements.length;
    health.note = skipped
      ? `${movements.length} movements · ${skipped} malformed line(s) skipped`
      : `${movements.length} movements`;
    if (skipped) health.status = 'degraded';
    return { movements, health };
  } catch (err) {
    health.status = 'down';
    health.lastError = err instanceof Error ? err.message : String(err);
    return { movements: [], health };
  }
}

/** Load the registry + every registered northstar/roadmap file. */
function readFiles(
  coreRoot: string,
  queueByRef: Map<string, QueueProjection>,
): { northstars: DeliveryNorthstar[]; roadmaps: DeliveryRoadmap[]; health: AdapterHealth } {
  const health: AdapterHealth = { name: 'delivery-files', status: 'up', itemCount: 0 };
  const problems: string[] = [];
  const northstars: DeliveryNorthstar[] = [];
  const roadmaps: DeliveryRoadmap[] = [];
  try {
    const readme = path.join(coreRoot, 'decisions', 'northstar', 'README.md');
    const registryFm = readFrontmatter(readme);
    if (!registryFm) {
      health.status = 'down';
      health.lastError = `registry not found at ${readme}`;
      return { northstars, roadmaps, health };
    }
    const registry = (registryFm.registry as FrontmatterItem[] | undefined) ?? [];
    const roadmapRegistry = (registryFm.roadmaps as FrontmatterItem[] | undefined) ?? [];

    // Northstars index (registry order); only roadmap-backed ones are surfaced.
    const nsBySlug = new Map<string, FrontmatterItem>();
    for (const entry of registry) {
      const slug = str(entry.slug);
      if (slug) nsBySlug.set(slug, entry);
    }
    const surfacedNs = new Set<string>();

    for (const entry of roadmapRegistry) {
      const slug = str(entry.slug);
      const nsSlug = str(entry.northstar);
      const relPath = str(entry.path);
      if (!slug || !nsSlug || !relPath) {
        problems.push(`malformed roadmaps: entry (${JSON.stringify(entry)})`);
        continue;
      }
      const fm = readFrontmatter(resolvePath(relPath, coreRoot));
      if (!fm) {
        problems.push(`roadmap ${slug}: file missing at ${relPath}`);
        continue;
      }
      const phases: RoadmapPhase[] = ((fm.phases as FrontmatterItem[] | undefined) ?? []).flatMap(
        (p) => {
          const id = str(p.id);
          const name = str(p.name);
          return id && name ? [{ id, name, goal: str(p.goal) }] : [];
        },
      );
      const slices: DeliverySlice[] = [];
      for (const s of (fm.slices as FrontmatterItem[] | undefined) ?? []) {
        const id = str(s.id);
        const fileStatus = str(s.status) as SliceFileStatus | undefined;
        if (!id || !fileStatus || !SLICE_FILE_STATUSES.has(fileStatus)) {
          problems.push(`roadmap ${slug}: malformed slice ${String(s.id ?? '?')}`);
          continue;
        }
        const ref = `rm:${str(fm.slug) ?? slug}#${id}`;
        const queue = queueByRef.get(ref);
        const { state, drift } = deriveSliceState(fileStatus, queue);
        slices.push({
          id,
          ref,
          phase: str(s.phase) ?? '',
          title: str(s.title) ?? '',
          advances: str(s.advances) ?? '',
          moves_from: num(s.moves_from) ?? 0,
          moves_to: num(s.moves_to) ?? 0,
          autonomy: str(s.autonomy) ?? 'gate-0',
          status: state,
          fileStatus,
          queueState: queue?.queueState,
          beadId: queue?.beadId,
          drift,
          repo: str(s.repo),
          depends_on: str(s.depends_on),
        });
      }
      roadmaps.push({ slug, northstar: nsSlug, status: str(fm.status) ?? 'active', phases, slices });

      // Surface the roadmap's northstar (once) with its property gaps.
      if (!surfacedNs.has(nsSlug)) {
        surfacedNs.add(nsSlug);
        const nsEntry = nsBySlug.get(nsSlug);
        if (!nsEntry || !str(nsEntry.path)) {
          problems.push(`roadmap ${slug}: northstar ${nsSlug} not in registry`);
          continue;
        }
        const nsFm = readFrontmatter(resolvePath(str(nsEntry.path)!, coreRoot));
        if (!nsFm) {
          problems.push(`northstar ${nsSlug}: file missing at ${str(nsEntry.path)}`);
          continue;
        }
        const properties = ((nsFm.properties as FrontmatterItem[] | undefined) ?? []).flatMap(
          (p) => {
            const id = str(p.id);
            const name = str(p.name);
            return id && name
              ? [{ id, name, current: num(p.current) ?? 0, target: str(p.target) ?? '' }]
              : [];
          },
        );
        northstars.push({
          slug: nsSlug,
          tier: str(nsFm.tier) ?? str(nsEntry.tier) ?? '',
          app: str(nsFm.app) ?? str(nsEntry.app),
          properties,
        });
      }
    }

    health.itemCount = roadmaps.length;
    const withoutRoadmap = registry.length - surfacedNs.size;
    health.note =
      `${roadmaps.length} roadmap(s) · ${northstars.length} northstar(s) surfaced · ` +
      `${withoutRoadmap} registry northstar(s) without a roadmap` +
      (problems.length ? ` · ${problems.join(' · ')}` : '');
    if (problems.length) health.status = 'degraded';
    return { northstars, roadmaps, health };
  } catch (err) {
    health.status = 'down';
    health.lastError = err instanceof Error ? err.message : String(err);
    return { northstars, roadmaps, health };
  }
}

export async function buildDeliverySnapshot(now = new Date()): Promise<DeliverySnapshot> {
  const coreRoot = config.delivery.coreRoot;

  // Queue first (async); files merge its projections in. Each source degrades independently.
  const { byRef, health: queueHealth } = await fetchQueueProjections(now);
  const { northstars, roadmaps, health: filesHealth } = readFiles(coreRoot, byRef);
  const { movements, health: movementHealth } = readMovements(coreRoot);

  return {
    generatedAt: now.toISOString(),
    northstars,
    roadmaps,
    movements,
    health: { files: filesHealth, movement: movementHealth, queue: queueHealth },
  };
}
