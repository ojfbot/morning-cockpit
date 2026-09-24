import { describe, it, expect, beforeEach } from 'vitest';
import { loadState, saveState, STATE_KEY } from '../cockpitState.js';

const LEGACY_CHAT_OPEN_KEY = 'cockpit-chat-open';

describe('cockpitState — selectedRepo (F1)', () => {
  it('defaults to morning-cockpit (fixed home, ADR-0012 #3)', () => {
    expect(loadState().selectedRepo).toBe('morning-cockpit');
  });

  it('falls back to the default when a persisted blob predates the key', () => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ theme: 'dark' }));
    expect(loadState().selectedRepo).toBe('morning-cockpit');
  });

  it('round-trips a selection across save → load (persistence)', () => {
    saveState({ ...loadState(), selectedRepo: 'core' });
    expect(loadState().selectedRepo).toBe('core');
  });
});

describe('cockpitState — chat tab + legacy rail key (S9)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to the Leo thread', () => {
    expect(loadState().activeChatTab).toBe('leo');
  });

  it('round-trips the active tab', () => {
    saveState({ ...loadState(), activeChatTab: 'northstar' });
    expect(loadState().activeChatTab).toBe('northstar');
  });

  /**
   * Regression: `chatOpen` shipped in the blob but the sidebar never read or wrote it — the
   * live value lived in `cockpit-chat-open`. Preferring the persisted (dead) `chatOpen` would
   * collapse an open rail on the first post-upgrade load.
   */
  it('lets the legacy rail key win over the dead persisted chatOpen', () => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ chatOpen: false, selectedRepo: 'core' }));
    localStorage.setItem(LEGACY_CHAT_OPEN_KEY, 'open');

    const state = loadState();
    expect(state.chatOpen).toBe(true);
    expect(state.selectedRepo).toBe('core'); // the rest of the blob is untouched
  });

  it('consumes the legacy key exactly once', () => {
    localStorage.setItem(LEGACY_CHAT_OPEN_KEY, 'open');
    expect(loadState().chatOpen).toBe(true);
    expect(localStorage.getItem(LEGACY_CHAT_OPEN_KEY)).toBeNull();

    saveState({ ...loadState(), chatOpen: false });
    expect(loadState().chatOpen).toBe(false); // no resurrection from the removed key
  });

  it('keeps the persisted value when there is no legacy key', () => {
    localStorage.setItem(STATE_KEY, JSON.stringify({ chatOpen: true }));
    expect(loadState().chatOpen).toBe(true);
  });
});
