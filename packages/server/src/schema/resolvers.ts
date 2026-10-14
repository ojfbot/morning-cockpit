import type {
  AgentLiveness,
  CockpitSnapshot,
  WorkItemLane,
} from '@cockpit/shared';
import type { createSchema } from 'graphql-yoga';
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

export interface ReadContext {
  snapshot?: Promise<CockpitSnapshot>;
}
export function makeResolvers(
  source: ReadModelSource,
): NonNullable<Parameters<typeof createSchema<ReadContext>>[0]['resolvers']> {
  const snapshot = (context?: ReadContext) =>
    context ? (context.snapshot ??= source.snapshot()) : source.snapshot();
  return {
    Query: {
      evidenceSummary: async (
        _p: unknown,
        _args: unknown,
        context?: ReadContext,
      ) => {
        const captured = await snapshot(context);
        return captured.evidenceSummary ?? source.evidenceSummary();
      },
      evidenceIndex: (_p: unknown, args: { snapshotId: string }) =>
        source.evidenceIndex(args.snapshotId),
      evidenceRecord: (
        _p: unknown,
        args: { snapshotId: string; sourceRecordKey: string },
      ) => source.evidenceRecord(args.snapshotId, args.sourceRecordKey),
      fleet: async (_p: unknown, _args: unknown, context?: ReadContext) => {
        const snap = await snapshot(context);
        const now = Date.parse(snap.generatedAt) || Date.now();
        return deriveFleet(snap, now).map((c) => ({
          ...c,
          liveness: up(c.liveness),
        }));
      },
      // repo arg accepted (G0 forward-declared it) but IGNORED in G1 — global briefing. F2 wires
      // repo-scoping. Same generator as REST `/api/briefing`, so parity is structural.
      briefing: async (_p: unknown, args: { repo?: string }) =>
        source.briefing(args.repo),
      workItems: async (
        _p: unknown,
        args: { lane: string },
        context?: ReadContext,
      ) => {
        const snap = await snapshot(context);
        return snap.lanes[args.lane as WorkItemLane] ?? [];
      },
      agentLiveness: async () => {
        const list = await source.agentLiveness();
        return list.map((a: AgentLiveness) => ({ ...a, state: up(a.state) }));
      },
    },
    WorkItem: {
      inspectionTarget: (item: { inspectionTarget?: unknown }) =>
        item.inspectionTarget ?? {
          reason: 'Legacy item has no observation-bound source reference',
        },
    },
    InspectionTarget: {
      __resolveType: (target: { snapshotId?: string }) =>
        target.snapshotId
          ? 'AvailableInspectionTarget'
          : 'UnavailableInspectionTarget',
    },
    SourceRecord: {
      __resolveType: (record: { kind: string }) =>
        record.kind === 'dolt-bead-v1'
          ? 'DoltBeadSourceRecord'
          : record.kind === 'handoff-document-v1'
            ? 'HandoffDocumentSourceRecord'
            : null,
    },
    UnresolvedRelationDiagnostic: {
      __resolveType: (record: { reason: string }) =>
        ({
          'target-not-observed': 'MissingTargetDiagnostic',
          'target-matches-multiple-records': 'AmbiguousTargetDiagnostic',
          'successor-order-unresolved': 'SuccessorOrderDiagnostic',
          'relation-cycle': 'RelationCycleDiagnostic',
        })[record.reason] ?? null,
    },
    DocumentProduction: {
      __resolveType: (record: { status: string }) =>
        ({
          recorded: 'RecordedDocumentProduction',
          'legacy-unknown': 'LegacyUnknownDocumentProduction',
          unavailable: 'UnavailableDocumentProduction',
        })[record.status] ?? null,
    },
    EvidenceIndexResult: {
      __resolveType: (record: { status: string }) =>
        record.status === 'ready' ? 'EvidenceIndex' : 'EvidenceRefreshRequired',
    },
    EvidenceRecordResult: {
      __resolveType: (record: { status: string }) =>
        ({
          ready: 'EvidenceRecord',
          'record-not-observed': 'EvidenceRecordNotObserved',
          'refresh-required': 'EvidenceRefreshRequired',
          'invalid-reference': 'EvidenceInvalidReference',
          'source-unavailable': 'EvidenceSourceUnavailable',
        })[record.status] ?? null,
    },
    ObservedEvidenceRecord: {
      __resolveType: (record: { sourceRecord: { source: string } }) =>
        record.sourceRecord.source === 'dolt-bead'
          ? 'DoltRecordEvidence'
          : 'HandoffRecordEvidence',
    },
    DoltEvidenceIndex: {
      __resolveType: (index: { status: string }) =>
        index.status === 'observed'
          ? 'ObservedDoltIndex'
          : 'UnavailableDoltIndex',
    },
    HandoffEvidenceIndex: {
      __resolveType: (index: { status: string }) =>
        index.status === 'observed'
          ? 'ObservedHandoffIndex'
          : 'UnavailableHandoffIndex',
    },
    TaskDocumentTarget: {
      __resolveType: (target: { source: string }) =>
        target.source === 'dolt-bead'
          ? 'DoltTaskTarget'
          : 'HandoffDocumentTarget',
    },
    TaskDocumentResolution: {
      __resolveType: (link: { status: string }) =>
        ({
          resolved: 'ResolvedTaskDocumentLink',
          'target-source-unavailable': 'UnavailableTaskDocumentLink',
          'target-not-observed-in-scope': 'AbsentTaskDocumentLink',
          'target-ambiguous': 'AmbiguousTaskDocumentLink',
          'target-kind-incompatible': 'IncompatibleTaskDocumentLink',
          'invalid-declaration': 'InvalidTaskDocumentLink',
        })[link.status] ?? null,
    },
    ProductionInteraction: {
      __resolveType: (interaction: { kind: string }) =>
        interaction.kind === 'model-generation'
          ? 'ModelGenerationInteraction'
          : interaction.kind === 'emission'
            ? 'EmissionProductionInteraction'
            : 'HumanProductionInteraction',
    },
    RepoCard: {
      // Forward-declared seams (G0): honest defaults until L1/L3 fill them, so the non-null `links`
      // list never crashes a query and `popover` reads null.
      links: () => [],
      popover: () => null,
    },
  };
}
