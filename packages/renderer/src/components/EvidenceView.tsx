import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { CockpitEvidence, HandoffRecordEvidence, UnresolvedRelationReason } from '@cockpit/shared';

const REASON_LABEL: Record<UnresolvedRelationReason, string> = {
  'target-matches-multiple-records': 'Target matches multiple observed records',
  'target-not-observed': 'Target not observed',
  'successor-order-unresolved': 'Successor order unresolved',
  'relation-cycle': 'Relation cycle observed',
};

function valueOrDash(value: string | null): string {
  return value?.trim() ? value : '—';
}

function EvidenceButton({ record, onOpen }: { record: HandoffRecordEvidence; onOpen: (record: HandoffRecordEvidence, opener: HTMLButtonElement) => void }) {
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
          <div><dt>Recipient (authored)</dt><dd>{valueOrDash(record.literal.to)}</dd></div>
          <div><dt>responding_to (authored)</dt><dd><code>{valueOrDash(record.literal.respondingTo)}</code></dd></div>
          <div><dt>refs (authored)</dt><dd>{record.literal.refs.length ? record.literal.refs.join(', ') : '—'}</dd></div>
          <div><dt>Created (authored)</dt><dd>{valueOrDash(record.literal.authoredCreatedAt)}</dd></div>
          <div><dt>Modified (filesystem observed)</dt><dd>{record.observedModifiedAt}</dd></div>
          <div><dt>Collected</dt><dd>{record.collectedAt}</dd></div>
          <div><dt>Verified process identity</dt><dd>Unavailable</dd></div>
        </dl>

        {repository && (
          <button className="evidence-focus" type="button" onClick={() => onFocusRepository(repository)}>
            Focus {repository}
          </button>
        )}
      </div>
    </div>
  );
}

export function EvidenceView({ evidence, onFocusRepository }: { evidence: CockpitEvidence | undefined; onFocusRepository: (repository: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [repository, setRepository] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const recordsByKey = useMemo(
    () => new Map((evidence?.records ?? []).map((record) => [record.sourceRecordKey, record])),
    [evidence?.records],
  );
  const selected = selectedKey ? recordsByKey.get(selectedKey) : undefined;

  useEffect(() => {
    if (selectedKey && !recordsByKey.has(selectedKey)) setSelectedKey(null);
  }, [recordsByKey, selectedKey]);

  if (!evidence) return null;
  const population = evidence.standaloneUnansweredBriefs;
  const visible = repository
    ? population.records.filter((record) => record.sourceRecord.repository === repository)
    : population.records;

  const close = () => {
    setSelectedKey(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  };
  const open = (record: HandoffRecordEvidence, opener: HTMLButtonElement) => {
    openerRef.current = opener;
    setSelectedKey(record.sourceRecordKey);
  };

  return (
    <div className="evidence-view">
      <button className="evidence-toggle" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span>Inspect evidence</span>
        <span className="evidence-toggle-meta">
          {population.total} standalone unanswered briefs
          {evidence.coverage.status !== 'complete' && <span className="evidence-coverage">{evidence.coverage.status}</span>}
          {evidence.unresolvedRelations.length > 0 && <span>{evidence.unresolvedRelations.length} unresolved</span>}
        </span>
      </button>

      {expanded && (
        <div className="evidence-panel">
          <div className="evidence-filters" aria-label="Filter evidence by repository">
            <button className={repository === null ? 'is-active' : ''} type="button" onClick={() => setRepository(null)}>All · {population.total}</button>
            {population.byRepository.map((entry) => (
              <button className={repository === entry.repository ? 'is-active' : ''} key={entry.repository} type="button" onClick={() => setRepository(entry.repository)}>
                {entry.repository} · {entry.count}
              </button>
            ))}
          </div>

          <div className="evidence-grid">
            <section aria-labelledby="standalone-evidence-title">
              <h3 id="standalone-evidence-title">Standalone unanswered briefs</h3>
              <div className="evidence-records">
                {visible.length ? visible.map((record) => <EvidenceButton key={record.sourceRecordKey} record={record} onOpen={open} />) : <p className="evidence-empty">No records in this filter.</p>}
              </div>
            </section>

            <section aria-labelledby="unresolved-evidence-title">
              <h3 id="unresolved-evidence-title">Unresolved relation evidence</h3>
              <div className="evidence-diagnostics">
                {evidence.unresolvedRelations.length ? evidence.unresolvedRelations.map((diagnostic, index) => (
                  <article className="evidence-diagnostic" key={`${diagnostic.reason}:${diagnostic.targetNativeId ?? ''}:${index}`}>
                    <strong>{REASON_LABEL[diagnostic.reason]}</strong>
                    <span>{diagnostic.relation}{diagnostic.targetNativeId ? ` · ${diagnostic.targetNativeId}` : ''}</span>
                    <div className="evidence-affected">
                      {diagnostic.affectedSourceRecordKeys.map((key) => {
                        const record = recordsByKey.get(key);
                        return record ? <EvidenceButton key={key} record={record} onOpen={open} /> : <code key={key}>{key}</code>;
                      })}
                    </div>
                  </article>
                )) : <p className="evidence-empty">No unresolved relations observed.</p>}
              </div>
            </section>
          </div>
        </div>
      )}

      {selected && <EvidenceDialog record={selected} onClose={close} onFocusRepository={onFocusRepository} />}
    </div>
  );
}
