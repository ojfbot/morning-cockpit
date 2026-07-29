/**
 * `pnpm watch:verify-sources` — re-fetch every endpoint in sources.yaml and report.
 *
 * The rule this enforces: anything that 404s, returns non-XML, or has gone stale is
 * QUARANTINED WITH A REASON — never silently dropped, never replaced with a guessed URL.
 * This command tells you when that needs to happen; a human writes the reason.
 *
 * Community mirrors are volunteer-maintained single points of failure. The conoro
 * engineering mirror died in Nov 2025 and nothing announced it. This is how we find out.
 */

import { loadRegistry } from './sources.js';

/**
 * Past this, a feed is worth a look — but NOT automatically a failure.
 *
 * "The endpoint is broken" and "the author has not posted lately" are different facts, and
 * conflating them is how you end up quarantining a healthy feed. Karpathy's blog went 110
 * days between posts and Chip Huyen's 560; both endpoints serve valid XML and would deliver
 * the next post fine. Only `broken` fails this command. Dormancy is reported and left to a
 * human, because the fix is a judgment call, not a lookup.
 */
const DORMANT_DAYS = 60;

/** How many times to retry a timeout before believing it. */
const RETRIES = 2;

type Health = 'ok' | 'dormant' | 'broken';

interface Check {
  id: string;
  health: Health;
  status: number | string;
  newest?: string;
  ageDays?: number;
  detail: string;
}

function newestDate(xml: string): string | undefined {
  const dates = [
    ...[...xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/gi)].map((m) => m[1]!),
    ...[...xml.matchAll(/<updated>([^<]+)<\/updated>/gi)].map((m) => m[1]!),
    ...[...xml.matchAll(/<lastBuildDate>([^<]+)<\/lastBuildDate>/gi)].map((m) => m[1]!),
  ]
    .map((d) => Date.parse(d))
    .filter((t) => !Number.isNaN(t));
  if (dates.length === 0) return undefined;
  return new Date(Math.max(...dates)).toISOString();
}

async function checkOnce(id: string, url: string, userAgent: string, timeoutMs: number): Promise<Check> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': userAgent, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { id, health: 'broken', status: res.status, detail: `HTTP ${res.status} ${res.statusText}` };

    const body = await res.text();
    const looksXml = /^\s*<\?xml|^\s*<(rss|feed)\b/i.test(body);
    const looksJson = /^\s*[[{]/.test(body);
    if (!looksXml && !looksJson) {
      return { id, health: 'broken', status: res.status, detail: `not XML or JSON (starts "${body.slice(0, 40).replace(/\s+/g, ' ')}")` };
    }

    const newest = newestDate(body);
    const ageDays = newest ? (Date.now() - Date.parse(newest)) / 86_400_000 : undefined;
    const size = `${(body.length / 1024).toFixed(0)}kb`;
    if (ageDays !== undefined && ageDays > DORMANT_DAYS) {
      return {
        id, health: 'dormant', status: res.status, newest, ageDays,
        detail: `serves valid XML · no post in ${Math.round(ageDays)}d (newest ${newest?.slice(0, 10)})`,
      };
    }
    return {
      id, health: 'ok', status: res.status, newest, ageDays,
      detail: `${size}${newest ? ` · newest ${newest.slice(0, 10)}` : ''}`,
    };
  } catch (err) {
    return { id, health: 'broken', status: 'ERR', detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Retry transient failures before believing them — a loaded machine times out on healthy feeds. */
async function check(id: string, url: string, userAgent: string, timeoutMs: number): Promise<Check> {
  let last = await checkOnce(id, url, userAgent, timeoutMs);
  for (let i = 0; i < RETRIES && last.health === 'broken' && last.status === 'ERR'; i++) {
    last = await checkOnce(id, url, userAgent, timeoutMs * 2);
  }
  return last;
}

async function main(): Promise<number> {
  const registry = loadRegistry();
  const { userAgent, fetchTimeoutMs } = registry.defaults;

  process.stdout.write(`Verifying ${registry.sources.length} active sources...\n\n`);
  const checks = await Promise.all(
    registry.sources.map((s) => check(s.id, s.feedUrl, userAgent, fetchTimeoutMs * 2)),
  );

  const LABEL: Record<Health, string> = { ok: ' ok  ', dormant: 'QUIET', broken: 'BROKE' };
  for (const c of checks) {
    process.stdout.write(`${LABEL[c.health]} ${c.id.padEnd(26)} ${c.detail}\n`);
  }

  const broken = checks.filter((c) => c.health === 'broken');
  const dormant = checks.filter((c) => c.health === 'dormant');
  process.stdout.write(
    `\n${checks.filter((c) => c.health === 'ok').length}/${checks.length} fresh · ${dormant.length} quiet · ${broken.length} broken\n`,
  );

  if (dormant.length > 0) {
    process.stdout.write(
      `\nQUIET feeds serve valid XML but have not published in ${DORMANT_DAYS}d. That is usually\n` +
        `an author who posts rarely, not a dead endpoint — it is NOT a failure and is left for a\n` +
        `human to judge. Quarantine one only if you have checked the site and it is genuinely gone.\n`,
    );
  }

  if (registry.quarantine.length > 0) {
    process.stdout.write(`\nQuarantined (${registry.quarantine.length}) — not fetched, reasons on record:\n`);
    for (const q of registry.quarantine) {
      process.stdout.write(`  · ${q.id.padEnd(30)} checked ${q.checked}\n`);
    }
  }

  if (broken.length > 0) {
    process.stdout.write(
      `\n${broken.length} source(s) are BROKEN. Move each to the quarantine block in sources.yaml\n` +
        `WITH the failure reason recorded. Do not delete it, and do not substitute a replacement\n` +
        `URL that has not been fetched — a hallucinated feed URL looks exactly like a source that\n` +
        `stopped publishing, and is the most expensive mistake available here.\n`,
    );
    return 1;
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    process.stderr.write(`verify-sources: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  },
);
