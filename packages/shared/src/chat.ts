/**
 * Cockpit Chat — pure prompt-assembly for the right-sidebar chat (ADR-0006). The preload is
 * DETERMINISTIC: built only from already-cached snapshots (no fetches, no LLM at load). The
 * grounding discipline is imported from f1-pit-wall's annotate.ts — context-in-prompt,
 * validated-or-deterministic-fallback output, local-first provider, no silent cloud cascade.
 */

import type { CockpitSnapshot, WorkItem, WorkItemLane } from './work-item.js';
import type { ReadingSnapshot } from './reading.js';
import type { PapersSnapshot } from './papers.js';
import type { DeliverySnapshot } from './delivery.js';

export type ChatRole = 'user' | 'assistant';

/**
 * Which conversation the sidebar is holding (roadmap S9). `leo` is the original global
 * chief-of-staff thread; `northstar` is per-focused-unit. Threads never mix.
 */
export type ChatTab = 'leo' | 'northstar';

export const CHAT_TABS: readonly ChatTab[] = ['leo', 'northstar'] as const;

export function isChatTab(v: unknown): v is ChatTab {
  return v === 'leo' || v === 'northstar';
}

/**
 * Thread identity. Leo stays one global thread (unchanged from v1); Northstar is keyed by the
 * focused unit, so pivoting the Fleet selection pivots the conversation with it.
 */
export function chatThreadKey(tab: ChatTab, unit?: string): string {
  return tab === 'northstar' ? `northstar:${unit ?? 'unknown'}` : 'leo';
}

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

// ── Northstar tab (roadmap S9) ─────────────────────────────────────────────

/**
 * What the Northstar tab opens pre-grounded with, for ONE focused fleet unit. Built purely
 * from the DeliverySnapshot the Delivery pane already reads — no new reader, no re-parse of
 * core's registry. `grounded: false` means the unit has no registered northstar; the prompt
 * then says so rather than inventing one.
 */
export interface NorthstarPreload {
  generatedAt: string;
  /** The focused fleet unit (repo name), verbatim from the Fleet selection. */
  unit: string;
  grounded: boolean;
  /** Northstar slug when grounded (e.g. "l1-morning-cockpit"). */
  northstar?: string;
  /** Properties with honest currents and their gaps. */
  compass: string;
  /** Roadmap slices by phase + recent recorded movement. */
  ladder: string;
}

function propertyLine(p: { id: string; name: string; current: number; target: string }): string[] {
  return [
    `- ${p.id} "${clipTitle(p.name)}" — current ${p.current} · gap ${100 - p.current}`,
    `    target: ${p.target}`,
  ];
}

/**
 * Compass + ladder for one unit. Pure and deterministic: every number here is read off disk
 * (northstar `current:`, slice `moves_from`/`moves_to`, `status.jsonl` lines) — nothing is
 * inferred, so the model can quote it and the user can check it.
 */
export function buildNorthstarPreload(delivery: DeliverySnapshot, unit: string): NorthstarPreload {
  const generatedAt = delivery.generatedAt;
  const ns = delivery.northstars.find((n) => n.app === unit);

  if (!ns) {
    /**
     * Truthful empty state. Note the careful wording: the delivery snapshot only surfaces
     * northstars that have a REGISTERED ROADMAP, so absence here does not prove absence in
     * core's registry. Saying "no northstar registered" would be a fabricated negative for the
     * handful of apps that carry a northstar but no roadmap yet. Say what was actually checked.
     */
    return {
      generatedAt,
      unit,
      grounded: false,
      compass: [
        `## Compass — ${unit}`,
        `- (not surfaced: no northstar with a registered roadmap was found for "${unit}")`,
        `  This does NOT prove ${unit} has no northstar. The cockpit reads northstar+roadmap`,
        `  PAIRS, so an app whose northstar has no roadmap yet looks identical to an`,
        `  unregistered one from here. Check core/decisions/northstar/README.md to tell them`,
        `  apart. Do not assert either way.`,
      ].join('\n'),
      ladder: ['## Roadmap', `- (no roadmap surfaced for "${unit}")`].join('\n'),
      // (no `northstar` slug — there is nothing verified to name)
    };
  }

  const compass = [`## Compass — ${ns.slug} (${ns.tier})`];
  if (ns.properties.length === 0) compass.push('- (northstar registered but declares no properties)');
  for (const p of ns.properties) compass.push(...propertyLine(p));

  const roadmap = delivery.roadmaps.find((r) => r.northstar === ns.slug);
  const ladder: string[] = [];
  if (!roadmap) {
    ladder.push('## Roadmap', `- (no roadmap registered for ${ns.slug})`);
  } else {
    ladder.push(`## Roadmap — ${roadmap.slug}`);
    for (const phase of roadmap.phases) {
      const slices = roadmap.slices.filter((s) => s.phase === phase.id);
      ladder.push(`### ${phase.id} — ${phase.name}${slices.length ? '' : ' (no slices)'}`);
      for (const s of slices) {
        const repo = s.repo ? ` [lands in ${s.repo}]` : '';
        ladder.push(
          `- ${s.id} "${clipTitle(s.title)}" → ${s.advances} · ${s.moves_from}→${s.moves_to} · ${s.status}${repo}`,
        );
      }
    }
  }

  const moves = delivery.movements.filter((m) => m.northstar === ns.slug).slice(-8);
  ladder.push('', '## Recorded movement');
  if (moves.length === 0) {
    ladder.push('- (none recorded — this northstar has never moved in status.jsonl)');
  } else {
    for (const m of moves) {
      const src = m.source ? ` · ${m.source}` : '';
      ladder.push(`- ${m.date} ${m.property} ${m.from}→${m.to}${src}`);
    }
  }

  return {
    generatedAt,
    unit,
    grounded: true,
    northstar: ns.slug,
    compass: compass.join('\n'),
    ladder: ladder.join('\n'),
  };
}

/**
 * Northstar system prompt.
 *
 * DELIBERATELY NOT the full roadtrip question ladder — the cadence (one-thread-at-a-time vs
 * freeform), the exact evidence-line field list, and whether decomposition belongs in this
 * thread at all are OPEN TICKETS in core/decisions/wayfinder/cockpit-northstar-conversation.md.
 * S9 ships grounding + guardrails only; the ladder is S11's, after those tickets close.
 *
 * The guardrails encode operator ruling D5: the tab may draft slice INTENT, never a slice.
 */
export function buildNorthstarSystemPrompt(preload: NorthstarPreload): string {
  return [
    `You are the Morning Cockpit's Northstar conversation, focused on "${preload.unit}".`,
    'You discuss this unit\'s compass — its vision, its properties, whether they are the right',
    'axes, and whether each `current` is honest. Push back on framing; do not validate by',
    'default. The user wants the sharpest version, not agreement.',
    '',
    '# Grounding rules',
    '- Every number below was read off disk. Quote them; never round, restate, or improve them.',
    '- Never invent a property id, a slice ref, a percentage, a movement line, or a northstar',
    '  slug. If it is not below, say it is not below.',
    '- Aspiration belongs in `target` and vision; honesty belongs in `current`. The gap is the',
    '  roadmap. Never deflate a target to make a percentage look better.',
    '',
    '# What you may and may not author',
    'You may propose slice INTENT: a title, a deliverable, which phase it sits in, and which',
    'property it advances (only one that appears below). `moves_from` is simply the property\'s',
    'current, so you may state it.',
    'You may NOT author `moves_to`, `entrance`, `success`, or `check:`. Those are the gate.',
    'A `check:` command you invented would silently mark a slice agent-claimable and let the',
    'day-runner pick it up — never write one. Say "the operator sets this" instead.',
    'You never write files, never touch `current:`, and never append to status.jsonl. Movement',
    'is recorded at merge by the person merging, not proposed here.',
    '',
    `# ${preload.unit} (generated ${preload.generatedAt})`,
    '',
    preload.compass,
    '',
    preload.ladder,
  ].join('\n');
}

/** Deterministic floor for the Northstar tab — same posture as chatFallbackText. */
export function northstarFallbackText(preload: NorthstarPreload): string {
  return [
    `Model unavailable — no synthesized answer. Deterministic compass for "${preload.unit}":`,
    '',
    preload.compass,
    '',
    preload.ladder,
  ].join('\n');
}
