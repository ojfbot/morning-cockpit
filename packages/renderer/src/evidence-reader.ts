import type {
  EvidenceSummary,
  EvidenceIndexResult,
  EvidenceRecordResult,
} from '@cockpit/shared';
import { decodeSummary, decodeIndex, decodeRecord } from './evidence-codec.js';
const SOURCE_FRAGMENT = `fragment SourceFields on SourceRecord { __typename
 ... on DoltBeadSourceRecord { doltKind:kind doltSource:source doltRepo:repository doltId:nativeId doltPath:sourcePath }
 ... on HandoffDocumentSourceRecord { handoffKind:kind handoffSource:source handoffRepo:repository handoffId:nativeId handoffPath:sourcePath } }`;
const SOURCE = '... SourceFields';
const COVERAGE =
  '__typename status repositoriesObserved skippedRecords unreadableRepositories reason';
const COUNTS = '__typename repository count';
const SUMMARY = `__typename snapshotId generatedAt expiresAt unresolvedCount dolt { __typename source scope collectedAt total coverage { ${COVERAGE} } byRepository { ${COUNTS} } } handoff { __typename inventory { __typename source scope collectedAt total coverage { ${COVERAGE} } byRepository { ${COUNTS} } } populationCount populationByRepository { ${COUNTS} } }`;
const DIAGNOSTICS = `__typename
 ... on MissingTargetDiagnostic { reason referenceRelation:relation requestedTarget:targetNativeId referrerKey }
 ... on AmbiguousTargetDiagnostic { reason referenceRelation:relation requestedTarget:targetNativeId referrerKey candidateTargetKeys }
 ... on SuccessorOrderDiagnostic { reason closingRelation:relation predecessorNativeId:targetNativeId predecessorKey candidateSuccessorKeys }
 ... on RelationCycleDiagnostic { reason closingRelation:relation cycleKeys }`;
// Diagnostic reasons are single-value enums with distinct types; alias them per concrete variant.
const DIAG = DIAGNOSTICS.replace(' { reason ', ' { missingReason:reason ')
  .replace(' { reason ', ' { ambiguousReason:reason ')
  .replace(' { reason ', ' { successorReason:reason ')
  .replace(' { reason ', ' { cycleReason:reason ');
const TARGET = `__typename ... on DoltTaskTarget { doltSource:source nativeId } ... on HandoffDocumentTarget { handoffSource:source repository sourcePath }`;
const LINKS = `__typename
 ... on ResolvedTaskDocumentLink { resolvedStatus:status referrer { ${SOURCE} } fieldPath target { ${TARGET} } task { ${SOURCE} } taskRecordKey document { ${SOURCE} } documentRecordKey }
 ... on UnavailableTaskDocumentLink { unavailableStatus:status referrer { ${SOURCE} } fieldPath target { ${TARGET} } }
 ... on AbsentTaskDocumentLink { absentStatus:status referrer { ${SOURCE} } fieldPath target { ${TARGET} } }
 ... on AmbiguousTaskDocumentLink { ambiguousStatus:status referrer { ${SOURCE} } fieldPath target { ${TARGET} } candidates { ${SOURCE} } }
 ... on IncompatibleTaskDocumentLink { incompatibleStatus:status referrer { ${SOURCE} } fieldPath target { ${TARGET} } observed { ${SOURCE} } nativeType }
 ... on InvalidTaskDocumentLink { invalidStatus:status referrer { ${SOURCE} } fieldPath reason }`;
const COMMON_INTERACTION =
  'interactionId parentInteractionId runtimeId traceId hostId startedAt completedAt';
const INTERACTIONS = `__typename
 ... on ModelGenerationInteraction { ${COMMON_INTERACTION} genKind:kind genPrincipal:principalId genAgent:agentId genSessionProvider:sessionProvider genSessionId:sessionId genModelProvider:modelProvider genModelId:modelId }
 ... on HumanProductionInteraction { ${COMMON_INTERACTION} humanKind:kind humanPrincipal:principalId humanAgent:agentId humanSessionProvider:sessionProvider humanSessionId:sessionId humanModelProvider:modelProvider humanModelId:modelId }
 ... on EmissionProductionInteraction { ${COMMON_INTERACTION} emissionKind:kind emissionPrincipal:principalId emissionAgent:agentId emissionSessionProvider:sessionProvider emissionSessionId:sessionId emissionModelProvider:modelProvider emissionModelId:modelId }`;
const PRODUCTION = `__typename ... on LegacyUnknownDocumentProduction { legacyStatus:status reason } ... on UnavailableDocumentProduction { unavailableStatus:status reason } ... on RecordedDocumentProduction { recordedStatus:status schemaVersion interactions { ${INTERACTIONS} } }`;

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
async function query(
  query: string,
  field: string,
  variables: Record<string, string>,
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  if (!response.ok)
    throw new Error(`Evidence read failed (${response.status})`);
  const result: unknown = await response.json();
  if (
    !isObject(result) ||
    result.errors !== undefined ||
    !isObject(result.data) ||
    !(field in result.data)
  )
    throw new Error('Evidence GraphQL response is unavailable');
  return result.data[field];
}
export async function fetchEvidenceSummary(
  signal?: AbortSignal,
): Promise<EvidenceSummary> {
  return decodeSummary(
    await query(
      `{ evidenceSummary { ${SUMMARY} } }`,
      'evidenceSummary',
      {},
      signal,
    ),
  );
}
export async function fetchEvidenceIndex(
  snapshotId: string,
  signal?: AbortSignal,
): Promise<EvidenceIndexResult> {
  const q = `query($snapshotId:String!) { evidenceIndex(snapshotId:$snapshotId) { __typename
    ... on EvidenceIndex { readyStatus:status snapshotId dolt { __typename
      ... on ObservedDoltIndex { observedStatus:status source scope collectedAt coverage { ${COVERAGE} } records { __typename sourceRecordKey title sourceRecord { ${SOURCE} } } }
      ... on UnavailableDoltIndex { unavailableStatus:status source scope reason } }
      handoff { __typename ... on ObservedHandoffIndex { observedStatus:status source scope collectedAt coverage { ${COVERAGE} } records { __typename sourceRecordKey title sourceRecord { ${SOURCE} } } populationRecordKeys unresolvedRelations { ${DIAG} } }
      ... on UnavailableHandoffIndex { unavailableStatus:status source scope reason } } }
    ... on EvidenceRefreshRequired { refreshStatus:status snapshotId reason } } }`;
  return decodeIndex(
    await query(q + SOURCE_FRAGMENT, 'evidenceIndex', { snapshotId }, signal),
    snapshotId,
  );
}
export async function fetchEvidenceRecord(
  snapshotId: string,
  sourceRecordKey: string,
  signal?: AbortSignal,
): Promise<EvidenceRecordResult> {
  const q = `query($snapshotId:String!,$sourceRecordKey:String!) { evidenceRecord(snapshotId:$snapshotId,sourceRecordKey:$sourceRecordKey) { __typename
    ... on EvidenceRecord { readyStatus:status snapshotId record { __typename
      ... on DoltRecordEvidence { sourceRecordKey title sourceRecord { ${SOURCE} } collectedAt native { __typename type status actor hook refs createdAt updatedAt closedAt } literalLabels { __typename queueDisposition claimedByKind leaseUntil expiresAt } coordinateDiagnostics { __typename reason fieldPath } declaredLinks { ${LINKS} } }
      ... on HandoffRecordEvidence { sourceRecordKey title sourceRecord { ${SOURCE} } collectedAt literal { __typename type status actor to respondingTo refs authoredCreatedAt } observedModifiedAt documentProduction { ${PRODUCTION} } declaredLinks { ${LINKS} } } } }
    ... on EvidenceRefreshRequired { refreshStatus:status snapshotId reason }
    ... on EvidenceRecordNotObserved { missingStatus:status snapshotId sourceRecordKey source scope }
    ... on EvidenceInvalidReference { invalidStatus:status snapshotId sourceRecordKey reason }
    ... on EvidenceSourceUnavailable { unavailableStatus:status snapshotId source reason } } }`;
  return decodeRecord(
    await query(
      q + SOURCE_FRAGMENT,
      'evidenceRecord',
      { snapshotId, sourceRecordKey },
      signal,
    ),
    snapshotId,
    sourceRecordKey,
  );
}
