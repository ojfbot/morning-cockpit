import type {
  CockpitSnapshot,
  CrossLinkSuggestion,
  LaneSummary,
  PaperExplainer,
  PapersSnapshot,
  ReadingSnapshot,
  SynthSummary,
  WorkItemLane,
} from '@cockpit/shared';

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
