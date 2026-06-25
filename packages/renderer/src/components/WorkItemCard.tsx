import { useState } from 'react';
import type { WorkItem } from '@cockpit/shared';
import { StalenessBadge } from './StalenessBadge.js';
import { claimTask } from '../api.js';

function relativeTime(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** "lease 7h" / "lease <1h" / "lease expired" from an ISO deadline. */
function leaseLabel(iso: string): string {
  const ms = Date.parse(iso) - Date.now();
  if (Number.isNaN(ms)) return 'lease ?';
  if (ms <= 0) return 'lease expired';
  const h = Math.floor(ms / 3_600_000);
  return h < 1 ? 'lease <1h' : `lease ${h}h`;
}

export function WorkItemCard({ item, onClaimed }: { item: WorkItem; onClaimed?: () => void }) {
  const convoy = item.detail.kind === 'convoy' ? item.detail : undefined;
  // A real, unclaimed queue post is claimable; a claimed item shows its owner instead.
  const claimable = item.posted === true && item.status === 'open' && !item.claimedBy;

  return (
    <div className={`card card--${item.status}`}>
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

      {item.url ? (
        <a
          className="card-title card-title--link"
          href={item.url}
          target={item.url.startsWith('http') ? '_blank' : undefined}
          rel="noreferrer"
        >
          {item.title}
        </a>
      ) : (
        <div className="card-title">{item.title}</div>
      )}

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

      {item.claimedBy ? (
        <div className="card-claim card-claim--held" title={`held by ${item.claimedBy}`}>
          ● claimed by {item.claimedBy}
          {item.leaseUntil && ` · ${leaseLabel(item.leaseUntil)}`}
        </div>
      ) : (
        claimable && <ClaimButton beadId={item.nativeId} onClaimed={onClaimed} />
      )}
    </div>
  );
}

type ClaimPhase =
  | { phase: 'idle' }
  | { phase: 'claiming' }
  | { phase: 'lost' }
  | { phase: 'error'; message: string };

function ClaimButton({ beadId, onClaimed }: { beadId: string; onClaimed?: () => void }) {
  const [state, setState] = useState<ClaimPhase>({ phase: 'idle' });

  const claim = async () => {
    setState({ phase: 'claiming' });
    try {
      const res = await claimTask(beadId);
      if (res.claimed) {
        onClaimed?.(); // refetch the snapshot so the card flips to the claimed badge
      } else if (res.reason === 'lost') {
        setState({ phase: 'lost' }); // someone/something beat us to it
      } else {
        setState({ phase: 'error', message: res.error ?? 'claim failed' });
      }
    } catch (err) {
      setState({ phase: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  if (state.phase === 'lost') {
    return <div className="card-claim card-claim--lost">already claimed — refresh</div>;
  }
  return (
    <div className="card-claim">
      <button
        className="card-claim-btn"
        onClick={() => void claim()}
        disabled={state.phase === 'claiming'}
        title="Take ownership of this queued task (sets a lease)"
      >
        {state.phase === 'claiming' ? 'Claiming…' : 'Claim →'}
      </button>
      {state.phase === 'error' && <span className="card-claim-err">{state.message}</span>}
    </div>
  );
}
