import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  classifyLane,
  type AdapterHealth,
  type LaneContext,
  type LaneInput,
  type WorkItem,
  type WorkItemKind,
  type WorkItemStatus,
} from '@cockpit/shared';
import { config } from '../config.js';

/**
 * Read-only adapter over per-repo `.handoff/*.md` markdown beads.
 * Open-hook logic ported from core/.claude/skills/bead/scripts/orient.py @ 2026-06-07:
 *   a brief is an "open hook" iff status=live AND no report responds_to it (per repo).
 */

const FRONTMATTER_RE = /^---\n([\s\S]+?)\n---\n/;
const BEAD_TYPES = new Set(['brief', 'report', 'decision', 'discovery']);

interface ParsedBead {
  id?: string;
  type?: string;
  title?: string;
  actor?: string;
  to?: string;
  status?: string;
  created_at?: string;
  responding_to?: string;
  filePath: string;
  mtimeIso: string;
}

function toIso(v: unknown, fallback: string): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return fallback;
}

async function listHandoffDirs(repoRoot: string): Promise<string[]> {
  let entries: string[] = [];
  try {
    entries = await readdir(repoRoot);
  } catch {
    return [];
  }
  const dirs: string[] = [];
  for (const name of entries) {
    const candidate = path.join(repoRoot, name, '.handoff');
    try {
      if ((await stat(candidate)).isDirectory()) dirs.push(candidate);
    } catch {
      /* no .handoff here */
    }
  }
  return dirs;
}

export async function fetchHandoff(ctx: LaneContext): Promise<{ items: WorkItem[]; health: AdapterHealth }> {
  const health: AdapterHealth = { name: 'handoff-bead', status: 'down', itemCount: 0 };
  let skipped = 0;
  let repoCount = 0;
  const items: WorkItem[] = [];

  try {
    const dirs = await listHandoffDirs(config.handoff.repoRoot);

    for (const dir of dirs) {
      repoCount++;
      const repo = path.basename(path.dirname(dir));
      let files: string[];
      try {
        files = (await readdir(dir)).filter((f) => f.endsWith('.md') && f !== 'README.md');
      } catch {
        continue;
      }

      // Parse all beads in this repo first (need the full set to compute open hooks).
      const beads: ParsedBead[] = [];
      for (const file of files) {
        const full = path.join(dir, file);
        try {
          const text = await readFile(full, 'utf8');
          const m = FRONTMATTER_RE.exec(text);
          if (!m) {
            skipped++;
            continue;
          }
          const fm = (parseYaml(m[1]!) ?? {}) as Record<string, unknown>;
          if (!BEAD_TYPES.has(String(fm['type']))) {
            skipped++;
            continue;
          }
          const mtimeIso = (await stat(full)).mtime.toISOString();
          beads.push({
            id: fm['id'] as string | undefined,
            type: fm['type'] as string | undefined,
            title: fm['title'] as string | undefined,
            actor: fm['actor'] as string | undefined,
            to: fm['to'] as string | undefined,
            status: fm['status'] as string | undefined,
            created_at: fm['created_at'] as string | undefined,
            responding_to: fm['responding_to'] as string | undefined,
            filePath: full,
            mtimeIso,
          });
        } catch {
          skipped++;
        }
      }

      const responded = new Set(
        beads.filter((b) => b.type === 'report' && b.responding_to).map((b) => b.responding_to),
      );

      for (const b of beads) {
        const kind = b.type as WorkItemKind;
        const createdIso = toIso(b.created_at, b.mtimeIso);
        const activityAt = Date.parse(b.mtimeIso) > Date.parse(createdIso) ? b.mtimeIso : createdIso;

        let status: WorkItemStatus;
        let openHook = false;
        if (kind === 'brief') {
          openHook = b.status === 'live' && !responded.has(b.id);
          status = openHook ? 'open' : 'done';
        } else {
          // report / decision / discovery record completed work
          status = 'done';
        }

        const input: LaneInput = {
          source: 'handoff-bead',
          kind,
          status,
          activityAt,
          openHook,
        };
        const lane = classifyLane(input, ctx);
        if (!lane) continue;

        items.push({
          id: `handoff-bead:${b.id ?? b.filePath}`,
          nativeId: b.id ?? path.basename(b.filePath),
          source: 'handoff-bead',
          kind,
          status,
          lane,
          title: b.title ?? path.basename(b.filePath),
          repo,
          actor: b.actor,
          createdAt: createdIso,
          updatedAt: b.mtimeIso,
          activityAt,
          url: `file://${b.filePath}`,
          detail: { kind: 'brief', to: b.to, openHook },
          provenance: { sourcePath: b.filePath },
        });
      }
    }

    health.status = 'up';
    health.itemCount = items.length;
    health.note = `${repoCount} repos with .handoff${skipped ? ` · ${skipped} files skipped` : ''}`;
    return { items, health };
  } catch (err) {
    health.status = 'down';
    health.lastError = err instanceof Error ? err.message : String(err);
    return { items, health };
  }
}
