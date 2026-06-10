import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChatHistoryEntry, HandoffDraft } from '@cockpit/shared';
import { config } from './config.js';

/**
 * JSON-file store for the chat's own state (single global thread, v1). Like store.ts this is
 * cockpit-OWN state under .data/ — it is not an upstream write. Handoff drafts (S3) get their
 * own file so clearing the conversation never loses a staged emission.
 */

const HISTORY_FILE = path.join(config.paths.dataDir, 'chat-history.json');

async function readJsonArray<T>(file: string): Promise<T[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(config.paths.dataDir, { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
}

/** Full thread, oldest first. */
export async function listHistory(): Promise<ChatHistoryEntry[]> {
  return readJsonArray<ChatHistoryEntry>(HISTORY_FILE);
}

/** One write per completed exchange (after the stream finishes or falls back). */
export async function appendExchange(user: ChatHistoryEntry, assistant: ChatHistoryEntry): Promise<void> {
  const all = await listHistory();
  await writeJson(HISTORY_FILE, [...all, user, assistant]);
}

export async function clearHistory(): Promise<void> {
  await writeJson(HISTORY_FILE, []);
}

// ── Handoff drafts (ADR-0005) — staged in cockpit .data/ until explicitly approved ──

const DRAFTS_FILE = path.join(config.paths.dataDir, 'chat-drafts.json');

/** All drafts, newest first (rejected kept as tombstones, like dismissed suggestions). */
export async function listDrafts(): Promise<HandoffDraft[]> {
  const all = await readJsonArray<HandoffDraft>(DRAFTS_FILE);
  return all.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function saveDraft(draft: HandoffDraft): Promise<void> {
  const all = await readJsonArray<HandoffDraft>(DRAFTS_FILE);
  await writeJson(DRAFTS_FILE, [draft, ...all]);
}

export async function updateDraft(draft: HandoffDraft): Promise<void> {
  const all = await readJsonArray<HandoffDraft>(DRAFTS_FILE);
  const idx = all.findIndex((d) => d.id === draft.id);
  if (idx === -1) throw new Error(`unknown draft: ${draft.id}`);
  all[idx] = draft;
  await writeJson(DRAFTS_FILE, all);
}

export async function getDraft(id: string): Promise<HandoffDraft | undefined> {
  return (await readJsonArray<HandoffDraft>(DRAFTS_FILE)).find((d) => d.id === id);
}
