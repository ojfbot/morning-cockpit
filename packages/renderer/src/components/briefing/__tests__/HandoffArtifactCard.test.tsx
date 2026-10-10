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

function artifact(source: BriefingArtifact['source']): BriefingArtifact {
  return {
    source,
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
    render(<HandoffArtifactCard artifact={artifact('handoff-bead')} approved={false} onApprove={() => {}} onUndo={() => {}} emittable />);

    await user.click(screen.getByRole('button', { name: /approve & emit/i }));

    expect(claimTask).not.toHaveBeenCalled();
    expect(await screen.findByText(/handoff-bead does not use core queue-claim/i)).toBeInTheDocument();
  });

  it('claims only an artifact grounded on an observed Dolt bead', async () => {
    const user = userEvent.setup();
    render(<HandoffArtifactCard artifact={artifact('dolt-bead')} approved={false} onApprove={() => {}} onUndo={() => {}} emittable />);

    await user.click(screen.getByRole('button', { name: /approve & emit/i }));

    expect(claimTask).toHaveBeenCalledWith('same-id');
  });
});
