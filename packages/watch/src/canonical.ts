/**
 * Dedup keys. The same story arrives via several feeds with different tracking params, so the
 * ledger keys on a canonicalized URL rather than the feed's guid. No embeddings — Stage 1
 * explicitly defers near-duplicate detection (ADR-0016).
 */

/** Query params that identify a referrer, not a document. */
const TRACKING = /^(utm_|ref$|refsrc$|ref_src$|fbclid$|gclid$|mc_cid$|mc_eid$|source$|at_medium$)/i;

/**
 * Canonicalize a URL for identity comparison: lowercase scheme+host, drop `www.`, drop
 * tracking params, sort what remains, drop the fragment, strip a trailing slash.
 *
 * Unparseable input is returned trimmed rather than thrown away — a bad URL still needs a
 * stable key, and losing the item silently is worse than a slightly ugly one.
 */
export function canonicalUrl(raw: string): string {
  const trimmed = raw.trim();
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    return trimmed;
  }

  u.protocol = u.protocol.toLowerCase();
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');
  u.hash = '';

  const keep = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k));
  keep.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  u.search = '';
  for (const [k, v] of keep) u.searchParams.append(k, v);

  let out = u.toString();
  if (out.endsWith('?')) out = out.slice(0, -1);
  // Trailing slash on a path (but never on a bare origin, where "/" is meaningful).
  if (out.endsWith('/') && new URL(out).pathname !== '/') out = out.slice(0, -1);
  return out;
}

/**
 * The ledger key for an item. GitHub commits and arXiv papers get a scheme-prefixed id so
 * they stay stable if the surrounding URL shape changes; everything else keys on the URL.
 */
export function itemId(url: string, guid?: string): string {
  const gh = /github\.com\/[^/]+\/[^/]+\/commit\/([0-9a-f]{7,40})/i.exec(url);
  if (gh?.[1]) return `gh:${gh[1].toLowerCase()}`;

  const arxiv = /arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]{4,5})(?:v\d+)?/i.exec(url);
  if (arxiv?.[1]) return `arxiv:${arxiv[1]}`;

  const hn = /news\.ycombinator\.com\/item\?id=(\d+)/i.exec(url);
  if (hn?.[1]) return `hn:${hn[1]}`;

  if (url) return canonicalUrl(url);
  return guid ? `guid:${guid}` : '';
}
