import type { AgentLiveness, WorkItemLane } from '@cockpit/shared';
import { deriveFleet } from '../fleet-derive.js';
import type { ReadModelSource } from './source.js';

/**
 * Query resolvers for the read-model facade (G1), parameterized by a {@link ReadModelSource}. All
 * resolvers are READ-ONLY — they read from the source and map to the generated SDL shapes. There is
 * no Mutation type and no write path here (ADR-0011 #4 / ADR-0013). Enum case is mapped at this
 * boundary (UPPERCASE SDL ↔ lowercase `@cockpit/shared`).
 */

/** Lowercase shared enum value → UPPERCASE SDL enum value. */
function up<T extends string>(v: T): string {
  return v.toUpperCase();
}

export function makeResolvers(source: ReadModelSource) {
  return {
    Query: {
      fleet: async () => {
        const snap = await source.snapshot();
        const now = Date.parse(snap.generatedAt) || Date.now();
        return deriveFleet(snap, now).map((c) => ({ ...c, liveness: up(c.liveness) }));
      },
      // repo arg accepted (G0 forward-declared it) but IGNORED in G1 — global briefing. F2 wires
      // repo-scoping. Same generator as REST `/api/briefing`, so parity is structural.
      briefing: async (_p: unknown, args: { repo?: string }) => source.briefing(args.repo),
      workItems: async (_p: unknown, args: { lane: string }) => {
        const snap = await source.snapshot();
        return snap.lanes[args.lane as WorkItemLane] ?? [];
      },
      agentLiveness: async () => {
        const list = await source.agentLiveness();
        return list.map((a: AgentLiveness) => ({ ...a, state: up(a.state) }));
      },
    },
    RepoCard: {
      // Forward-declared seams (G0): honest defaults until L1/L3 fill them, so the non-null `links`
      // list never crashes a query and `popover` reads null.
      links: () => [],
      popover: () => null,
    },
  };
}
