import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type {
  EvidenceSummary,
  EvidenceIndex,
  EvidenceRecord,
  HandoffRecordSummary,
  HandoffRecordEvidence,
  DoltRecordEvidence,
  DoltRecordSummary,
  InspectionTarget,
  UnresolvedRelationReason,
  UnresolvedRelationDiagnostic,
} from '@cockpit/shared';

import { useEvidenceInspector } from '../useEvidenceInspector.js';
type RecordSummary = HandoffRecordSummary | DoltRecordSummary;
type ObservedRecord = HandoffRecordEvidence | DoltRecordEvidence;
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

function valueOrDash(value: string | null): string {
  return value?.trim() ? value : '—';
}

function EvidenceButton({
  record,
  onOpen,
}: {
  record: RecordSummary;
  onOpen: (record: RecordSummary, opener: HTMLButtonElement) => void;
}) {
  return (
    <button
      className="evidence-record"
      type="button"
      onClick={(event) => onOpen(record, event.currentTarget)}
    >
      <span className="evidence-record-title">{record.title}</span>
      <span className="evidence-record-meta">
        {record.sourceRecord.repository ?? 'unknown'} ·{' '}
        {record.sourceRecord.nativeId ?? 'no authored id'}
      </span>
    </button>
  );
}

function EvidenceDialog({
  record,
  onClose,
  onFocusRepository,
  onRelated,
  historical,
}: {
  record: ObservedRecord;
  historical: boolean;
  onRelated: (key: string, opener: HTMLButtonElement) => void;
  onClose: () => void;
  onFocusRepository: (repository: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => closeRef.current?.focus(), []);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []),
    ].filter((element) => !element.hasAttribute('disabled'));
    if (controls.length === 0) return;
    // The empty-list guard above proves both endpoints exist.
    const first = controls[0]!;
    const last = controls[controls.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const repository = record.sourceRecord.repository;
  return (
    <div className="evidence-scrim" role="presentation">
      <div
        className="evidence-dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-dialog-title"
        onKeyDown={onKeyDown}
      >
        <header className="evidence-dialog-head">
          <div>
            <span className="evidence-eyebrow">Source observation</span>
            <h3 id="evidence-dialog-title">{record.title}</h3>
          </div>
          <button
            ref={closeRef}
            className="evidence-close"
            type="button"
            onClick={onClose}
            aria-label="Close evidence inspector"
          >
            Close
          </button>
        </header>

        <p className="evidence-caveat">
          {historical && <strong>Historical observation · expired. </strong>}
          Reference only; body not read by this evidence view. Authored names
          are literal source claims, not authenticated identities or authority.
        </p>

        <dl className="evidence-ledger">
          <div>
            <dt>Repository</dt>
            <dd>{valueOrDash(repository)}</dd>
          </div>
          <div>
            <dt>Source reference</dt>
            <dd>
              <code>{valueOrDash(record.sourceRecord.sourcePath)}</code>
            </dd>
          </div>
          <div>
            <dt>Native ID</dt>
            <dd>
              <code>{valueOrDash(record.sourceRecord.nativeId)}</code>
            </dd>
          </div>
          {'literal' in record ? (
            <>
              <div>
                <dt>Type (authored)</dt>
                <dd>{valueOrDash(record.literal.type)}</dd>
              </div>
              <div>
                <dt>Status (authored)</dt>
                <dd>{valueOrDash(record.literal.status)}</dd>
              </div>
              <div>
                <dt>Actor (authored)</dt>
                <dd>{valueOrDash(record.literal.actor)}</dd>
              </div>
              <div>
                <dt>Recipient (authored)</dt>
                <dd>
                  {record.literal.to?.trim() ? record.literal.to : 'Unknown'}
                </dd>
              </div>
              <div>
                <dt>responding_to (authored)</dt>
                <dd>
                  <code>{valueOrDash(record.literal.respondingTo)}</code>
                </dd>
              </div>
              <div>
                <dt>refs (authored)</dt>
                <dd>
                  {record.literal.refs.length
                    ? record.literal.refs.join(', ')
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Created (authored)</dt>
                <dd>{valueOrDash(record.literal.authoredCreatedAt)}</dd>
              </div>
              <div>
                <dt>Modified (filesystem observed)</dt>
                <dd>{record.observedModifiedAt}</dd>
              </div>
            </>
          ) : (
            Object.entries(record.native)
              .filter(([field]) => field !== '__typename')
              .map(([field, value]) => (
                <div key={field}>
                  <dt>{field} (native)</dt>
                  <dd>
                    {Array.isArray(value)
                      ? value.join(', ') || '—'
                      : (value ?? '—')}
                  </dd>
                </div>
              ))
          )}
          <div>
            <dt>Collected</dt>
            <dd>{record.collectedAt}</dd>
          </div>
          <div>
            <dt>Verified process identity</dt>
            <dd>Unavailable</dd>
          </div>
        </dl>

        {'documentProduction' in record && (
          <details className="evidence-production">
            <summary tabIndex={0}>
              Document production · {record.documentProduction.status}
            </summary>
            <p>
              Self-recorded production claims; this does not verify process
              identity, recipient authority or approval.
            </p>
            {record.documentProduction.status === 'recorded' ? (
              record.documentProduction.interactions.map((interaction) => (
                <dl key={interaction.interactionId}>
                  {Object.entries(interaction)
                    .filter(([field]) => field !== '__typename')
                    .map(([field, value]) => (
                      <div key={field}>
                        <dt>{field}</dt>
                        <dd>{value ?? 'Unknown'}</dd>
                      </div>
                    ))}
                </dl>
              ))
            ) : (
              <p>{record.documentProduction.reason}</p>
            )}
          </details>
        )}
        {'literalLabels' in record && (
          <section aria-label="Observed claim and queue labels">
            <h4>Claim and queue labels (literal)</h4>
            <p>
              Observed values do not establish current ownership or eligibility.
            </p>
            <dl className="evidence-ledger">
              <div>
                <dt>labels.queue</dt>
                <dd>{valueOrDash(record.literalLabels.queueDisposition)}</dd>
              </div>
              <div>
                <dt>labels.claimed_by_kind</dt>
                <dd>{valueOrDash(record.literalLabels.claimedByKind)}</dd>
              </div>
              <div>
                <dt>labels.lease_until</dt>
                <dd>{valueOrDash(record.literalLabels.leaseUntil)}</dd>
              </div>
              <div>
                <dt>labels.expires_at</dt>
                <dd>{valueOrDash(record.literalLabels.expiresAt)}</dd>
              </div>
            </dl>
          </section>
        )}
        {'coordinateDiagnostics' in record &&
          record.coordinateDiagnostics.map((diagnostic, index) => (
            <p key={index}>
              Repository coordinate: {diagnostic.reason} ·{' '}
              {diagnostic.fieldPath}
            </p>
          ))}
        <section aria-label="Declared task and document links">
          <h4>Declared task/document links</h4>
          {record.declaredLinks.length === 0 ? (
            <p>No declared links observed.</p>
          ) : (
            record.declaredLinks.map((link, index) => (
              <div key={index}>
                <p>
                  {link.status} · {link.fieldPath} · declared by{' '}
                  {link.referrer.source}
                </p>
                {link.status === 'resolved' && (
                  <>
                    <button
                      type="button"
                      onClick={(event) =>
                        onRelated(link.taskRecordKey, event.currentTarget)
                      }
                    >
                      Inspect declared task
                    </button>
                    <button
                      type="button"
                      onClick={(event) =>
                        onRelated(link.documentRecordKey, event.currentTarget)
                      }
                    >
                      Inspect declared document
                    </button>
                  </>
                )}
                {link.status === 'invalid-declaration' && <p>{link.reason}</p>}
              </div>
            ))
          )}
        </section>
        {repository ? (
          <button
            className="evidence-focus"
            type="button"
            onClick={() => onFocusRepository(repository)}
          >
            Focus {repository}
          </button>
        ) : (
          <button type="button" disabled>
            Repository Focus unavailable
          </button>
        )}
      </div>
    </div>
  );
}

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
export const EvidenceView = forwardRef<
  EvidenceViewHandle,
  {
    summary: EvidenceSummary | undefined;
    onFocusRepository: (repository: string) => void;
  }
>(function EvidenceView({ summary, onFocusRepository }, ref) {
  const inspector = useEvidenceInspector(summary);
  useImperativeHandle(ref, () => ({ inspect: inspector.inspect }));
  const [repository, setRepository] = useState<string | null>(null);
  const [scope, setScope] = useState<'population' | 'dolt' | 'handoff' | 'all'>(
    'population',
  );
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
        (scope === 'handoff' && record.sourceRecord.source === 'handoff-bead')),
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
              Historical observation · expired. Loaded detail remains reference
              material.
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
                  state.selection.kind === 'failed' ? state.selection.key : '',
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
});
