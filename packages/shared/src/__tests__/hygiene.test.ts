import { describe, expect, it } from 'vitest';
import { parseCodexHygiene } from '../loop.js';

const nextRunAt = '2026-10-03T14:01:22.000Z';
const receipt = {
  threadId: 'private-run-thread', status: 'completed',
  observedAt: '2026-10-02T14:01:22.000Z', updatedAt: '2026-10-02T14:02:22.000Z',
};
const configured = {
  id: 'selfco-vault-hygiene', scheduler: 'codex', configured: 'configured',
  schedule: { rrule: 'FREQ=DAILY;BYHOUR=9', targetThreadId: 'private-target-thread', nextRunAt },
};

describe('Codex hygiene boundary', () => {
  it('keeps configuration, firing and output separate without leaking thread IDs', () => {
    const status = parseCodexHygiene({ ...configured, firing: 'succeeded', receipt, output: 'unverified' });
    expect(status).toEqual({
      kind: 'configured', scheduler: 'Codex', scheduleRule: 'FREQ=DAILY;BYHOUR=9', nextRunAt,
      firing: { kind: 'succeeded', observedAt: receipt.observedAt, status: 'completed' },
      output: 'unverified',
    });
    expect(JSON.stringify(status)).not.toContain('private-');
  });

  it('distinguishes an uncertain empty history from a recorded overdue occurrence', () => {
    expect(parseCodexHygiene({ ...configured, firing: 'never-fired', warning: 'old empty history' }))
      .toMatchObject({ firing: { kind: 'never-fired', historyUncertain: true } });
    expect(parseCodexHygiene({ ...configured, firing: 'missed', warning: 'old empty history' }))
      .toMatchObject({ firing: { kind: 'missed', nextRunAt, historyUncertain: true } });
    expect(parseCodexHygiene({ ...configured, firing: 'missed' }))
      .toMatchObject({ firing: { kind: 'missed', nextRunAt, historyUncertain: false } });
    expect(parseCodexHygiene({ ...configured, firing: 'never-fired' }))
      .toMatchObject({ firing: { kind: 'never-fired', historyUncertain: false } });
  });

  it('preserves disabled and unavailable states', () => {
    expect(parseCodexHygiene({ id: configured.id, scheduler: 'codex', configured: 'disabled', firing: 'disabled' }))
      .toEqual({ kind: 'disabled', reason: 'Codex automation is disabled' });
    expect(parseCodexHygiene({ id: configured.id, scheduler: 'codex', configured: 'unverifiable', firing: 'unknown' }))
      .toEqual({ kind: 'unavailable', reason: 'Codex automation unverifiable' });
  });

  it.each([
    ['wrong identity', { ...configured, id: 'other', firing: 'never-fired' }],
    ['invalid schedule', { ...configured, schedule: { ...configured.schedule, nextRunAt: 'yesterday' }, firing: 'missed' }],
    ['missing receipt', { ...configured, firing: 'succeeded' }],
    ['backward receipt chronology', { ...configured, firing: 'succeeded',
      receipt: { ...receipt, updatedAt: '2026-10-01T14:01:22.000Z' }, output: 'unverified' }],
    ['missed without due date', { ...configured, schedule: { rrule: 'FREQ=DAILY', targetThreadId: 'private-target-thread' }, firing: 'missed' }],
    ['unknown state', { ...configured, firing: 'invented' }],
    ['invented output verification', { ...configured, firing: 'succeeded', receipt, output: 'verified' }],
    ['malformed uncertainty warning', { ...configured, firing: 'never-fired', warning: 42 }],
    ['warning with a run receipt', { ...configured, firing: 'succeeded', receipt, output: 'unverified', warning: 'old empty history' }],
    ['inconsistent disabled state', { ...configured, configured: 'disabled', firing: 'succeeded' }],
  ])('rejects %s', (_case, input) => {
    expect(() => parseCodexHygiene(input)).toThrow();
  });
});
