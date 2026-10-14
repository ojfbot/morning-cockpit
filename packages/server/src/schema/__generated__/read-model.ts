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
  fieldPath: Scalars['String']['output'];
  referrer: SourceRecord;
  status: AbsentTaskDocumentLinkStatus;
  target: TaskDocumentTarget;
};

export type AbsentTaskDocumentLinkStatus =
  | 'target_not_observed_in_scope';

export type AgentLiveness = {
  agentId: Scalars['String']['output'];
  lastEventAt: Scalars['String']['output'];
  lastEventType: Scalars['String']['output'];
  state: AgentLivenessState;
};

export type AgentLivenessState =
  | 'DARK'
  | 'IDLE'
  | 'LIVE';

export type AmbiguousTargetDiagnostic = {
  candidateTargetKeys: Array<Scalars['String']['output']>;
  reason: AmbiguousTargetDiagnosticReason;
  referrerKey: Scalars['String']['output'];
  relation: ReferenceRelation;
  targetNativeId: Scalars['String']['output'];
};

export type AmbiguousTargetDiagnosticReason =
  | 'target_matches_multiple_records';

export type AmbiguousTaskDocumentLink = {
  candidates: Array<SourceRecord>;
  fieldPath: Scalars['String']['output'];
  referrer: SourceRecord;
  status: AmbiguousTaskDocumentLinkStatus;
  target: TaskDocumentTarget;
};

export type AmbiguousTaskDocumentLinkStatus =
  | 'target_ambiguous';

export type AvailableInspectionTarget = {
  expiresAt: Scalars['String']['output'];
  generatedAt: Scalars['String']['output'];
  snapshotId: Scalars['String']['output'];
  sourceRecord: SourceRecord;
  sourceRecordKey: Scalars['String']['output'];
};

export type BriefingArtifact = {
  align: Scalars['String']['output'];
  closes: Scalars['String']['output'];
  criteria: Array<Scalars['String']['output']>;
  target: Scalars['String']['output'];
  task: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type BriefingBranch = {
  artifact?: Maybe<BriefingArtifact>;
  cta?: Maybe<Scalars['String']['output']>;
  doneText?: Maybe<Scalars['String']['output']>;
  key: Scalars['String']['output'];
  label: Scalars['String']['output'];
  outcome?: Maybe<Scalars['String']['output']>;
  recommended: Scalars['Boolean']['output'];
  type: Scalars['String']['output'];
};

export type BriefingSnapshot = {
  generatedAt: Scalars['String']['output'];
  /** Forward-declared (F2) — the repo this briefing is scoped to; null while global. */
  repo?: Maybe<Scalars['String']['output']>;
  source: Scalars['String']['output'];
  threads: Array<BriefingThread>;
};

export type BriefingThread = {
  branches: Array<BriefingBranch>;
  catchUp: Scalars['String']['output'];
  id: Scalars['String']['output'];
  question: Scalars['String']['output'];
  tag: Scalars['String']['output'];
  title: Scalars['String']['output'];
  whyNow: Scalars['String']['output'];
};

export type ClosingRelation =
  | 'closes';

export type DocumentProduction = LegacyUnknownDocumentProduction | RecordedDocumentProduction | UnavailableDocumentProduction;

export type DoltBeadSourceRecord = {
  kind: DoltRecordKind;
  nativeId: Scalars['String']['output'];
  repository?: Maybe<Scalars['String']['output']>;
  source: DoltSource;
  sourcePath?: Maybe<Scalars['Absent']['output']>;
};

export type DoltEvidenceIndex = ObservedDoltIndex | UnavailableDoltIndex;

/** Whitelisted string-valued labels, preserved literally; not current eligibility or ownership. */
export type DoltLiteralLabels = {
  /** Observed labels.claimed_by_kind. */
  claimedByKind?: Maybe<Scalars['String']['output']>;
  /** Observed labels.expires_at; not a claimability decision. */
  expiresAt?: Maybe<Scalars['String']['output']>;
  /** Observed labels.lease_until; never interpreted as a renewed lease. */
  leaseUntil?: Maybe<Scalars['String']['output']>;
  /** Observed labels.queue; no lane-policy inference. */
  queueDisposition?: Maybe<Scalars['String']['output']>;
};

export type DoltLiteralMetadata = {
  actor: Scalars['String']['output'];
  closedAt?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  hook?: Maybe<Scalars['String']['output']>;
  refs: Array<Scalars['String']['output']>;
  status: Scalars['String']['output'];
  type: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['String']['output']>;
};

export type DoltRecordEvidence = {
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
  | 'dolt_bead_v1';

export type DoltRecordSummary = {
  sourceRecord: DoltBeadSourceRecord;
  sourceRecordKey: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type DoltSource =
  | 'dolt_bead';

/** A proposed v1 declaration physically present on the referring resource. Navigation only. */
export type DoltTaskTarget = {
  nativeId: Scalars['String']['output'];
  source: DoltSource;
};

export type EmissionKind =
  | 'emission';

export type EmissionProductionInteraction = {
  agentId?: Maybe<Scalars['String']['output']>;
  completedAt: Scalars['String']['output'];
  hostId: Scalars['String']['output'];
  interactionId: Scalars['String']['output'];
  kind: EmissionKind;
  modelId?: Maybe<Scalars['Absent']['output']>;
  modelProvider?: Maybe<Scalars['Absent']['output']>;
  parentInteractionId?: Maybe<Scalars['String']['output']>;
  principalId?: Maybe<Scalars['String']['output']>;
  runtimeId: Scalars['String']['output'];
  sessionId?: Maybe<Scalars['String']['output']>;
  sessionProvider?: Maybe<Scalars['String']['output']>;
  startedAt: Scalars['String']['output'];
  traceId?: Maybe<Scalars['String']['output']>;
};

export type EvidenceCoverage = {
  reason?: Maybe<Scalars['String']['output']>;
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
  dolt: DoltEvidenceIndex;
  handoff: HandoffEvidenceIndex;
  snapshotId: Scalars['String']['output'];
  status: ReadyStatus;
};

export type EvidenceIndexResult = EvidenceIndex | EvidenceRefreshRequired;

export type EvidenceInvalidReference = {
  reason: Scalars['String']['output'];
  snapshotId: Scalars['String']['output'];
  sourceRecordKey: Scalars['String']['output'];
  status: InvalidReferenceStatus;
};

export type EvidenceRecord = {
  record: ObservedEvidenceRecord;
  snapshotId: Scalars['String']['output'];
  status: ReadyStatus;
};

export type EvidenceRecordNotObserved = {
  scope: Scalars['String']['output'];
  snapshotId: Scalars['String']['output'];
  source: EvidenceSource;
  sourceRecordKey: Scalars['String']['output'];
  status: MissingStatus;
};

export type EvidenceRecordResult = EvidenceInvalidReference | EvidenceRecord | EvidenceRecordNotObserved | EvidenceRefreshRequired | EvidenceSourceUnavailable;

export type EvidenceRefreshRequired = {
  reason: Scalars['String']['output'];
  snapshotId: Scalars['String']['output'];
  status: RefreshStatus;
};

export type EvidenceSource =
  | 'dolt_bead'
  | 'handoff_bead';

export type EvidenceSourceSummary = {
  byRepository: Array<RepositoryEvidenceCount>;
  collectedAt?: Maybe<Scalars['String']['output']>;
  coverage: EvidenceCoverage;
  scope: Scalars['String']['output'];
  source: EvidenceSource;
  total?: Maybe<Scalars['Int']['output']>;
};

export type EvidenceSourceUnavailable = {
  reason: Scalars['String']['output'];
  snapshotId: Scalars['String']['output'];
  source: EvidenceSource;
  status: SourceUnavailableStatus;
};

export type EvidenceSummary = {
  dolt: EvidenceSourceSummary;
  expiresAt: Scalars['String']['output'];
  generatedAt: Scalars['String']['output'];
  handoff: HandoffEvidenceSummary;
  snapshotId: Scalars['String']['output'];
  unresolvedCount: Scalars['Int']['output'];
};

export type HandoffDocumentSourceRecord = {
  kind: HandoffRecordKind;
  nativeId?: Maybe<Scalars['String']['output']>;
  repository: Scalars['String']['output'];
  source: HandoffSource;
  sourcePath: Scalars['String']['output'];
};

export type HandoffDocumentTarget = {
  repository: Scalars['String']['output'];
  source: HandoffSource;
  sourcePath: Scalars['String']['output'];
};

export type HandoffEvidenceIndex = ObservedHandoffIndex | UnavailableHandoffIndex;

export type HandoffEvidenceSummary = {
  inventory: EvidenceSourceSummary;
  populationByRepository: Array<RepositoryEvidenceCount>;
  populationCount?: Maybe<Scalars['Int']['output']>;
};

export type HandoffLiteralMetadata = {
  actor?: Maybe<Scalars['String']['output']>;
  authoredCreatedAt?: Maybe<Scalars['String']['output']>;
  refs: Array<Scalars['String']['output']>;
  respondingTo?: Maybe<Scalars['String']['output']>;
  status?: Maybe<Scalars['String']['output']>;
  to?: Maybe<Scalars['String']['output']>;
  type?: Maybe<Scalars['String']['output']>;
};

export type HandoffRecordEvidence = {
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
  | 'handoff_document_v1';

export type HandoffRecordSummary = {
  sourceRecord: HandoffDocumentSourceRecord;
  sourceRecordKey: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type HandoffSource =
  | 'handoff_bead';

export type HumanInteractionKind =
  | 'human_approval'
  | 'human_edit';

export type HumanProductionInteraction = {
  agentId?: Maybe<Scalars['Absent']['output']>;
  completedAt: Scalars['String']['output'];
  hostId: Scalars['String']['output'];
  interactionId: Scalars['String']['output'];
  kind: HumanInteractionKind;
  modelId?: Maybe<Scalars['Absent']['output']>;
  modelProvider?: Maybe<Scalars['Absent']['output']>;
  parentInteractionId?: Maybe<Scalars['String']['output']>;
  principalId: Scalars['String']['output'];
  runtimeId: Scalars['String']['output'];
  sessionId?: Maybe<Scalars['String']['output']>;
  sessionProvider?: Maybe<Scalars['String']['output']>;
  startedAt: Scalars['String']['output'];
  traceId?: Maybe<Scalars['String']['output']>;
};

export type IncompatibleTaskDocumentLink = {
  fieldPath: Scalars['String']['output'];
  nativeType: Scalars['String']['output'];
  observed: SourceRecord;
  referrer: SourceRecord;
  status: IncompatibleTaskDocumentLinkStatus;
  target: TaskDocumentTarget;
};

export type IncompatibleTaskDocumentLinkStatus =
  | 'target_kind_incompatible';

export type InspectionTarget = AvailableInspectionTarget | UnavailableInspectionTarget;

export type InvalidReferenceStatus =
  | 'invalid_reference';

export type InvalidTaskDocumentLink = {
  fieldPath: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  referrer: SourceRecord;
  status: InvalidTaskDocumentLinkStatus;
};

export type InvalidTaskDocumentLinkStatus =
  | 'invalid_declaration';

export type LegacyUnknownDocumentProduction = {
  reason: Scalars['String']['output'];
  status: LegacyUnknownStatus;
};

export type LegacyUnknownStatus =
  | 'legacy_unknown';

/**
 * Canonical read-model contract — the fleet-wide GraphQL SDL (ADR-0013).
 *
 * One typed shape for the morning-cockpit human UI and agent readers alike (ADR-0011). Authored here
 * in core as the authority; the cockpit facade's types are codegen'd from this file (fetched at CI via
 * git-clone — no runtime import, ADR-0001 extended). Query-only: there is NO Mutation type — the sole
 * upstream write path stays Handoff Emission (ADR-0005).
 *
 * Field shapes mirror morning-cockpit `@cockpit/shared` view-models; an SDL<->shared parity test in the
 * cockpit keeps them from diverging (a deliberate drift breaks CI).
 */
export type Liveness =
  | 'DARK'
  | 'LIVE'
  | 'STALE';

export type MissingStatus =
  | 'record_not_observed';

export type MissingTargetDiagnostic = {
  reason: MissingTargetDiagnosticReason;
  referrerKey: Scalars['String']['output'];
  relation: ReferenceRelation;
  targetNativeId: Scalars['String']['output'];
};

export type MissingTargetDiagnosticReason =
  | 'target_not_observed';

export type ModelGenerationInteraction = {
  agentId: Scalars['String']['output'];
  completedAt: Scalars['String']['output'];
  hostId: Scalars['String']['output'];
  interactionId: Scalars['String']['output'];
  kind: ModelGenerationKind;
  modelId: Scalars['String']['output'];
  modelProvider: Scalars['String']['output'];
  parentInteractionId?: Maybe<Scalars['String']['output']>;
  principalId?: Maybe<Scalars['String']['output']>;
  runtimeId: Scalars['String']['output'];
  sessionId: Scalars['String']['output'];
  sessionProvider: Scalars['String']['output'];
  startedAt: Scalars['String']['output'];
  traceId?: Maybe<Scalars['String']['output']>;
};

export type ModelGenerationKind =
  | 'model_generation';

export type ObservedDoltIndex = {
  collectedAt: Scalars['String']['output'];
  coverage: EvidenceCoverage;
  records: Array<DoltRecordSummary>;
  scope: Scalars['String']['output'];
  source: DoltSource;
  status: ObservedStatus;
};

export type ObservedEvidenceRecord = DoltRecordEvidence | HandoffRecordEvidence;

export type ObservedHandoffIndex = {
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

export type Query = {
  /** Derived agent liveness (ADR-0008). */
  agentLiveness: Array<AgentLiveness>;
  /** Briefing (00). `repo` arg forward-declared for Slice F2 (repo-scoped briefing); null = global. */
  briefing: BriefingSnapshot;
  evidenceIndex: EvidenceIndexResult;
  evidenceRecord: EvidenceRecordResult;
  /** Counts and coverage for one captured evidence observation. */
  evidenceSummary: EvidenceSummary;
  /** Fleet (01) repo cards. */
  fleet: Array<RepoCard>;
  /** Lane work-items: overnight | pickup | available. */
  workItems: Array<WorkItem>;
};


export type QueryBriefingArgs = {
  repo?: InputMaybe<Scalars['String']['input']>;
};


export type QueryEvidenceIndexArgs = {
  snapshotId: Scalars['String']['input'];
};


export type QueryEvidenceRecordArgs = {
  snapshotId: Scalars['String']['input'];
  sourceRecordKey: Scalars['String']['input'];
};


export type QueryWorkItemsArgs = {
  lane: Scalars['String']['input'];
};

export type ReadyStatus =
  | 'ready';

/** Self-recorded metadata, never authentication, delivery or approval enforcement. */
export type RecordedDocumentProduction = {
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
  | 'refresh_required';

export type RelationCycleDiagnostic = {
  cycleKeys: Array<Scalars['String']['output']>;
  reason: RelationCycleDiagnosticReason;
  relation: ClosingRelation;
};

/** Directed keys, canonically rotated to the least key; never member-sorted. */
export type RelationCycleDiagnosticReason =
  | 'relation_cycle';

export type RepoCard = {
  here?: Maybe<Scalars['Boolean']['output']>;
  lastActivity?: Maybe<Scalars['String']['output']>;
  /** Forward-declared (L1) — empty until the tile link set lands. */
  links: Array<RepoLink>;
  liveness: Liveness;
  name: Scalars['String']['output'];
  openCount: Scalars['Int']['output'];
  phase: Scalars['String']['output'];
  /** Forward-declared (L3/L3s) — null until the popover contents spike resolves. */
  popover?: Maybe<RepoPopover>;
  role: Scalars['String']['output'];
};

/** A per-tile launch link. `links` is forward-declared for Slice L1 (extensible list). */
export type RepoLink = {
  kind: Scalars['String']['output'];
  label: Scalars['String']['output'];
  url: Scalars['String']['output'];
};

/** Hover/focus popover payload. Contents are deferred to the L3s spike (ADR-0012 #7) — placeholder. */
export type RepoPopover = {
  placeholder: Scalars['Boolean']['output'];
};

export type RepositoryCoordinateDiagnostic = {
  fieldPath: Scalars['String']['output'];
  reason: RepositoryCoordinateReason;
};

export type RepositoryCoordinateReason =
  | 'conflict'
  | 'invalid'
  | 'missing';

export type RepositoryEvidenceCount = {
  count: Scalars['Int']['output'];
  repository?: Maybe<Scalars['String']['output']>;
};

export type ResolvedTaskDocumentLink = {
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
  | 'source_unavailable';

export type SuccessorOrderDiagnostic = {
  candidateSuccessorKeys: Array<Scalars['String']['output']>;
  predecessorKey: Scalars['String']['output'];
  reason: SuccessorOrderDiagnosticReason;
  relation: ClosingRelation;
  targetNativeId?: Maybe<Scalars['String']['output']>;
};

export type SuccessorOrderDiagnosticReason =
  | 'successor_order_unresolved';

export type TaskDocumentResolution = AbsentTaskDocumentLink | AmbiguousTaskDocumentLink | IncompatibleTaskDocumentLink | InvalidTaskDocumentLink | ResolvedTaskDocumentLink | UnavailableTaskDocumentLink;

export type TaskDocumentTarget = DoltTaskTarget | HandoffDocumentTarget;

export type UnavailableDocumentProduction = {
  reason: Scalars['String']['output'];
  status: UnavailableStatus;
};

export type UnavailableDoltIndex = {
  reason: Scalars['String']['output'];
  scope: Scalars['String']['output'];
  source: DoltSource;
  status: UnavailableStatus;
};

export type UnavailableHandoffIndex = {
  reason: Scalars['String']['output'];
  scope: Scalars['String']['output'];
  source: HandoffSource;
  status: UnavailableStatus;
};

export type UnavailableInspectionTarget = {
  reason: Scalars['String']['output'];
};

export type UnavailableStatus =
  | 'unavailable';

export type UnavailableTaskDocumentLink = {
  fieldPath: Scalars['String']['output'];
  referrer: SourceRecord;
  status: UnavailableTaskDocumentLinkStatus;
  target: TaskDocumentTarget;
};

export type UnavailableTaskDocumentLinkStatus =
  | 'target_source_unavailable';

export type UnresolvedRelationDiagnostic = AmbiguousTargetDiagnostic | MissingTargetDiagnostic | RelationCycleDiagnostic | SuccessorOrderDiagnostic;

export type WorkItem = {
  activityAt: Scalars['String']['output'];
  actor?: Maybe<Scalars['String']['output']>;
  claimedBy?: Maybe<Scalars['String']['output']>;
  claimedByKind?: Maybe<Scalars['String']['output']>;
  closedAt?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  inspectionTarget: InspectionTarget;
  kind: Scalars['String']['output'];
  lane: Scalars['String']['output'];
  leaseUntil?: Maybe<Scalars['String']['output']>;
  nativeId: Scalars['String']['output'];
  posted?: Maybe<Scalars['Boolean']['output']>;
  repo?: Maybe<Scalars['String']['output']>;
  source: Scalars['String']['output'];
  sourceRecord?: Maybe<SourceRecord>;
  sourceRecordKey?: Maybe<Scalars['String']['output']>;
  staleDays?: Maybe<Scalars['Int']['output']>;
  status: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['String']['output']>;
  url?: Maybe<Scalars['String']['output']>;
};
