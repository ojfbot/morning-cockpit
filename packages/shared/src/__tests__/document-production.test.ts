import { describe, expect, it } from 'vitest';
import { parseDocumentProduction } from '../document-production.js';
import { sourceRecordKey } from '../source-record.js';
const event = { kind: 'model-generation', interactionId: 'interaction-v1-one', principalId: null, agentId: 'agent-core-worker', runtimeId: 'runtime:v1:16732e41-8295-4f8e-929c-d2b1b7a01730', sessionProvider: 'codex', sessionId: 'provider-native-session', modelProvider: 'openai', modelId: 'exact-recorded-model', traceId: 'existing-core-trace', parentInteractionId: null, hostId: 'fixture-host', startedAt: '2026-10-13T00:00:00Z', completedAt: '2026-10-13T00:01:00Z' };
describe('production provenance at the read boundary', () => {
  it('leaves absence legacy-unknown; malformed expected capture unavailable', () => {
    expect(parseDocumentProduction(undefined).status).toBe('legacy-unknown');
    for (const value of [null, {}, { schemaVersion: 99 }, { schemaVersion: 1, interactions: [] }, { schemaVersion: 1, interactions: [{ ...event, runtimeId: '1234' }] }]) expect(parseDocumentProduction(value).status).toBe('unavailable');
  });
  it('records model, human approval and emission separately without treating claims as authority', () => {
    const human = { ...event, kind: 'human-approval', interactionId: 'human-approval', principalId: 'self-recorded-human', agentId: null, modelProvider: null, modelId: null, parentInteractionId: event.interactionId };
    const emitted = { ...event, kind: 'emission', interactionId: 'emission', modelProvider: null, modelId: null, parentInteractionId: human.interactionId };
    expect(parseDocumentProduction({ schemaVersion: 1, interactions: [event, human, emitted] })).toEqual({ status: 'recorded', schemaVersion: 1, interactions: [event, human, emitted] });
  });
  it('rejects duplicated IDs, mismatched sessions, missing exact models and impossible human/model combinations', () => {
    const invalids = [[event, event], [{ ...event, modelId: null }], [{ ...event, sessionProvider: null }], [{ ...event, completedAt: 'invalid' }], [{ ...event, kind: 'human-edit' }]];
    for (const interactions of invalids) expect(parseDocumentProduction({ schemaVersion: 1, interactions }).status).toBe('unavailable');
  });
  it('resource identity is unchanged by production interaction or runtime changes', () => {
    const ref = { kind: 'handoff-document-v1', source: 'handoff-bead', repository: 'alpha', nativeId: 'native', sourcePath: '.handoff/brief.md' } as const;
    const key = sourceRecordKey(ref);
    const observed = { ...ref, documentProduction: { status: 'recorded', interactions: [event] } };
    expect(sourceRecordKey(observed)).toBe(key);
  });
  it.each(['principalId', 'traceId', 'parentInteractionId', 'agentId', 'sessionProvider', 'sessionId', 'modelProvider', 'modelId'] as const)('rejects an omitted schema-v1 %s declaration', (field) => {
    const missing = Object.fromEntries(Object.entries(event).filter(([key]) => key !== field));
    expect(parseDocumentProduction({ schemaVersion: 1, interactions: [missing] }).status).toBe('unavailable');
  });
  it('accepts explicit null declarations for unknown principal, trace and parent', () => {
    const explicit = { ...event, principalId: null, traceId: null, parentInteractionId: null };
    expect(parseDocumentProduction({ schemaVersion: 1, interactions: [explicit] })).toEqual({ status: 'recorded', schemaVersion: 1, interactions: [explicit] });
  });
});

it('rejects impossible calendar dates and unspecified timezone, while accepting real leap days', () => {
  for (const [startedAt, completedAt] of [
    ['2026-02-31T00:00:00Z', '2026-03-04T00:00:00Z'],
    ['2026-02-29T00:00:00Z', '2026-03-01T00:00:00Z'],
    ['2026-01-01T24:00:00Z', '2026-01-02T01:00:00Z'],
    ['2026-01-01T00:00:00', '2026-01-01T01:00:00'],
  ]) expect(parseDocumentProduction({ schemaVersion: 1, interactions: [{ ...event, startedAt, completedAt }] }).status).toBe('unavailable');
  expect(parseDocumentProduction({ schemaVersion: 1, interactions: [{ ...event, startedAt: '2024-02-29T00:00:00.001Z', completedAt: '2024-02-29T00:01:00+00:00' }] }).status).toBe('recorded');
});
