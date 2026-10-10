import type { WorkItemSource } from './work-item.js';

/** Portable coordinates for one source observation. This is a cockpit read key, not a fleet identity. */
export interface SourceRecordRef {
  source: WorkItemSource;
  repository: string | null;
  nativeId: string | null;
  /** Repository-relative reference. For handoff records this is always present. */
  sourcePath: string | null;
}

/** Stable consumer key. JSON tuple encoding avoids delimiter and prefix collisions. */
export function sourceRecordKey(ref: SourceRecordRef): string {
  return JSON.stringify([ref.source, ref.repository, ref.nativeId, ref.sourcePath]);
}

export interface HandoffRecordEvidence {
  sourceRecordKey: string;
  sourceRecord: SourceRecordRef;
  title: string;
  literal: {
    type: string | null;
    status: string | null;
    actor: string | null;
    to: string | null;
    respondingTo: string | null;
    refs: string[];
    authoredCreatedAt: string | null;
  };
  observedModifiedAt: string;
  collectedAt: string;
}

export type UnresolvedRelationReason =
  | 'target-matches-multiple-records'
  | 'target-not-observed'
  | 'successor-order-unresolved'
  | 'relation-cycle';

export interface UnresolvedRelationDiagnostic {
  reason: UnresolvedRelationReason;
  relation: 'closes' | 'responding_to';
  targetNativeId: string | null;
  /** Sorted source-record keys for the referrer and every known affected record. */
  affectedSourceRecordKeys: string[];
}

export type EvidenceCoverage =
  | { status: 'complete'; repositoriesObserved: number; skippedRecords: 0; unreadableRepositories: 0 }
  | { status: 'partial'; repositoriesObserved: number; skippedRecords: number; unreadableRepositories: number }
  | { status: 'unavailable'; repositoriesObserved: 0; skippedRecords: 0; unreadableRepositories: 0; reason: string };

export interface StandaloneUnansweredBriefs {
  name: 'standaloneUnansweredBriefs';
  records: HandoffRecordEvidence[];
  total: number;
  byRepository: Array<{ repository: string; count: number }>;
}

export interface CockpitEvidence {
  coverage: EvidenceCoverage;
  /** Metadata-only envelope for every parsed handoff record, including non-lane diagnostics. */
  records: HandoffRecordEvidence[];
  standaloneUnansweredBriefs: StandaloneUnansweredBriefs;
  unresolvedRelations: UnresolvedRelationDiagnostic[];
}

export function emptyCockpitEvidence(coverage: EvidenceCoverage): CockpitEvidence {
  return {
    coverage,
    records: [],
    standaloneUnansweredBriefs: {
      name: 'standaloneUnansweredBriefs',
      records: [],
      total: 0,
      byRepository: [],
    },
    unresolvedRelations: [],
  };
}
