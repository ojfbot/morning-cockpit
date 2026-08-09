/**
 * Cockpit UI state — the prototype's `mc.cockpit.v1` contract.
 *
 * All serializable, persisted wholesale to one localStorage key. This is UI-only
 * state (theme / selection / approval / chat) — domain data always comes from the
 * read-model (`/api/*`), never from here. Mirrors the design's `Component.loadState`.
 */

import type { ChatTab } from '@cockpit/shared';

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
  /**
   * Which sidebar conversation is showing (S9). `northstar` is scoped to `selectedRepo`;
   * `leo` is the original single global thread.
   */
  activeChatTab: ChatTab;
  /**
   * The Fleet tile currently in focus (F1, ADR-0012). Default = morning-cockpit (fixed home).
   * Drives the Fleet highlight, scopes the Briefing (F2), and scopes the Northstar chat (S9).
   */
  selectedRepo: string;
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
  activeChatTab: 'leo',
  selectedRepo: 'morning-cockpit',
};

/** v1 key for the chat rail's open flag, superseded by `chatOpen` in mc.cockpit.v1 (S9). */
const LEGACY_CHAT_OPEN_KEY = 'cockpit-chat-open';

/**
 * Merge persisted state over defaults; tolerate corrupt / absent storage.
 *
 * S9 also absorbs the stray `cockpit-chat-open` key the sidebar used to own, so all chat UI
 * state lives in one blob. The legacy key WINS when present: `chatOpen` shipped in this blob
 * but was never read or written by the sidebar, so a persisted `chatOpen` is dead state, not a
 * user preference. Reading it in preference to the legacy key would collapse an open rail on
 * first load. Read once, then remove.
 */
export function loadState(): CockpitUiState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<CockpitUiState>) : {};
    const merged = { ...DEFAULTS, ...stored };
    const legacy = localStorage.getItem(LEGACY_CHAT_OPEN_KEY);
    if (legacy === 'open' || legacy === 'closed') {
      merged.chatOpen = legacy === 'open';
      localStorage.removeItem(LEGACY_CHAT_OPEN_KEY);
    }
    return merged;
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
