import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChatHistoryEntry, HandoffDraft } from '@cockpit/shared';
import { config } from './config.js';

/**
 * JSON-file store for the chat's own state. Like store.ts this is cockpit-OWN state under
 * .data/ — it is not an upstream write. Handoff drafts (S3) get their own file so clearing
 * the conversation never loses a staged emission.
 *
 * v2 (roadmap S9): history is keyed by THREAD, not one global array — 'leo' stays the single
 * chief-of-staff thread; the Northstar tab gets one thread per focused unit. The v1 flat file
 * is migrated into 'leo' on first read, so an existing conversation survives the upgrade.
 */

const HISTORY_FILE = path.join(config.paths.dataDir, 'chat-history.json'); // v1, read-only legacy
const THREADS_FILE = path.join(config.paths.dataDir, 'chat-threads.json');

type ThreadMap = Record<string, ChatHistoryEntry[]>;

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

/**
 * Read every thread. If the v2 file is absent, seed it in-memory from the v1 flat array so a
 * pre-S9 conversation keeps rendering under 'leo' (the migration persists on the next write).
 */
async function readThreads(): Promise<ThreadMap> {
  try {
    const parsed: unknown = JSON.parse(await readFile(THREADS_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as ThreadMap;
  } catch {
    /* absent or corrupt — fall through to the v1 migration */
  }
  const legacy = await readJsonArray<ChatHistoryEntry>(HISTORY_FILE);
  return legacy.length ? { leo: legacy } : {};
}

/** One thread, oldest first. Unknown threads read as empty, never as an error. */
export async function listHistory(thread: string): Promise<ChatHistoryEntry[]> {
  return (await readThreads())[thread] ?? [];
}

/** One write per completed exchange (after the stream finishes or falls back). */
export async function appendExchange(
  thread: string,
  user: ChatHistoryEntry,
  assistant: ChatHistoryEntry,
): Promise<void> {
  const threads = await readThreads();
  threads[thread] = [...(threads[thread] ?? []), user, assistant];
  await writeJson(THREADS_FILE, threads);
}

/** Clear ONE thread; the others are untouched. */
export async function clearHistory(thread: string): Promise<void> {
  const threads = await readThreads();
  threads[thread] = [];
  await writeJson(THREADS_FILE, threads);
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
