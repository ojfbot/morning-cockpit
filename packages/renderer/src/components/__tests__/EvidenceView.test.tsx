import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CockpitEvidence, HandoffRecordEvidence } from '@cockpit/shared';
import { EvidenceView } from '../EvidenceView.js';

function record(repository: string, sourceRecordKey: string): HandoffRecordEvidence {
  return {
    sourceRecordKey,
    sourceRecord: {
      source: 'handoff-bead',
      repository,
      nativeId: 'same-id',
      sourcePath: '.handoff/brief.md',
    },
    title: `${repository} brief`,
    literal: {
      type: 'brief',
      status: 'live',
      actor: 'authored-agent',
      to: 'authored-recipient',
      respondingTo: null,
      refs: [],
      authoredCreatedAt: '2026-10-10T10:00:00Z',
    },
    observedModifiedAt: '2026-10-10T11:00:00.000Z',
    collectedAt: '2026-10-10T12:00:00.000Z',
  };
}

function evidence(records: HandoffRecordEvidence[]): CockpitEvidence {
  return {
    coverage: { status: 'complete', repositoriesObserved: records.length, skippedRecords: 0 },
    records,
    standaloneUnansweredBriefs: {
      name: 'standaloneUnansweredBriefs',
      records,
      total: records.length,
      byRepository: records.map((entry) => ({ repository: entry.sourceRecord.repository!, count: 1 })),
    },
    unresolvedRelations: [],
  };
}

describe('EvidenceView', () => {
  it('opens by keyboard without changing repository, then explicit focus changes it', async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const alpha = record('alpha', 'alpha-key');
    render(<EvidenceView evidence={evidence([alpha])} onFocusRepository={onFocus} />);

    await user.click(screen.getByRole('button', { name: /inspect evidence/i }));
    const recordButton = screen.getByRole('button', { name: /alpha brief/i });
    recordButton.focus();
    await user.keyboard('{Enter}');

    expect(onFocus).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent('Reference only; body not read by this evidence view.');
    expect(screen.getByRole('dialog')).toHaveTextContent('Verified process identity');

    await user.click(screen.getByRole('button', { name: 'Focus alpha' }));
    expect(onFocus).toHaveBeenCalledWith('alpha');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('Escape closes the dialog and restores focus to the exact opener', async () => {
    const user = userEvent.setup();
    render(<EvidenceView evidence={evidence([record('alpha', 'alpha-key')])} onFocusRepository={() => {}} />);
    await user.click(screen.getByRole('button', { name: /inspect evidence/i }));
    const opener = screen.getByRole('button', { name: /alpha brief/i });
    await user.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(opener).toHaveFocus();
  });

  it('clears selection when its key disappears; a colliding native id cannot inherit it', async () => {
    const user = userEvent.setup();
    const alpha = record('alpha', 'alpha-key');
    const beta = record('beta', 'beta-key');
    const rendered = render(<EvidenceView evidence={evidence([alpha])} onFocusRepository={() => {}} />);
    await user.click(screen.getByRole('button', { name: /inspect evidence/i }));
    await user.click(screen.getByRole('button', { name: /alpha brief/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent('alpha brief');

    rendered.rerender(<EvidenceView evidence={evidence([beta])} onFocusRepository={() => {}} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders typed partial coverage and unresolved evidence without putting it in the population', async () => {
    const user = userEvent.setup();
    const alpha = record('alpha', 'alpha-key');
    const partial: CockpitEvidence = {
      coverage: { status: 'partial', repositoriesObserved: 1, skippedRecords: 1 },
      records: [alpha],
      standaloneUnansweredBriefs: {
        name: 'standaloneUnansweredBriefs',
        records: [],
        total: 0,
        byRepository: [],
      },
      unresolvedRelations: [{
        reason: 'target-not-observed',
        relation: 'closes',
        targetNativeId: 'missing-target',
        affectedSourceRecordKeys: ['alpha-key'],
      }],
    };
    render(<EvidenceView evidence={partial} onFocusRepository={() => {}} />);

    expect(screen.getByText('partial')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /inspect evidence/i }));
    expect(screen.getByText('Target not observed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /alpha brief/i })).toBeInTheDocument();
    expect(screen.getByText('No records in this filter.')).toBeInTheDocument();
  });
});
