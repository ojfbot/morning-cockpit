import { useEffect, useState } from 'react';
import type { DispositionCounts, LoopSnapshot, PopulationFunnel } from '@cockpit/shared';
import { fetchLoop } from '../api.js';
import { Section } from './Section.js';

const POLL_MS = 60_000;

/**
 * 07 · Loop — the self-improvement telemetry loop, read-only. Capture health (are the
 * shadow-mode OPAV hooks still writing?), the disposition funnel (ignored →
 * engaged_no_act → followed → acted — the zeros are the point, never hidden), the
 * per-skill breakdown, and odometer/audit freshness. This pane observes the loop;
 * closing it happens in core, not here.
 */
export function LoopSection() {
  const [snap, setSnap] = useState<LoopSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchLoop()
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

  const healthNotes = [snap.health.dispositions, snap.health.odometer, snap.health.audit]
    .filter((h) => h.status !== 'up')
    .map((h) => `${h.name}: ${h.status}${h.lastError ? ` — ${h.lastError}` : ''}`);

  return (
    <Section
      index="07"
      kicker="LOOP"
      title="Loop"
      caption={
        <span className="section-caption">
          shadow-mode skill dispositions
          <br />
          capture → funnel → odometer
        </span>
      }
    >
      {snap.capture.total === 0 ? (
        <p className="delivery-empty">
          No dispositions captured yet — the shadow hooks haven&apos;t written
          skill-dispositions.jsonl.
        </p>
      ) : (
        <>
          <CaptureBlock snap={snap} />
          {snap.populations.map((p) => (
            <PopulationFunnelBlock key={p.population} funnel={p} />
          ))}
          <SkillBlock snap={snap} />
        </>
      )}

      <OdometerBlock snap={snap} />

      {healthNotes.length > 0 && <p className="delivery-health-note">{healthNotes.join(' · ')}</p>}
    </Section>
  );
}

/** Is the capture side of the loop alive? Days-quiet with an explicit stale badge. */
function CaptureBlock({ snap }: { snap: LoopSnapshot }) {
  const { capture } = snap;
  return (
    <div className="loop-capture">
      <div className="delivery-block-head">
        <span className="delivery-block-label">Capture</span>
        <span className="delivery-block-src">skill-dispositions.jsonl · shadow mode</span>
      </div>
      <div className="loop-capture-row">
        <span className="loop-stat">
          <span className="loop-stat-num">{capture.total}</span> events all-time
        </span>
        <span className="loop-stat">
          <span className="loop-stat-num">{capture.last7d}</span> last 7d
        </span>
        <span className="loop-stat">
          newest {capture.newestTs ? capture.newestTs.slice(0, 10) : 'never'}
          {capture.daysSinceLast !== undefined ? ` · ${capture.daysSinceLast}d ago` : ''}
        </span>
        {capture.stale && (
          <span className="loop-stale-badge" title="No new disposition events within the stale threshold — the capture hooks may have stopped writing.">
            capture stale
          </span>
        )}
      </div>
    </div>
  );
}

const FUNNEL_ROWS: Array<{ key: keyof DispositionCounts; label: string }> = [
  { key: 'ignored', label: 'ignored' },
  { key: 'engaged_no_act', label: 'engaged, no act' },
  { key: 'followed', label: 'followed' },
  { key: 'capture_miss', label: 'capture miss' },
  { key: 'acted', label: 'acted' },
];

const POPULATION_META: Record<PopulationFunnel['population'], { label: string; src: string }> = {
  installed: { label: 'Funnel · installed', src: 'installed-skill suggestions · post-fix era' },
  uninstalled: { label: 'Funnel · uninstalled', src: 'uninstalled-skill suggestions · post-fix era' },
  legacy: {
    label: 'Funnel · legacy',
    src: 'pre-fix rows (blind predicate) — archived to .bak at the 2026-07-17 rebuild, never blended',
  },
};

/** One population's funnel — all-time and last-14d counts. Zero rows always render. */
function PopulationFunnelBlock({ funnel }: { funnel: PopulationFunnel }) {
  const { allTime, last14d } = funnel;
  const meta = POPULATION_META[funnel.population];
  if (allTime.total === 0 && funnel.population !== 'legacy') {
    return (
      <div className="loop-funnel">
        <div className="delivery-block-head">
          <span className="delivery-block-label">{meta.label}</span>
          <span className="delivery-block-src">{meta.src}</span>
        </div>
        <p className="delivery-empty">No {funnel.population}-population rows yet — they accumulate as sessions stop.</p>
      </div>
    );
  }
  const max = Math.max(1, ...FUNNEL_ROWS.map((r) => allTime[r.key]));
  return (
    <div className="loop-funnel">
      <div className="delivery-block-head">
        <span className="delivery-block-label">{meta.label}</span>
        <span className="delivery-block-src">{meta.src}</span>
      </div>
      {FUNNEL_ROWS.map((row) => (
        <div className="loop-funnel-row" key={row.key}>
          <span className="loop-funnel-label">{row.label}</span>
          <span className="loop-funnel-bar">
            <span
              className={`loop-funnel-fill${allTime[row.key] === 0 ? ' loop-funnel-fill--zero' : ''}`}
              style={{ width: `${(allTime[row.key] / max) * 100}%` }}
            />
          </span>
          <span className="loop-funnel-count">{allTime[row.key]}</span>
          <span className="loop-funnel-window">{last14d[row.key]} / 14d</span>
        </div>
      ))}
      {allTime.other > 0 && (
        <p className="delivery-empty">{allTime.other} event(s) with an unrecognized disposition.</p>
      )}
    </div>
  );
}

/**
 * Top skills by suggestion volume. Rates render ONLY when the S6 capture-quality
 * artifact exists (snap.rateVerified) — until then, raw followed counts with an
 * unverified badge (ADR-0095: never publish a rate before the gold set is green).
 */
function SkillBlock({ snap }: { snap: LoopSnapshot }) {
  if (snap.skills.length === 0) return null;
  return (
    <div className="loop-skills">
      <div className="delivery-block-head">
        <span className="delivery-block-label">
          Top suggested skills
          {!snap.rateVerified && (
            <span
              className="loop-stale-badge loop-unverified-badge"
              title="No capture-quality artifact yet (rm:rm-l1-core#S6) — counts shown, rates suppressed per the ADR-0095 honesty contract."
            >
              rates unverified
            </span>
          )}
        </span>
        <span className="delivery-block-src">
          {snap.rateVerified ? 'suggestions · engaged · follow rate' : 'suggestions · engaged · followed (count)'}
        </span>
      </div>
      {snap.skills.map((s) => (
        <div className="loop-skill-row" key={s.skill}>
          <span className="loop-skill-name">{s.skill}</span>
          <span className="loop-skill-num">{s.total}</span>
          <span className="loop-skill-num">{s.engaged}</span>
          <span className="loop-skill-rate">
            {snap.rateVerified ? `${Math.round(s.followRate * 100)}%` : s.followed}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Downstream freshness — the odometer and the weekly architecture audit. */
function OdometerBlock({ snap }: { snap: LoopSnapshot }) {
  const { odometer, audit } = snap;
  return (
    <div className="loop-odometer">
      <div className="delivery-block-head">
        <span className="delivery-block-label">Downstream</span>
        <span className="delivery-block-src">odometer · weekly audit</span>
      </div>
      {odometer.movementCount === 0 ? (
        <p className="delivery-empty">No movement recorded yet — the odometer turns at first merge.</p>
      ) : (
        <div className="loop-capture-row">
          <span className="loop-stat">
            <span className="loop-stat-num">{odometer.movementCount}</span> movements
          </span>
          <span className="loop-stat">
            last {odometer.lastMovementDate}
            {odometer.daysSince !== undefined ? ` · ${odometer.daysSince}d ago` : ''}
          </span>
          <span className="loop-stat">
            audit{' '}
            {audit.mtime
              ? `${audit.mtime.slice(0, 10)}${audit.daysSince !== undefined ? ` · ${audit.daysSince}d ago` : ''}`
              : 'never ran'}
          </span>
        </div>
      )}
    </div>
  );
}
