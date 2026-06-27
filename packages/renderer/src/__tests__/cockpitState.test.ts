import { describe, it, expect } from 'vitest';
import { loadState, saveState, STATE_KEY } from '../cockpitState.js';

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
