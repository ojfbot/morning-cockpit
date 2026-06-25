import type { LaneSummary, WorkItem, WorkItemLane } from '@cockpit/shared';
import { WorkItemCard } from './WorkItemCard.js';
import { LaneSummaryPanel } from './LaneSummaryPanel.js';

const SUBTITLE: Record<WorkItemLane, string> = {
  overnight: 'ran or running since last evening',
  pickup: 'human-in-the-loop, act today',
  available: 'unclaimed — pickable, stale floats up',
};

const EMPTY: Record<WorkItemLane, string> = {
  overnight: 'No fresh overnight activity.',
  pickup: 'Nothing flagged for pickup.',
  available: 'Queue is empty (no real unassigned pool exists yet — see ADR-0002).',
};

export function Lane({
  lane,
  items,
  summary,
  onClaimed,
}: {
  lane: WorkItemLane;
  items: WorkItem[];
  summary: LaneSummary | undefined;
  /** Refetch callback passed to cards so a claim reflects immediately (Available lane). */
  onClaimed?: () => void;
}) {
  return (
    <section className="lane">
      <header className="lane-head">
        <span className="lane-label">{lane}</span>
        <span className="lane-count">{items.length}</span>
      </header>
      <div className="lane-sub">{SUBTITLE[lane]}</div>
      <div className="lane-cards">
        {items.length === 0 ? (
          <div className="lane-empty">{EMPTY[lane]}</div>
        ) : (
          items.map((item) => <WorkItemCard key={item.id} item={item} onClaimed={onClaimed} />)
        )}
      </div>
      {summary && <LaneSummaryPanel lane={lane} items={items} deterministic={summary} />}
    </section>
  );
}
