import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BriefingSnapshot } from '@cockpit/shared';
import type { CockpitUiState } from '../../../cockpitState.js';

const fetchBriefing = vi.fn();
vi.mock('../../../api.js', () => ({
  fetchBriefing: (...args: unknown[]) => fetchBriefing(...args),
}));

import { Briefing } from '../Briefing.js';

function uiWith(repo: string): CockpitUiState {
  return {
    theme: 'light', density: 'comfortable', accent: 'red',
    activeId: '', chosen: {}, approved: {}, chatOpen: false,
    selectedRepo: repo,
  };
}

function briefing(repo: string, title: string): BriefingSnapshot {
  return {
    generatedAt: 'x', repo, source: 'deterministic',
    threads: [{
      id: 't1', tag: 'stale', title, whyNow: '30d stale', catchUp: 'cu', question: 'q?',
      branches: [
        { key: 'ship', label: 'Ship', recommended: true, type: 'deliver',
          artifact: { title: 'a', target: `${repo}/.handoff/`, closes: 'b1', align: 'al', task: 'tk', criteria: ['c1'] } },
        { key: 'defer', label: 'Defer', recommended: false, type: 'defer', cta: 'Snooze', outcome: 'o', doneText: 'd' },
      ],
    }],
  };
}

const noop = () => {};

describe('Briefing (F2) — repo-scoped swap', () => {
  beforeEach(() => fetchBriefing.mockReset());

  it('fetches the selected repo and shows its threads + caption', async () => {
    fetchBriefing.mockResolvedValue(briefing('core', 'core first move'));
    render(<Briefing ui={uiWith('core')} setUi={noop} />);

    expect(await screen.findByText('core first move')).toBeInTheDocument();
    expect(screen.getByText(/scoped to core/i)).toBeInTheDocument();
    expect(fetchBriefing).toHaveBeenCalledWith('core', false, expect.anything());
  });

  it('refetches and swaps when the selected repo changes', async () => {
    fetchBriefing.mockResolvedValue(briefing('core', 'core first move'));
    const { rerender } = render(<Briefing ui={uiWith('core')} setUi={noop} />);
    await screen.findByText('core first move');

    fetchBriefing.mockResolvedValue(briefing('daily-logger', 'logger first move'));
    rerender(<Briefing ui={uiWith('daily-logger')} setUi={noop} />);

    expect(await screen.findByText('logger first move')).toBeInTheDocument();
    expect(fetchBriefing).toHaveBeenCalledWith('daily-logger', false, expect.anything());
  });

  it('shows an honest empty First Move for a quiet repo (no fabricated thread)', async () => {
    fetchBriefing.mockResolvedValue({ generatedAt: 'x', repo: 'lean-canvas', source: 'deterministic', threads: [] });
    render(<Briefing ui={uiWith('lean-canvas')} setUi={noop} />);

    expect(await screen.findByText(/lean-canvas is quiet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Seeded threads/i)).not.toBeInTheDocument();
  });
});
