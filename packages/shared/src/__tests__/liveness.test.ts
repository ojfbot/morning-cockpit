import { describe, it, expect } from 'vitest';
import {
  deriveAgentLiveness,
  livenessForAgents,
  DEFAULT_LIVENESS_WINDOWS,
} from '../liveness.js';
import type { BeadEventRow } from '../dolt-bead.js';

const NOW = Date.parse('2026-06-24T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const ev = (actor: string, event_type: string, timestamp: string): BeadEventRow => ({
  event_type,
  bead_id: actor,
  actor,
  summary: '',
  timestamp,
});

describe('deriveAgentLiveness (S2 C0)', () => {
  it('classifies a recently-active agent as live', () => {
    const out = deriveAgentLiveness([ev('agent-A', 'agent-sling', ago(10 * MIN))], NOW);
    expect(out).toEqual([
      expect.objectContaining({ agentId: 'agent-A', state: 'live', lastEventType: 'agent-sling' }),
    ]);
  });

  it('classifies an explicitly-idled agent as idle', () => {
    const out = deriveAgentLiveness([ev('agent-B', 'agent-idle', ago(2 * HOUR))], NOW);
    expect(out[0]).toMatchObject({ agentId: 'agent-B', state: 'idle' });
  });

  it('classifies an agent whose last event is old as dark', () => {
    const out = deriveAgentLiveness([ev('agent-C', 'agent-create', ago(3 * DAY))], NOW);
    expect(out[0]).toMatchObject({ agentId: 'agent-C', state: 'dark' });
  });

  it('(C1, the lie-killer) an agent whose last event is agent-idle is NEVER live', () => {
    // This is the case agent_status lies about — status reads 'active' forever.
    const out = deriveAgentLiveness([ev('agent-D', 'agent-idle', ago(30 * MIN))], NOW);
    expect(out[0]!.state).toBe('idle');
    expect(out[0]!.state).not.toBe('live');
  });

  it('uses the most-recent event per agent (group-by-actor, MAX timestamp)', () => {
    const out = deriveAgentLiveness(
      [
        ev('agent-A', 'agent-create', ago(3 * DAY)),
        ev('agent-A', 'agent-sling', ago(10 * MIN)),
      ],
      NOW,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ agentId: 'agent-A', state: 'live', lastEventType: 'agent-sling' });
  });

  it('ignores non-agent events (task/pr/etc. with actor=claude-code)', () => {
    const out = deriveAgentLiveness(
      [
        ev('claude-code', 'task-create', ago(5 * MIN)),
        ev('claude-code', 'pr-created', ago(5 * MIN)),
      ],
      NOW,
    );
    expect(out).toEqual([]);
  });

  it('skips events with a null actor', () => {
    const e: BeadEventRow = { event_type: 'agent-create', bead_id: null, actor: null, summary: '', timestamp: ago(MIN) };
    expect(deriveAgentLiveness([e], NOW)).toEqual([]);
  });
});

describe('livenessForAgents (S2 C0 — full roster incl. no-event agents)', () => {
  it('marks an agent with zero events as dark', () => {
    const map = livenessForAgents(['agent-E'], [], NOW);
    expect(map.get('agent-E')).toBe('dark');
  });

  it('fills derived states and defaults the rest to dark', () => {
    const events = [ev('agent-A', 'agent-sling', ago(5 * MIN)), ev('agent-B', 'agent-idle', ago(1 * HOUR))];
    const map = livenessForAgents(['agent-A', 'agent-B', 'agent-Z'], events, NOW);
    expect(map.get('agent-A')).toBe('live');
    expect(map.get('agent-B')).toBe('idle');
    expect(map.get('agent-Z')).toBe('dark'); // no events
  });
});

describe('window boundaries', () => {
  it('default windows are 2h live / 24h idle', () => {
    expect(DEFAULT_LIVENESS_WINDOWS.liveMs).toBe(2 * HOUR);
    expect(DEFAULT_LIVENESS_WINDOWS.idleMs).toBe(24 * HOUR);
  });

  it('a non-idle event just inside the live window is live; just outside is idle', () => {
    const justLive = deriveAgentLiveness([ev('a', 'agent-sling', ago(2 * HOUR - MIN))], NOW);
    const justIdle = deriveAgentLiveness([ev('b', 'agent-sling', ago(2 * HOUR + MIN))], NOW);
    expect(justLive[0]!.state).toBe('live');
    expect(justIdle[0]!.state).toBe('idle');
  });
});
