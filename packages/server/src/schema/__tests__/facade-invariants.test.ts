import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createYoga } from 'graphql-yoga';
import type { CockpitSnapshot } from '@cockpit/shared';
import { buildReadModelGraphSchema } from '../graph.js';
import { deriveFleet } from '../../fleet-derive.js';
import type { ReadModelSource } from '../source.js';

function fakeSnapshot(): CockpitSnapshot {
  const empty = { headline: '', bullets: [] as string[] };
  return {
    generatedAt: '2026-06-27T05:00:00.000Z',
    overnightSince: '2026-06-26T22:00:00.000Z',
    lanes: { overnight: [], pickup: [], available: [] },
    health: [],
    summaries: {
      overnight: { ...empty, source: 'deterministic', lane: 'overnight', action: '' },
      pickup: { ...empty, source: 'deterministic', lane: 'pickup', action: '' },
      available: { ...empty, source: 'deterministic', lane: 'available', action: '' },
    },
    meta: { totalItems: 0, skipped: 0 },
  };
}

const source: ReadModelSource = {
  snapshot: async () => fakeSnapshot(),
  briefing: async () => ({ generatedAt: 'x', threads: [], source: 'deterministic' }),
  agentLiveness: async () => [],
  agentEvents: async () => [],
};

async function run(query: string) {
  const yoga = createYoga({ schema: buildReadModelGraphSchema(source) });
  const res = await yoga.fetch('http://cockpit/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json() as Promise<{ data?: any; errors?: unknown[] }>;
}

describe('facade C1 — fleet parity with the REST derivation', () => {
  it('GraphQL fleet equals deriveFleet() (the REST path), enum-normalized', async () => {
    const snap = fakeSnapshot();
    const now = Date.parse(snap.generatedAt);
    const rest = deriveFleet(snap, now).map((c) => ({
      name: c.name,
      role: c.role,
      phase: c.phase,
      openCount: c.openCount,
      lastActivity: c.lastActivity,
      liveness: c.liveness.toUpperCase(), // boundary-normalized
      here: c.here ?? null, // GraphQL nullable Boolean
    }));

    const { data, errors } = await run(
      '{ fleet { name role phase openCount lastActivity liveness here } }',
    );
    expect(errors).toBeUndefined();
    expect(data?.fleet).toEqual(rest); // 100% field parity, no field only-in-REST
  });
});

describe('facade C2 — read-only proof', () => {
  it('the served schema rejects mutations (no Mutation type)', async () => {
    const { errors } = await run('mutation { anything }');
    expect(errors).toBeDefined();
  });

  it('the resolver + source modules import no write path', () => {
    const dir = fileURLToPath(new URL('../', import.meta.url));
    const src = readFileSync(`${dir}resolvers.ts`, 'utf8') + readFileSync(`${dir}source.ts`, 'utf8');
    for (const forbidden of ['handoff-emit', 'queue-claim', 'queue-post', 'DOLT_COMMIT', 'child_process', "from 'gh'"]) {
      expect(src, `read-only: must not reference ${forbidden}`).not.toContain(forbidden);
    }
  });
});
