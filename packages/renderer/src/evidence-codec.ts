import type {
  DocumentProduction,
  DoltEvidenceIndex,
  DoltRecordSummary,
  EvidenceCoverage,
  EvidenceIndexResult,
  EvidenceRecordResult,
  EvidenceSourceSummary,
  EvidenceSummary,
  HandoffEvidenceIndex,
  HandoffRecordSummary,
  ObservedEvidenceRecord,
  ProductionInteraction,
  RepositoryEvidenceCount,
  SourceRecord,
  TaskDocumentResolution,
  TaskDocumentTarget,
  UnresolvedRelationDiagnostic,
} from '@cockpit/shared/inspector-contract';
import { sourceRecordKey, parseDocumentProduction } from '@cockpit/shared';
// Unknown GraphQL JSON stops here. Constructors are checked against generated SDL models.
function object(v: unknown): Record<string, unknown> {
  if (!isObject(v)) throw new Error('Expected evidence object');
  return v;
}
function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function text(v: unknown): string {
  if (typeof v !== 'string') throw new Error('Missing evidence string');
  return v;
}
function nonempty(v: unknown): string {
  const s = text(v);
  if (!s.trim()) throw new Error('Empty evidence coordinate');
  return s;
}
function nullable(v: unknown): string | null {
  return v === null ? null : text(v);
}
function number(v: unknown): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0)
    throw new Error('Invalid evidence count');
  return v;
}
function list<T>(v: unknown, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(v)) throw new Error('Missing evidence list');
  return v.map(parse);
}
function tag<T extends string>(v: unknown, wire: string, domain: T): T {
  if (v !== wire) throw new Error('Evidence variant mismatch');
  return domain;
}
function nil(v: unknown): null {
  if (v !== null) throw new Error('Expected explicit null');
  return null;
}
function same(v: unknown, requested: string): string {
  if (v !== requested)
    throw new Error('Evidence response does not match request');
  return requested;
}

function ref(v: unknown): SourceRecord {
  const o = object(v);
  switch (o.__typename) {
    case 'DoltBeadSourceRecord': {
      const r: Extract<SourceRecord, { __typename: 'DoltBeadSourceRecord' }> = {
        __typename: 'DoltBeadSourceRecord',
        kind: tag(o.doltKind, 'dolt_bead_v1', 'dolt-bead-v1'),
        source: tag(o.doltSource, 'dolt_bead', 'dolt-bead'),
        nativeId: nonempty(o.doltId),
        repository: o.doltRepo === null ? null : nonempty(o.doltRepo),
        sourcePath: nil(o.doltPath),
      };
      sourceRecordKey(r);
      return r;
    }
    case 'HandoffDocumentSourceRecord': {
      const r: Extract<
        SourceRecord,
        { __typename: 'HandoffDocumentSourceRecord' }
      > = {
        __typename: 'HandoffDocumentSourceRecord',
        kind: tag(o.handoffKind, 'handoff_document_v1', 'handoff-document-v1'),
        source: tag(o.handoffSource, 'handoff_bead', 'handoff-bead'),
        nativeId: o.handoffId === null ? null : nonempty(o.handoffId),
        repository: nonempty(o.handoffRepo),
        sourcePath: nonempty(o.handoffPath),
      };
      sourceRecordKey(r);
      return r;
    }
    default:
      throw new Error('Unknown evidence source variant');
  }
}
function summaryRecord(v: unknown) {
  const o = object(v);
  const sourceRecord = ref(o.sourceRecord);
  const key = same(o.sourceRecordKey, sourceRecordKey(sourceRecord));
  if (
    o.__typename === 'DoltRecordSummary' &&
    sourceRecord.__typename === 'DoltBeadSourceRecord'
  )
    return {
      __typename: 'DoltRecordSummary',
      sourceRecord,
      sourceRecordKey: key,
      title: text(o.title),
    } satisfies DoltRecordSummary;
  if (
    o.__typename === 'HandoffRecordSummary' &&
    sourceRecord.__typename === 'HandoffDocumentSourceRecord'
  )
    return {
      __typename: 'HandoffRecordSummary',
      sourceRecord,
      sourceRecordKey: key,
      title: text(o.title),
    } satisfies HandoffRecordSummary;
  throw new Error('Record/source mismatch');
}
function coverage(v: unknown): EvidenceCoverage {
  const o = object(v);
  const status = o.status;
  if (status !== 'complete' && status !== 'partial' && status !== 'unavailable')
    throw new Error('Unknown coverage');
  return {
    __typename: tag(o.__typename, 'EvidenceCoverage', 'EvidenceCoverage'),
    status,
    repositoriesObserved: number(o.repositoriesObserved),
    skippedRecords: number(o.skippedRecords),
    unreadableRepositories: number(o.unreadableRepositories),
    reason: nullable(o.reason),
  };
}
function counts(v: unknown): RepositoryEvidenceCount[] {
  return list(v, (v) => {
    const o = object(v);
    return {
      __typename: tag(
        o.__typename,
        'RepositoryEvidenceCount',
        'RepositoryEvidenceCount',
      ),
      repository: nullable(o.repository),
      count: number(o.count),
    };
  });
}
function sourceSummary(v: unknown): EvidenceSourceSummary {
  const o = object(v);
  let source: 'dolt-bead' | 'handoff-bead';
  if (o.source === 'dolt_bead') source = 'dolt-bead';
  else if (o.source === 'handoff_bead') source = 'handoff-bead';
  else throw new Error('Unknown summary source');
  const c = coverage(o.coverage);
  const total = o.total === null ? null : number(o.total);
  if ((c.status === 'unavailable') !== (total === null))
    throw new Error('Unavailable source cannot advertise a count');
  return {
    __typename: tag(
      o.__typename,
      'EvidenceSourceSummary',
      'EvidenceSourceSummary',
    ),
    source,
    scope: text(o.scope),
    collectedAt: nullable(o.collectedAt),
    coverage: c,
    total,
    byRepository: counts(o.byRepository),
  };
}
export function decodeSummary(v: unknown): EvidenceSummary {
  const o = object(v),
    h = object(o.handoff);
  const dolt = sourceSummary(o.dolt),
    inventory = sourceSummary(h.inventory);
  if (dolt.source !== 'dolt-bead' || inventory.source !== 'handoff-bead')
    throw new Error('Summary partition mismatch');
  return {
    __typename: tag(o.__typename, 'EvidenceSummary', 'EvidenceSummary'),
    snapshotId: nonempty(o.snapshotId),
    generatedAt: text(o.generatedAt),
    expiresAt: text(o.expiresAt),
    dolt,
    handoff: {
      __typename: tag(
        h.__typename,
        'HandoffEvidenceSummary',
        'HandoffEvidenceSummary',
      ),
      inventory,
      populationCount:
        h.populationCount === null ? null : number(h.populationCount),
      populationByRepository: counts(h.populationByRepository),
    },
    unresolvedCount: number(o.unresolvedCount),
  };
}
function diagnostic(v: unknown): UnresolvedRelationDiagnostic {
  const o = object(v);
  const relation = () => {
    if (
      o.referenceRelation !== 'closes' &&
      o.referenceRelation !== 'responding_to'
    )
      throw new Error('Unknown relation');
    return o.referenceRelation;
  };
  switch (o.__typename) {
    case 'MissingTargetDiagnostic':
      return {
        __typename: o.__typename,
        reason: tag(
          o.missingReason,
          'target_not_observed',
          'target-not-observed',
        ),
        relation: relation(),
        targetNativeId: text(o.requestedTarget),
        referrerKey: text(o.referrerKey),
      };
    case 'AmbiguousTargetDiagnostic':
      return {
        __typename: o.__typename,
        reason: tag(
          o.ambiguousReason,
          'target_matches_multiple_records',
          'target-matches-multiple-records',
        ),
        relation: relation(),
        targetNativeId: text(o.requestedTarget),
        referrerKey: text(o.referrerKey),
        candidateTargetKeys: list(o.candidateTargetKeys, text),
      };
    case 'SuccessorOrderDiagnostic':
      return {
        __typename: o.__typename,
        reason: tag(
          o.successorReason,
          'successor_order_unresolved',
          'successor-order-unresolved',
        ),
        relation: tag(o.closingRelation, 'closes', 'closes'),
        targetNativeId: nullable(o.predecessorNativeId),
        predecessorKey: text(o.predecessorKey),
        candidateSuccessorKeys: list(o.candidateSuccessorKeys, text),
      };
    case 'RelationCycleDiagnostic':
      return {
        __typename: o.__typename,
        reason: tag(o.cycleReason, 'relation_cycle', 'relation-cycle'),
        relation: tag(o.closingRelation, 'closes', 'closes'),
        cycleKeys: list(o.cycleKeys, text),
      };
    default:
      throw new Error('Unknown relation diagnostic');
  }
}
export function decodeIndex(
  v: unknown,
  snapshotId: string,
): EvidenceIndexResult {
  const o = object(v);
  same(o.snapshotId, snapshotId);
  if (o.__typename === 'EvidenceRefreshRequired')
    return {
      __typename: o.__typename,
      status: tag(o.refreshStatus, 'refresh_required', 'refresh-required'),
      snapshotId,
      reason: text(o.reason),
    };
  if (o.__typename !== 'EvidenceIndex') throw new Error('Unknown index result');
  const d = object(o.dolt),
    h = object(o.handoff);
  const dolt: DoltEvidenceIndex =
    d.__typename === 'UnavailableDoltIndex'
      ? {
          __typename: d.__typename,
          status: tag(d.unavailableStatus, 'unavailable', 'unavailable'),
          source: tag(d.source, 'dolt_bead', 'dolt-bead'),
          scope: text(d.scope),
          reason: text(d.reason),
        }
      : {
          __typename: tag(
            d.__typename,
            'ObservedDoltIndex',
            'ObservedDoltIndex',
          ),
          status: tag(d.observedStatus, 'observed', 'observed'),
          source: tag(d.source, 'dolt_bead', 'dolt-bead'),
          scope: text(d.scope),
          collectedAt: text(d.collectedAt),
          coverage: coverage(d.coverage),
          records: list(d.records, (v) => {
            const r = summaryRecord(v);
            if (r.__typename !== 'DoltRecordSummary')
              throw new Error('Dolt partition mismatch');
            return r;
          }),
        };
  const handoff: HandoffEvidenceIndex =
    h.__typename === 'UnavailableHandoffIndex'
      ? {
          __typename: h.__typename,
          status: tag(h.unavailableStatus, 'unavailable', 'unavailable'),
          source: tag(h.source, 'handoff_bead', 'handoff-bead'),
          scope: text(h.scope),
          reason: text(h.reason),
        }
      : {
          __typename: tag(
            h.__typename,
            'ObservedHandoffIndex',
            'ObservedHandoffIndex',
          ),
          status: tag(h.observedStatus, 'observed', 'observed'),
          source: tag(h.source, 'handoff_bead', 'handoff-bead'),
          scope: text(h.scope),
          collectedAt: text(h.collectedAt),
          coverage: coverage(h.coverage),
          records: list(h.records, (v) => {
            const r = summaryRecord(v);
            if (r.__typename !== 'HandoffRecordSummary')
              throw new Error('Handoff partition mismatch');
            return r;
          }),
          populationRecordKeys: list(h.populationRecordKeys, text),
          unresolvedRelations: list(h.unresolvedRelations, diagnostic),
        };
  return {
    __typename: 'EvidenceIndex',
    status: tag(o.readyStatus, 'ready', 'ready'),
    snapshotId,
    dolt,
    handoff,
  };
}
function production(v: unknown): DocumentProduction {
  const o = object(v);
  switch (o.__typename) {
    case 'LegacyUnknownDocumentProduction':
      return {
        __typename: o.__typename,
        status: tag(o.legacyStatus, 'legacy_unknown', 'legacy-unknown'),
        reason: text(o.reason),
      };
    case 'UnavailableDocumentProduction':
      return {
        __typename: o.__typename,
        status: tag(o.unavailableStatus, 'unavailable', 'unavailable'),
        reason: text(o.reason),
      };
    case 'RecordedDocumentProduction': {
      if (o.schemaVersion !== 1)
        throw new Error('Unsupported production version');
      const interactions: ProductionInteraction[] = list(
        o.interactions,
        (v) => {
          const i = object(v);
          const common = {
            interactionId: text(i.interactionId),
            parentInteractionId: nullable(i.parentInteractionId),
            runtimeId: text(i.runtimeId),
            traceId: nullable(i.traceId),
            hostId: text(i.hostId),
            startedAt: text(i.startedAt),
            completedAt: text(i.completedAt),
          };
          switch (i.__typename) {
            case 'ModelGenerationInteraction':
              return {
                __typename: i.__typename,
                ...common,
                kind: tag(i.genKind, 'model_generation', 'model-generation'),
                principalId: nullable(i.genPrincipal),
                agentId: text(i.genAgent),
                sessionProvider: text(i.genSessionProvider),
                sessionId: text(i.genSessionId),
                modelProvider: text(i.genModelProvider),
                modelId: text(i.genModelId),
              };
            case 'HumanProductionInteraction': {
              const kind =
                i.humanKind === 'human_edit'
                  ? 'human-edit'
                  : tag(i.humanKind, 'human_approval', 'human-approval');
              return {
                __typename: i.__typename,
                ...common,
                kind,
                principalId: text(i.humanPrincipal),
                agentId: nil(i.humanAgent),
                sessionProvider: nullable(i.humanSessionProvider),
                sessionId: nullable(i.humanSessionId),
                modelProvider: nil(i.humanModelProvider),
                modelId: nil(i.humanModelId),
              };
            }
            case 'EmissionProductionInteraction':
              return {
                __typename: i.__typename,
                ...common,
                kind: tag(i.emissionKind, 'emission', 'emission'),
                principalId: nullable(i.emissionPrincipal),
                agentId: nullable(i.emissionAgent),
                sessionProvider: nullable(i.emissionSessionProvider),
                sessionId: nullable(i.emissionSessionId),
                modelProvider: nil(i.emissionModelProvider),
                modelId: nil(i.emissionModelId),
              };
            default:
              throw new Error('Unknown production interaction');
          }
        },
      );
      const parsed = parseDocumentProduction({
        status: 'recorded',
        schemaVersion: 1,
        interactions,
      });
      if (parsed.status !== 'recorded')
        throw new Error('Invalid production refinements');
      return {
        __typename: o.__typename,
        status: tag(o.recordedStatus, 'recorded', 'recorded'),
        schemaVersion: 1,
        interactions,
      };
    }
    default:
      throw new Error('Unknown document production');
  }
}
function target(v: unknown): TaskDocumentTarget {
  const o = object(v);
  switch (o.__typename) {
    case 'DoltTaskTarget':
      return {
        __typename: o.__typename,
        source: tag(o.doltSource, 'dolt_bead', 'dolt-bead'),
        nativeId: nonempty(o.nativeId),
      };
    case 'HandoffDocumentTarget':
      return {
        __typename: o.__typename,
        source: tag(o.handoffSource, 'handoff_bead', 'handoff-bead'),
        repository: nonempty(o.repository),
        sourcePath: nonempty(o.sourcePath),
      };
    default:
      throw new Error('Unknown declared target');
  }
}
function link(v: unknown): TaskDocumentResolution {
  const o = object(v),
    referrer = ref(o.referrer),
    fieldPath = text(o.fieldPath);
  if (o.__typename === 'InvalidTaskDocumentLink')
    return {
      __typename: o.__typename,
      status: tag(
        o.invalidStatus,
        'invalid_declaration',
        'invalid-declaration',
      ),
      referrer,
      fieldPath,
      reason: text(o.reason),
    };
  const declaration = { referrer, fieldPath, target: target(o.target) };
  switch (o.__typename) {
    case 'ResolvedTaskDocumentLink': {
      const task = ref(o.task),
        document = ref(o.document);
      if (
        task.__typename !== 'DoltBeadSourceRecord' ||
        document.__typename !== 'HandoffDocumentSourceRecord'
      )
        throw new Error('Resolved endpoint mismatch');
      return {
        __typename: o.__typename,
        status: tag(o.resolvedStatus, 'resolved', 'resolved'),
        ...declaration,
        task,
        document,
        taskRecordKey: same(o.taskRecordKey, sourceRecordKey(task)),
        documentRecordKey: same(o.documentRecordKey, sourceRecordKey(document)),
      };
    }
    case 'UnavailableTaskDocumentLink':
      return {
        __typename: o.__typename,
        status: tag(
          o.unavailableStatus,
          'target_source_unavailable',
          'target-source-unavailable',
        ),
        ...declaration,
      };
    case 'AbsentTaskDocumentLink':
      return {
        __typename: o.__typename,
        status: tag(
          o.absentStatus,
          'target_not_observed_in_scope',
          'target-not-observed-in-scope',
        ),
        ...declaration,
      };
    case 'AmbiguousTaskDocumentLink':
      return {
        __typename: o.__typename,
        status: tag(o.ambiguousStatus, 'target_ambiguous', 'target-ambiguous'),
        ...declaration,
        candidates: list(o.candidates, ref),
      };
    case 'IncompatibleTaskDocumentLink':
      return {
        __typename: o.__typename,
        status: tag(
          o.incompatibleStatus,
          'target_kind_incompatible',
          'target-kind-incompatible',
        ),
        ...declaration,
        observed: ref(o.observed),
        nativeType: text(o.nativeType),
      };
    default:
      throw new Error('Unknown declared-link result');
  }
}
function requestedSource(key: string): 'dolt-bead' | 'handoff-bead' {
  const parsed: unknown = JSON.parse(key);
  if (!Array.isArray(parsed) || parsed.length !== 4)
    throw new Error('Invalid requested key');
  const [kind, repository, nativeId, sourcePath]: unknown[] = parsed;
  if (
    kind === 'dolt-bead-v1' &&
    (repository === null || typeof repository === 'string') &&
    typeof nativeId === 'string' &&
    sourcePath === null
  ) {
    const coordinate = {
      kind,
      source: 'dolt-bead',
      repository,
      nativeId,
      sourcePath,
    } as const;
    same(key, sourceRecordKey(coordinate));
    return coordinate.source;
  }
  if (
    kind === 'handoff-document-v1' &&
    typeof repository === 'string' &&
    (nativeId === null || typeof nativeId === 'string') &&
    typeof sourcePath === 'string'
  ) {
    const coordinate = {
      kind,
      source: 'handoff-bead',
      repository,
      nativeId,
      sourcePath,
    } as const;
    same(key, sourceRecordKey(coordinate));
    return coordinate.source;
  }
  throw new Error('Invalid requested source coordinates');
}
export function decodeRecord(
  v: unknown,
  snapshotId: string,
  key: string,
): EvidenceRecordResult {
  const o = object(v);
  same(o.snapshotId, snapshotId);
  switch (o.__typename) {
    case 'EvidenceRefreshRequired':
      return {
        __typename: o.__typename,
        status: tag(o.refreshStatus, 'refresh_required', 'refresh-required'),
        snapshotId,
        reason: text(o.reason),
      };
    case 'EvidenceInvalidReference':
      return {
        __typename: o.__typename,
        status: tag(o.invalidStatus, 'invalid_reference', 'invalid-reference'),
        snapshotId,
        sourceRecordKey: same(o.sourceRecordKey, key),
        reason: text(o.reason),
      };
    case 'EvidenceSourceUnavailable': {
      const source =
        o.source === 'dolt_bead'
          ? 'dolt-bead'
          : tag(o.source, 'handoff_bead', 'handoff-bead');
      same(source, requestedSource(key));
      return {
        __typename: o.__typename,
        status: tag(
          o.unavailableStatus,
          'source_unavailable',
          'source-unavailable',
        ),
        snapshotId,
        source,
        reason: text(o.reason),
      };
    }
    case 'EvidenceRecordNotObserved': {
      const source =
        o.source === 'dolt_bead'
          ? 'dolt-bead'
          : tag(o.source, 'handoff_bead', 'handoff-bead');
      same(source, requestedSource(key));
      return {
        __typename: o.__typename,
        status: tag(
          o.missingStatus,
          'record_not_observed',
          'record-not-observed',
        ),
        snapshotId,
        sourceRecordKey: same(o.sourceRecordKey, key),
        source,
        scope: text(o.scope),
      };
    }
    case 'EvidenceRecord': {
      const r = object(o.record);
      const sourceRecord = ref(r.sourceRecord);
      const common = {
        sourceRecordKey: same(r.sourceRecordKey, key),
        title: text(r.title),
        collectedAt: text(r.collectedAt),
        declaredLinks: list(r.declaredLinks, link),
      };
      same(key, sourceRecordKey(sourceRecord));
      for (const declaration of common.declaredLinks)
        if (sourceRecordKey(declaration.referrer) !== key)
          throw new Error(
            'Declaration origin does not match containing record',
          );
      let record: ObservedEvidenceRecord;
      if (
        r.__typename === 'DoltRecordEvidence' &&
        sourceRecord.__typename === 'DoltBeadSourceRecord'
      ) {
        const n = object(r.native);
        const labels = object(r.literalLabels);
        record = {
          __typename: r.__typename,
          ...common,
          sourceRecord,
          native: {
            __typename: tag(
              n.__typename,
              'DoltLiteralMetadata',
              'DoltLiteralMetadata',
            ),
            type: text(n.type),
            status: text(n.status),
            actor: text(n.actor),
            hook: nullable(n.hook),
            refs: list(n.refs, text),
            createdAt: nullable(n.createdAt),
            updatedAt: nullable(n.updatedAt),
            closedAt: nullable(n.closedAt),
          },
          literalLabels: {
            __typename: tag(
              labels.__typename,
              'DoltLiteralLabels',
              'DoltLiteralLabels',
            ),
            queueDisposition: nullable(labels.queueDisposition),
            claimedByKind: nullable(labels.claimedByKind),
            leaseUntil: nullable(labels.leaseUntil),
            expiresAt: nullable(labels.expiresAt),
          },
          coordinateDiagnostics: list(r.coordinateDiagnostics, (v) => {
            const d = object(v);
            const reason = d.reason;
            if (
              reason !== 'missing' &&
              reason !== 'invalid' &&
              reason !== 'conflict'
            )
              throw new Error('Unknown coordinate diagnostic');
            return {
              __typename: tag(
                d.__typename,
                'RepositoryCoordinateDiagnostic',
                'RepositoryCoordinateDiagnostic',
              ),
              reason,
              fieldPath: text(d.fieldPath),
            };
          }),
        };
      } else if (
        r.__typename === 'HandoffRecordEvidence' &&
        sourceRecord.__typename === 'HandoffDocumentSourceRecord'
      ) {
        const l = object(r.literal);
        record = {
          __typename: r.__typename,
          ...common,
          sourceRecord,
          literal: {
            __typename: tag(
              l.__typename,
              'HandoffLiteralMetadata',
              'HandoffLiteralMetadata',
            ),
            type: nullable(l.type),
            status: nullable(l.status),
            actor: nullable(l.actor),
            to: nullable(l.to),
            respondingTo: nullable(l.respondingTo),
            refs: list(l.refs, text),
            authoredCreatedAt: nullable(l.authoredCreatedAt),
          },
          observedModifiedAt: text(r.observedModifiedAt),
          documentProduction: production(r.documentProduction),
        };
      } else throw new Error('Detail/source mismatch');
      return {
        __typename: 'EvidenceRecord',
        status: tag(o.readyStatus, 'ready', 'ready'),
        snapshotId,
        record,
      };
    }
    default:
      throw new Error('Unknown detail result');
  }
}
