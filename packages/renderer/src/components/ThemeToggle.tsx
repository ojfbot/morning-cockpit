import type { Theme } from '../cockpitState.js';

/**
 * Masthead light/dark switch. Controlled — the parent owns `mc.cockpit.v1`.
 * The label shows the *other* mode (the action), per the design.
 */
export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const other = theme === 'dark' ? 'LIGHT' : 'DARK';
  return (
    <button
      className="theme-toggle"
      onClick={onToggle}
      title={`Switch to ${other.toLowerCase()} mode`}
      aria-label={`Switch to ${other.toLowerCase()} mode`}
    >
      {other}
    </button>
  );
}
