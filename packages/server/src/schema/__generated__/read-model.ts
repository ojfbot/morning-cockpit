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
};

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
  reason: Scalars['String']['output'];
  referrerKey: Scalars['String']['output'];
  relation: ReferenceRelation;
  targetNativeId: Scalars['String']['output'];
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

export type DoltBeadSourceRecord = SourceRecord & {
  kind: Scalars['String']['output'];
  nativeId: Scalars['String']['output'];
  repository?: Maybe<Scalars['String']['output']>;
  source: Scalars['String']['output'];
  sourcePath?: Maybe<Scalars['String']['output']>;
};

export type EvidenceCoverage = {
  reason?: Maybe<Scalars['String']['output']>;
  repositoriesObserved: Scalars['Int']['output'];
  skippedRecords: Scalars['Int']['output'];
  status: Scalars['String']['output'];
  unreadableRepositories: Scalars['Int']['output'];
};

export type EvidenceIndex = {
  populationRecordKeys: Array<Scalars['String']['output']>;
  records: Array<HandoffRecordSummary>;
  snapshotId: Scalars['String']['output'];
  status: Scalars['String']['output'];
  unresolvedRelations: Array<UnresolvedRelationDiagnostic>;
};

export type EvidenceIndexResult = EvidenceIndex | EvidenceRefreshRequired;

export type EvidenceRecord = {
  record: HandoffRecordEvidence;
  snapshotId: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type EvidenceRecordNotObserved = {
  snapshotId: Scalars['String']['output'];
  sourceRecordKey: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type EvidenceRecordResult = EvidenceRecord | EvidenceRecordNotObserved | EvidenceRefreshRequired;

export type EvidenceRefreshRequired = {
  reason: Scalars['String']['output'];
  snapshotId: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type EvidenceSummary = {
  byRepository: Array<RepositoryEvidenceCount>;
  coverage: EvidenceCoverage;
  generatedAt: Scalars['String']['output'];
  snapshotId: Scalars['String']['output'];
  total: Scalars['Int']['output'];
  unresolvedCount: Scalars['Int']['output'];
};

export type HandoffDocumentSourceRecord = SourceRecord & {
  kind: Scalars['String']['output'];
  nativeId?: Maybe<Scalars['String']['output']>;
  repository: Scalars['String']['output'];
  source: Scalars['String']['output'];
  sourcePath: Scalars['String']['output'];
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
  documentProduction: DocumentProduction;
  literal: HandoffLiteralMetadata;
  observedModifiedAt: Scalars['String']['output'];
  sourceRecord: SourceRecord;
  sourceRecordKey: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type HandoffRecordSummary = {
  sourceRecord: SourceRecord;
  sourceRecordKey: Scalars['String']['output'];
  title: Scalars['String']['output'];
};

export type LegacyUnknownDocumentProduction = {
  reason: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

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

export type MissingTargetDiagnostic = {
  reason: Scalars['String']['output'];
  referrerKey: Scalars['String']['output'];
  relation: ReferenceRelation;
  targetNativeId: Scalars['String']['output'];
};

export type ProductionInteraction = {
  agentId?: Maybe<Scalars['String']['output']>;
  completedAt: Scalars['String']['output'];
  hostId: Scalars['String']['output'];
  interactionId: Scalars['String']['output'];
  kind: Scalars['String']['output'];
  modelId?: Maybe<Scalars['String']['output']>;
  modelProvider?: Maybe<Scalars['String']['output']>;
  parentInteractionId?: Maybe<Scalars['String']['output']>;
  principalId?: Maybe<Scalars['String']['output']>;
  runtimeId: Scalars['String']['output'];
  sessionId?: Maybe<Scalars['String']['output']>;
  sessionProvider?: Maybe<Scalars['String']['output']>;
  startedAt: Scalars['String']['output'];
  traceId?: Maybe<Scalars['String']['output']>;
};

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

/** Self-recorded trace, never proof of authenticated authority. See inspector-contract.md; emission enforcement inactive. */
export type RecordedDocumentProduction = {
  interactions: Array<ProductionInteraction>;
  schemaVersion: Scalars['Int']['output'];
  status: Scalars['String']['output'];
};

export type ReferenceRelation =
  | 'closes'
  | 'responding_to';

/** Directed keys, canonically rotated to the least key; never member-sorted. */
export type RelationCycleDiagnostic = {
  cycleKeys: Array<Scalars['String']['output']>;
  reason: Scalars['String']['output'];
  relation: ClosingRelation;
};

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

export type RepositoryEvidenceCount = {
  count: Scalars['Int']['output'];
  repository: Scalars['String']['output'];
};

export type SourceRecord = {
  kind: Scalars['String']['output'];
  nativeId?: Maybe<Scalars['String']['output']>;
  repository?: Maybe<Scalars['String']['output']>;
  source: Scalars['String']['output'];
  sourcePath?: Maybe<Scalars['String']['output']>;
};

export type SuccessorOrderDiagnostic = {
  candidateSuccessorKeys: Array<Scalars['String']['output']>;
  predecessorKey: Scalars['String']['output'];
  reason: Scalars['String']['output'];
  relation: ClosingRelation;
  targetNativeId?: Maybe<Scalars['String']['output']>;
};

export type UnavailableDocumentProduction = {
  reason: Scalars['String']['output'];
  status: Scalars['String']['output'];
};

export type UnresolvedRelationDiagnostic = AmbiguousTargetDiagnostic | MissingTargetDiagnostic | RelationCycleDiagnostic | SuccessorOrderDiagnostic;

export type WorkItem = {
  activityAt: Scalars['String']['output'];
  actor?: Maybe<Scalars['String']['output']>;
  claimedBy?: Maybe<Scalars['String']['output']>;
  claimedByKind?: Maybe<Scalars['String']['output']>;
  closedAt?: Maybe<Scalars['String']['output']>;
  createdAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
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
