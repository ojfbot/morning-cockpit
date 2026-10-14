/** Closed resource coordinates; production, credentials and authority never enter the key. */
export interface DoltBeadSourceRecord {
  kind: 'dolt-bead-v1';
  source: 'dolt-bead';
  repository: string | null;
  nativeId: string;
  sourcePath: null;
}
export interface HandoffDocumentSourceRecord {
  kind: 'handoff-document-v1';
  source: 'handoff-bead';
  repository: string;
  nativeId: string | null;
  sourcePath: string;
}
export type SourceRecordRef = DoltBeadSourceRecord | HandoffDocumentSourceRecord;

export function sourceRecordKey(ref: SourceRecordRef): string {
  switch (ref.kind) {
    case 'dolt-bead-v1':
      if (ref.source !== 'dolt-bead' || !ref.nativeId || ref.sourcePath !== null) throw new Error('Invalid Dolt source coordinates');
      break;
    case 'handoff-document-v1':
      if (ref.source !== 'handoff-bead' || !ref.repository || !ref.sourcePath || ref.sourcePath.startsWith('/') || ref.sourcePath.split('/').includes('..')) throw new Error('Invalid handoff source coordinates');
      break;
    default: throw new Error('Unsupported source coordinate variant');
  }
  return JSON.stringify([ref.kind, ref.repository, ref.nativeId, ref.sourcePath]);
}

export interface ProductionInteractionMetadata {
  interactionId: string;
  parentInteractionId: string | null;
  principalId: string | null;
  agentId: string | null;
  runtimeId: string;
  sessionProvider: string | null;
  sessionId: string | null;
  modelProvider: string | null;
  modelId: string | null;
  traceId: string | null;
  hostId: string;
  startedAt: string;
  completedAt: string;
}
export interface ModelGenerationInteraction extends ProductionInteractionMetadata {
  kind: 'model-generation'; agentId: string; sessionProvider: string; sessionId: string; modelProvider: string; modelId: string;
}
export interface HumanProductionInteraction extends ProductionInteractionMetadata {
  kind: 'human-edit' | 'human-approval'; principalId: string; agentId: null; modelProvider: null; modelId: null;
}
export interface EmissionProductionInteraction extends ProductionInteractionMetadata {
  kind: 'emission'; modelProvider: null; modelId: null;
}
export type ProductionInteraction = ModelGenerationInteraction | HumanProductionInteraction | EmissionProductionInteraction;
export interface RecordedDocumentProduction { status: 'recorded'; schemaVersion: 1; interactions: ProductionInteraction[] }
export interface LegacyUnknownDocumentProduction { status: 'legacy-unknown'; reason: string }
export interface UnavailableDocumentProduction { status: 'unavailable'; reason: string }
export type DocumentProduction = RecordedDocumentProduction | LegacyUnknownDocumentProduction | UnavailableDocumentProduction;

export interface HandoffLiteralMetadata {
  type: string | null;
  status: string | null;
  actor: string | null;
  to: string | null;
  respondingTo: string | null;
  refs: string[];
  authoredCreatedAt: string | null;
}
export interface HandoffRecordSummary {
  sourceRecordKey: string;
  sourceRecord: SourceRecordRef;
  title: string;
}
export interface HandoffRecordEvidence extends HandoffRecordSummary {
  literal: HandoffLiteralMetadata;
  observedModifiedAt: string;
  collectedAt: string;
  documentProduction: DocumentProduction;
}
export interface MissingTargetDiagnostic {
  reason: 'target-not-observed'; relation: 'closes' | 'responding_to'; targetNativeId: string; referrerKey: string;
}
export interface AmbiguousTargetDiagnostic {
  reason: 'target-matches-multiple-records'; relation: 'closes' | 'responding_to'; targetNativeId: string; referrerKey: string; candidateTargetKeys: string[];
}
export interface SuccessorOrderDiagnostic {
  reason: 'successor-order-unresolved'; relation: 'closes'; targetNativeId: string | null; predecessorKey: string; candidateSuccessorKeys: string[];
}
export interface RelationCycleDiagnostic { reason: 'relation-cycle'; relation: 'closes'; cycleKeys: string[] }
export type UnresolvedRelationDiagnostic = MissingTargetDiagnostic | AmbiguousTargetDiagnostic | SuccessorOrderDiagnostic | RelationCycleDiagnostic;
export type UnresolvedRelationReason = UnresolvedRelationDiagnostic['reason'];

export function diagnosticRecordKeys(diagnostic: UnresolvedRelationDiagnostic): string[] {
  switch (diagnostic.reason) {
    case 'target-not-observed': return [diagnostic.referrerKey];
    case 'target-matches-multiple-records': return [diagnostic.referrerKey, ...diagnostic.candidateTargetKeys];
    case 'successor-order-unresolved': return [diagnostic.predecessorKey, ...diagnostic.candidateSuccessorKeys];
    case 'relation-cycle': return diagnostic.cycleKeys;
    default: { const exhaustive: never = diagnostic; return exhaustive; }
  }
}
export type EvidenceCoverage =
  | { status: 'complete'; repositoriesObserved: number; skippedRecords: 0; unreadableRepositories: 0 }
  | { status: 'partial'; repositoriesObserved: number; skippedRecords: number; unreadableRepositories: number }
  | { status: 'unavailable'; repositoriesObserved: 0; skippedRecords: 0; unreadableRepositories: 0; reason: string };
export interface RepositoryEvidenceCount { repository: string; count: number }
export interface StandaloneUnansweredBriefs {
  name: 'standaloneUnansweredBriefs'; recordKeys: string[]; total: number; byRepository: RepositoryEvidenceCount[];
}
/** Internal collected ledger; never returned by the hot REST snapshot. */
export interface CockpitEvidence {
  coverage: EvidenceCoverage;
  records: HandoffRecordEvidence[];
  standaloneUnansweredBriefs: StandaloneUnansweredBriefs;
  unresolvedRelations: UnresolvedRelationDiagnostic[];
}
export interface EvidenceSummary {
  snapshotId: string; generatedAt: string; coverage: EvidenceCoverage; total: number; byRepository: RepositoryEvidenceCount[]; unresolvedCount: number;
}
export interface EvidenceIndex {
  status: 'ready'; snapshotId: string; records: HandoffRecordSummary[]; populationRecordKeys: string[]; unresolvedRelations: UnresolvedRelationDiagnostic[];
}
export interface EvidenceRecord { status: 'ready'; snapshotId: string; record: HandoffRecordEvidence }
export interface EvidenceRefreshRequired { status: 'refresh-required'; snapshotId: string; reason: string }
export interface EvidenceRecordNotObserved { status: 'record-not-observed'; snapshotId: string; sourceRecordKey: string }
export type EvidenceIndexResult = EvidenceIndex | EvidenceRefreshRequired;
export type EvidenceRecordResult = EvidenceRecord | EvidenceRefreshRequired | EvidenceRecordNotObserved;
export function emptyCockpitEvidence(coverage: EvidenceCoverage): CockpitEvidence {
  return { coverage, records: [], standaloneUnansweredBriefs: { name: 'standaloneUnansweredBriefs', recordKeys: [], total: 0, byRepository: [] }, unresolvedRelations: [] };
}
