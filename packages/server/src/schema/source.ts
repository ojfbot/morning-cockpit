import type { AgentLiveness, BeadEventRow, BriefingSnapshot, CockpitSnapshot } from '@cockpit/shared';
import { buildSnapshot } from '../aggregate.js';
import { generateBriefing } from '../briefing-generate.js';

/**
 * ReadModelSource — the extraction seam (ADR-0011/0013 trajectory). The GraphQL resolvers depend on
 * THIS interface, never on `buildSnapshot()`/Dolt directly, so the eventual lean graph service can
 * re-back the read-model with a core-fed data layer without touching the resolvers. It is also the
 * test seam: unit tests inject a fake source (no live Dolt).
 */
export interface ReadModelSource {
  snapshot(): Promise<CockpitSnapshot>;
  /**
   * The Chief-of-Staff briefing (ADR-0007). Kept behind the port so the LLM/generation logic stays
   * out of the resolvers (and out of the future lean graph service). `repo` is forward-declared for
   * F2 (repo-scoped briefing) — ignored today.
   */
  briefing(repo?: string): Promise<BriefingSnapshot>;
  /** Derived agent liveness (ADR-0008). See cockpit impl note — wired in a G1 follow-up. */
  agentLiveness(): Promise<AgentLiveness[]>;
  /** Raw agent-* events (reserved for a future resolver); empty until surfaced from the adapter. */
  agentEvents(): Promise<BeadEventRow[]>;
}

/** Production source — backed by the cockpit aggregate (today's data path). */
export const cockpitReadModelSource: ReadModelSource = {
  snapshot: () => buildSnapshot(),
  // Delegates to the same generator REST `/api/briefing` uses → parity is structural. repo ignored (F2).
  briefing: async () => {
    const snap = await buildSnapshot();
    return generateBriefing(snap, snap.generatedAt);
  },
  // TODO(G1+): surface derived liveness via a read-only dolt accessor. The derivation already exists
  // inside `adapters/dolt.ts fetchDolt` (deriveAgentLiveness over agent-* events) but is not exported;
  // extracting it is a focused follow-up. Returns [] until then — honestly empty, not fabricated.
  agentLiveness: async () => [],
  agentEvents: async () => [],
};
