import { useEffect, useState } from 'react';
import { sortRows, type ControlPlaneSnapshot, type LoopVerdict } from '@cockpit/shared';
import { fetchControlPlane } from '../api.js';
import { Section } from './Section.js';

const POLL_MS = 60_000;

/**
 * 08 · Control plane — health of the fleet's LOOPS, read from core's registry
 * (`decisions/loops/loops.md`).
 *
 * Distinct from the two panes that look like they cover this:
 *   Fleet (01) reports repo *bead traffic* — a repo with healthy loops and no beads reads dark.
 *   Loop (07) reports *skill-disposition telemetry* — the OPAV capture funnel, nothing else.
 *
 * Two things this pane refuses to do:
 *
 * 1. **Let coverage hide.** The headline is watched/unwatched, not a green count. Most of the
 *    registry is `event`/`manual` cadence, which liveness cannot evaluate at all — so an
 *    event hook that silently stops is invisible. Rendering only the watched subset would
 *    make that blindness look like health.
 * 2. **Render `unverifiable` as broken.** Evidence unreadable from this host says nothing
 *    about the loop. Those rows are visually distinct from `down`, carry their reason, and
 *    the vantage is printed under the pane.
 */
export function ControlPlaneSection() {
  const [snap, setSnap] = useState<ControlPlaneSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchControlPlane()
        .then((s) => active && setSnap(s))
        .catch(() => {});
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (!snap) return null;

  const { totals, rows } = snap;
  const problems = rows.filter((r) => r.verdict === 'down' || r.verdict === 'stale');
  const unverifiable = rows.filter((r) => r.verdict === 'unverifiable');
  const degraded = snap.health.filter((h) => h.status !== 'up');

  return (
    <Section
      index="08"
      kicker="CONTROL PLANE"
      title="Control plane"
      caption={
        <span className="section-caption">
          {totals.loops} loops declared in core&rsquo;s registry
          <br />
          {totals.watched} watchable · {totals.unwatched} unobserved
        </span>
      }
    >
      {degraded.length > 0 && (
        <div className="cp-degraded" role="status">
          {degraded.map((h) => (
            <div key={h.name}>
              {h.name}: {h.status}
              {h.lastError ? ` — ${h.lastError}` : h.note ? ` — ${h.note}` : ''}
            </div>
          ))}
        </div>
      )}

      {/*
        Coverage first. `unwatched` is NOT a healthy state — it is the share of the control
        plane no mechanism can currently check, which is the pane's most important number.
      */}
      <div className="cp-coverage">
        <div className="cp-stat">
          <span className="cp-stat-n">{totals.watched}</span>
          <span className="cp-stat-l">watchable</span>
          <span className="cp-stat-sub">cadenced &amp; live</span>
        </div>
        <div className="cp-stat cp-stat-warn">
          <span className="cp-stat-n">{totals.unwatched}</span>
          <span className="cp-stat-l">unobserved</span>
          <span className="cp-stat-sub">event/manual/parked — nothing checks these</span>
        </div>
        <div className="cp-stat">
          <span className="cp-stat-n">{totals.withoutVerifier}</span>
          <span className="cp-stat-l">no verifier</span>
          <span className="cp-stat-sub">cannot be checked in principle</span>
        </div>
        {totals.parseSkipped > 0 && (
          <div className="cp-stat cp-stat-warn">
            <span className="cp-stat-n">{totals.parseSkipped}</span>
            <span className="cp-stat-l">unparsed</span>
            <span className="cp-stat-sub">registry entries this pane cannot see</span>
          </div>
        )}
      </div>

      {problems.length === 0 ? (
        <p className="cp-empty">
          No watchable loop is down or stale. {totals.unwatched} loops remain unobserved — that is
          coverage, not health.
        </p>
      ) : (
        <table className="cp-table">
          <thead>
            <tr>
              <th>loop</th>
              <th>repo</th>
              <th>trigger</th>
              <th>cadence</th>
              <th>state</th>
              <th>detail</th>
            </tr>
          </thead>
          <tbody>
            {sortRows(problems).map((r) => (
              <tr key={r.slug}>
                <td className="cp-slug">{r.slug}</td>
                <td>{r.repo ?? '—'}</td>
                <td>{r.trigger}</td>
                <td>{r.cadence}</td>
                <td>
                  <VerdictBadge verdict={r.verdict} />
                </td>
                <td className="cp-why">{r.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {unverifiable.length > 0 && (
        <details className="cp-unverifiable">
          <summary>
            {unverifiable.length} loop{unverifiable.length === 1 ? '' : 's'} unverifiable from this
            vantage — not a failure state
          </summary>
          <ul>
            {unverifiable.map((r) => (
              <li key={r.slug}>
                <span className="cp-slug">{r.slug}</span> — {r.why}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="cp-vantage">
        read from <code>{snap.source}</code> at <code>{snap.vantage}</code>. Evidence living on
        another host reads <em>unverifiable</em> here — a statement about this vantage, not about
        the loop.
      </p>
    </Section>
  );
}

const VERDICT_LABEL: Record<LoopVerdict, string> = {
  ok: 'ok',
  stale: 'stale',
  down: 'down',
  unverifiable: 'unverifiable',
  excluded: 'unobserved',
};

function VerdictBadge({ verdict }: { verdict: LoopVerdict }) {
  return <span className={`cp-badge cp-badge-${verdict}`}>{VERDICT_LABEL[verdict]}</span>;
}
