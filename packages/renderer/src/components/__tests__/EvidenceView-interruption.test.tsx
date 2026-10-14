import {
  beforeEach,
  afterEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { writeFile } from 'node:fs/promises';
import {
  render,
  screen,
  waitFor,
  cleanup,
  act,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceView } from '../EvidenceView.js';
import {
  fetchEvidenceIndex,
  fetchEvidenceRecord,
  fetchEvidenceSummary,
} from '../../api.js';
vi.mock('../../api.js', () => ({
  fetchEvidenceIndex: vi.fn(),
  fetchEvidenceRecord: vi.fn(),
  fetchEvidenceSummary: vi.fn(),
}));
const audit = process.env.COCKPIT_INSPECTOR_RECEIPT_DIR;
const facts: Record<string, unknown> = {};
const ref = {
  kind: 'handoff-document-v1',
  source: 'handoff-bead',
  repository: 'core',
  nativeId: 'alpha',
  sourcePath: '.handoff/alpha.md',
} as const;
const key = JSON.stringify([
  ref.kind,
  ref.repository,
  ref.nativeId,
  ref.sourcePath,
]);
function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('Deferred promise not initialized');
  };
  let reject: (reason: unknown) => void = () => {
    throw new Error('Deferred promise not initialized');
  };
  const promise = new Promise<T>((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}
const coverage = {
  status: 'complete' as const,
  repositoriesObserved: 1,
  skippedRecords: 0,
  unreadableRepositories: 0,
  reason: null,
};
const summary = (id = 'one') => ({
  snapshotId: id,
  generatedAt: '2026-10-13T12:00:00Z',
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  dolt: {
    source: 'dolt-bead' as const,
    scope: 'Fixture Dolt',
    collectedAt: null,
    total: null,
    byRepository: [],
    coverage: {
      ...coverage,
      status: 'unavailable' as const,
      reason: 'Fixture absent',
    },
  },
  handoff: {
    inventory: {
      source: 'handoff-bead' as const,
      scope: 'Fixture handoff',
      collectedAt: '2026-10-13T12:00:00Z',
      total: 1,
      byRepository: [{ repository: 'core', count: 1 }],
      coverage,
    },
    populationCount: 1,
    populationByRepository: [{ repository: 'core', count: 1 }],
  },
  unresolvedCount: 0,
});
const index = (id = 'one') => ({
  status: 'ready' as const,
  snapshotId: id,
  dolt: {
    status: 'unavailable' as const,
    source: 'dolt-bead' as const,
    scope: 'Fixture Dolt',
    reason: 'Fixture absent',
  },
  handoff: {
    status: 'observed' as const,
    source: 'handoff-bead' as const,
    scope: 'Fixture handoff',
    collectedAt: '2026-10-13T12:00:00Z',
    coverage,
    records: [
      { sourceRecordKey: key, sourceRecord: ref, title: 'Alpha brief' },
    ],
    populationRecordKeys: [key],
    unresolvedRelations: [],
  },
});
const detail = (id = 'one', title = 'Alpha brief') => ({
  status: 'ready' as const,
  snapshotId: id,
  record: {
    declaredLinks: [],
    sourceRecordKey: key,
    sourceRecord: ref,
    title,
    literal: {
      type: 'brief',
      status: 'live',
      actor: null,
      to: null,
      respondingTo: null,
      refs: [],
      authoredCreatedAt: null,
    },
    observedModifiedAt: '2026-10-13T12:00:00Z',
    collectedAt: '2026-10-13T12:00:00Z',
    documentProduction: {
      status: 'legacy-unknown' as const,
      reason: 'Not recorded.',
    },
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchEvidenceIndex).mockImplementation(async (id) => index(id));
  vi.mocked(fetchEvidenceRecord).mockImplementation(async (id) => detail(id));
  vi.mocked(fetchEvidenceSummary).mockResolvedValue(summary('fresh'));
});
afterEach(cleanup);
afterAll(async () => {
  if (!audit) return;
  await writeFile(
    audit + '/observation-observations.json',
    JSON.stringify(facts, null, 2) + String.fromCharCode(10),
  );
});
async function openIndex() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Inspect evidence/ }));
  await screen.findByRole('button', { name: /Alpha brief/ });
  return user;
}
describe('actual inspector async interruption controls; no transport or source writes', () => {
  it('collapsing during detail load must prevent a late modal', async () => {
    const pending = deferred<ReturnType<typeof detail>>();
    vi.mocked(fetchEvidenceRecord).mockReturnValue(pending.promise);
    render(<EvidenceView summary={summary()} onFocusRepository={() => {}} />);
    const user = await openIndex();
    await user.click(screen.getByRole('button', { name: /Alpha brief/ }));
    await user.click(screen.getByRole('button', { name: /Inspect evidence/ }));
    await act(async () => pending.resolve(detail()));
    facts.collapseDuringDetail = {
      expanded: screen
        .getByRole('button', { name: /Inspect evidence/ })
        .getAttribute('aria-expanded'),
      modalOpened: Boolean(screen.queryByRole('dialog')),
      detailCalls: vi.mocked(fetchEvidenceRecord).mock.calls.length,
    };
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('same-record click after a detail error must retry or expose a working retry', async () => {
    vi.mocked(fetchEvidenceRecord)
      .mockRejectedValueOnce(new Error('Owned detail failure'))
      .mockResolvedValue(detail());
    render(<EvidenceView summary={summary()} onFocusRepository={() => {}} />);
    const user = await openIndex();
    await user.click(screen.getByRole('button', { name: /Alpha brief/ }));
    await screen.findByText('Owned detail failure');
    await user.click(screen.getByRole('button', { name: /Alpha brief/ }));
    facts.sameKeyRetry = {
      detailCalls: vi.mocked(fetchEvidenceRecord).mock.calls.length,
      refreshButtonVisible: Boolean(
        screen.queryByRole('button', { name: 'Refresh evidence' }),
      ),
      loadingAfterClick: Boolean(
        screen.queryByText('Loading evidence detail…'),
      ),
    };
    expect(fetchEvidenceRecord).toHaveBeenCalledTimes(2);
  });
  it('older explicit refresh must not overwrite the later request', async () => {
    vi.mocked(fetchEvidenceRecord).mockResolvedValueOnce({
      status: 'refresh-required',
      snapshotId: 'one',
      reason: 'Owned expiry.',
    });
    const older = deferred<ReturnType<typeof summary>>();
    const newer = deferred<ReturnType<typeof summary>>();
    vi.mocked(fetchEvidenceSummary)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    render(<EvidenceView summary={summary()} onFocusRepository={() => {}} />);
    const user = await openIndex();
    await user.click(screen.getByRole('button', { name: /Alpha brief/ }));
    await screen.findByText('Owned expiry.');
    await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
    await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
    await act(async () => newer.resolve(summary('newer')));
    await screen.findByText(/Observation newer/);
    await act(async () => older.resolve(summary('older')));
    await screen.findByRole('button', { name: /Alpha brief/ });
    facts.refreshRace = {
      summaryCalls: vi.mocked(fetchEvidenceSummary).mock.calls.length,
      indexRequests: vi.mocked(fetchEvidenceIndex).mock.calls.map(([id]) => id),
      displayed: screen.getByText(/Observation /).textContent,
    };
    expect(screen.getByText(/Observation newer/)).toBeInTheDocument();
  });
  it('late detail from a replaced observation is ignored', async () => {
    const pending = deferred<ReturnType<typeof detail>>();
    vi.mocked(fetchEvidenceRecord)
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue(detail('two', 'New captured title'));
    const view = render(
      <EvidenceView summary={summary()} onFocusRepository={() => {}} />,
    );
    const user = await openIndex();
    await user.click(screen.getByRole('button', { name: /Alpha brief/ }));
    view.rerender(
      <EvidenceView summary={summary('two')} onFocusRepository={() => {}} />,
    );
    vi.mocked(fetchEvidenceSummary).mockResolvedValue(summary('two'));
    await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
    await screen.findByRole('button', { name: /Alpha brief/ });
    await user.click(screen.getByRole('button', { name: /Alpha brief/ }));
    await screen.findByRole('dialog');
    await act(async () => pending.resolve(detail('one', 'Obsolete title')));
    expect(screen.getByRole('dialog')).toHaveTextContent('New captured title');
    expect(screen.queryByText('Obsolete title')).not.toBeInTheDocument();
    facts.lateSnapshotDetail = {
      displayed: screen.getByRole('dialog').textContent,
      obsoleteIgnored: true,
    };
  });
  it('unmount aborts pending record observation without mounting a late dialog', async () => {
    const pending = deferred<ReturnType<typeof detail>>();
    vi.mocked(fetchEvidenceRecord).mockReturnValue(pending.promise);
    const view = render(
      <EvidenceView summary={summary()} onFocusRepository={() => {}} />,
    );
    const user = await openIndex();
    await user.click(screen.getByRole('button', { name: /Alpha brief/ }));
    const signal = vi.mocked(fetchEvidenceRecord).mock.calls[0]?.[2];
    view.unmount();
    await act(async () => pending.resolve(detail()));
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    facts.unmount = { signalAborted: signal?.aborted, modalOpened: false };
  });
  it('cached client detail stays visible past retention without another server read; is visibly historical under the proposed foreground policy', async () => {
    vi.useFakeTimers();
    try {
      render(<EvidenceView summary={summary()} onFocusRepository={() => {}} />);
      await act(async () => {
        fireEvent.click(
          screen.getByRole('button', { name: /Inspect evidence/ }),
        );
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Alpha brief/ }));
      });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(300_001);
      });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toHaveTextContent(
        'Historical observation',
      );
      expect(fetchEvidenceRecord).toHaveBeenCalledTimes(1);
      facts.cachedClientDetail = {
        elapsedMs: 300_001,
        stillVisible: true,
        extraServerReads: 0,
        classification:
          'owner policy; cached evidence is not live execution or proactive expiry verification',
      };
    } finally {
      vi.useRealTimers();
    }
  });
});

it('newest refresh failure remains visible after an older request succeeds', async () => {
  const older = deferred<ReturnType<typeof summary>>();
  const newer = deferred<ReturnType<typeof summary>>();
  vi.mocked(fetchEvidenceSummary)
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);
  render(<EvidenceView summary={summary()} onFocusRepository={() => {}} />);
  const user = await openIndex();
  await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
  await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
  await act(async () => newer.reject(new Error('Newest owned failure')));
  await screen.findByText('Newest owned failure');
  await act(async () => older.resolve(summary('obsolete-success')));
  expect(screen.getByText('Newest owned failure')).toBeInTheDocument();
  expect(
    screen.queryByText(/Observation obsolete-success/),
  ).not.toBeInTheDocument();
  expect(fetchEvidenceIndex).toHaveBeenCalledTimes(1);
});
it('latest refresh wins when the older request completes first', async () => {
  const older = deferred<ReturnType<typeof summary>>();
  const newer = deferred<ReturnType<typeof summary>>();
  vi.mocked(fetchEvidenceSummary)
    .mockReturnValueOnce(older.promise)
    .mockReturnValueOnce(newer.promise);
  render(<EvidenceView summary={summary()} onFocusRepository={() => {}} />);
  const user = await openIndex();
  await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
  await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
  await act(async () => older.resolve(summary('obsolete-first')));
  expect(
    screen.queryByText(/Observation obsolete-first/),
  ).not.toBeInTheDocument();
  await act(async () => newer.resolve(summary('newest-last')));
  await screen.findByText(/Observation newest-last/);
});
it('closing a pending detail aborts its lifetime and restores the opener', async () => {
  const pending = deferred<ReturnType<typeof detail>>();
  vi.mocked(fetchEvidenceRecord).mockReturnValueOnce(pending.promise);
  render(<EvidenceView summary={summary()} onFocusRepository={() => {}} />);
  const user = await openIndex();
  const opener = screen.getByRole('button', { name: /Alpha brief/ });
  await user.click(opener);
  const signal = vi.mocked(fetchEvidenceRecord).mock.calls[0]?.[2];
  await user.click(
    screen.getByRole('button', { name: 'Cancel evidence detail' }),
  );
  expect(signal?.aborted).toBe(true);
  await act(async () => pending.resolve(detail()));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(opener).toHaveFocus());
});
it('collapse aborts a pending explicit refresh and index request', async () => {
  const pending = deferred<ReturnType<typeof summary>>();
  vi.mocked(fetchEvidenceSummary).mockReturnValueOnce(pending.promise);
  render(<EvidenceView summary={summary()} onFocusRepository={() => {}} />);
  const user = await openIndex();
  await user.click(screen.getByRole('button', { name: 'Refresh evidence' }));
  const signal = vi.mocked(fetchEvidenceSummary).mock.calls[0]?.[0];
  await user.click(screen.getByRole('button', { name: /Inspect evidence/ }));
  expect(signal?.aborted).toBe(true);
  await act(async () => pending.resolve(summary('obsolete')));
  expect(
    screen.getByRole('button', { name: /Inspect evidence/ }),
  ).toHaveAttribute('aria-expanded', 'false');
});
