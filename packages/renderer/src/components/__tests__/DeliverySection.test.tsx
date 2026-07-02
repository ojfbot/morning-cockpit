import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DeliverySnapshot } from '@cockpit/shared';

// vi.hoisted: the vi.mock factory below is hoisted above this module's initializers.
const SNAPSHOT: DeliverySnapshot = vi.hoisted(() => ({
  generatedAt: '2026-07-02T20:00:00.000Z',
  northstars: [
    {
      slug: 'l1-morning-cockpit',
      tier: 'L1',
      app: 'morning-cockpit',
      properties: [
        { id: 'P1', name: 'Single legible pane', current: 60, target: 'Ground truth everywhere.' },
      ],
    },
  ],
  roadmaps: [
    {
      slug: 'rm-l1-morning-cockpit',
      northstar: 'l1-morning-cockpit',
      status: 'active',
      phases: [
        { id: 'PH1', name: 'Ground-truth producers', goal: 'No stubs.' },
        { id: 'PH2', name: 'Dispatch loop' },
      ],
      slices: [
        {
          id: 'S1',
          ref: 'rm:rm-l1-morning-cockpit#S1',
          phase: 'PH1',
          title: 'Wire the GitHub adapter',
          advances: 'ns:l1-morning-cockpit#P1',
          moves_from: 60,
          moves_to: 67,
          autonomy: 'gate-0',
          status: 'available',
          fileStatus: 'ready',
          queueState: 'available',
          beadId: 'morn-task-8258a633',
        },
        {
          id: 'S5',
          ref: 'rm:rm-l1-morning-cockpit#S5',
          phase: 'PH2',
          title: 'Delivery pane',
          advances: 'ns:l1-morning-cockpit#P1',
          moves_from: 60,
          moves_to: 66,
          autonomy: 'gate-0',
          status: 'claimed',
          fileStatus: 'dispatched',
          drift: 'file=dispatched queue=none',
        },
      ],
    },
  ],
  movements: [],
  health: {
    files: { name: 'delivery-files', status: 'up', itemCount: 1 },
    movement: { name: 'delivery-movement', status: 'up', itemCount: 0 },
    queue: { name: 'delivery-queue', status: 'down', itemCount: 0, lastError: 'ECONNREFUSED' },
  },
})) as DeliverySnapshot;

vi.mock('../../api.js', () => ({
  fetchDelivery: vi.fn().mockResolvedValue(SNAPSHOT),
}));

import { DeliverySection } from '../DeliverySection.js';

describe('DeliverySection (roadmap S5) — pipeline rendering', () => {
  it('renders gap bars, phase-grouped slices with state/gate/drift chips, and truthful empty movement', async () => {
    render(<DeliverySection />);

    // Northstar property gap bar with the honest current %.
    expect(await screen.findByText('Single legible pane')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();

    // Slices grouped under their phases.
    expect(screen.getByText('Ground-truth producers')).toBeInTheDocument();
    expect(screen.getByText('Dispatch loop')).toBeInTheDocument();

    // Merged displayed state chips: queue projection wins for S1, drift flagged for S5.
    expect(screen.getByText('available')).toBeInTheDocument();
    expect(screen.getByText('claimed')).toBeInTheDocument();
    expect(screen.getByText('drift')).toHaveAttribute(
      'title',
      'file-vs-queue drift: file=dispatched queue=none',
    );
    expect(screen.getAllByText('gate-0')).toHaveLength(2);
    expect(screen.getByText(/morn-task-8258a633/)).toBeInTheDocument();

    // Truthful empty movement feed + degraded-source note surfaced.
    expect(
      screen.getByText('No movement recorded yet — the odometer turns at first merge.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/delivery-queue: down — ECONNREFUSED/)).toBeInTheDocument();
  });
});
