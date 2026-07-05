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

  it('(F5) a slung agent silent past the stall threshold is stalled, not idle', () => {
    // agent-sling = assignment; no agent-idle since ⇒ it holds work and has gone quiet.
    const out = deriveAgentLiveness([ev('agent-S', 'agent-sling', ago(5 * HOUR))], NOW);
    expect(out[0]).toMatchObject({ agentId: 'agent-S', state: 'stalled', lastEventType: 'agent-sling' });
  });

  it('(F5) a slung agent silent past the dark threshold is zombie — it still holds the assignment', () => {
    const out = deriveAgentLiveness([ev('agent-Z', 'agent-sling', ago(3 * DAY))], NOW);
    expect(out[0]).toMatchObject({ agentId: 'agent-Z', state: 'zombie' });
  });

  it('(F5) an open claim upgrades would-be dark to zombie — the store says it has work', () => {
    const events = [ev('agent-C', 'agent-create', ago(3 * DAY))];
    const withoutClaim = deriveAgentLiveness(events, NOW);
    const withClaim = deriveAgentLiveness(events, NOW, DEFAULT_LIVENESS_WINDOWS, new Set(['agent-C']));
    expect(withoutClaim[0]!.state).toBe('dark');
    expect(withClaim[0]!.state).toBe('zombie');
  });

  it('(F5) an open claim does NOT touch live/idle/stalled — only the dark boundary flips', () => {
    const claims = new Set(['agent-A', 'agent-B', 'agent-S']);
    const out = deriveAgentLiveness(
      [
        ev('agent-A', 'agent-create', ago(10 * MIN)),
        ev('agent-B', 'agent-idle', ago(2 * HOUR)),
        ev('agent-S', 'agent-sling', ago(5 * HOUR)),
      ],
      NOW,
      DEFAULT_LIVENESS_WINDOWS,
      claims,
    );
    const byId = new Map(out.map((a) => [a.agentId, a.state]));
    expect(byId.get('agent-A')).toBe('live');
    expect(byId.get('agent-B')).toBe('idle');
    expect(byId.get('agent-S')).toBe('stalled');
  });

  it('(F5) an explicitly-idled agent aged past the dark window with an open claim is zombie', () => {
    // It stood down but the store still holds its hook — asserted-alive with a dead event trail.
    const out = deriveAgentLiveness(
      [ev('agent-I', 'agent-idle', ago(3 * DAY))],
      NOW,
      DEFAULT_LIVENESS_WINDOWS,
      new Set(['agent-I']),
    );
    expect(out[0]!.state).toBe('zombie');
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

  it('(F5) a no-event agent holding an open claim is zombie, not dark', () => {
    const map = livenessForAgents(['agent-E', 'agent-F'], [], NOW, DEFAULT_LIVENESS_WINDOWS, new Set(['agent-E']));
    expect(map.get('agent-E')).toBe('zombie'); // claim held, never seen acting
    expect(map.get('agent-F')).toBe('dark');
  });
});

describe('window boundaries', () => {
  it('default windows are 2h live / 24h idle / 2h stall', () => {
    expect(DEFAULT_LIVENESS_WINDOWS.liveMs).toBe(2 * HOUR);
    expect(DEFAULT_LIVENESS_WINDOWS.idleMs).toBe(24 * HOUR);
    expect(DEFAULT_LIVENESS_WINDOWS.stallMs).toBe(2 * HOUR);
  });

  it('a non-idle, non-assignment event just inside the live window is live; just outside is idle', () => {
    const justLive = deriveAgentLiveness([ev('a', 'agent-create', ago(2 * HOUR - MIN))], NOW);
    const justIdle = deriveAgentLiveness([ev('b', 'agent-create', ago(2 * HOUR + MIN))], NOW);
    expect(justLive[0]!.state).toBe('live');
    expect(justIdle[0]!.state).toBe('idle');
  });

  it('(F5) a sling just inside the stall window is live; just outside is stalled — never idle', () => {
    const justLive = deriveAgentLiveness([ev('a', 'agent-sling', ago(2 * HOUR - MIN))], NOW);
    const justStalled = deriveAgentLiveness([ev('b', 'agent-sling', ago(2 * HOUR + MIN))], NOW);
    expect(justLive[0]!.state).toBe('live');
    expect(justStalled[0]!.state).toBe('stalled');
  });

  it('(F5) a sling just inside the dark window is stalled; just outside is zombie', () => {
    const justStalled = deriveAgentLiveness([ev('a', 'agent-sling', ago(24 * HOUR - MIN))], NOW);
    const justZombie = deriveAgentLiveness([ev('b', 'agent-sling', ago(24 * HOUR + MIN))], NOW);
    expect(justStalled[0]!.state).toBe('stalled');
    expect(justZombie[0]!.state).toBe('zombie');
  });
});
