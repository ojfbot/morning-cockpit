import type { RepoCard } from '@cockpit/shared';

/**
 * A single Fleet repo tile. Extracted from FleetSection (F1) into its own file so the tile-links
 * (L1) and popover (L3) slices graft onto a stable seam. As of F1 the tile is a selector: clicking
 * (or Enter/Space) sets the focused repo; `selected` drives the highlight. Read-only — selection is
 * UI state, not a write (ADR-0001/0012).
 */
export function RepoCardView({
  repo,
  selected,
  onSelect,
  relativeTime,
}: {
  repo: RepoCard;
  selected: boolean;
  onSelect: (name: string) => void;
  relativeTime: (iso: string | null) => string;
}) {
  const select = () => onSelect(repo.name);
  return (
    <div
      className={`repo-card${selected ? ' repo-card--here' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={select}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
      }}
    >
      <div className="repo-top">
        <span className={`dot ${repo.liveness === 'live' ? 'running' : repo.liveness === 'stale' ? 'stale' : 'unknown'}`} />
        <span className="repo-name">{repo.name}</span>
        <span className="repo-phase">{repo.phase}</span>
      </div>
      <div className="repo-role">{repo.here ? '★ ' : ''}{repo.role}</div>
      <div className="repo-foot">
        <span className="repo-open">{repo.openCount} open</span>
        <span className="repo-last">{repo.here ? 'now' : relativeTime(repo.lastActivity)}</span>
      </div>
    </div>
  );
}
