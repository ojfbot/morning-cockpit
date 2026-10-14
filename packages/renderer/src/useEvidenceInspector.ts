import { useEffect, useRef, useState } from 'react';
import type {
  EvidenceIndex,
  EvidenceRecord,
  EvidenceSummary,
  InspectionTarget,
} from '@cockpit/shared';
import {
  fetchEvidenceIndex,
  fetchEvidenceRecord,
  fetchEvidenceSummary,
} from './api.js';

type Pin = Pick<EvidenceSummary, 'snapshotId' | 'generatedAt' | 'expiresAt'>;
type Selection =
  | { kind: 'none' }
  | { kind: 'loading'; key: string }
  | { kind: 'failed'; key: string }
  | { kind: 'ready'; key: string; detail: EvidenceRecord };
type State =
  | { mode: 'closed' }
  | {
      mode: 'open';
      pin: Pin;
      index: EvidenceIndex | null;
      selection: Selection;
      message: string | null;
      refreshRequired: boolean;
    }
  | {
      mode: 'refreshing';
      pin: Pin;
      index: null;
      selection: { kind: 'none' };
      message: string;
      refreshRequired: boolean;
    };

/** One owner for all request lifetimes. Each new intent invalidates obsolete completions. */
export function useEvidenceInspector(summary: EvidenceSummary | undefined) {
  const [state, setState] = useState<State>({ mode: 'closed' });
  const [clock, setClock] = useState(Date.now());
  const current = useRef(state);
  current.current = state;
  const latest = useRef(summary);
  latest.current = summary;
  const epoch = useRef(0);
  const detailGeneration = useRef(0);
  const controllers = useRef<{
    index?: AbortController;
    detail?: AbortController;
    refresh?: AbortController;
  }>({});
  const opener = useRef<HTMLButtonElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const publish = (next: State) => {
    current.current = next;
    setState(next);
  };
  const end = () => {
    epoch.current++;
    detailGeneration.current++;
    for (const controller of Object.values(controllers.current))
      controller?.abort();
    controllers.current = {};
  };
  const message = (value: string, refreshRequired = false) => {
    const s = current.current;
    if (s.mode === 'open') publish({ ...s, message: value, refreshRequired });
  };
  const focusBack = () =>
    requestAnimationFrame(() =>
      (opener.current?.isConnected
        ? opener.current
        : toggleRef.current
      )?.focus(),
    );
  useEffect(() => () => end(), []);
  useEffect(() => {
    if (state.mode === 'closed') return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.mode]);

  const loadIndex = (pin: Pin, lifetime: number) => {
    const controller = new AbortController();
    controllers.current.index = controller;
    void fetchEvidenceIndex(pin.snapshotId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted || epoch.current !== lifetime) return;
        const s = current.current;
        if (s.mode !== 'open' || s.pin.snapshotId !== pin.snapshotId) return;
        switch (result.status) {
          case 'ready':
            publish({ ...s, index: result });
            break;
          case 'refresh-required':
            publish({
              ...s,
              selection: { kind: 'none' },
              refreshRequired: true,
              message: result.reason,
            });
            break;
          default: {
            const never: never = result;
            return never;
          }
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted && epoch.current === lifetime)
          message(
            error instanceof Error
              ? error.message
              : 'Evidence index unavailable.',
          );
      });
  };
  const select = (key: string) => {
    const s = current.current;
    if (s.mode !== 'open') return;
    if (s.refreshRequired || Date.now() >= Date.parse(s.pin.expiresAt)) {
      message(
        'Historical observation. Refresh evidence before a new lookup.',
        true,
      );
      return;
    }
    controllers.current.detail?.abort();
    const generation = ++detailGeneration.current;
    const lifetime = epoch.current;
    const controller = new AbortController();
    controllers.current.detail = controller;
    publish({ ...s, selection: { kind: 'loading', key }, message: null });
    void fetchEvidenceRecord(s.pin.snapshotId, key, controller.signal)
      .then((result) => {
        if (
          controller.signal.aborted ||
          epoch.current !== lifetime ||
          detailGeneration.current !== generation
        )
          return;
        const active = current.current;
        if (
          active.mode !== 'open' ||
          active.refreshRequired ||
          active.pin.snapshotId !== s.pin.snapshotId
        )
          return;
        switch (result.status) {
          case 'ready':
            publish({
              ...active,
              selection: { kind: 'ready', key, detail: result },
              message: null,
            });
            break;
          case 'refresh-required':
            publish({
              ...active,
              selection: { kind: 'none' },
              refreshRequired: true,
              message: result.reason,
            });
            break;
          case 'record-not-observed':
            publish({
              ...active,
              selection: { kind: 'failed', key },
              message: 'Record was not observed in this snapshot.',
            });
            break;
          case 'invalid-reference':
          case 'source-unavailable':
            publish({
              ...active,
              selection: { kind: 'failed', key },
              message: result.reason,
            });
            break;
          default: {
            const never: never = result;
            return never;
          }
        }
      })
      .catch((error) => {
        if (
          controller.signal.aborted ||
          epoch.current !== lifetime ||
          detailGeneration.current !== generation
        )
          return;
        const active = current.current;
        if (active.mode === 'open')
          publish({
            ...active,
            selection: { kind: 'failed', key },
            message:
              error instanceof Error
                ? error.message
                : 'Evidence detail unavailable.',
          });
      });
  };
  const open = (pin: Pin) => {
    end();
    publish({
      mode: 'open',
      pin,
      index: null,
      selection: { kind: 'none' },
      message: null,
      refreshRequired: false,
    });
    loadIndex(pin, epoch.current);
  };
  const inspect = (
    target: InspectionTarget | undefined,
    button: HTMLButtonElement,
  ) => {
    opener.current = button;
    if (!target || !('snapshotId' in target)) return;
    // A card's own target is authoritative for the lookup, even if a poll has advanced.
    open(target);
    select(target.sourceRecordKey);
  };
  const toggle = () => {
    if (current.current.mode !== 'closed') {
      end();
      publish({ mode: 'closed' });
      focusBack();
    } else if (latest.current) open(latest.current);
  };
  const close = () => {
    controllers.current.detail?.abort();
    detailGeneration.current++;
    const s = current.current;
    if (s.mode === 'open')
      publish({ ...s, selection: { kind: 'none' }, message: null });
    focusBack();
  };
  const refresh = () => {
    const s = current.current;
    if (s.mode === 'closed') return;
    end();
    const lifetime = epoch.current;
    const controller = new AbortController();
    controllers.current.refresh = controller;
    publish({
      mode: 'refreshing',
      pin: s.pin,
      refreshRequired: s.refreshRequired,
      index: null,
      selection: { kind: 'none' },
      message: 'Refreshing evidence…',
    });
    void fetchEvidenceSummary(controller.signal)
      .then((pin) => {
        if (controller.signal.aborted || epoch.current !== lifetime) return;
        publish({
          mode: 'open',
          pin,
          index: null,
          selection: { kind: 'none' },
          message: null,
          refreshRequired: false,
        });
        loadIndex(pin, lifetime);
      })
      .catch((error) => {
        if (controller.signal.aborted || epoch.current !== lifetime) return;
        const active = current.current;
        if (active.mode !== 'closed')
          publish({
            ...active,
            mode: 'open',
            message:
              error instanceof Error
                ? error.message
                : 'Evidence refresh unavailable.',
          });
      });
  };
  const selectFrom = (key: string, button: HTMLButtonElement) => {
    opener.current = button;
    select(key);
  };
  return {
    state,
    toggleRef,
    toggle,
    close,
    refresh,
    select: selectFrom,
    inspect,
    historical:
      state.mode !== 'closed' && clock >= Date.parse(state.pin.expiresAt),
    newerAvailable:
      state.mode !== 'closed' &&
      summary !== undefined &&
      summary.snapshotId !== state.pin.snapshotId,
  };
}
