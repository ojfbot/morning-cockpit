import { describe, it, expect } from 'vitest';
import { createYoga } from 'graphql-yoga';
import type { CockpitSnapshot } from '@cockpit/shared';
import { buildReadModelGraphSchema } from '../graph.js';
import type { ReadModelSource } from '../source.js';

/** Minimal valid snapshot — empty lanes; deriveFleet still yields a card per REPO_META entry. */
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

const fakeSource: ReadModelSource = {
  snapshot: async () => fakeSnapshot(),
  briefing: async () => ({
    generatedAt: '2026-06-27T05:00:00.000Z',
    threads: [],
    source: 'deterministic',
  }),
  agentLiveness: async () => [],
  agentEvents: async () => [],
};

/** Execute a query through Yoga itself (avoids the bundled-graphql realm clash). */
async function run(query: string, source: ReadModelSource = fakeSource) {
  const yoga = createYoga({ schema: buildReadModelGraphSchema(source) });
  const res = await yoga.fetch('http://cockpit/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json() as Promise<{ data?: any; errors?: unknown[] }>;
}

describe('read-model GraphQL facade — fleet resolver', () => {
  it('resolves { fleet { name liveness here } } to repo cards with a valid Liveness enum', async () => {
    const { data, errors } = await run('{ fleet { name liveness here } }');

    expect(errors).toBeUndefined();
    const fleet = data?.fleet as Array<{ name: string; liveness: string; here: boolean | null }>;
    expect(fleet.length).toBeGreaterThan(0);
    const home = fleet.find((r) => r.name === 'morning-cockpit');
    expect(home?.here).toBe(true);
    // Liveness must serialize as the SDL enum (UPPERCASE) — boundary-mapped from lowercase shared.
    expect(['LIVE', 'STALE', 'DARK']).toContain(home?.liveness);
  });

  it('resolves briefing, workItems(lane:) and agentLiveness without error', async () => {
    const { data, errors } = await run(
      '{ briefing(repo:"core") { source repo threads { id } } workItems(lane:"overnight") { id } agentLiveness { agentId state } }',
    );
    expect(errors).toBeUndefined();
    expect(data?.briefing.source).toBeDefined(); // deterministic floor with no LLM
    expect(data?.briefing.repo).toBeNull(); // repo arg accepted but ignored in G1 (F2 wires it)
    expect(Array.isArray(data?.workItems)).toBe(true);
    expect(Array.isArray(data?.agentLiveness)).toBe(true);
  });
});
