import { useEffect, useState } from 'react';
import type { FleetSnapshot } from '@cockpit/shared';
import { fetchFleet } from '../api.js';
import { Section } from './Section.js';
import { RepoCardView } from './RepoCardView.js';

const POLL_MS = 5 * 60_000;

function relativeTime(iso: string | null): string {
  if (!iso) return 'no activity';
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** 01 · Fleet — one card per repo: liveness dot, phase tag, role, open count, last activity. */
export function FleetSection({
  selectedRepo,
  onSelectRepo,
}: {
  selectedRepo: string;
  onSelectRepo: (name: string) => void;
}) {
  const [snap, setSnap] = useState<FleetSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchFleet()
        .then((s) => active && setSnap(s))
        .catch(() => {});
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const t = snap?.totals;
  return (
    <Section
      index="01"
      kicker="FLEET"
      title="Fleet"
      caption={
        <span className="section-caption">
          {t ? `${t.repos} repositories · ${t.openBeads} open beads` : 'scanning repos…'}
          <br />
          {t ? `${t.live} live · ${t.stale} stale · ${t.dark} dark` : 'deriving liveness…'}
        </span>
      }
    >
      <div className="fleet-grid">
        {(snap?.repos ?? []).map((r) => (
          <RepoCardView
            key={r.name}
            repo={r}
            selected={selectedRepo === r.name}
            onSelect={onSelectRepo}
            relativeTime={relativeTime}
          />
        ))}
      </div>
    </Section>
  );
}
