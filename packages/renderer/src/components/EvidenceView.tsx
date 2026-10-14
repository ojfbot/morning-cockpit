import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { EvidenceSummary, EvidenceIndex, EvidenceRecord, HandoffRecordSummary, HandoffRecordEvidence, UnresolvedRelationReason, UnresolvedRelationDiagnostic } from '@cockpit/shared';

import { fetchEvidenceIndex, fetchEvidenceRecord, fetchEvidenceSummary } from '../api.js';

const REASON_LABEL: Record<UnresolvedRelationReason, string> = {
  'target-matches-multiple-records': 'Target matches multiple observed records',
  'target-not-observed': 'Target not observed',
  'successor-order-unresolved': 'Successor order unresolved',
  'relation-cycle': 'Relation cycle observed',
};

function valueOrDash(value: string | null): string {
  return value?.trim() ? value : '—';
}

function EvidenceButton({ record, onOpen }: { record: HandoffRecordSummary; onOpen: (record: HandoffRecordSummary, opener: HTMLButtonElement) => void }) {
  return (
    <button className="evidence-record" type="button" onClick={(event) => onOpen(record, event.currentTarget)}>
      <span className="evidence-record-title">{record.title}</span>
      <span className="evidence-record-meta">
        {record.sourceRecord.repository ?? 'unknown'} · {record.sourceRecord.nativeId ?? 'no authored id'}
      </span>
    </button>
  );
}

function EvidenceDialog({
  record,
  onClose,
  onFocusRepository,
}: {
  record: HandoffRecordEvidence;
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
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])') ?? [])]
      .filter((element) => !element.hasAttribute('disabled'));
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
          <button ref={closeRef} className="evidence-close" type="button" onClick={onClose} aria-label="Close evidence inspector">Close</button>
        </header>

        <p className="evidence-caveat">
          Reference only; body not read by this evidence view. Authored names are literal source claims, not authenticated identities or authority.
        </p>

        <dl className="evidence-ledger">
          <div><dt>Repository</dt><dd>{valueOrDash(repository)}</dd></div>
          <div><dt>Source reference</dt><dd><code>{valueOrDash(record.sourceRecord.sourcePath)}</code></dd></div>
          <div><dt>Native ID</dt><dd><code>{valueOrDash(record.sourceRecord.nativeId)}</code></dd></div>
          <div><dt>Type (authored)</dt><dd>{valueOrDash(record.literal.type)}</dd></div>
          <div><dt>Status (authored)</dt><dd>{valueOrDash(record.literal.status)}</dd></div>
          <div><dt>Actor (authored)</dt><dd>{valueOrDash(record.literal.actor)}</dd></div>
          <div><dt>Recipient (authored)</dt><dd>{record.literal.to?.trim() ? record.literal.to : 'Unknown'}</dd></div>
          <div><dt>responding_to (authored)</dt><dd><code>{valueOrDash(record.literal.respondingTo)}</code></dd></div>
          <div><dt>refs (authored)</dt><dd>{record.literal.refs.length ? record.literal.refs.join(', ') : '—'}</dd></div>
          <div><dt>Created (authored)</dt><dd>{valueOrDash(record.literal.authoredCreatedAt)}</dd></div>
          <div><dt>Modified (filesystem observed)</dt><dd>{record.observedModifiedAt}</dd></div>
          <div><dt>Collected</dt><dd>{record.collectedAt}</dd></div>
          <div><dt>Verified process identity</dt><dd>Unavailable</dd></div>
        </dl>

        <details className="evidence-production">
          <summary tabIndex={0}>Document production · {record.documentProduction.status}</summary>
          <p>Self-recorded production claims; this does not verify process identity, recipient authority or approval.</p>
          {record.documentProduction.status === 'recorded' ? record.documentProduction.interactions.map(interaction => (
            <dl key={interaction.interactionId}>
              {Object.entries(interaction).map(([field, value]) => <div key={field}><dt>{field}</dt><dd>{value ?? 'Unknown'}</dd></div>)}
            </dl>
          )) : <p>{record.documentProduction.reason}</p>}
        </details>

        {repository && (
          <button className="evidence-focus" type="button" onClick={() => onFocusRepository(repository)}>
            Focus {repository}
          </button>
        )}
      </div>
    </div>
  );
}

function participants(diagnostic: UnresolvedRelationDiagnostic): Array<{ label: string; key: string }> {
  switch (diagnostic.reason) {
    case 'target-not-observed': return [{ label: 'Referrer', key: diagnostic.referrerKey }];
    case 'target-matches-multiple-records': return [{ label: 'Referrer', key: diagnostic.referrerKey }, ...diagnostic.candidateTargetKeys.map(key => ({ label: 'Candidate target', key }))];
    case 'successor-order-unresolved': return [{ label: 'Predecessor', key: diagnostic.predecessorKey }, ...diagnostic.candidateSuccessorKeys.map(key => ({ label: 'Candidate successor', key }))];
    case 'relation-cycle': return diagnostic.cycleKeys.map((key, index) => ({ label: `Directed cycle ${index + 1}`, key }));
  }
}
export function EvidenceView({ summary, onFocusRepository }: { summary: EvidenceSummary | undefined; onFocusRepository: (repository: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [repository, setRepository] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [observation, setObservation] = useState(summary);
  const [loadedIndex, setIndex] = useState<EvidenceIndex>();
  const [detail, setDetail] = useState<EvidenceRecord>();
  const [message, setMessage] = useState<string | null>(null);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    // Background summaries cannot clear an expiry already observed by the reader.
    if (refreshRequired) return;
    setObservation(summary); setMessage(null);
  }, [summary]);
  const index = loadedIndex?.snapshotId === observation?.snapshotId ? loadedIndex : undefined;
  const recordsByKey = useMemo(() => new Map((index?.records ?? []).map(record => [record.sourceRecordKey, record])), [index]);
  const selected = selectedKey && detail?.snapshotId === index?.snapshotId && detail?.record.sourceRecordKey === selectedKey ? detail.record : undefined;

  useEffect(() => {
    if (!expanded || !observation) return;
    const controller = new AbortController();
    setIndex(undefined); setDetail(undefined);
    void fetchEvidenceIndex(observation.snapshotId, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (result.status === 'refresh-required') { setRefreshRequired(true); setMessage(result.reason); return; }
      setIndex(result);
      if (selectedKey && !result.records.some(record => record.sourceRecordKey === selectedKey)) setSelectedKey(null);
    }).catch(error => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Evidence index unavailable.'); });
    return () => controller.abort();
  }, [expanded, observation]);

  useEffect(() => {
    setDetail(undefined);
    if (!selectedKey || !index) return;
    const controller = new AbortController();
    void fetchEvidenceRecord(index.snapshotId, selectedKey, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (result.status === 'refresh-required') { setRefreshRequired(true); setMessage(result.reason); return; }
      if (result.status === 'record-not-observed') { setSelectedKey(null); setMessage('Record was not observed in this snapshot.'); return; }
      setDetail(result);
    }).catch(error => { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : 'Evidence detail unavailable.'); });
    return () => controller.abort();
  }, [selectedKey, index]);

  if (!observation) return null;
  const population = (index?.populationRecordKeys ?? []).flatMap(key => { const record = recordsByKey.get(key); return record ? [record] : []; });
  const visible = repository ? population.filter(record => record.sourceRecord.repository === repository) : population;
  const close = () => { setSelectedKey(null); requestAnimationFrame(() => openerRef.current?.focus()); };
  const open = (record: HandoffRecordSummary, opener: HTMLButtonElement) => { openerRef.current = opener; setSelectedKey(record.sourceRecordKey); setMessage(null); };
  const refresh = async () => {
    setSelectedKey(null); setIndex(undefined); setDetail(undefined); setMessage(null);
    try { setObservation(await fetchEvidenceSummary()); setRefreshRequired(false); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Evidence refresh unavailable.'); }
  };
  return (
    <div className="evidence-view">
      <button className="evidence-toggle" type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
        <span>Inspect evidence</span>
        <span className="evidence-toggle-meta">{observation.total} standalone unanswered briefs
          {observation.coverage.status !== 'complete' && <span className="evidence-coverage">{observation.coverage.status}</span>}
          {observation.unresolvedCount > 0 && <span>{observation.unresolvedCount} unresolved</span>}
        </span>
      </button>
      {expanded && <div className="evidence-panel">
        {message && <p role="status">{message}</p>}
        {(refreshRequired || (message && !index)) && <button type="button" onClick={() => void refresh()}>Refresh evidence</button>}
        {!index && !message && <p role="status">Loading evidence index…</p>}
        {index && !refreshRequired && <>
          <p className="evidence-caveat">Observation {index.snapshotId} · {observation.generatedAt}</p>
          <div className="evidence-filters" aria-label="Filter evidence by repository">
            <button type="button" className={repository === null ? 'is-active' : ''} onClick={() => setRepository(null)}>All · {observation.total}</button>
            {observation.byRepository.map(entry => <button type="button" className={repository === entry.repository ? 'is-active' : ''} key={entry.repository} onClick={() => setRepository(entry.repository)}>{entry.repository} · {entry.count}</button>)}
          </div>
          <div className="evidence-grid">
            <section aria-labelledby="standalone-evidence-title"><h3 id="standalone-evidence-title">Standalone unanswered briefs</h3>
              <div className="evidence-records">{visible.length ? visible.map(record => <EvidenceButton key={record.sourceRecordKey} record={record} onOpen={open} />) : <p className="evidence-empty">No records in this filter.</p>}</div>
            </section>
            <section aria-labelledby="unresolved-evidence-title"><h3 id="unresolved-evidence-title">Unresolved relation evidence</h3>
              <div className="evidence-diagnostics">{index.unresolvedRelations.length ? index.unresolvedRelations.map((diagnostic, number) => <article className="evidence-diagnostic" key={number}>
                <strong>{REASON_LABEL[diagnostic.reason]}</strong>
                <span>{diagnostic.relation}{'targetNativeId' in diagnostic && diagnostic.targetNativeId ? ` · ${diagnostic.targetNativeId}` : ''}</span>
                <div className="evidence-affected">{participants(diagnostic).map(({ label, key }, position) => { const record = recordsByKey.get(key); return <div key={`${label}:${position}:${key}`}><span>{label}</span>{record ? <EvidenceButton record={record} onOpen={open} /> : <code>{key}</code>}</div>; })}</div>
              </article>) : <p className="evidence-empty">No unresolved relations observed.</p>}</div>
            </section>
          </div>
          {selectedKey && !selected && !message && <p role="status">Loading evidence detail…</p>}
        </>}
      </div>}
      {selected && !refreshRequired && <EvidenceDialog record={selected} onClose={close} onFocusRepository={onFocusRepository} />}
    </div>
  );
}
