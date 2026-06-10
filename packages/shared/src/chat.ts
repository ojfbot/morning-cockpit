/**
 * Cockpit Chat — pure prompt-assembly for the right-sidebar chat (ADR-0006). The preload is
 * DETERMINISTIC: built only from already-cached snapshots (no fetches, no LLM at load). The
 * grounding discipline is imported from f1-pit-wall's annotate.ts — context-in-prompt,
 * validated-or-deterministic-fallback output, local-first provider, no silent cloud cascade.
 */

import type { CockpitSnapshot, WorkItem, WorkItemLane } from './work-item.js';
import type { ReadingSnapshot } from './reading.js';
import type { PapersSnapshot } from './papers.js';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** What the chat session opens pre-grounded with (see CONTEXT.md: Index Skeleton, Day-Goal Brief). */
export interface ChatPreload {
  generatedAt: string;
  indexSkeleton: string;
  dayGoalBrief: string;
}

/** A persisted chat turn (server .data/chat-history.json). */
export interface ChatHistoryEntry extends ChatMessage {
  id: string;
  createdAt: string;
  /** True when this assistant turn is the deterministic fallback, not model output. */
  fallback?: boolean;
  /** Ids of context items attached to this user turn (S2). */
  attachmentIds?: string[];
}

// ── Context Attachments (see CONTEXT.md) ───────────────────────────────────

export type ChatContextType = 'bead' | 'reading' | 'paper';

/** One row in the unified attach registry (autocomplete multiselect over all pods). */
export interface ChatContextItem {
  id: string;
  type: ChatContextType;
  title: string;
  repo?: string;
  subtitle?: string;
}

/** What the renderer sends: which items to inject into the NEXT prompt only. */
export interface ChatAttachment {
  id: string;
  type: ChatContextType;
}

/** An attachment with its full content resolved server-side. */
export interface ResolvedAttachment {
  type: ChatContextType;
  title: string;
  content: string;
}

const TITLE_MAX = 80;

function clipTitle(title: string): string {
  return title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX - 1)}…` : title;
}

function skeletonLine(item: WorkItem): string {
  const stale = item.staleDays ? ` (${item.staleDays}d stale)` : '';
  const repo = item.repo ? `[${item.repo}] ` : '';
  return `- ${repo}"${clipTitle(item.title)}" — ${item.kind}/${item.status}${stale}`;
}

function laneBlock(label: string, items: WorkItem[], capPerLane: number): string[] {
  const lines = [`### ${label} (${items.length})`];
  if (items.length === 0) {
    lines.push('- (none)');
    return lines;
  }
  lines.push(...items.slice(0, capPerLane).map(skeletonLine));
  if (items.length > capPerLane) lines.push(`- … and ${items.length - capPerLane} more`);
  return lines;
}

const LANE_LABELS: Record<WorkItemLane, string> = {
  overnight: 'Overnight',
  pickup: 'Pickup',
  available: 'Available',
};

/**
 * Index Skeleton — a compact, deterministic, per-pod outline (titles/status only, no bodies)
 * built from already-cached snapshots. Never triggers fetches; cold pods print "(not loaded yet)".
 */
export function buildIndexSkeleton(
  snapshot: CockpitSnapshot,
  reading?: ReadingSnapshot,
  papers?: PapersSnapshot,
  capPerLane = 12,
): string {
  const lines: string[] = ['## Beads'];
  for (const lane of ['overnight', 'pickup', 'available'] as const) {
    lines.push(...laneBlock(LANE_LABELS[lane], snapshot.lanes[lane], capPerLane));
  }

  lines.push('', '## Reading');
  if (!reading) {
    lines.push('- (not loaded yet)');
  } else {
    const withNew = reading.sources
      .map((s) => ({ title: s.title, fresh: s.items.filter((i) => i.isNew) }))
      .filter((s) => s.fresh.length > 0);
    if (withNew.length === 0) {
      lines.push('- (no new posts in the window)');
    } else {
      for (const s of withNew) {
        lines.push(`- ${s.title}: ${s.fresh.map((i) => `"${clipTitle(i.title)}"`).join(' · ')}`);
      }
    }
  }

  lines.push('', '## Research papers');
  if (!papers) {
    lines.push('- (not loaded yet)');
  } else if (papers.papers.length === 0) {
    lines.push('- (none today)');
  } else {
    for (const p of papers.papers) {
      lines.push(`- "${clipTitle(p.title)}"${p.upvotes != null ? ` (▲${p.upvotes})` : ''}`);
    }
  }

  return lines.join('\n');
}

/**
 * Day-Goal Brief — previous/current day framing derived from the always-present deterministic
 * lane summaries: previous day = Overnight, today = Pickup (+ its action). Inferred, never
 * user-authored, never an LLM call.
 */
export function buildDayGoalBrief(summaries: CockpitSnapshot['summaries']): string {
  const { overnight, pickup } = summaries;
  return [
    '## Since last evening',
    overnight.headline,
    ...overnight.bullets.map((b) => `- ${b}`),
    '',
    '## Today',
    pickup.headline,
    ...pickup.bullets.map((b) => `- ${b}`),
    `→ ${pickup.action}`,
  ].join('\n');
}

/** System prompt = grounding preamble + Day-Goal Brief + Index Skeleton. */
export function buildChatSystemPrompt(preload: ChatPreload): string {
  return [
    'You are the Morning Cockpit chat — a concise chief-of-staff discussing the user\'s',
    'work-items (beads), reading feed, and research papers. Ground every answer ONLY in the',
    'cockpit context below and any [Attached context] in the user message. If the answer is',
    'not in that context, say so plainly — never invent bead ids, repos, titles, statuses, or',
    'paper claims. Refer to items by their exact titles so the user can find them. Keep',
    'answers short and direct.',
    '',
    `# Cockpit context (generated ${preload.generatedAt})`,
    '',
    preload.dayGoalBrief,
    '',
    preload.indexSkeleton,
  ].join('\n');
}

/**
 * Unified context registry — every attachable item across the pods, flattened for the
 * input bar's autocomplete multiselect. Pure: built from the same cached snapshots.
 */
export function buildChatRegistry(
  snapshot: CockpitSnapshot,
  reading?: ReadingSnapshot,
  papers?: PapersSnapshot,
): ChatContextItem[] {
  const items: ChatContextItem[] = [];

  for (const lane of ['overnight', 'pickup', 'available'] as const) {
    for (const w of snapshot.lanes[lane]) {
      items.push({
        id: w.id,
        type: 'bead',
        title: w.title,
        repo: w.repo,
        subtitle: `${w.kind} · ${w.status}`,
      });
    }
  }
  for (const source of reading?.sources ?? []) {
    for (const r of source.items) {
      items.push({ id: r.id, type: 'reading', title: r.title, subtitle: source.title });
    }
  }
  for (const p of papers?.papers ?? []) {
    items.push({
      id: p.id,
      type: 'paper',
      title: p.title,
      subtitle: p.upvotes != null ? `▲${p.upvotes}` : 'paper',
    });
  }
  return items;
}

/**
 * Render resolved attachments as the [Attached context] block prepended to the LATEST user
 * message only — attachments are never replayed into stored prior turns.
 */
export function formatAttachmentBlock(resolved: ResolvedAttachment[]): string {
  if (resolved.length === 0) return '';
  const blocks = resolved.map(
    (r) => `### ${r.type}: "${clipTitle(r.title)}"\n\`\`\`\n${r.content}\n\`\`\``,
  );
  return ['[Attached context]', ...blocks, '[End attached context]', ''].join('\n\n');
}

/**
 * Deterministic answer floor when the local model is down (or synthesis is off): honest about
 * the failure, still useful — the same preload the model would have seen. No cloud cascade.
 */
export function chatFallbackText(preload: ChatPreload): string {
  return [
    'Local model unavailable — no synthesized answer. Here is the deterministic cockpit state:',
    '',
    preload.dayGoalBrief,
    '',
    preload.indexSkeleton,
  ].join('\n');
}
