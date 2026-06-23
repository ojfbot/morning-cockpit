import type {
  BriefingArtifact,
  ChatAttachment,
  ChatContextItem,
  ChatHistoryEntry,
  ChatMessage,
  ChatPreload,
  CockpitSnapshot,
  CrossLinkSuggestion,
  HandoffDraft,
  LaneSummary,
  PaperExplainer,
  PapersSnapshot,
  ReadingSnapshot,
  SynthSummary,
  WorkItemLane,
} from '@cockpit/shared';
import { streamSse, type SseEvent } from './sse.js';

export async function fetchCockpit(signal?: AbortSignal): Promise<CockpitSnapshot> {
  const res = await fetch('/api/cockpit', { signal });
  if (!res.ok) throw new Error(`cockpit ${res.status}`);
  return (await res.json()) as CockpitSnapshot;
}

export interface SummaryResponse {
  lane: WorkItemLane;
  summary: LaneSummary;
  cached: boolean;
  disabled?: boolean;
  reason?: string;
  error?: string;
}

export async function fetchSummary(
  lane: WorkItemLane,
  force = false,
  signal?: AbortSignal,
): Promise<SummaryResponse> {
  const res = await fetch(`/api/summary?lane=${lane}${force ? '&force=1' : ''}`, { signal });
  if (!res.ok) throw new Error(`summary ${res.status}`);
  return (await res.json()) as SummaryResponse;
}

export async function fetchReading(signal?: AbortSignal): Promise<ReadingSnapshot> {
  const res = await fetch('/api/reading', { signal });
  if (!res.ok) throw new Error(`reading ${res.status}`);
  return (await res.json()) as ReadingSnapshot;
}

export interface ReadingDigestResponse {
  digest: SynthSummary;
  cached: boolean;
  disabled?: boolean;
  reason?: string;
  error?: string;
}

export async function fetchReadingDigest(force = false, signal?: AbortSignal): Promise<ReadingDigestResponse> {
  const res = await fetch(`/api/reading/digest${force ? '?force=1' : ''}`, { signal });
  if (!res.ok) throw new Error(`reading digest ${res.status}`);
  return (await res.json()) as ReadingDigestResponse;
}

// ── Research / papers ──────────────────────────────────────────────────────

export async function fetchPapers(signal?: AbortSignal): Promise<PapersSnapshot> {
  const res = await fetch('/api/papers', { signal });
  if (!res.ok) throw new Error(`papers ${res.status}`);
  return (await res.json()) as PapersSnapshot;
}

export interface ExplainerResponse {
  explainer: PaperExplainer;
  cached: boolean;
  disabled?: boolean;
  reason?: string;
  error?: string;
}

export async function fetchPaperExplainer(id: string, force = false, signal?: AbortSignal): Promise<ExplainerResponse> {
  const res = await fetch(`/api/papers/explainer?id=${encodeURIComponent(id)}${force ? '&force=1' : ''}`, { signal });
  if (!res.ok) throw new Error(`explainer ${res.status}`);
  return (await res.json()) as ExplainerResponse;
}

export async function fetchPaperDeepDive(id: string, force = false, signal?: AbortSignal): Promise<ExplainerResponse> {
  const res = await fetch(`/api/papers/deepdive?id=${encodeURIComponent(id)}${force ? '&force=1' : ''}`, { signal });
  if (!res.ok) throw new Error(`deepdive ${res.status}`);
  return (await res.json()) as ExplainerResponse;
}

export async function fetchSuggestions(signal?: AbortSignal): Promise<CrossLinkSuggestion[]> {
  const res = await fetch('/api/papers/suggestions', { signal });
  if (!res.ok) throw new Error(`suggestions ${res.status}`);
  return ((await res.json()) as { suggestions: CrossLinkSuggestion[] }).suggestions;
}

export async function stageSuggestion(input: {
  paperId: string;
  paperTitle: string;
  nodeKey: string;
  nodeLabel: string;
  vaultPath?: string;
  rationale?: string;
}): Promise<CrossLinkSuggestion> {
  const res = await fetch('/api/papers/suggestions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`stage ${res.status}`);
  return ((await res.json()) as { suggestion: CrossLinkSuggestion }).suggestion;
}

export async function dismissSuggestion(id: string): Promise<void> {
  const res = await fetch(`/api/papers/suggestions/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`dismiss ${res.status}`);
}

// ── Cockpit Chat ───────────────────────────────────────────────────────────

export interface ChatContextResponse {
  preload: ChatPreload;
  systemPrompt: string;
  model: string;
}

export async function fetchChatContext(signal?: AbortSignal): Promise<ChatContextResponse> {
  const res = await fetch('/api/chat/context', { signal });
  if (!res.ok) throw new Error(`chat context ${res.status}`);
  return (await res.json()) as ChatContextResponse;
}

export async function fetchChatHistory(signal?: AbortSignal): Promise<ChatHistoryEntry[]> {
  const res = await fetch('/api/chat/history', { signal });
  if (!res.ok) throw new Error(`chat history ${res.status}`);
  return ((await res.json()) as { messages: ChatHistoryEntry[] }).messages;
}

export async function clearChatHistory(): Promise<void> {
  const res = await fetch('/api/chat/history', { method: 'DELETE' });
  if (!res.ok) throw new Error(`chat clear ${res.status}`);
}

/** POST + parse the SSE stream (meta → token* → fallback? → done). */
export async function streamChat(
  messages: ChatMessage[],
  attachments: ChatAttachment[] = [],
): Promise<AsyncGenerator<SseEvent>> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, attachments }),
  });
  return streamSse(res);
}

export async function fetchChatRegistry(signal?: AbortSignal): Promise<ChatContextItem[]> {
  const res = await fetch('/api/chat/registry', { signal });
  if (!res.ok) throw new Error(`chat registry ${res.status}`);
  return ((await res.json()) as { items: ChatContextItem[] }).items;
}

// ── Handoff Emission (ADR-0005) ────────────────────────────────────────────

export type DraftHandoffResponse =
  | { status: 'ok'; draft: HandoffDraft }
  | { status: 'failed_validation'; errors: string[]; raw: string }
  | { status: 'unavailable'; reason: string };

export async function draftHandoff(messages: ChatMessage[]): Promise<DraftHandoffResponse> {
  const res = await fetch('/api/chat/handoff/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok && res.status !== 422) throw new Error(`handoff draft ${res.status}`);
  return (await res.json()) as DraftHandoffResponse;
}

export interface HandoffEdits {
  title?: string;
  to?: string;
  body?: Partial<HandoffDraft['body']>;
}

export interface ApproveHandoffResponse {
  written: boolean;
  path?: string;
  beadId?: string;
  errors?: string[];
}

export async function approveHandoff(draftId: string, edits?: HandoffEdits): Promise<ApproveHandoffResponse> {
  const res = await fetch('/api/chat/handoff/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftId, edits }),
  });
  if (!res.ok && res.status !== 400) throw new Error(`handoff approve ${res.status}`);
  return (await res.json()) as ApproveHandoffResponse;
}

export async function rejectHandoff(draftId: string): Promise<void> {
  const res = await fetch(`/api/chat/handoff/draft/${encodeURIComponent(draftId)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`handoff reject ${res.status}`);
}

export async function fetchHandoffDrafts(signal?: AbortSignal): Promise<HandoffDraft[]> {
  const res = await fetch('/api/chat/handoff/drafts', { signal });
  if (!res.ok) throw new Error(`handoff drafts ${res.status}`);
  return ((await res.json()) as { drafts: HandoffDraft[] }).drafts;
}

// ── Briefing console (ADR-0007) — deliver-branch emit reuses the gated handoff write ──

export interface EmitArtifactResponse {
  written: boolean;
  path?: string;
  beadId?: string;
  errors?: string[];
}

/** Approve & emit a deliver-branch artifact → POST /api/briefing/emit (validates + writes a brief). */
export async function emitBriefingArtifact(artifact: BriefingArtifact): Promise<EmitArtifactResponse> {
  const res = await fetch('/api/briefing/emit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artifact }),
  });
  if (!res.ok && res.status !== 422) throw new Error(`briefing emit ${res.status}`);
  return (await res.json()) as EmitArtifactResponse;
}
