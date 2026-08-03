import { ageBucket } from '@cockpit/shared';

/**
 * Age chip on the shared bucket boundaries (fresh <7d · aging 7-30d · rotten >30d),
 * replacing the old 14-day cliff. One definition (shared ageBucket) so badge, lane
 * order, and briefing ranking never disagree about what "old" means.
 */
export function StalenessBadge({ days }: { days: number | undefined }) {
  const bucket = ageBucket(days);
  if (bucket === 'fresh') return null;
  return (
    <span className={`stale-badge stale-badge--${bucket}`}>
      {bucket} {days}d
    </span>
  );
}
