import type { HandoffRecordSummary, DoltRecordSummary } from '@cockpit/shared';
type RecordSummary = HandoffRecordSummary | DoltRecordSummary;
interface EvidenceButtonProps {
  record: RecordSummary;
  onOpen: (record: RecordSummary, opener: HTMLButtonElement) => void;
}

export function EvidenceButton({ record, onOpen }: EvidenceButtonProps) {
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
