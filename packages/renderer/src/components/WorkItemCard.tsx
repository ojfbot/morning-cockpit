import type { WorkItem } from '@cockpit/shared';
import { StalenessBadge } from './StalenessBadge.js';

function relativeTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function WorkItemCard({ item }: { item: WorkItem }) {
  const convoy = item.detail.kind === 'convoy' ? item.detail : undefined;
  return (
    <a
      className={`card card--${item.status}`}
      href={item.url}
      target={item.url?.startsWith('http') ? '_blank' : undefined}
      rel="noreferrer"
    >
      <div className="card-top">
        <span className={`dot ${item.status}`} title={item.status} />
        <span className="card-kind">{item.kind.replace('_', ' ')}</span>
        {item.posted ? (
          <span className="card-queue card-queue--posted" title="Posted to the unassigned queue (queue=available)">
            POSTED
          </span>
        ) : (
          item.lane === 'available' && (
            <span className="card-queue card-queue--synth" title="Synthesized from open issues/briefs — not a real queue post">
              synth
            </span>
          )
        )}
        {item.repo && <span className="card-repo">{item.repo}</span>}
      </div>
      <div className="card-title">{item.title}</div>
      {convoy && (
        <div className="convoy-bar" title={`${convoy.done}/${convoy.total} done`}>
          <span style={{ width: `${convoy.pct}%` }} />
        </div>
      )}
      <div className="card-foot">
        {item.actor && <span>{item.actor}</span>}
        <span>{relativeTime(item.activityAt)}</span>
        <StalenessBadge days={item.staleDays} />
      </div>
    </a>
  );
}
