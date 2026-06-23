import type { CockpitSnapshot } from '@cockpit/shared';
import type { Density, Theme } from '../cockpitState.js';
import { ThemeToggle } from './ThemeToggle.js';

const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
  'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
];
const word = (n: number) => WORDS[n] ?? String(n);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Pull "N beads scanned · M agents · K overnight events" off the dolt adapter health note. */
function statBlock(snapshot: CockpitSnapshot): { beads: number; agents: number | null; events: number | null } {
  const note = snapshot.health.find((h) => /beads scanned/.test(h.note ?? ''))?.note ?? '';
  const num = (re: RegExp): number | null => {
    const m = note.match(re);
    return m ? Number(m[1]) : null;
  };
  return {
    beads: num(/(\d+) beads scanned/) ?? snapshot.meta.totalItems,
    agents: num(/(\d+) agents/),
    events: num(/(\d+) overnight events/) ?? snapshot.lanes.overnight.length,
  };
}

/**
 * Editorial masthead: hairline meta row, two-line nameplate, derived cover-line, mono stat block.
 * The cover-line is DERIVED from lane counts (pickup wanting a decision + stale-available), never static.
 */
export function Masthead({
  snapshot,
  theme,
  onToggleTheme,
  density,
  onToggleDensity,
  error,
}: {
  snapshot: CockpitSnapshot | null;
  theme: Theme;
  onToggleTheme: () => void;
  density: Density;
  onToggleDensity: () => void;
  error: string | null;
}) {
  const now = new Date();
  // Editorial style: "Saturday 23 June 2026" (day before month, no commas).
  const dateLine = [
    now.toLocaleDateString([], { weekday: 'long' }),
    now.getDate(),
    now.toLocaleDateString([], { month: 'long' }),
    now.getFullYear(),
  ].join(' ');
  const timeLine = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const pickup = snapshot?.lanes.pickup.length ?? 0;
  const stale = snapshot?.lanes.available.filter((i) => i.status === 'stale').length ?? 0;
  const overnight = snapshot?.lanes.overnight.length ?? 0;
  const stats = snapshot ? statBlock(snapshot) : null;

  return (
    <header className="masthead">
      <div className="masthead-metarow">
        <span>LOCAL EDITION · No. {snapshot?.meta.totalItems ?? '—'}</span>
        <span className="masthead-date">{dateLine}</span>
        <span className="masthead-meta-right">
          <span className="masthead-time">{timeLine}</span>
          <button
            className="theme-toggle"
            onClick={onToggleDensity}
            title={`Switch to ${density === 'compact' ? 'comfortable' : 'compact'} density`}
            aria-label={`Switch to ${density === 'compact' ? 'comfortable' : 'compact'} density`}
          >
            {density === 'compact' ? 'COZY' : 'DENSE'}
          </button>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </span>
      </div>

      <h1 className="nameplate">
        Morning
        <br />
        Cockpit
      </h1>

      <div className="masthead-foot">
        <p className="coverline">
          {error ? (
            <>
              Read-model unreachable. <span className="sig">{error}</span>
            </>
          ) : !snapshot ? (
            'Reading the overnight wire…'
          ) : (
            <>
              {overnight > 0 ? 'Busy night.' : 'Quiet night.'}{' '}
              <span className="sig">
                {cap(word(pickup))} brief{pickup === 1 ? '' : 's'}
              </span>{' '}
              want a decision, and{' '}
              <span className="sig">
                {word(stale)} task{stale === 1 ? '' : 's'}
              </span>{' '}
              {stale === 1 ? 'is' : 'are'} going stale while you sleep.
            </>
          )}
        </p>
        {stats && (
          <div className="masthead-stats">
            <span>{stats.beads} BEADS SCANNED</span>
            <span>
              {stats.agents ?? '—'} AGENTS · {stats.events ?? 0} OVERNIGHT EVENTS
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
