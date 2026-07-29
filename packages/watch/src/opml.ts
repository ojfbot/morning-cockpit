/**
 * `pnpm watch:opml` — regenerate reading.opml from sources.yaml.
 *
 * reading.opml used to be hand-maintained alongside a hardcoded array in config.ts. The two
 * had already drifted on titles. It is now a derived artifact: import it into any RSS reader,
 * but edit sources.yaml. See ADR-0015.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadRegistry, repoRoot, sourcesFor, type Source } from './sources.js';

const TIER_LABELS: Record<string, string> = {
  '0': 'Tier 0 — Anchors',
  '1': 'Tier 1 — Daily signal',
  '2': 'Tier 2 — Depth',
};

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderOpml(sources: Source[]): string {
  const byTier = new Map<string, Source[]>();
  for (const s of sources) {
    const tier = s.tier ?? '2';
    byTier.set(tier, [...(byTier.get(tier) ?? []), s]);
  }

  const groups = [...byTier.keys()].sort();
  const body = groups
    .map((tier) => {
      const label = TIER_LABELS[tier] ?? `Tier ${tier}`;
      const rows = (byTier.get(tier) ?? [])
        .map(
          (s) =>
            `      <outline text="${esc(s.title)}" type="rss" xmlUrl="${esc(s.feedUrl)}"${s.siteUrl ? ` htmlUrl="${esc(s.siteUrl)}"` : ''}/>`,
        )
        .join('\n');
      return `    <outline text="${esc(label)}">\n${rows}\n    </outline>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- GENERATED FILE — do not edit by hand. Run \`pnpm watch:opml\` after changing sources.yaml.
     Source of truth: morning-cockpit/sources.yaml (entries with \`pods: [reading]\`). ADR-0015.
     Import into any RSS reader (e.g. NetNewsWire). -->
<opml version="2.0">
  <head><title>ojfbot reading — AI eng + agentic coding</title></head>
  <body>
${body}
  </body>
</opml>
`;
}

const registry = loadRegistry();
const out = resolve(repoRoot(), 'reading.opml');
writeFileSync(out, renderOpml(sourcesFor(registry, 'reading')), 'utf8');
process.stdout.write(`wrote ${out}\n`);
