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

export type Query = {
  /** Derived agent liveness (ADR-0008). */
  agentLiveness: Array<AgentLiveness>;
  /** Briefing (00). `repo` arg forward-declared for Slice F2 (repo-scoped briefing); null = global. */
  briefing: BriefingSnapshot;
  /** Fleet (01) repo cards. */
  fleet: Array<RepoCard>;
  /** Lane work-items: overnight | pickup | available. */
  workItems: Array<WorkItem>;
};


export type QueryBriefingArgs = {
  repo?: InputMaybe<Scalars['String']['input']>;
};


export type QueryWorkItemsArgs = {
  lane: Scalars['String']['input'];
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
  staleDays?: Maybe<Scalars['Int']['output']>;
  status: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt?: Maybe<Scalars['String']['output']>;
  url?: Maybe<Scalars['String']['output']>;
};
