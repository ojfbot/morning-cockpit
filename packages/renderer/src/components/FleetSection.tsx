import { useEffect, useState } from 'react';
import type { FleetSnapshot, RepoCard } from '@cockpit/shared';
import { fetchFleet } from '../api.js';
import { Section } from './Section.js';

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
export function FleetSection() {
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
          <RepoCardView key={r.name} repo={r} relativeTime={relativeTime} />
        ))}
      </div>
    </Section>
  );
}

function RepoCardView({ repo, relativeTime }: { repo: RepoCard; relativeTime: (iso: string | null) => string }) {
  return (
    <div className={`repo-card${repo.here ? ' repo-card--here' : ''}`}>
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
