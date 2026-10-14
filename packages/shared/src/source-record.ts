import { isSafeRepoName } from './handoff-brief.js';
import type * as Contract from './internal/inspector-model.js';
/** Collected native metadata has no GraphQL type tags; field shapes come from the SDL. */
type Collected<T> =
  T extends Array<infer U>
    ? Collected<U>[]
    : T extends object
      ? {
          [K in keyof T as K extends '__typename' ? never : K]: Collected<T[K]>;
        }
      : T;
export type DoltBeadSourceRecord = Collected<Contract.DoltBeadSourceRecord>;
export type HandoffDocumentSourceRecord =
  Collected<Contract.HandoffDocumentSourceRecord>;
export type ProductionInteraction = Collected<Contract.ProductionInteraction>;
export type ModelGenerationInteraction =
  Collected<Contract.ModelGenerationInteraction>;
export type HumanProductionInteraction =
  Collected<Contract.HumanProductionInteraction>;
export type EmissionProductionInteraction =
  Collected<Contract.EmissionProductionInteraction>;
export type LegacyUnknownDocumentProduction =
  Collected<Contract.LegacyUnknownDocumentProduction>;
export type UnavailableDocumentProduction =
  Collected<Contract.UnavailableDocumentProduction>;
export type DocumentProduction = Collected<Contract.DocumentProduction>;
export type HandoffLiteralMetadata = Collected<Contract.HandoffLiteralMetadata>;
export type HandoffRecordSummary = Collected<Contract.HandoffRecordSummary>;
export type HandoffRecordEvidence = Collected<Contract.HandoffRecordEvidence>;
export type DoltRecordSummary = Collected<Contract.DoltRecordSummary>;
export type DoltRecordEvidence = Collected<Contract.DoltRecordEvidence>;
export type MissingTargetDiagnostic =
  Collected<Contract.MissingTargetDiagnostic>;
export type AmbiguousTargetDiagnostic =
  Collected<Contract.AmbiguousTargetDiagnostic>;
export type SuccessorOrderDiagnostic =
  Collected<Contract.SuccessorOrderDiagnostic>;
export type RelationCycleDiagnostic =
  Collected<Contract.RelationCycleDiagnostic>;
export type UnresolvedRelationDiagnostic =
  Collected<Contract.UnresolvedRelationDiagnostic>;
export type EvidenceCoverage = Collected<Contract.EvidenceCoverage>;
export type RepositoryEvidenceCount =
  Collected<Contract.RepositoryEvidenceCount>;
export type EvidenceSummary = Collected<Contract.EvidenceSummary>;
export type EvidenceIndex = Collected<Contract.EvidenceIndex>;
export type EvidenceRecord = Collected<Contract.EvidenceRecord>;
export type EvidenceRefreshRequired =
  Collected<Contract.EvidenceRefreshRequired>;
export type EvidenceRecordNotObserved =
  Collected<Contract.EvidenceRecordNotObserved>;
export type EvidenceIndexResult = Collected<Contract.EvidenceIndexResult>;
export type EvidenceRecordResult = Collected<Contract.EvidenceRecordResult>;
export type InspectionTarget = Collected<Contract.InspectionTarget>;
export type TaskDocumentTarget = Collected<Contract.TaskDocumentTarget>;
export type TaskDocumentResolution = Collected<Contract.TaskDocumentResolution>;
export type DoltEvidenceIndex = Collected<Contract.DoltEvidenceIndex>;
export type HandoffEvidenceIndex = Collected<Contract.HandoffEvidenceIndex>;
export type EvidenceSourceSummary = Collected<Contract.EvidenceSourceSummary>;
export type RecordedDocumentProduction =
  Collected<Contract.RecordedDocumentProduction> & { schemaVersion: 1 };
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
