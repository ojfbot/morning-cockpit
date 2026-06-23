import { useEffect, useState } from 'react';
import type { DeliverySnapshot } from '@cockpit/shared';
import { fetchDelivery } from '../api.js';
import { Section } from './Section.js';

/** 03 · Delivery — a horizontal phase track + the prioritized "next moves" from §6. */
export function DeliverySection() {
  const [snap, setSnap] = useState<DeliverySnapshot | null>(null);

  useEffect(() => {
    let active = true;
    fetchDelivery()
      .then((s) => active && setSnap(s))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!snap) return null;

  return (
    <Section
      index="03"
      kicker="DELIVERY"
      title="Delivery"
      caption={
        <span className="section-caption">
          Frame OS roadmap
          <br />
          next moves · coordination ADR-0002
        </span>
      }
    >
      <div className="phase-track" style={{ ['--progress' as string]: `${Math.round(snap.progress * 100)}%` }}>
        <div className="phase-line" />
        <div className="phase-line-fill" />
        {snap.milestones.map((m) => (
          <div className={`milestone milestone--${m.state}`} key={m.marker}>
            <span className="milestone-dot" />
            <span className="milestone-marker">{m.marker}</span>
            <span className="milestone-title">{m.title}</span>
            <span className="milestone-status">{m.status}</span>
          </div>
        ))}
      </div>

      <div className="nextmoves">
        <div className="nextmoves-head">
          <span className="nextmoves-label">Next moves</span>
          <span className="nextmoves-src">from coordination-design.md · §6</span>
        </div>
        {snap.nextMoves.map((mv) => (
          <div className="move" key={mv.index}>
            <span className="move-index">{String(mv.index).padStart(2, '0')}</span>
            <div className="move-body">
              <span className="move-title">{mv.title}</span>
              <span className="move-unblocks">unblocks — {mv.unblocks}</span>
            </div>
            <span className={`move-effort move-effort--${mv.effort.toLowerCase()}`}>{mv.effort}</span>
            <span className="move-repo">{mv.repo}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}
