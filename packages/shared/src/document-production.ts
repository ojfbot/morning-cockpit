import type { DocumentProduction, ProductionInteraction } from './source-record.js';

function object(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : undefined;
}
function required(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value : undefined; }
function nullable(value: unknown): string | null | undefined { return value === null ? null : required(value); }

/** Zoned RFC3339, millisecond precision; calendar validity precedes Date.parse normalization. */
function timestamp(value: string): number | undefined {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts) return;
  const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
  const hour = Number(parts[4]), minute = Number(parts[5]), second = Number(parts[6]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (days === undefined || day < 1 || day > days || hour > 23 || minute > 59 || second > 59) return;
  const zone = parts[7];
  if (!zone) return;
  if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4, 6)) > 59)) return;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : undefined;
}

function interaction(value: unknown): ProductionInteraction | undefined {
  const row = object(value);
  if (!row) return;
  const kind = row.kind;
  if (kind !== 'model-generation' && kind !== 'human-edit' && kind !== 'human-approval' && kind !== 'emission') return;
  const interactionId = required(row.interactionId), runtimeId = required(row.runtimeId), hostId = required(row.hostId);
  const startedAt = required(row.startedAt), completedAt = required(row.completedAt);
  const parentInteractionId = nullable(row.parentInteractionId), principalId = nullable(row.principalId), agentId = nullable(row.agentId);
  const sessionProvider = nullable(row.sessionProvider), sessionId = nullable(row.sessionId), modelProvider = nullable(row.modelProvider), modelId = nullable(row.modelId), traceId = nullable(row.traceId);
  if (!interactionId || !runtimeId || !hostId || !startedAt || !completedAt) return;
  const start = timestamp(startedAt), end = timestamp(completedAt);
  if (start === undefined || end === undefined || end < start) return;
  if (!/^runtime:v1:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runtimeId)) return;
  if (parentInteractionId === undefined || principalId === undefined || agentId === undefined || sessionProvider === undefined || sessionId === undefined || modelProvider === undefined || modelId === undefined || traceId === undefined) return;
  if (Boolean(sessionProvider) !== Boolean(sessionId) || Boolean(modelProvider) !== Boolean(modelId)) return;
  const base = { interactionId, parentInteractionId, principalId, agentId, runtimeId, sessionProvider, sessionId, modelProvider, modelId, traceId, hostId, startedAt, completedAt };
  if (kind === 'model-generation') {
    if (!agentId || !sessionProvider || !sessionId || !modelProvider || !modelId) return;
    return { ...base, kind, agentId, sessionProvider, sessionId, modelProvider, modelId };
  }
  if (kind === 'human-edit' || kind === 'human-approval') {
    if (!principalId || modelId !== null || agentId !== null) return;
    return { ...base, kind, principalId, agentId: null, modelProvider: null, modelId: null };
  }
  if (modelId !== null) return;
  return { ...base, kind, modelProvider: null, modelId: null };
}

/** Reader never reconstructs trace fields from other metadata or the observing runtime. */
export function parseDocumentProduction(value: unknown): DocumentProduction {
  if (value === undefined) return { status: 'legacy-unknown', reason: 'Production trace is absent from observed frontmatter. Historical production is unknown.' };
  const row = object(value);
  if (!row || row.schemaVersion !== 1 || !Array.isArray(row.interactions) || row.interactions.length === 0) return { status: 'unavailable', reason: 'Recorded production trace is malformed or unsupported.' };
  const interactions: ProductionInteraction[] = [];
  for (const entry of row.interactions) {
    const parsed = interaction(entry);
    if (!parsed || interactions.some(existing => existing.interactionId === parsed.interactionId)) return { status: 'unavailable', reason: 'Recorded production interactions are malformed or duplicated.' };
    interactions.push(parsed);
  }
  return { status: 'recorded', schemaVersion: 1, interactions };
}
