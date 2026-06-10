import { useEffect, useMemo, useState } from 'react';
import type { LaneSummary, WorkItem, WorkItemLane } from '@cockpit/shared';
import { fetchSummary, type SummaryResponse } from '../api.js';
import { SummaryView } from './SummaryView.js';

/**
 * Bottom-of-lane summary. Renders the deterministic summary immediately, then auto-fetches
 * the local-model synthesis on load (cached server-side by item-set). The button forces a refresh.
 */
export function LaneSummaryPanel({
  lane,
  items,
  deterministic,
}: {
  lane: WorkItemLane;
  items: WorkItem[];
  deterministic: LaneSummary;
}) {
  const signature = useMemo(() => items.map((i) => `${i.nativeId}:${i.status}`).sort().join('|'), [items]);
  const [resp, setResp] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    fetchSummary(lane, false, controller.signal)
      .then((r) => active && setResp(r))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
      controller.abort();
    };
  }, [lane, signature]);

  const synthesize = async () => {
    setLoading(true);
    try {
      setResp(await fetchSummary(lane, true));
    } catch {
      /* keep current */
    } finally {
      setLoading(false);
    }
  };

  return (
    <SummaryView
      tag="Summary"
      summary={resp?.summary ?? deterministic}
      loading={loading}
      onSynthesize={synthesize}
      disabled={resp?.disabled === true}
      reason={resp?.reason}
      error={resp?.error}
    />
  );
}
