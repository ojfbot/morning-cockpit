import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { CrossLinkSuggestion } from '@cockpit/shared';
import { config } from './config.js';

/**
 * Tiny JSON-file store for staged paper→concept cross-link suggestions. This is the cockpit's
 * OWN state — it does NOT write to the selfco vault or Claude memory (that "apply to vault"
 * write-path is deferred & gated; see ADR-0004). Read-only on all upstream sources holds.
 */

const FILE = path.join(config.paths.dataDir, 'suggestions.json');

async function readAll(): Promise<CrossLinkSuggestion[]> {
  try {
    const text = await readFile(FILE, 'utf8');
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as CrossLinkSuggestion[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: CrossLinkSuggestion[]): Promise<void> {
  await mkdir(config.paths.dataDir, { recursive: true });
  await writeFile(FILE, JSON.stringify(items, null, 2), 'utf8');
}

/** All non-dismissed suggestions, newest first. */
export async function listSuggestions(): Promise<CrossLinkSuggestion[]> {
  const all = await readAll();
  return all
    .filter((s) => s.status !== 'dismissed')
    .sort((a, b) => Date.parse(b.stagedAt) - Date.parse(a.stagedAt));
}

export interface StageInput {
  paperId: string;
  paperTitle: string;
  nodeKey: string;
  nodeLabel: string;
  vaultPath?: string;
  rationale?: string;
}

/** Stage a cross-link. Idempotent per (paperId, nodeKey) — re-staging returns the existing one. */
export async function stageSuggestion(input: StageInput): Promise<CrossLinkSuggestion> {
  const all = await readAll();
  const existing = all.find(
    (s) => s.paperId === input.paperId && s.nodeKey === input.nodeKey && s.status !== 'dismissed',
  );
  if (existing) return existing;

  const suggestion: CrossLinkSuggestion = {
    id: randomUUID(),
    paperId: input.paperId,
    paperTitle: input.paperTitle,
    nodeKey: input.nodeKey,
    nodeLabel: input.nodeLabel,
    vaultPath: input.vaultPath,
    rationale: input.rationale ?? '',
    status: 'staged',
    stagedAt: new Date().toISOString(),
  };
  await writeAll([suggestion, ...all]);
  return suggestion;
}

/** Mark a staged suggestion dismissed (kept in the file as a tombstone). */
export async function dismissSuggestion(id: string): Promise<boolean> {
  const all = await readAll();
  const idx = all.findIndex((s) => s.id === id);
  if (idx === -1) return false;
  all[idx] = { ...all[idx]!, status: 'dismissed' };
  await writeAll(all);
  return true;
}
