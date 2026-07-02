import { useEffect, useState } from 'react';
import type { DeliveryNorthstar, DeliveryRoadmap, DeliverySnapshot, Movement } from '@cockpit/shared';
import { fetchDelivery } from '../api.js';
import { Section } from './Section.js';

const POLL_MS = 60_000;

/**
 * 03 · Delivery — the northstar→roadmap→dispatch pipeline, read-only (roadmap S5).
 * Per-northstar property gap bars, the roadmap slice pipeline grouped by phase (file
 * status × queue label merged, drift flagged), and the status.jsonl movement feed.
 * Replaces the old seeded Frame OS phase track — everything here is ground truth.
 */
export function DeliverySection() {
  const [snap, setSnap] = useState<DeliverySnapshot | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchDelivery()
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

  const healthNotes = [snap.health.files, snap.health.queue, snap.health.movement]
    .filter((h) => h.status !== 'up')
    .map((h) => `${h.name}: ${h.status}${h.lastError ? ` — ${h.lastError}` : ''}`);

  return (
    <Section
      index="03"
      kicker="DELIVERY"
      title="Delivery"
      caption={
        <span className="section-caption">
          northstar → roadmap → queue
          <br />
          movement recorded at merge
        </span>
      }
    >
      {snap.northstars.length === 0 && snap.roadmaps.length === 0 ? (
        <p className="delivery-empty">
          No roadmaps registered yet — register one in core/decisions/northstar/README.md.
        </p>
      ) : (
        <>
          {snap.northstars.map((ns) => (
            <NorthstarGaps key={ns.slug} ns={ns} />
          ))}
          {snap.roadmaps.map((rm) => (
            <RoadmapPipeline key={rm.slug} rm={rm} />
          ))}
        </>
      )}

      <MovementFeed movements={snap.movements} />

      {healthNotes.length > 0 && (
        <p className="delivery-health-note">{healthNotes.join(' · ')}</p>
      )}
    </Section>
  );
}

/** Per-property gap bars: honest current % against the 100% target (target prose on hover). */
function NorthstarGaps({ ns }: { ns: DeliveryNorthstar }) {
  return (
    <div className="ns-gaps">
      <div className="delivery-block-head">
        <span className="delivery-block-label">
          {ns.slug}
          {ns.app ? ` · ${ns.app}` : ''}
        </span>
        <span className="delivery-block-src">{ns.tier} northstar · property gaps</span>
      </div>
      {ns.properties.map((p) => (
        <div className="gap-row" key={p.id} title={`${p.id} target — ${p.target}`}>
          <span className="gap-id">{p.id}</span>
          <span className="gap-name">{p.name}</span>
          <span className="gap-bar">
            <span className="gap-bar-fill" style={{ width: `${Math.max(0, Math.min(100, p.current))}%` }} />
          </span>
          <span className="gap-pct">{p.current}%</span>
        </div>
      ))}
    </div>
  );
}

/** The slice pipeline, grouped by phase. State chip = file status × queue label, merged. */
function RoadmapPipeline({ rm }: { rm: DeliveryRoadmap }) {
  return (
    <div className="rm-pipeline">
      <div className="delivery-block-head">
        <span className="delivery-block-label">{rm.slug}</span>
        <span className="delivery-block-src">
          {rm.slices.length} slices · {rm.status}
        </span>
      </div>
      {rm.slices.length === 0 && <p className="delivery-empty">Roadmap has no slices yet.</p>}
      {rm.phases.map((ph) => {
        const slices = rm.slices.filter((s) => s.phase === ph.id);
        if (slices.length === 0) return null;
        return (
          <div className="rm-phase" key={ph.id}>
            <div className="rm-phase-head" title={ph.goal}>
              <span className="rm-phase-id">{ph.id}</span>
              <span className="rm-phase-name">{ph.name}</span>
            </div>
            {slices.map((s) => (
              <div className="slice-row" key={s.id}>
                <span className="slice-id">{s.id}</span>
                <div className="slice-body">
                  <span className="slice-title">{s.title}</span>
                  <span className="slice-meta">
                    {s.advances} · {s.moves_from}→{s.moves_to}%{s.repo ? ` · ${s.repo}` : ''}
                    {s.beadId ? ` · ${s.beadId}` : ''}
                  </span>
                </div>
                {s.drift && (
                  <span className="slice-drift" title={`file-vs-queue drift: ${s.drift}`}>
                    drift
                  </span>
                )}
                <span className="slice-gate">{s.autonomy}</span>
                <span className={`slice-chip slice-chip--${s.status}`}>{s.status}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** The odometer — status.jsonl movements, most recent first. */
function MovementFeed({ movements }: { movements: Movement[] }) {
  return (
    <div className="movement-feed">
      <div className="delivery-block-head">
        <span className="delivery-block-label">Movement</span>
        <span className="delivery-block-src">status.jsonl · recorded at merge</span>
      </div>
      {movements.length === 0 ? (
        <p className="delivery-empty">No movement recorded yet — the odometer turns at first merge.</p>
      ) : (
        movements.map((m, i) => (
          <div className="movement-row" key={`${m.date}-${m.northstar}-${m.property}-${i}`}>
            <span className="movement-date">{m.date}</span>
            <span className="movement-ref">
              ns:{m.northstar}#{m.property}
            </span>
            <span className="movement-delta">
              {m.from}→{m.to}%
            </span>
            <span className="movement-evidence" title={m.evidence}>
              {m.evidence ?? ''}
            </span>
            <span className="movement-actor">{m.actor ?? ''}</span>
          </div>
        ))
      )}
    </div>
  );
}
