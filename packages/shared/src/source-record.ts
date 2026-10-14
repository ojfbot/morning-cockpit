import { isSafeRepoName } from './handoff-brief.js';
import type {
  AmbiguousTargetDiagnostic as ContractAmbiguousTargetDiagnostic,
  DocumentProduction as ContractDocumentProduction,
  DoltBeadSourceRecord as ContractDoltBeadSourceRecord,
  DoltEvidenceIndex as ContractDoltEvidenceIndex,
  DoltRecordEvidence as ContractDoltRecordEvidence,
  DoltRecordSummary as ContractDoltRecordSummary,
  EmissionProductionInteraction as ContractEmissionProductionInteraction,
  EvidenceCoverage as ContractEvidenceCoverage,
  EvidenceIndex as ContractEvidenceIndex,
  EvidenceIndexResult as ContractEvidenceIndexResult,
  EvidenceRecord as ContractEvidenceRecord,
  EvidenceRecordNotObserved as ContractEvidenceRecordNotObserved,
  EvidenceRecordResult as ContractEvidenceRecordResult,
  EvidenceRefreshRequired as ContractEvidenceRefreshRequired,
  EvidenceSourceSummary as ContractEvidenceSourceSummary,
  EvidenceSummary as ContractEvidenceSummary,
  HandoffDocumentSourceRecord as ContractHandoffDocumentSourceRecord,
  HandoffEvidenceIndex as ContractHandoffEvidenceIndex,
  HandoffLiteralMetadata as ContractHandoffLiteralMetadata,
  HandoffRecordEvidence as ContractHandoffRecordEvidence,
  HandoffRecordSummary as ContractHandoffRecordSummary,
  HumanProductionInteraction as ContractHumanProductionInteraction,
  InspectionTarget as ContractInspectionTarget,
  LegacyUnknownDocumentProduction as ContractLegacyUnknownDocumentProduction,
  MissingTargetDiagnostic as ContractMissingTargetDiagnostic,
  ModelGenerationInteraction as ContractModelGenerationInteraction,
  ProductionInteraction as ContractProductionInteraction,
  RecordedDocumentProduction as ContractRecordedDocumentProduction,
  RelationCycleDiagnostic as ContractRelationCycleDiagnostic,
  RepositoryEvidenceCount as ContractRepositoryEvidenceCount,
  SuccessorOrderDiagnostic as ContractSuccessorOrderDiagnostic,
  TaskDocumentResolution as ContractTaskDocumentResolution,
  TaskDocumentTarget as ContractTaskDocumentTarget,
  UnavailableDocumentProduction as ContractUnavailableDocumentProduction,
  UnresolvedRelationDiagnostic as ContractUnresolvedRelationDiagnostic,
} from './internal/inspector-model.js';
/** Collected native metadata has no GraphQL type tags; field shapes come from the SDL. */
type Collected<T> =
  T extends Array<infer U>
    ? Collected<U>[]
    : T extends object
      ? {
          [K in keyof T as K extends '__typename' ? never : K]: Collected<T[K]>;
        }
      : T;
export type DoltBeadSourceRecord = Collected<ContractDoltBeadSourceRecord>;
export type HandoffDocumentSourceRecord =
  Collected<ContractHandoffDocumentSourceRecord>;
export type ProductionInteraction = Collected<ContractProductionInteraction>;
export type ModelGenerationInteraction =
  Collected<ContractModelGenerationInteraction>;
export type HumanProductionInteraction =
  Collected<ContractHumanProductionInteraction>;
export type EmissionProductionInteraction =
  Collected<ContractEmissionProductionInteraction>;
export type LegacyUnknownDocumentProduction =
  Collected<ContractLegacyUnknownDocumentProduction>;
export type UnavailableDocumentProduction =
  Collected<ContractUnavailableDocumentProduction>;
export type DocumentProduction = Collected<ContractDocumentProduction>;
export type HandoffLiteralMetadata = Collected<ContractHandoffLiteralMetadata>;
export type HandoffRecordSummary = Collected<ContractHandoffRecordSummary>;
export type HandoffRecordEvidence = Collected<ContractHandoffRecordEvidence>;
export type DoltRecordSummary = Collected<ContractDoltRecordSummary>;
export type DoltRecordEvidence = Collected<ContractDoltRecordEvidence>;
export type MissingTargetDiagnostic =
  Collected<ContractMissingTargetDiagnostic>;
export type AmbiguousTargetDiagnostic =
  Collected<ContractAmbiguousTargetDiagnostic>;
export type SuccessorOrderDiagnostic =
  Collected<ContractSuccessorOrderDiagnostic>;
export type RelationCycleDiagnostic =
  Collected<ContractRelationCycleDiagnostic>;
export type UnresolvedRelationDiagnostic =
  Collected<ContractUnresolvedRelationDiagnostic>;
export type EvidenceCoverage = Collected<ContractEvidenceCoverage>;
export type RepositoryEvidenceCount =
  Collected<ContractRepositoryEvidenceCount>;
export type EvidenceSummary = Collected<ContractEvidenceSummary>;
export type EvidenceIndex = Collected<ContractEvidenceIndex>;
export type EvidenceRecord = Collected<ContractEvidenceRecord>;
export type EvidenceRefreshRequired =
  Collected<ContractEvidenceRefreshRequired>;
export type EvidenceRecordNotObserved =
  Collected<ContractEvidenceRecordNotObserved>;
export type EvidenceIndexResult = Collected<ContractEvidenceIndexResult>;
export type EvidenceRecordResult = Collected<ContractEvidenceRecordResult>;
export type InspectionTarget = Collected<ContractInspectionTarget>;
export type TaskDocumentTarget = Collected<ContractTaskDocumentTarget>;
export type TaskDocumentResolution = Collected<ContractTaskDocumentResolution>;
export type DoltEvidenceIndex = Collected<ContractDoltEvidenceIndex>;
export type HandoffEvidenceIndex = Collected<ContractHandoffEvidenceIndex>;
export type EvidenceSourceSummary = Collected<ContractEvidenceSourceSummary>;
export type RecordedDocumentProduction =
  Collected<ContractRecordedDocumentProduction> & { schemaVersion: 1 };
export type SourceRecordRef =
  | DoltBeadSourceRecord
  | HandoffDocumentSourceRecord;
export type UnresolvedRelationReason = UnresolvedRelationDiagnostic['reason'];
export type ProductionInteractionMetadata = Omit<
  EmissionProductionInteraction,
  'kind'
>;
export type DoltCollection =
  | (Omit<Extract<DoltEvidenceIndex, { status: 'observed' }>, 'records'> & {
      records: DoltRecordEvidence[];
    })
  | Extract<DoltEvidenceIndex, { status: 'unavailable' }>;
export interface StandaloneUnansweredBriefs {
  name: 'standaloneUnansweredBriefs';
  recordKeys: string[];
  total: number;
  byRepository: RepositoryEvidenceCount[];
}
/** Handoff's collector product; the store keeps it separate from native Dolt facts. */
export interface CockpitEvidence {
  collectedAt?: string;
  coverage: EvidenceCoverage;
  records: HandoffRecordEvidence[];
  standaloneUnansweredBriefs: StandaloneUnansweredBriefs;
  unresolvedRelations: UnresolvedRelationDiagnostic[];
}
export interface CapturedEvidence {
  dolt: DoltCollection;
  handoff: CockpitEvidence;
  handoffCollectedAt: string;
}
export function sourceRecordKey(ref: SourceRecordRef): string {
  switch (ref.kind) {
    case 'dolt-bead-v1':
      if (
        ref.source !== 'dolt-bead' ||
        !ref.nativeId.trim() ||
        (ref.repository !== null && !isSafeRepoName(ref.repository)) ||
        ref.sourcePath !== null
      )
        throw new Error('Invalid Dolt source coordinates');
      break;
    case 'handoff-document-v1':
      if (
        ref.source !== 'handoff-bead' ||
        !isSafeRepoName(ref.repository) ||
        (ref.nativeId !== null && !ref.nativeId.trim()) ||
        !ref.sourcePath ||
        ref.sourcePath.startsWith('/') ||
        ref.sourcePath.split('/').includes('..')
      )
        throw new Error('Invalid handoff source coordinates');
      break;
    default:
      throw new Error('Unsupported source coordinate variant');
  }
  return JSON.stringify([
    ref.kind,
    ref.repository,
    ref.nativeId,
    ref.sourcePath,
  ]);
}

export function diagnosticRecordKeys(
  diagnostic: UnresolvedRelationDiagnostic,
): string[] {
  switch (diagnostic.reason) {
    case 'target-not-observed':
      return [diagnostic.referrerKey];
    case 'target-matches-multiple-records':
      return [diagnostic.referrerKey, ...diagnostic.candidateTargetKeys];
    case 'successor-order-unresolved':
      return [diagnostic.predecessorKey, ...diagnostic.candidateSuccessorKeys];
    case 'relation-cycle':
      return diagnostic.cycleKeys;
    default: {
      const exhaustive: never = diagnostic;
      return exhaustive;
    }
  }
}
export function emptyCockpitEvidence(
  coverage: EvidenceCoverage,
): CockpitEvidence {
  return {
    coverage,
    records: [],
    standaloneUnansweredBriefs: {
      name: 'standaloneUnansweredBriefs',
      recordKeys: [],
      total: 0,
      byRepository: [],
    },
    unresolvedRelations: [],
  };
}
