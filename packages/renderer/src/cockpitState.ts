/**
 * Cockpit UI state — the prototype's `mc.cockpit.v1` contract.
 *
 * All serializable, persisted wholesale to one localStorage key. This is UI-only
 * state (theme / selection / approval / chat) — domain data always comes from the
 * read-model (`/api/*`), never from here. Mirrors the design's `Component.loadState`.
 */

export type Theme = 'light' | 'dark';
export type Density = 'comfortable' | 'compact';
export type Accent = 'red' | 'blue' | 'green';

export interface CockpitUiState {
  theme: Theme;
  density: Density;
  accent: Accent;
  /** Selected Briefing thread (Slice 2). */
  activeId: string;
  /** Picked decision branch per thread (Slice 2). */
  chosen: Record<string, string>;
  /** Approved (emitted) branch per thread (Slice 2). */
  approved: Record<string, string>;
  /** Chat rail expanded (Slice 6). */
  chatOpen: boolean;
}

export const STATE_KEY = 'mc.cockpit.v1';

const DEFAULTS: CockpitUiState = {
  theme: 'light',
  density: 'comfortable',
  accent: 'red',
  activeId: '',
  chosen: {},
  approved: {},
  chatOpen: false,
};

/** Merge persisted state over defaults; tolerate corrupt / absent storage. */
export function loadState(): CockpitUiState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<CockpitUiState>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveState(state: CockpitUiState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — UI still works, just not persisted */
  }
}

/** Reflect the three presentation axes onto the document root (tokens.css drives the rest). */
export function applyRootAttributes(state: Pick<CockpitUiState, 'theme' | 'density' | 'accent'>): void {
  const root = document.documentElement;
  root.setAttribute('data-theme', state.theme);
  root.setAttribute('data-density', state.density);
  root.setAttribute('data-accent', state.accent);
}
