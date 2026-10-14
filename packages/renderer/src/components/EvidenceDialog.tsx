import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type {
  HandoffRecordEvidence,
  DoltRecordEvidence,
} from '@cockpit/shared';
type ObservedRecord = HandoffRecordEvidence | DoltRecordEvidence;
interface EvidenceDialogProps {
  record: ObservedRecord;
  historical: boolean;
  onRelated: (key: string, opener: HTMLButtonElement) => void;
  onClose: () => void;
  onFocusRepository: (repository: string) => void;
}
function valueOrDash(value: string | null): string {
  return value?.trim() ? value : '—';
}

export function EvidenceDialog({
  record,
  onClose,
  onFocusRepository,
  onRelated,
  historical,
}: EvidenceDialogProps) {
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
