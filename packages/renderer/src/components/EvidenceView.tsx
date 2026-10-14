import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import type {
  EvidenceSummary,
  HandoffRecordSummary,
  DoltRecordSummary,
  InspectionTarget,
  UnresolvedRelationReason,
  UnresolvedRelationDiagnostic,
} from '@cockpit/shared';

import { useEvidenceInspector } from '../use-evidence-inspector.js';
import { EvidenceButton } from './EvidenceButton.js';
import { EvidenceDialog } from './EvidenceDialog.js';
type RecordSummary = HandoffRecordSummary | DoltRecordSummary;
export interface EvidenceViewHandle {
  inspect(
    target: InspectionTarget | undefined,
    opener: HTMLButtonElement,
  ): void;
}

const REASON_LABEL: Record<UnresolvedRelationReason, string> = {
  'target-matches-multiple-records': 'Target matches multiple observed records',
  'target-not-observed': 'Target not observed',
  'successor-order-unresolved': 'Successor order unresolved',
  'relation-cycle': 'Relation cycle observed',
};

function participants(
  diagnostic: UnresolvedRelationDiagnostic,
): Array<{ label: string; key: string }> {
  switch (diagnostic.reason) {
    case 'target-not-observed':
      return [{ label: 'Referrer', key: diagnostic.referrerKey }];
    case 'target-matches-multiple-records':
      return [
        { label: 'Referrer', key: diagnostic.referrerKey },
        ...diagnostic.candidateTargetKeys.map((key) => ({
          label: 'Candidate target',
          key,
        })),
      ];
    case 'successor-order-unresolved':
      return [
        { label: 'Predecessor', key: diagnostic.predecessorKey },
        ...diagnostic.candidateSuccessorKeys.map((key) => ({
          label: 'Candidate successor',
          key,
        })),
      ];
    case 'relation-cycle':
      return diagnostic.cycleKeys.map((key, index) => ({
        label: `Directed cycle ${index + 1}`,
        key,
      }));
  }
}
interface EvidenceViewProps {
  summary: EvidenceSummary | undefined;
  onFocusRepository: (repository: string) => void;
}
export const EvidenceView = forwardRef<EvidenceViewHandle, EvidenceViewProps>(
  function EvidenceView({ summary, onFocusRepository }, ref) {
    const inspector = useEvidenceInspector(summary);
    useImperativeHandle(ref, () => ({ inspect: inspector.inspect }));
    const [repository, setRepository] = useState<string | null>(null);
    const [scope, setScope] = useState<
      'population' | 'dolt' | 'handoff' | 'all'
    >('population');
    const state = inspector.state;
    const index = state.mode === 'open' ? state.index : null;
    const records = useMemo(
      () =>
        index
          ? [
              ...(index.dolt.status === 'observed' ? index.dolt.records : []),
              ...(index.handoff.status === 'observed'
                ? index.handoff.records
                : []),
            ]
          : [],
      [index],
    );
    const recordsByKey = new Map(
      records.map((record) => [record.sourceRecordKey, record]),
    );
    const population = new Set(
      index?.handoff.status === 'observed'
        ? index.handoff.populationRecordKeys
        : [],
    );
    const visible = records.filter(
      (record) =>
        (!repository || record.sourceRecord.repository === repository) &&
        (scope === 'all' ||
          (scope === 'population' && population.has(record.sourceRecordKey)) ||
          (scope === 'dolt' && record.sourceRecord.source === 'dolt-bead') ||
          (scope === 'handoff' &&
            record.sourceRecord.source === 'handoff-bead')),
    );
    const diagnostics =
      index?.handoff.status === 'observed'
        ? index.handoff.unresolvedRelations
        : [];
    const selected =
      state.mode === 'open' && state.selection.kind === 'ready'
        ? state.selection.detail.record
        : null;
    const open = (record: RecordSummary, opener: HTMLButtonElement) =>
      inspector.select(record.sourceRecordKey, opener);
    if (!summary && state.mode === 'closed') return null;
    return (
      <div className="evidence-view">
        <button
          ref={inspector.toggleRef}
          className="evidence-toggle"
          type="button"
          onClick={inspector.toggle}
          aria-expanded={state.mode !== 'closed'}
        >
          <span>Inspect evidence</span>
          <span className="evidence-toggle-meta">
            {summary?.handoff.populationCount ?? 'Unavailable'} standalone
            unanswered briefs
          </span>
        </button>
        {state.mode !== 'closed' && (
          <div className="evidence-panel">
            <p className="evidence-caveat">
              Observation {state.pin.snapshotId} · {state.pin.generatedAt}
            </p>
            {inspector.newerAvailable && (
              <p role="status">
                New observation available. Refresh evidence to adopt it.
              </p>
            )}
            {inspector.historical && (
              <p role="status">
                Historical observation · expired. Loaded detail remains
                reference material.
              </p>
            )}
            <button type="button" onClick={inspector.refresh}>
              Refresh evidence
            </button>
            {state.message && <p role="status">{state.message}</p>}
            {summary?.snapshotId === state.pin.snapshotId && (
              <p>
                Dolt: {summary.dolt.total ?? 'unavailable'} ·{' '}
                {summary.dolt.coverage.status}; handoff inventory:{' '}
                {summary.handoff.inventory.total ?? 'unavailable'} ·{' '}
                {summary.handoff.inventory.coverage.status}
              </p>
            )}
            {!index && !state.message && (
              <p role="status">Loading evidence index…</p>
            )}
            {index && !state.refreshRequired && (
              <>
                <div
                  className="evidence-filters"
                  aria-label="Filter evidence by source"
                >
                  <button type="button" onClick={() => setScope('population')}>
                    Standalone unanswered briefs
                  </button>
                  <button type="button" onClick={() => setScope('dolt')}>
                    Dolt inventory
                  </button>
                  <button type="button" onClick={() => setScope('handoff')}>
                    Handoff inventory
                  </button>
                  <button type="button" onClick={() => setScope('all')}>
                    Both inventories
                  </button>
                </div>
                <div
                  className="evidence-filters"
                  aria-label="Filter evidence by repository"
                >
                  <button type="button" onClick={() => setRepository(null)}>
                    All · {records.length}
                  </button>
                  {[
                    ...new Set(
                      records.flatMap((record) =>
                        record.sourceRecord.repository === null
                          ? []
                          : [record.sourceRecord.repository],
                      ),
                    ),
                  ]
                    .sort()
                    .map((repo) => (
                      <button
                        type="button"
                        key={repo}
                        onClick={() => setRepository(repo)}
                      >
                        {repo} ·{' '}
                        {
                          records.filter(
                            (record) => record.sourceRecord.repository === repo,
                          ).length
                        }
                      </button>
                    ))}
                </div>
                {index.dolt.status === 'observed' && (
                  <p className="evidence-caveat">
                    Dolt inventory: {index.dolt.records.length} observed ·{' '}
                    {index.dolt.coverage.status} · {index.dolt.scope}
                  </p>
                )}
                {index.handoff.status === 'observed' && (
                  <p className="evidence-caveat">
                    Handoff inventory: {index.handoff.records.length} observed ·{' '}
                    {index.handoff.coverage.status} · {index.handoff.scope}
                  </p>
                )}
                {index.dolt.status === 'unavailable' && (
                  <p>Dolt source unavailable: {index.dolt.reason}</p>
                )}
                {index.handoff.status === 'unavailable' && (
                  <p>Handoff source unavailable: {index.handoff.reason}</p>
                )}
                <div className="evidence-grid">
                  <section>
                    <h3>
                      {scope === 'population'
                        ? 'Standalone unanswered briefs'
                        : 'Observed source inventory'}
                    </h3>
                    <div className="evidence-records">
                      {visible.length ? (
                        visible.map((record) => (
                          <EvidenceButton
                            key={record.sourceRecordKey}
                            record={record}
                            onOpen={open}
                          />
                        ))
                      ) : (
                        <p className="evidence-empty">
                          No records in this filter.
                        </p>
                      )}
                    </div>
                  </section>
                  <section>
                    <h3>Unresolved relation evidence</h3>
                    <div className="evidence-diagnostics">
                      {diagnostics.length ? (
                        diagnostics.map((diagnostic, number) => (
                          <article className="evidence-diagnostic" key={number}>
                            <strong>{REASON_LABEL[diagnostic.reason]}</strong>
                            <span>{diagnostic.relation}</span>
                            <div className="evidence-affected">
                              {participants(diagnostic).map(
                                ({ label, key }, position) => {
                                  const record = recordsByKey.get(key);
                                  return (
                                    <div key={`${label}:${position}:${key}`}>
                                      <span>{label}</span>
                                      {record ? (
                                        <EvidenceButton
                                          record={record}
                                          onOpen={open}
                                        />
                                      ) : (
                                        <code>{key}</code>
                                      )}
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="evidence-empty">
                          No unresolved relations observed.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}
            {state.selection.kind === 'loading' && (
              <>
                <p role="status">Loading evidence detail…</p>
                <button type="button" onClick={inspector.close}>
                  Cancel evidence detail
                </button>
              </>
            )}
            {state.selection.kind === 'failed' && (
              <button
                type="button"
                onClick={(event) =>
                  inspector.select(
                    state.selection.kind === 'failed'
                      ? state.selection.key
                      : '',
                    event.currentTarget,
                  )
                }
              >
                Retry evidence detail
              </button>
            )}
          </div>
        )}
        {selected && (
          <EvidenceDialog
            record={selected}
            historical={inspector.historical}
            onClose={inspector.close}
            onRelated={inspector.select}
            onFocusRepository={onFocusRepository}
          />
        )}
      </div>
    );
  },
);
