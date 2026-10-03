import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LoopSnapshot } from '@cockpit/shared';

const snapshot: LoopSnapshot = vi.hoisted(() => ({
  generatedAt: '2026-10-03T02:35:00Z',
  hygiene: {
    kind: 'configured', scheduler: 'Codex', targetThreadId: 'thread-1',
    nextRunAt: '2026-10-03T14:01:22Z',
    firing: { kind: 'never-fired', nextRunAt: '2026-10-03T14:01:22Z' },
    output: 'unverified',
  },
  capture: { total: 0, last7d: 0, stale: true },
  funnel: {
    allTime: { ignored: 0, engaged_no_act: 0, followed: 0, capture_miss: 0, acted: 0, other: 0, total: 0 },
    last14d: { ignored: 0, engaged_no_act: 0, followed: 0, capture_miss: 0, acted: 0, other: 0, total: 0 },
  },
  populations: [], rateVerified: false, skills: [],
  odometer: { movementCount: 0 }, audit: {},
  health: {
    dispositions: { name: 'loop-dispositions', status: 'up', itemCount: 0 },
    odometer: { name: 'loop-odometer', status: 'up', itemCount: 0 },
    audit: { name: 'loop-audit', status: 'up', itemCount: 0 },
  },
}));

vi.mock('../../api.js', () => ({ fetchLoop: vi.fn().mockResolvedValue(snapshot) }));

import { LoopSection } from '../LoopSection.js';

describe('Selfco hygiene cockpit projection', () => {
  it('renders configuration without claiming a scheduled fire or verified output', async () => {
    render(<LoopSection />);
    expect(await screen.findByText('Selfco vault hygiene')).toBeInTheDocument();
    expect(screen.getByText('configured · Codex')).toBeInTheDocument();
    expect(screen.getByText('firing · never fired')).toBeInTheDocument();
    expect(screen.getByText('output · unverified')).toBeInTheDocument();
    expect(screen.getByText(/pending core #500/)).toBeInTheDocument();
  });
});
