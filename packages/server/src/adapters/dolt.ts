import mysql from 'mysql2/promise';
import {
  beadPrefix,
  classifyLane,
  deriveAgentLiveness,
  parseJsonColumn,
  type AdapterHealth,
  type AgentLiveness,
  type ConvoySlot,
  type LaneContext,
  type LaneInput,
  type WorkItem,
  type WorkItemKind,
  type WorkItemStatus,
} from '@cockpit/shared';
import { config } from '../config.js';

/**
 * Read-only adapter over the Dolt bead store. NEVER writes (no DOLT_COMMIT).
 *
 * "Overnight" is timestamp-driven: a bead surfaces there if it is running, finished in the
 * window, or has a bead_events row in the window. We still do NOT trust agent_status (it reads
 * permanently 'active'); instead agent liveness is DERIVED from agent-* bead_events keyed by
 * actor (S2): agents classified `live` are emitted as Overnight lane items, idle/dark agents are
 * tallied in the health note. This supersedes the old "all agents hidden" behaviour (ADR-0008).
 */

interface BeadRow {
  id: string;
  type: string;
  status: string;
  title: string;
  labels: unknown;
  actor: string;
  hook: string | null;
  refs: unknown;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

interface EventRow {
  bead_id: string | null;
  timestamp: string;
}

interface AgentEventRow {
  event_type: string;
  actor: string | null;
  timestamp: string;
}

const EMITTED_KINDS = new Set(['convoy', 'task', 'pr', 'session']);

/** Liveness lookback — wide enough that an agent's most-recent agent-* event is found; older ⇒ dark. */
const LIVENESS_LOOKBACK_MS = 30 * 86_400_000;

function toIso(v: string | Date | null | undefined): string | undefined {
  if (!v) return undefined;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function normalizeStatus(type: string, status: string, hook: string | null, convoyStatus?: string): WorkItemStatus {
  if (type === 'convoy') {
    if (convoyStatus === 'active') return 'running';
    if (convoyStatus === 'completed') return 'done';
    if (convoyStatus === 'failed') return 'failed';
    return 'open'; // forming
  }
  if (type === 'session') return status === 'closed' ? 'done' : 'running';
  if (type === 'task') {
    if (status === 'closed') return 'done';
    return hook ? 'running' : 'open'; // hooked = claimed/in-flight
  }
  if (type === 'pr') return status === 'closed' ? 'done' : 'open';
  return 'unknown';
}

export async function fetchDolt(ctx: LaneContext): Promise<{ items: WorkItem[]; health: AdapterHealth }> {
  const health: AdapterHealth = { name: 'dolt-bead', status: 'down', itemCount: 0 };
  let pool: mysql.Pool | undefined;
  try {
    pool = mysql.createPool({
      host: config.dolt.host,
      port: config.dolt.port,
      user: config.dolt.user,
      password: config.dolt.password,
      database: config.dolt.database,
      connectTimeout: config.dolt.connectTimeoutMs,
      connectionLimit: 2,
    });

    const since = ctx.overnightSince.slice(0, 19).replace('T', ' '); // DATETIME literal

    const [beadRows] = (await pool.query(
      `SELECT id, type, status, title, labels, actor, hook, refs, created_at, updated_at, closed_at
         FROM beads
        WHERE status IN ('created', 'live')
           OR updated_at >= ?
           OR closed_at >= ?`,
      [since, since],
    )) as unknown as [BeadRow[], unknown];

    const [eventRows] = (await pool.query(
      `SELECT bead_id, timestamp FROM bead_events WHERE timestamp >= ? ORDER BY timestamp DESC`,
      [since],
    )) as unknown as [EventRow[], unknown];

    // Agent-* events over a wide window — the input to derived liveness (S2). actor = agent id.
    const livenessSince = new Date(ctx.now.getTime() - LIVENESS_LOOKBACK_MS)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    const [agentEventRows] = (await pool.query(
      `SELECT event_type, actor, timestamp FROM bead_events
        WHERE event_type LIKE 'agent-%' AND timestamp >= ? ORDER BY timestamp DESC`,
      [livenessSince],
    )) as unknown as [AgentEventRow[], unknown];

    // Most-recent overnight event timestamp per bead — promotes a bead into the overnight lane.
    const eventActivity = new Map<string, string>();
    for (const e of eventRows) {
      if (e.bead_id && !eventActivity.has(e.bead_id)) {
        const iso = toIso(e.timestamp);
        if (iso) eventActivity.set(e.bead_id, iso);
      }
    }

    const items: WorkItem[] = [];
    const agentRows: BeadRow[] = [];
    let staleRunningHidden = 0;

    for (const row of beadRows) {
      if (row.type === 'agent') {
        agentRows.push(row); // liveness derived after the loop (S2), not trusted from agent_status
        continue;
      }
      if (!EMITTED_KINDS.has(row.type)) continue;

      const labels = parseJsonColumn<Record<string, string>>(row.labels, {});
      const refs = parseJsonColumn<string[]>(row.refs, []);
      const convoyStatus = labels['convoy_status'];
      const status = normalizeStatus(row.type, row.status, row.hook, convoyStatus);

      const eventAt = eventActivity.get(row.id);
      const activityAt =
        eventAt ??
        toIso(row.closed_at) ??
        toIso(row.updated_at) ??
        toIso(row.created_at) ??
        ctx.now.toISOString();

      const kind = row.type as WorkItemKind;
      const input: LaneInput = {
        source: 'dolt-bead',
        kind,
        status,
        activityAt,
        hookAssigned: !!row.hook,
      };
      const lane = classifyLane(input, ctx);
      if (!lane) {
        // A "live" bead claiming running but last touched before the window — not trusted.
        if (status === 'running') staleRunningHidden++;
        continue;
      }

      let detail: WorkItem['detail'] = { kind: 'generic' };
      if (row.type === 'convoy') {
        const slots = parseJsonColumn<ConvoySlot[]>(labels['slots'], []);
        const counts = { pending: 0, active: 0, done: 0, failed: 0 };
        for (const s of slots) counts[s.status] = (counts[s.status] ?? 0) + 1;
        const total = slots.length;
        detail = {
          kind: 'convoy',
          convoyStatus: convoyStatus ?? row.status,
          total,
          done: counts.done,
          active: counts.active,
          pending: counts.pending,
          failed: counts.failed,
          pct: total ? Math.round((counts.done / total) * 100) : 0,
        };
      }

      items.push({
        id: `dolt-bead:${row.id}`,
        nativeId: row.id,
        source: 'dolt-bead',
        kind,
        status,
        lane,
        title: row.title,
        repo: labels['app'] ?? labels['repo'] ?? beadPrefix(row.id),
        actor: row.actor,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
        closedAt: toIso(row.closed_at),
        activityAt,
        // Real unassigned-queue item (ADR-0002/S3) — deliberately posted, vs synthesized Available.
        posted: labels['queue'] === 'available',
        url: `#bead/${row.id}`,
        detail,
        provenance: { labels, refs },
      });
    }

    // ── Agent liveness (S2): live/idle/dark derived from agent-* events, keyed by actor ──
    const agentEvents = agentEventRows.map((e) => ({
      event_type: e.event_type,
      actor: e.actor,
      bead_id: e.actor,
      summary: null,
      timestamp: toIso(e.timestamp) ?? ctx.now.toISOString(),
    }));
    const derived = new Map<string, AgentLiveness>(
      deriveAgentLiveness(agentEvents, ctx.now.getTime()).map((a) => [a.agentId, a]),
    );
    let liveAgents = 0;
    let idleAgents = 0;
    let darkAgents = 0;
    for (const row of agentRows) {
      const state = derived.get(row.id)?.state ?? 'dark';
      if (state === 'live') liveAgents++;
      else if (state === 'idle') idleAgents++;
      else darkAgents++;
      if (state !== 'live') continue; // idle/dark are tallied in the note, not surfaced as lane items

      const labels = parseJsonColumn<Record<string, string>>(row.labels, {});
      const activityAt = derived.get(row.id)?.lastEventAt ?? toIso(row.updated_at) ?? ctx.now.toISOString();
      items.push({
        id: `dolt-bead:${row.id}`,
        nativeId: row.id,
        source: 'dolt-bead',
        kind: 'agent',
        status: 'running',
        lane: 'overnight', // a live agent IS current activity — decoupled from the overnight-window heuristic
        title: row.title,
        repo: labels['app'] ?? labels['repo'] ?? beadPrefix(row.id),
        actor: row.actor,
        createdAt: toIso(row.created_at),
        updatedAt: toIso(row.updated_at),
        activityAt,
        url: `#bead/${row.id}`,
        detail: {
          kind: 'agent',
          role: labels['role'] ?? 'agent',
          app: labels['app'] ?? '',
          agentStatus: 'live',
          reportsTo: labels['reports_to'],
          sessionId: labels['session_id'],
        },
        provenance: { labels, refs: parseJsonColumn<string[]>(row.refs, []) },
      });
    }

    health.status = 'up';
    health.itemCount = items.length;
    health.note =
      `${beadRows.length} beads scanned · ${liveAgents} live · ${idleAgents} idle · ${darkAgents} dark agents · ` +
      `${eventRows.length} overnight events` +
      (staleRunningHidden ? ` · ${staleRunningHidden} stale-"live" hidden` : '');
    return { items, health };
  } catch (err) {
    health.status = 'down';
    health.lastError = err instanceof Error ? err.message : String(err);
    health.note = `Dolt unreachable at ${config.dolt.host}:${config.dolt.port}/${config.dolt.database}`;
    return { items: [], health };
  } finally {
    await pool?.end().catch(() => {});
  }
}
