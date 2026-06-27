import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BriefingSnapshot } from '@cockpit/shared';
import type { CockpitUiState } from '../../../cockpitState.js';

const streamBriefing = vi.fn();
vi.mock('../../../api.js', () => ({
  streamBriefing: (...args: unknown[]) => streamBriefing(...args),
}));

import { Briefing } from '../Briefing.js';

/** Build an async generator of briefing frames (the SSE-stream shape). */
function frames(...items: BriefingSnapshot[]) {
  return (async function* () {
    for (const i of items) yield i;
  })();
}

function uiWith(repo: string): CockpitUiState {
  return {
    theme: 'light', density: 'comfortable', accent: 'red',
    activeId: '', chosen: {}, approved: {}, chatOpen: false,
    selectedRepo: repo,
  };
}

function briefing(repo: string, title: string, source: 'deterministic' | 'llm' = 'deterministic'): BriefingSnapshot {
  return {
    generatedAt: 'x', repo, source,
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

const empty = (repo: string): BriefingSnapshot => ({ generatedAt: 'x', repo, source: 'deterministic', threads: [] });
const noop = () => {};

describe('Briefing (F2/F3) — repo-scoped swap', () => {
  beforeEach(() => streamBriefing.mockReset());

  it('streams the selected repo and shows its threads + caption', async () => {
    streamBriefing.mockImplementation(() => frames(briefing('core', 'core first move')));
    render(<Briefing ui={uiWith('core')} setUi={noop} />);

    expect(await screen.findByText('core first move')).toBeInTheDocument();
    expect(screen.getByText(/scoped to core/i)).toBeInTheDocument();
    expect(streamBriefing).toHaveBeenCalledWith('core', false, expect.anything());
  });

  it('re-streams and swaps when the selected repo changes', async () => {
    streamBriefing.mockImplementation(() => frames(briefing('core', 'core first move')));
    const { rerender } = render(<Briefing ui={uiWith('core')} setUi={noop} />);
    await screen.findByText('core first move');

    streamBriefing.mockImplementation(() => frames(briefing('daily-logger', 'logger first move')));
    rerender(<Briefing ui={uiWith('daily-logger')} setUi={noop} />);

    expect(await screen.findByText('logger first move')).toBeInTheDocument();
    expect(streamBriefing).toHaveBeenCalledWith('daily-logger', false, expect.anything());
  });

  it('shows the deterministic floor first, then upgrades to the LLM frame (ADR-0014)', async () => {
    streamBriefing.mockImplementation(() =>
      frames(briefing('core', 'deterministic move', 'deterministic'), briefing('core', 'llm move', 'llm')),
    );
    render(<Briefing ui={uiWith('core')} setUi={noop} />);

    // Both frames flush in the same async tick here; the upgraded content is what remains.
    expect(await screen.findByText('llm move')).toBeInTheDocument();
    expect(screen.queryByText('deterministic move')).not.toBeInTheDocument();
  });

  it('shows an honest empty First Move for a quiet repo (no fabricated thread)', async () => {
    streamBriefing.mockImplementation(() => frames(empty('lean-canvas')));
    render(<Briefing ui={uiWith('lean-canvas')} setUi={noop} />);

    expect(await screen.findByText(/lean-canvas is quiet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Seeded threads/i)).not.toBeInTheDocument();
  });

  // F3 — the content sits in a repo-keyed .briefing-swap container (animation + reduced-motion in app.css).
  it('wraps populated content in a .briefing-swap container', async () => {
    streamBriefing.mockImplementation(() => frames(briefing('core', 'core first move')));
    const { container } = render(<Briefing ui={uiWith('core')} setUi={noop} />);
    await screen.findByText('core first move');
    expect(container.querySelector('.briefing-swap')).toBeTruthy();
  });

  it('wraps the empty First Move in a .briefing-swap container too', async () => {
    streamBriefing.mockImplementation(() => frames(empty('lean-canvas')));
    const { container } = render(<Briefing ui={uiWith('lean-canvas')} setUi={noop} />);
    await screen.findByText(/lean-canvas is quiet/i);
    expect(container.querySelector('.briefing-swap')).toBeTruthy();
  });
});
