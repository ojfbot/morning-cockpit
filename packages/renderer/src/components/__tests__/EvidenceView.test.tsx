import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  EvidenceIndex,
  EvidenceSummary,
  HandoffRecordEvidence,
} from '@cockpit/shared';
import {
  fetchEvidenceIndex,
  fetchEvidenceRecord,
  fetchEvidenceSummary,
} from '../../api.js';
import { EvidenceView } from '../EvidenceView.js';
vi.mock('../../api.js', () => ({
  fetchEvidenceIndex: vi.fn(),
  fetchEvidenceRecord: vi.fn(),
  fetchEvidenceSummary: vi.fn(),
}));
function record(repository: string): HandoffRecordEvidence {
  return {
    declaredLinks: [],
    sourceRecordKey: `${repository}-key`,
    sourceRecord: {
      kind: 'handoff-document-v1',
      source: 'handoff-bead',
      repository,
      nativeId: 'same',
      sourcePath: '.handoff/brief.md',
    },
    title: `${repository} brief`,
    literal: {
      type: 'brief',
      status: 'live',
      actor: 'literal-actor',
      to: null,
      respondingTo: null,
      refs: [],
      authoredCreatedAt: null,
    },
    observedModifiedAt: '2026-10-13T00:00:00Z',
    collectedAt: '2026-10-13T00:00:00Z',
    documentProduction: {
      status: 'legacy-unknown',
      reason: 'Not captured at creation.',
    },
  };
}
const alpha = record('alpha'),
  beta = record('beta');
const coverage = {
  status: 'complete' as const,
  repositoriesObserved: 2,
  skippedRecords: 0,
  unreadableRepositories: 0,
  reason: null,
};
function summary(snapshotId = 'snapshot-one'): EvidenceSummary {
  return {
    snapshotId,
    generatedAt: '2026-10-13T00:00:00Z',
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    dolt: {
      source: 'dolt-bead',
      scope: 'Fixture Dolt',
      collectedAt: null,
      coverage: {
        ...coverage,
        status: 'unavailable',
        reason: 'Fixture absent',
      },
      total: null,
      byRepository: [],
    },
    handoff: {
      inventory: {
        source: 'handoff-bead',
        scope: 'Fixture handoff',
        collectedAt: '2026-10-13T00:00:00Z',
        coverage,
        total: 2,
        byRepository: [
          { repository: 'alpha', count: 1 },
          { repository: 'beta', count: 1 },
        ],
      },
      populationCount: 2,
      populationByRepository: [
        { repository: 'alpha', count: 1 },
        { repository: 'beta', count: 1 },
      ],
    },
    unresolvedCount: 0,
  };
}
function index(
  snapshotId = 'snapshot-one',
  records = [alpha, beta],
): EvidenceIndex {
  return {
    status: 'ready',
    snapshotId,
    dolt: {
      status: 'unavailable',
      source: 'dolt-bead',
      scope: 'Fixture Dolt',
      reason: 'Fixture absent',
    },
    handoff: {
      status: 'observed',
      source: 'handoff-bead',
      scope: 'Fixture handoff',
      collectedAt: '2026-10-13T00:00:00Z',
      coverage,
      records,
      populationRecordKeys: records.map((entry) => entry.sourceRecordKey),
      unresolvedRelations: [],
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchEvidenceIndex).mockImplementation(async (id) => index(id));
  vi.mocked(fetchEvidenceRecord).mockImplementation(async (id, key) => ({
    status: 'ready',
    snapshotId: id,
    record: key === alpha.sourceRecordKey ? alpha : beta,
  }));
  vi.mocked(fetchEvidenceSummary).mockResolvedValue(summary('snapshot-new'));
});
async function expand() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /inspect evidence/i }));
  await screen.findByRole('button', { name: /alpha brief/i });
  return user;
}

describe('on-demand evidence inspector', () => {
  it('loads nothing while collapsed; index on expansion and pinned detail only on opening', async () => {
    const onFocus = vi.fn();
    render(<EvidenceView summary={summary()} onFocusRepository={onFocus} />);
    expect(fetchEvidenceIndex).not.toHaveBeenCalled();
    expect(fetchEvidenceRecord).not.toHaveBeenCalled();
    const user = await expand();
    expect(fetchEvidenceIndex).toHaveBeenCalledWith(
      'snapshot-one',
      expect.any(AbortSignal),
    );
    expect(fetchEvidenceRecord).not.toHaveBeenCalled();
    const opener = screen.getByRole('button', { name: /alpha brief/i });
    opener.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('dialog');
    expect(fetchEvidenceRecord).toHaveBeenCalledWith(
      'snapshot-one',
      'alpha-key',
      expect.any(AbortSignal),
    );
    expect(onFocus).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Recipient (authored)Unknown',
    );
    const production = screen
      .getByText('Document production · legacy-unknown')
      .closest('details');
    expect(production).not.toHaveAttribute('open');
    await user.click(screen.getByText('Document production · legacy-unknown'));
    expect(production).toHaveAttribute('open');
    expect(screen.getByText('Not captured at creation.')).toBeVisible();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(opener).toHaveFocus());
  });
  it('filters locally and changes global focus only through the explicit Focus action', async () => {
    const onFocus = vi.fn();
    render(<EvidenceView summary={summary()} onFocusRepository={onFocus} />);
    const user = await expand();
    await user.click(screen.getByRole('button', { name: 'beta · 1' }));
    expect(
      screen.queryByRole('button', { name: /alpha brief/i }),
    ).not.toBeInTheDocument();
    expect(onFocus).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /beta brief/i }));
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: 'Focus beta' }));
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledWith('beta');
  });
  it('pins foreground details across background polls and replaces them only on explicit refresh', async () => {
    const view = render(
      <EvidenceView summary={summary()} onFocusRepository={() => {}} />,
    );
    const user = await expand();
    await user.click(screen.getByRole('button', { name: /alpha brief/i }));
    await screen.findByRole('dialog');
    view.rerender(
      <EvidenceView
        summary={summary('snapshot-two')}
        onFocusRepository={() => {}}
      />,
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('alpha brief');
    expect(screen.getByText(/New observation available/)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    vi.mocked(fetchEvidenceIndex).mockResolvedValue(
      index('snapshot-new', [beta]),
    );
    await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
    await screen.findByRole('button', { name: /beta brief/i });
    expect(
      screen.queryByRole('button', { name: /alpha brief/i }),
    ).not.toBeInTheDocument();
  });
  it('displays participant roles and partial coverage without guessing population membership', async () => {
    vi.mocked(fetchEvidenceIndex).mockResolvedValue({
      ...index(),
      handoff: {
        ...index().handoff,
        status: 'observed',
        source: 'handoff-bead',
        scope: 'Fixture handoff',
        collectedAt: alpha.collectedAt,
        coverage,
        records: [alpha, beta],
        populationRecordKeys: [],
        unresolvedRelations: [
          {
            reason: 'target-matches-multiple-records',
            relation: 'closes',
            referrerKey: 'alpha-key',
            targetNativeId: 'same',
            candidateTargetKeys: ['beta-key'],
          },
        ],
      },
    });
    render(
      <EvidenceView
        summary={{
          ...summary(),
          handoff: {
            ...summary().handoff,
            populationCount: 0,
            inventory: {
              ...summary().handoff.inventory,
              coverage: {
                status: 'partial',
                repositoriesObserved: 2,
                skippedRecords: 1,
                unreadableRepositories: 0,
                reason: null,
              },
            },
          },
        }}
        onFocusRepository={() => {}}
      />,
    );
    await expand();
    expect(screen.getByText('Referrer')).toBeInTheDocument();
    expect(screen.getByText('Candidate target')).toBeInTheDocument();
    expect(
      screen.getByText(/handoff inventory: 2 · partial/),
    ).toBeInTheDocument();
    expect(screen.getByText('No records in this filter.')).toBeInTheDocument();
  });
  it('exposes expiry and requires an explicit refresh rather than mixing snapshots', async () => {
    vi.mocked(fetchEvidenceRecord).mockResolvedValueOnce({
      status: 'refresh-required',
      snapshotId: 'snapshot-one',
      reason: 'Observation expired.',
    });
    render(<EvidenceView summary={summary()} onFocusRepository={() => {}} />);
    const user = await expand();
    await user.click(screen.getByRole('button', { name: /alpha brief/i }));
    await screen.findByText('Observation expired.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchEvidenceSummary).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
    await screen.findByRole('button', { name: /alpha brief/i });
    expect(fetchEvidenceSummary).toHaveBeenCalledTimes(1);
    expect(fetchEvidenceIndex).toHaveBeenLastCalledWith(
      'snapshot-new',
      expect.any(AbortSignal),
    );
  });
  it('reports a vanished record and ignores late details after a snapshot change', async () => {
    vi.mocked(fetchEvidenceRecord).mockResolvedValue({
      status: 'record-not-observed',
      snapshotId: 'snapshot-one',
      sourceRecordKey: 'alpha-key',
      source: 'handoff-bead',
      scope: 'Fixture scope',
    });
    render(<EvidenceView summary={summary()} onFocusRepository={() => {}} />);
    const user = await expand();
    await user.click(screen.getByRole('button', { name: /alpha brief/i }));
    await screen.findByText('Record was not observed in this snapshot.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

it('keeps an observed expiry gate across background summary polls until explicit refresh', async () => {
  vi.mocked(fetchEvidenceRecord).mockResolvedValueOnce({
    status: 'refresh-required',
    snapshotId: 'snapshot-one',
    reason: 'Observation expired.',
  });
  const view = render(
    <EvidenceView summary={summary()} onFocusRepository={() => {}} />,
  );
  const user = await expand();
  await user.click(screen.getByRole('button', { name: /alpha brief/i }));
  await screen.findByText('Observation expired.');
  vi.mocked(fetchEvidenceIndex).mockClear();
  view.rerender(
    <EvidenceView
      summary={summary('background-poll')}
      onFocusRepository={() => {}}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Refresh evidence' }),
    ).toBeInTheDocument(),
  );
  expect(fetchEvidenceIndex).not.toHaveBeenCalled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(fetchEvidenceRecord).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
  await screen.findByRole('button', { name: /alpha brief/i });
  expect(fetchEvidenceIndex).toHaveBeenCalledWith(
    'snapshot-new',
    expect.any(AbortSignal),
  );
});
