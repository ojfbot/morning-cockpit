import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../api.js', () => ({
  fetchFleet: vi.fn().mockResolvedValue({
    generatedAt: '2026-06-27T05:00:00.000Z',
    repos: [
      { name: 'morning-cockpit', role: 'home base', phase: 'EXP', openCount: 0, lastActivity: null, liveness: 'dark', here: true },
      { name: 'core', role: 'workflow engine', phase: 'P2', openCount: 1, lastActivity: null, liveness: 'live' },
    ],
    totals: { repos: 2, openBeads: 1, live: 1, stale: 0, dark: 1 },
  }),
}));

import { FleetSection } from '../FleetSection.js';

describe('FleetSection (F1) — selector wiring', () => {
  it('highlights the selected repo and delegates clicks to onSelectRepo', async () => {
    const onSelectRepo = vi.fn();
    render(<FleetSection selectedRepo="morning-cockpit" onSelectRepo={onSelectRepo} />);

    const coreCard = await screen.findByRole('button', { name: /core/i });
    const homeCard = screen.getByRole('button', { name: /morning-cockpit/i });

    // Highlight follows selection (default = morning-cockpit), not the static here flag.
    expect(homeCard).toHaveAttribute('aria-pressed', 'true');
    expect(coreCard).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(coreCard);
    expect(onSelectRepo).toHaveBeenCalledWith('core');
  });
});
