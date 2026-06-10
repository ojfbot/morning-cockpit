import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildChatRegistry,
  type ChatAttachment,
  type ChatContextItem,
  type CockpitSnapshot,
  type PapersSnapshot,
  type ReadingSnapshot,
  type ResolvedAttachment,
  type WorkItem,
} from '@cockpit/shared';
import { config } from './config.js';
import { buildSnapshot } from './aggregate.js';
import { getReading } from './routes/reading.js';
import { getPapers } from './routes/papers.js';

/**
 * Unified attach registry + server-side attachment resolution. Resolution stays read-only and
 * honest: unknown ids and unreadable files resolve to truthful stubs, never silent drops.
 */

/** Pure path guard: p must live strictly inside root (no `..` escapes, no absolute hops). */
export function isPathInside(root: string, p: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(p));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

interface PodSnapshots {
  snapshot: CockpitSnapshot;
  reading?: ReadingSnapshot;
  papers?: PapersSnapshot;
}

/** Registry is user-initiated (typing in the picker) → full getters are fine; each pod degrades alone. */
async function loadPods(now: number): Promise<PodSnapshots> {
  const [snapshot, readingRes, papersRes] = await Promise.all([
    buildSnapshot(new Date(now)),
    getReading(now).catch(() => undefined),
    getPapers(now).catch(() => undefined),
  ]);
  return { snapshot, reading: readingRes?.snapshot, papers: papersRes?.snapshot };
}

export async function getRegistry(now: number): Promise<ChatContextItem[]> {
  const { snapshot, reading, papers } = await loadPods(now);
  return buildChatRegistry(snapshot, reading, papers);
}

function clip(text: string): string {
  const max = config.chat.maxAttachmentChars;
  return text.length > max ? `${text.slice(0, max)}\n…(clipped at ${max} chars)` : text;
}

function findBead(snapshot: CockpitSnapshot, id: string): WorkItem | undefined {
  for (const lane of ['overnight', 'pickup', 'available'] as const) {
    const hit = snapshot.lanes[lane].find((w) => w.id === id);
    if (hit) return hit;
  }
  return undefined;
}

async function resolveBead(item: WorkItem): Promise<ResolvedAttachment> {
  const sourcePath = item.provenance.sourcePath;
  if (sourcePath) {
    if (!isPathInside(config.handoff.repoRoot, sourcePath)) {
      return { type: 'bead', title: item.title, content: '(content unavailable: source path outside the repo root)' };
    }
    try {
      return { type: 'bead', title: item.title, content: clip(await readFile(sourcePath, 'utf8')) };
    } catch (err) {
      return {
        type: 'bead',
        title: item.title,
        content: `(content unavailable: ${err instanceof Error ? err.message : String(err)})`,
      };
    }
  }
  // Dolt beads have no file body — serialize the structured fields we already hold (no re-query).
  const { id, kind, status, title, repo, actor, createdAt, updatedAt, closedAt, staleDays, detail } = item;
  return {
    type: 'bead',
    title: item.title,
    content: clip(JSON.stringify({ id, kind, status, title, repo, actor, createdAt, updatedAt, closedAt, staleDays, detail }, null, 2)),
  };
}

const NOT_FOUND = (type: ResolvedAttachment['type'], id: string): ResolvedAttachment => ({
  type,
  title: id,
  content: '(not found in the current snapshot — it may have rotated out since you attached it)',
});

/** Resolve attachment ids → full content for prompt injection (next prompt only). */
export async function resolveAttachments(atts: ChatAttachment[], now: number): Promise<ResolvedAttachment[]> {
  if (atts.length === 0) return [];
  const { snapshot, reading, papers } = await loadPods(now);

  return Promise.all(
    atts.map(async (att): Promise<ResolvedAttachment> => {
      if (att.type === 'bead') {
        const item = findBead(snapshot, att.id);
        return item ? resolveBead(item) : NOT_FOUND('bead', att.id);
      }
      if (att.type === 'paper') {
        const p = papers?.papers.find((x) => x.id === att.id);
        if (!p) return NOT_FOUND('paper', att.id);
        const meta = [
          `Authors: ${p.authors.join(', ') || 'n/a'}`,
          ...(p.upvotes != null ? [`Upvotes: ${p.upvotes}`] : []),
          `URL: ${p.url}`,
          '',
          'Abstract:',
          p.abstract,
        ].join('\n');
        return { type: 'paper', title: p.title, content: clip(meta) };
      }
      // reading: metadata only — the cockpit never fetches article bodies (read-only, no new egress).
      for (const source of reading?.sources ?? []) {
        const r = source.items.find((x) => x.id === att.id);
        if (r) {
          const meta = [
            `Source: ${source.title}`,
            ...(r.author ? [`Author: ${r.author}`] : []),
            ...(r.publishedAt ? [`Published: ${r.publishedAt}`] : []),
            `URL: ${r.url}`,
            '(metadata only — the cockpit does not fetch article bodies)',
          ].join('\n');
          return { type: 'reading', title: r.title, content: meta };
        }
      }
      return NOT_FOUND('reading', att.id);
    }),
  );
}
