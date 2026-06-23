import { useEffect, useState } from 'react';
import type { CriticalChain, CriticalPathSnapshot } from '@cockpit/shared';
import type { CockpitUiState } from '../cockpitState.js';
import { fetchCriticalPath } from '../api.js';
import { Section } from './Section.js';

/** Render "{red fragment}" markers in the intro line. */
function intro(text: string) {
  return text.split(/(\{[^}]+\})/g).map((part, i) =>
    part.startsWith('{') && part.endsWith('}') ? (
      <span className="sig" key={i}>
        {part.slice(1, -1)}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/**
 * 02 · Critical Path — the blocker board (seeded from coordination-design §6). "Brief ↑" sets the
 * Briefing's active thread (best-effort id match — threads are generated) and scrolls to it.
 */
export function CriticalPathSection({ setUi }: { setUi: (fn: (s: CockpitUiState) => CockpitUiState) => void }) {
  const [snap, setSnap] = useState<CriticalPathSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    fetchCriticalPath()
      .then((s) => active && setSnap(s))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const jump = (chain: CriticalChain) => {
    if (!chain.briefId) return;
    setUi((s) => ({ ...s, activeId: chain.briefId! }));
    document.getElementById('briefing')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!snap) return null;

  return (
    <Section
      index="02"
      kicker="CRITICAL PATH"
      title="Critical Path"
      caption={
        <span className="section-caption">
          what blocks what
          <br />
          core is the chokepoint
        </span>
      }
    >
      <p className="crit-intro">{intro(snap.intro)}</p>

      <div className="crit-board">
        {snap.chains.map((c) => (
          <div className={`crit-row crit-row--${c.severity}`} key={c.id}>
            <div className="crit-main">
              <div className="crit-headline">
                <span className={`crit-sev crit-sev--${c.severity}`}>{c.severity}</span>
                <span className="crit-title">{c.title}</span>
                {c.waitsOn && <span className="crit-waits">{c.waitsOn}</span>}
              </div>
              <div className="crit-blocks">
                <span className="crit-rel">{c.relation}</span>
                {c.blocks.map((b) => (
                  <span className="crit-chip" key={b}>
                    {b}
                  </span>
                ))}
              </div>
            </div>
            <span className="crit-impact">{c.impact}</span>
            <button
              className={`crit-cta${c.briefId ? '' : ' crit-cta--ghost'}`}
              onClick={() => jump(c)}
              disabled={!c.briefId}
              title={c.briefId ? 'Jump the Briefing to this thread' : 'Settle the ADR first'}
            >
              {c.cta}
            </button>
          </div>
        ))}
      </div>

      {snap.seeded && <p className="crit-note">{snap.note}</p>}
    </Section>
  );
}
