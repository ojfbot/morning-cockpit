import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { LoopSnapshot } from '@cockpit/shared';
import { fetchLoop } from '../../api.js';

const snapshot: LoopSnapshot = vi.hoisted(() => ({
  generatedAt: '2026-10-03T02:35:00Z',
  hygiene: {
    kind: 'configured', scheduler: 'Codex', scheduleRule: 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0',
    nextRunAt: '2026-10-03T14:01:22.000Z',
    firing: { kind: 'never-fired' },
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
    hygiene: { name: 'loop-hygiene', status: 'up', itemCount: 1 },
  },
}));

vi.mock('../../api.js', () => ({ fetchLoop: vi.fn().mockResolvedValue(snapshot) }));

import { LoopSection } from '../LoopSection.js';

describe('Selfco hygiene cockpit projection', () => {
  afterEach(() => cleanup());

  function show(hygiene: LoopSnapshot['hygiene'], health: LoopSnapshot['health']['hygiene'] = snapshot.health.hygiene) {
    vi.mocked(fetchLoop).mockResolvedValueOnce({ ...snapshot, hygiene, health: { ...snapshot.health, hygiene: health } });
    render(<LoopSection />);
  }

  it('renders configuration without claiming a scheduled fire or verified output', async () => {
    show(snapshot.hygiene);
    expect(await screen.findByText('Selfco vault hygiene')).toBeInTheDocument();
    expect(screen.getByText('configured · Codex')).toBeInTheDocument();
    expect(screen.getByText('firing · no recorded run')).toBeInTheDocument();
    expect(screen.getByText('output · unverified')).toBeInTheDocument();
    expect(screen.getByText(/Schedule FREQ=DAILY;BYHOUR=9;BYMINUTE=0/)).toBeInTheDocument();
  });

  it.each([
    ['unavailable', { kind: 'unavailable', reason: 'core reader is not installed' }],
    ['disabled', { kind: 'disabled', reason: 'Codex automation is disabled' }],
  ] as const)('renders %s', async (_label, hygiene) => {
    show(hygiene);
    expect(await screen.findByText(hygiene.reason)).toBeInTheDocument();
  });

  it('renders succeeded without claiming output verification', async () => {
    show({ kind: 'configured', scheduler: 'Codex', scheduleRule: 'FREQ=DAILY',
      firing: { kind: 'succeeded', observedAt: '2026-10-02T14:01:22.000Z', status: 'completed' },
      output: 'unverified' });
    expect(await screen.findByText(/firing · succeeded/)).toBeInTheDocument();
    expect(screen.getByText('output · unverified')).toBeInTheDocument();
  });

  it('renders a missed occurrence only when the producer reports one', async () => {
    show({ kind: 'configured', scheduler: 'Codex', scheduleRule: 'FREQ=DAILY',
      firing: { kind: 'missed', nextRunAt: '2026-10-02T14:01:22.000Z' }, output: 'unverified' });
    expect(await screen.findByText(/firing · missed · due/)).toBeInTheDocument();
  });

  it('shows uncertainty and adapter failure', async () => {
    show({ kind: 'configured', scheduler: 'Codex', scheduleRule: 'FREQ=DAILY',
      firing: { kind: 'unknown', reason: 'Prior pauses and retention are unknown' }, output: 'unverified' },
      { name: 'loop-hygiene', status: 'down', itemCount: 0, lastError: 'Reader failed' });
    expect(await screen.findByText('Prior pauses and retention are unknown')).toBeInTheDocument();
    expect(screen.getByText(/loop-hygiene: down.*Reader failed/)).toBeInTheDocument();
  });
});
