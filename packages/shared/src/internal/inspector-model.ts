export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** Always null; a Dolt coordinate never has a filesystem path. */
  Absent: { input: never; output: never; }
};

export type AbsentTaskDocumentLink = {
  __typename: 'AbsentTaskDocumentLink';
  fieldPath: Scalars['String']['output'];
  referrer: SourceRecord;
  status: AbsentTaskDocumentLinkStatus;
  target: TaskDocumentTarget;
};

export type AbsentTaskDocumentLinkStatus =
  | 'target-not-observed-in-scope';

export type AmbiguousTargetDiagnostic = {
  __typename: 'AmbiguousTargetDiagnostic';
  candidateTargetKeys: Array<Scalars['String']['output']>;
  reason: AmbiguousTargetDiagnosticReason;
  referrerKey: Scalars['String']['output'];
  relation: ReferenceRelation;
  targetNativeId: Scalars['String']['output'];
};

export type AmbiguousTargetDiagnosticReason =
  | 'target-matches-multiple-records';

export type AmbiguousTaskDocumentLink = {
  __typename: 'AmbiguousTaskDocumentLink';
  candidates: Array<SourceRecord>;
  fieldPath: Scalars['String']['output'];
  referrer: SourceRecord;
  status: AmbiguousTaskDocumentLinkStatus;
  target: TaskDocumentTarget;
};

export type AmbiguousTaskDocumentLinkStatus =
  | 'target-ambiguous';

export type AvailableInspectionTarget = {
  __typename: 'AvailableInspectionTarget';
  expiresAt: Scalars['String']['output'];
  generatedAt: Scalars['String']['output'];
  snapshotId: Scalars['String']['output'];
  sourceRecord: SourceRecord;
  sourceRecordKey: Scalars['String']['output'];
};

export type ClosingRelation =
  | 'closes';

export type DocumentProduction = LegacyUnknownDocumentProduction | RecordedDocumentProduction | UnavailableDocumentProduction;

export type DoltBeadSourceRecord = {
  __typename: 'DoltBeadSourceRecord';
  kind: DoltRecordKind;
  nativeId: Scalars['String']['output'];
  repository: Maybe<Scalars['String']['output']>;
  source: DoltSource;
  sourcePath: Maybe<Scalars['Absent']['output']>;
};

export type DoltEvidenceIndex = ObservedDoltIndex | UnavailableDoltIndex;

/** Whitelisted string-valued labels, preserved literally; not current eligibility or ownership. */
export type DoltLiteralLabels = {
  __typename: 'DoltLiteralLabels';
  /** Observed labels.claimed_by_kind. */
  claimedByKind: Maybe<Scalars['String']['output']>;
  /** Observed labels.expires_at; not a claimability decision. */
  expiresAt: Maybe<Scalars['String']['output']>;
  /** Observed labels.lease_until; never interpreted as a renewed lease. */
  leaseUntil: Maybe<Scalars['String']['output']>;
  /** Observed labels.queue; no lane-policy inference. */
  queueDisposition: Maybe<Scalars['String']['output']>;
};

export type DoltLiteralMetadata = {
  __typename: 'DoltLiteralMetadata';
  actor: Scalars['String']['output'];
  closedAt: Maybe<Scalars['String']['output']>;
  createdAt: Maybe<Scalars['String']['output']>;
  hook: Maybe<Scalars['String']['output']>;
  refs: Array<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  type: Scalars['String']['output'];
  updatedAt: Maybe<Scalars['String']['output']>;
};

export type DoltRecordEvidence = {
  __typename: 'DoltRecordEvidence';
  collectedAt: Scalars['String']['output'];
  coordinateDiagnostics: Array<RepositoryCoordinateDiagnostic>;
  declaredLinks: Array<TaskDocumentResolution>;
  literalLabels: DoltLiteralLabels;
  native: DoltLiteralMetadata;
  sourceRecord: DoltBeadSourceRecord;
  sourceRecordKey: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type DoltRecordKind =
  | 'dolt-bead-v1';

export type DoltRecordSummary = {
  __typename: 'DoltRecordSummary';
  sourceRecord: DoltBeadSourceRecord;
  sourceRecordKey: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type DoltSource =
  | 'dolt-bead';

/** A proposed v1 declaration physically present on the referring resource. Navigation only. */
export type DoltTaskTarget = {
  __typename: 'DoltTaskTarget';
  nativeId: Scalars['String']['output'];
  source: DoltSource;
};

export type EmissionKind =
  | 'emission';

export type EmissionProductionInteraction = {
  __typename: 'EmissionProductionInteraction';
  agentId: Maybe<Scalars['String']['output']>;
  completedAt: Scalars['String']['output'];
  hostId: Scalars['String']['output'];
  interactionId: Scalars['String']['output'];
  kind: EmissionKind;
  modelId: Maybe<Scalars['Absent']['output']>;
  modelProvider: Maybe<Scalars['Absent']['output']>;
  parentInteractionId: Maybe<Scalars['String']['output']>;
  principalId: Maybe<Scalars['String']['output']>;
  runtimeId: Scalars['String']['output'];
  sessionId: Maybe<Scalars['String']['output']>;
  sessionProvider: Maybe<Scalars['String']['output']>;
  startedAt: Scalars['String']['output'];
  traceId: Maybe<Scalars['String']['output']>;
};

export type EvidenceCoverage = {
  __typename: 'EvidenceCoverage';
  reason: Maybe<Scalars['String']['output']>;
  repositoriesObserved: Scalars['Int']['output'];
  skippedRecords: Scalars['Int']['output'];
  status: EvidenceCoverageStatus;
  unreadableRepositories: Scalars['Int']['output'];
};

export type EvidenceCoverageStatus =
  | 'complete'
  | 'partial'
  | 'unavailable';

export type EvidenceIndex = {
  __typename: 'EvidenceIndex';
  dolt: DoltEvidenceIndex;
  handoff: HandoffEvidenceIndex;
  snapshotId: Scalars['String']['output'];
  status: ReadyStatus;
};

export type EvidenceIndexResult = EvidenceIndex | EvidenceRefreshRequired;

export type EvidenceInvalidReference = {
  __typename: 'EvidenceInvalidReference';
  reason: Scalars['String']['output'];
  snapshotId: Scalars['String']['output'];
  sourceRecordKey: Scalars['String']['output'];
  status: InvalidReferenceStatus;
};

export type EvidenceRecord = {
  __typename: 'EvidenceRecord';
  record: ObservedEvidenceRecord;
  snapshotId: Scalars['String']['output'];
  status: ReadyStatus;
};

export type EvidenceRecordNotObserved = {
  __typename: 'EvidenceRecordNotObserved';
  scope: Scalars['String']['output'];
  snapshotId: Scalars['String']['output'];
  source: EvidenceSource;
  sourceRecordKey: Scalars['String']['output'];
  status: MissingStatus;
};

export type EvidenceRecordResult = EvidenceInvalidReference | EvidenceRecord | EvidenceRecordNotObserved | EvidenceRefreshRequired | EvidenceSourceUnavailable;

export type EvidenceRefreshRequired = {
  __typename: 'EvidenceRefreshRequired';
  reason: Scalars['String']['output'];
  snapshotId: Scalars['String']['output'];
  status: RefreshStatus;
};

export type EvidenceSource =
  | 'dolt-bead'
  | 'handoff-bead';

export type EvidenceSourceSummary = {
  __typename: 'EvidenceSourceSummary';
  byRepository: Array<RepositoryEvidenceCount>;
  collectedAt: Maybe<Scalars['String']['output']>;
  coverage: EvidenceCoverage;
  scope: Scalars['String']['output'];
  source: EvidenceSource;
  total: Maybe<Scalars['Int']['output']>;
};

export type EvidenceSourceUnavailable = {
  __typename: 'EvidenceSourceUnavailable';
  reason: Scalars['String']['output'];
  snapshotId: Scalars['String']['output'];
  source: EvidenceSource;
  status: SourceUnavailableStatus;
};

export type EvidenceSummary = {
  __typename: 'EvidenceSummary';
  dolt: EvidenceSourceSummary;
  expiresAt: Scalars['String']['output'];
  generatedAt: Scalars['String']['output'];
  handoff: HandoffEvidenceSummary;
  snapshotId: Scalars['String']['output'];
  unresolvedCount: Scalars['Int']['output'];
};

export type HandoffDocumentSourceRecord = {
  __typename: 'HandoffDocumentSourceRecord';
  kind: HandoffRecordKind;
  nativeId: Maybe<Scalars['String']['output']>;
  repository: Scalars['String']['output'];
  source: HandoffSource;
  sourcePath: Scalars['String']['output'];
};

export type HandoffDocumentTarget = {
  __typename: 'HandoffDocumentTarget';
  repository: Scalars['String']['output'];
  source: HandoffSource;
  sourcePath: Scalars['String']['output'];
};

export type HandoffEvidenceIndex = ObservedHandoffIndex | UnavailableHandoffIndex;

export type HandoffEvidenceSummary = {
  __typename: 'HandoffEvidenceSummary';
  inventory: EvidenceSourceSummary;
  populationByRepository: Array<RepositoryEvidenceCount>;
  populationCount: Maybe<Scalars['Int']['output']>;
};

export type HandoffLiteralMetadata = {
  __typename: 'HandoffLiteralMetadata';
  actor: Maybe<Scalars['String']['output']>;
  authoredCreatedAt: Maybe<Scalars['String']['output']>;
  refs: Array<Scalars['String']['output']>;
  respondingTo: Maybe<Scalars['String']['output']>;
  status: Maybe<Scalars['String']['output']>;
  to: Maybe<Scalars['String']['output']>;
  type: Maybe<Scalars['String']['output']>;
};

export type HandoffRecordEvidence = {
  __typename: 'HandoffRecordEvidence';
  collectedAt: Scalars['String']['output'];
  declaredLinks: Array<TaskDocumentResolution>;
  documentProduction: DocumentProduction;
  literal: HandoffLiteralMetadata;
  observedModifiedAt: Scalars['String']['output'];
  sourceRecord: HandoffDocumentSourceRecord;
  sourceRecordKey: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type HandoffRecordKind =
  | 'handoff-document-v1';

export type HandoffRecordSummary = {
  __typename: 'HandoffRecordSummary';
  sourceRecord: HandoffDocumentSourceRecord;
  sourceRecordKey: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type HandoffSource =
  | 'handoff-bead';

export type HumanInteractionKind =
  | 'human-approval'
  | 'human-edit';

export type HumanProductionInteraction = {
  __typename: 'HumanProductionInteraction';
  agentId: Maybe<Scalars['Absent']['output']>;
  completedAt: Scalars['String']['output'];
  hostId: Scalars['String']['output'];
  interactionId: Scalars['String']['output'];
  kind: HumanInteractionKind;
  modelId: Maybe<Scalars['Absent']['output']>;
  modelProvider: Maybe<Scalars['Absent']['output']>;
  parentInteractionId: Maybe<Scalars['String']['output']>;
  principalId: Scalars['String']['output'];
  runtimeId: Scalars['String']['output'];
  sessionId: Maybe<Scalars['String']['output']>;
  sessionProvider: Maybe<Scalars['String']['output']>;
  startedAt: Scalars['String']['output'];
  traceId: Maybe<Scalars['String']['output']>;
};

export type IncompatibleTaskDocumentLink = {
  __typename: 'IncompatibleTaskDocumentLink';
  fieldPath: Scalars['String']['output'];
  nativeType: Scalars['String']['output'];
  observed: SourceRecord;
  referrer: SourceRecord;
  status: IncompatibleTaskDocumentLinkStatus;
  target: TaskDocumentTarget;
};

export type IncompatibleTaskDocumentLinkStatus =
  | 'target-kind-incompatible';

export type InspectionTarget = AvailableInspectionTarget | UnavailableInspectionTarget;

export type InvalidReferenceStatus =
  | 'invalid-reference';

export type InvalidTaskDocumentLink = {
  __typename: 'InvalidTaskDocumentLink';
  fieldPath: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  referrer: SourceRecord;
  status: InvalidTaskDocumentLinkStatus;
};

export type InvalidTaskDocumentLinkStatus =
  | 'invalid-declaration';

export type LegacyUnknownDocumentProduction = {
  __typename: 'LegacyUnknownDocumentProduction';
  reason: Scalars['String']['output'];
  status: LegacyUnknownStatus;
};

export type LegacyUnknownStatus =
  | 'legacy-unknown';

export type MissingStatus =
  | 'record-not-observed';

export type MissingTargetDiagnostic = {
  __typename: 'MissingTargetDiagnostic';
  reason: MissingTargetDiagnosticReason;
  referrerKey: Scalars['String']['output'];
  relation: ReferenceRelation;
  targetNativeId: Scalars['String']['output'];
};

export type MissingTargetDiagnosticReason =
  | 'target-not-observed';

export type ModelGenerationInteraction = {
  __typename: 'ModelGenerationInteraction';
  agentId: Scalars['String']['output'];
  completedAt: Scalars['String']['output'];
  hostId: Scalars['String']['output'];
  interactionId: Scalars['String']['output'];
  kind: ModelGenerationKind;
  modelId: Scalars['String']['output'];
  modelProvider: Scalars['String']['output'];
  parentInteractionId: Maybe<Scalars['String']['output']>;
  principalId: Maybe<Scalars['String']['output']>;
  runtimeId: Scalars['String']['output'];
  sessionId: Scalars['String']['output'];
  sessionProvider: Scalars['String']['output'];
  startedAt: Scalars['String']['output'];
  traceId: Maybe<Scalars['String']['output']>;
};

export type ModelGenerationKind =
  | 'model-generation';

export type ObservedDoltIndex = {
  __typename: 'ObservedDoltIndex';
  collectedAt: Scalars['String']['output'];
  coverage: EvidenceCoverage;
  records: Array<DoltRecordSummary>;
  scope: Scalars['String']['output'];
  source: DoltSource;
  status: ObservedStatus;
};

export type ObservedEvidenceRecord = DoltRecordEvidence | HandoffRecordEvidence;

export type ObservedHandoffIndex = {
  __typename: 'ObservedHandoffIndex';
  collectedAt: Scalars['String']['output'];
  coverage: EvidenceCoverage;
  populationRecordKeys: Array<Scalars['String']['output']>;
  records: Array<HandoffRecordSummary>;
  scope: Scalars['String']['output'];
  source: HandoffSource;
  status: ObservedStatus;
  unresolvedRelations: Array<UnresolvedRelationDiagnostic>;
};

export type ObservedStatus =
  | 'observed';

export type ProductionInteraction = EmissionProductionInteraction | HumanProductionInteraction | ModelGenerationInteraction;

export type ReadyStatus =
  | 'ready';

/** Self-recorded metadata, never authentication, delivery or approval enforcement. */
export type RecordedDocumentProduction = {
  __typename: 'RecordedDocumentProduction';
  interactions: Array<ProductionInteraction>;
  schemaVersion: Scalars['Int']['output'];
  status: RecordedStatus;
};

export type RecordedStatus =
  | 'recorded';

export type ReferenceRelation =
  | 'closes'
  | 'responding_to';

export type RefreshStatus =
  | 'refresh-required';

export type RelationCycleDiagnostic = {
  __typename: 'RelationCycleDiagnostic';
  cycleKeys: Array<Scalars['String']['output']>;
  reason: RelationCycleDiagnosticReason;
  relation: ClosingRelation;
};

/** Directed keys, canonically rotated to the least key; never member-sorted. */
export type RelationCycleDiagnosticReason =
  | 'relation-cycle';

export type RepositoryCoordinateDiagnostic = {
  __typename: 'RepositoryCoordinateDiagnostic';
  fieldPath: Scalars['String']['output'];
  reason: RepositoryCoordinateReason;
};

export type RepositoryCoordinateReason =
  | 'conflict'
  | 'invalid'
  | 'missing';

export type RepositoryEvidenceCount = {
  __typename: 'RepositoryEvidenceCount';
  count: Scalars['Int']['output'];
  repository: Maybe<Scalars['String']['output']>;
};

export type ResolvedTaskDocumentLink = {
  __typename: 'ResolvedTaskDocumentLink';
  document: HandoffDocumentSourceRecord;
  documentRecordKey: Scalars['String']['output'];
  fieldPath: Scalars['String']['output'];
  referrer: SourceRecord;
  status: ResolvedTaskDocumentLinkStatus;
  target: TaskDocumentTarget;
  task: DoltBeadSourceRecord;
  taskRecordKey: Scalars['String']['output'];
};

export type ResolvedTaskDocumentLinkStatus =
  | 'resolved';

export type SourceRecord = DoltBeadSourceRecord | HandoffDocumentSourceRecord;

export type SourceUnavailableStatus =
  | 'source-unavailable';

export type SuccessorOrderDiagnostic = {
  __typename: 'SuccessorOrderDiagnostic';
  candidateSuccessorKeys: Array<Scalars['String']['output']>;
  predecessorKey: Scalars['String']['output'];
  reason: SuccessorOrderDiagnosticReason;
  relation: ClosingRelation;
  targetNativeId: Maybe<Scalars['String']['output']>;
};

export type SuccessorOrderDiagnosticReason =
  | 'successor-order-unresolved';

export type TaskDocumentResolution = AbsentTaskDocumentLink | AmbiguousTaskDocumentLink | IncompatibleTaskDocumentLink | InvalidTaskDocumentLink | ResolvedTaskDocumentLink | UnavailableTaskDocumentLink;

export type TaskDocumentTarget = DoltTaskTarget | HandoffDocumentTarget;

export type UnavailableDocumentProduction = {
  __typename: 'UnavailableDocumentProduction';
  reason: Scalars['String']['output'];
  status: UnavailableStatus;
};

export type UnavailableDoltIndex = {
  __typename: 'UnavailableDoltIndex';
  reason: Scalars['String']['output'];
  scope: Scalars['String']['output'];
  source: DoltSource;
  status: UnavailableStatus;
};

export type UnavailableHandoffIndex = {
  __typename: 'UnavailableHandoffIndex';
  reason: Scalars['String']['output'];
  scope: Scalars['String']['output'];
  source: HandoffSource;
  status: UnavailableStatus;
};

export type UnavailableInspectionTarget = {
  __typename: 'UnavailableInspectionTarget';
  reason: Scalars['String']['output'];
};

export type UnavailableStatus =
  | 'unavailable';

export type UnavailableTaskDocumentLink = {
  __typename: 'UnavailableTaskDocumentLink';
  fieldPath: Scalars['String']['output'];
  referrer: SourceRecord;
  status: UnavailableTaskDocumentLinkStatus;
  target: TaskDocumentTarget;
};

export type UnavailableTaskDocumentLinkStatus =
  | 'target-source-unavailable';

export type UnresolvedRelationDiagnostic = AmbiguousTargetDiagnostic | MissingTargetDiagnostic | RelationCycleDiagnostic | SuccessorOrderDiagnostic;
