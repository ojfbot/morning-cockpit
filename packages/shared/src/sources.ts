/**
 * The feed registry contract (ADR-0015). sources.yaml is the single source of truth for both
 * the Reading pod and the watch poller.
 *
 * This module validates an ALREADY-PARSED plain object. It deliberately does no file I/O and
 * imports no YAML library, so @cockpit/shared keeps its no-runtime-dependencies property —
 * each consumer supplies the parsed document, and there is still exactly one validator. Two
 * validators would reintroduce the drift this file exists to remove.
 */

export type Pod = 'watch' | 'reading';

export interface Source {
  id: string;
  title: string;
  kind: 'rss' | 'atom';
  feedUrl: string;
  siteUrl?: string;
  /** Reading-pod display grouping only. */
  tier?: string;
  /** Taxonomy for the watch surface. */
  class: string;
  /** Deterministic input to the watch rubric — never model-scored. See ADR-0017. */
  authority: number;
  pods: Pod[];
  /** Fetch the article body? False for feeds whose text is already complete. */
  fetchFullText: boolean;
  verified: string;
  note?: string;
}

export interface QuarantinedSource {
  id: string;
  title: string;
  feedUrl?: string;
  siteUrl?: string;
  checked: string;
  /** Why it is out of service. Required — a source that vanished with no record is the bug. */
  reason: string;
}

export interface Registry {
  version: number;
  defaults: { userAgent: string; fetchTimeoutMs: number };
  sources: Source[];
  quarantine: QuarantinedSource[];
}

const PODS: readonly string[] = ['watch', 'reading'];

function req<T>(value: T | undefined | null, what: string, where: string): T {
  if (value === undefined || value === null || value === '') {
    throw new Error(`sources.yaml: ${where} is missing required field "${what}"`);
  }
  return value;
}

/**
 * Validate and normalize the registry. Every problem is a hard error rather than a skip: a
 * silently-dropped source is indistinguishable from a source that published nothing.
 */
export function parseRegistry(raw: unknown): Registry {
  if (!raw || typeof raw !== 'object') throw new Error('sources.yaml: not a mapping');
  const doc = raw as Record<string, unknown>;

  const defaults = (doc.defaults ?? {}) as Record<string, unknown>;
  const rawSources = doc.sources;
  if (!Array.isArray(rawSources)) throw new Error('sources.yaml: "sources" must be a list');

  const seen = new Set<string>();
  const sources: Source[] = rawSources.map((entry, i) => {
    const s = entry as Record<string, unknown>;
    const where = `sources[${i}]${s.id ? ` (${String(s.id)})` : ''}`;
    const id = String(req(s.id as string, 'id', where));
    if (seen.has(id)) throw new Error(`sources.yaml: duplicate source id "${id}"`);
    seen.add(id);

    const pods = req(s.pods as string[], 'pods', where);
    if (!Array.isArray(pods) || pods.length === 0) {
      throw new Error(`sources.yaml: ${where} "pods" must be a non-empty list`);
    }
    for (const p of pods) {
      if (!PODS.includes(p)) {
        throw new Error(`sources.yaml: ${where} unknown pod "${p}" (expected ${PODS.join(' | ')})`);
      }
    }

    const authority = Number(req(s.authority as number, 'authority', where));
    if (!Number.isFinite(authority) || authority < 0 || authority > 1) {
      throw new Error(`sources.yaml: ${where} "authority" must be 0..1, got ${String(s.authority)}`);
    }

    const kind = (s.kind as string) ?? 'rss';
    if (kind !== 'rss' && kind !== 'atom') {
      throw new Error(`sources.yaml: ${where} "kind" must be rss | atom, got "${kind}"`);
    }

    return {
      id,
      title: String(req(s.title as string, 'title', where)),
      kind,
      feedUrl: String(req(s.feed_url as string, 'feed_url', where)),
      siteUrl: s.site_url ? String(s.site_url) : undefined,
      tier: s.tier !== undefined ? String(s.tier) : undefined,
      class: String(s.class ?? 'unclassified'),
      authority,
      pods: pods as Pod[],
      fetchFullText: s.fetch_full_text === true,
      verified: String(s.verified ?? 'unverified'),
      note: s.note ? String(s.note) : undefined,
    };
  });

  const rawQ = Array.isArray(doc.quarantine) ? doc.quarantine : [];
  const quarantine: QuarantinedSource[] = rawQ.map((entry, i) => {
    const q = entry as Record<string, unknown>;
    const where = `quarantine[${i}]`;
    return {
      id: String(req(q.id as string, 'id', where)),
      title: String(q.title ?? q.id),
      feedUrl: q.feed_url ? String(q.feed_url) : undefined,
      siteUrl: q.site_url ? String(q.site_url) : undefined,
      checked: String(req(q.checked as string, 'checked', where)),
      reason: String(req(q.reason as string, 'reason', where)),
    };
  });

  return {
    version: Number(doc.version ?? 1),
    defaults: {
      userAgent: String(defaults.user_agent ?? 'morning-cockpit/0.1 (+local read-model)'),
      fetchTimeoutMs: Number(defaults.fetch_timeout_ms ?? 8000),
    },
    sources,
    quarantine,
  };
}

/** Sources a given surface consumes. The absorb mechanism — one entry, no drift. */
export function sourcesFor(registry: Registry, pod: Pod): Source[] {
  return registry.sources.filter((s) => s.pods.includes(pod));
}
