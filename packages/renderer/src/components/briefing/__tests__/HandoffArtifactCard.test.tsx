import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BriefingArtifact } from '@cockpit/shared';

const { claimTask, emitBriefingArtifact } = vi.hoisted(() => ({
  claimTask: vi.fn(),
  emitBriefingArtifact: vi.fn(),
}));

vi.mock('../../../api.js', () => ({ claimTask, emitBriefingArtifact }));

import { HandoffArtifactCard } from '../HandoffArtifactCard.js';

function artifact(): BriefingArtifact {
  return {
    title: 'Resolve the collision',
    target: 'core/.handoff/',
    closes: 'same-id',
    align: 'The exact observed record stays attached.',
    task: 'Resolve it.',
    criteria: ['No cross-source claim'],
  };
}

describe('HandoffArtifactCard source routing', () => {
  beforeEach(() => {
    claimTask.mockReset();
    emitBriefingArtifact.mockReset();
    emitBriefingArtifact.mockResolvedValue({ written: true, path: 'core/.handoff/new.md', beadId: 'new' });
    claimTask.mockResolvedValue({ claimed: true });
  });

  it('never sends a handoff source id to the Dolt queue-claim verb', async () => {
    const user = userEvent.setup();
    render(<HandoffArtifactCard artifact={artifact()} approved={false} onApprove={() => {}} onUndo={() => {}} emittable doltClaimable={false} />);

    await user.click(screen.getByRole('button', { name: /approve & emit/i }));

    expect(claimTask).not.toHaveBeenCalled();
    expect(await screen.findByText(/no observed Dolt routing match/i)).toBeInTheDocument();
  });

  it('claims only an artifact grounded on an observed Dolt bead', async () => {
    const user = userEvent.setup();
    render(<HandoffArtifactCard artifact={artifact()} approved={false} onApprove={() => {}} onUndo={() => {}} emittable doltClaimable />);

    await user.click(screen.getByRole('button', { name: /approve & emit/i }));

    expect(claimTask).toHaveBeenCalledWith('same-id');
  });

  it('surfaces a normal lost-claim response after emission', async () => {
    const user = userEvent.setup();
    claimTask.mockResolvedValue({ claimed: false, reason: 'lost' });
    render(<HandoffArtifactCard artifact={artifact()} approved={false} onApprove={() => {}} onUndo={() => {}} emittable doltClaimable />);

    await user.click(screen.getByRole('button', { name: /approve & emit/i }));

    expect(await screen.findByText(/claim of same-id lost/i)).toBeInTheDocument();
  });
});
