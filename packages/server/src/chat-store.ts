import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
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
 * is migrated into 'leo' on first read, then retired, so an existing conversation survives the
 * upgrade and the legacy path can never fire twice.
 *
 * An ABSENT thread file and an UNREADABLE one are deliberately different cases. Absent means
 * "nothing written yet" and migrates from v1. Unreadable means the threads on disk are still
 * real but we cannot see them — so the bad bytes are moved aside and every write refuses for
 * the life of the process. Treating the two alike is how one corrupt byte used to erase every
 * sibling thread on the next message.
 */

const HISTORY_FILE = path.join(config.paths.dataDir, 'chat-history.json'); // v1, read-only legacy
const HISTORY_RETIRED_FILE = path.join(config.paths.dataDir, 'chat-history.migrated.json');
const THREADS_FILE = path.join(config.paths.dataDir, 'chat-threads.json');

type ThreadMap = Record<string, ChatHistoryEntry[]>;

/** Why the thread file could not be read, once it could not be. Writes refuse while set. */
let unreadable: string | null = null;

const isMissing = (err: unknown): boolean =>
  (err as NodeJS.ErrnoException | null)?.code === 'ENOENT';

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
 * Move an unreadable thread file aside under a timestamped name and refuse further writes.
 * Renamed, never deleted: whatever those bytes are, they are the only copy of those threads.
 */
async function quarantine(reason: string): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const aside = path.join(config.paths.dataDir, `chat-threads.corrupt-${stamp}.json`);
  try {
    await rename(THREADS_FILE, aside);
    unreadable = `${reason}; moved aside to ${path.basename(aside)}`;
  } catch (err) {
    unreadable = `${reason}; could not be moved aside (${String((err as NodeJS.ErrnoException).code ?? err)})`;
  }
  console.warn(`[chat-store] ${unreadable} — history is read-only until restart`);
}

/** The v1 flat array, folded into 'leo'. Only ever reached when the v2 file is absent. */
async function migrateLegacy(): Promise<ThreadMap> {
  const legacy = await readJsonArray<ChatHistoryEntry>(HISTORY_FILE);
  return legacy.length ? { leo: legacy } : {};
}

/**
 * Read every thread. Absent → migrate from v1. Unreadable → quarantine and report empty, but
 * poisoned, so nothing overwrites what we failed to read.
 */
async function readThreads(): Promise<ThreadMap> {
  if (unreadable) return {};
  let raw: string;
  try {
    raw = await readFile(THREADS_FILE, 'utf8');
  } catch (err) {
    if (isMissing(err)) return migrateLegacy();
    await quarantine(`chat-threads.json unreadable (${String((err as NodeJS.ErrnoException).code ?? err)})`);
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await quarantine('chat-threads.json is not valid JSON');
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    await quarantine('chat-threads.json is not a thread map');
    return {};
  }
  return parsed as ThreadMap;
}

/** Writes are refused wholesale while the thread file is unreadable — never partially applied. */
function assertWritable(): void {
  if (unreadable) throw new Error(`chat history is read-only: ${unreadable}`);
}

/**
 * Persist the map, then retire the v1 file. Retirement is best-effort and never fails the write
 * that already succeeded — but it is reported, not swallowed.
 */
async function writeThreads(threads: ThreadMap): Promise<void> {
  await writeJson(THREADS_FILE, threads);
  try {
    await rename(HISTORY_FILE, HISTORY_RETIRED_FILE);
  } catch (err) {
    if (!isMissing(err)) {
      console.warn(`[chat-store] v1 history could not be retired: ${String((err as NodeJS.ErrnoException).code ?? err)}`);
    }
  }
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
  assertWritable();
  threads[thread] = [...(threads[thread] ?? []), user, assistant];
  await writeThreads(threads);
}

/** Clear ONE thread; the others are untouched. */
export async function clearHistory(thread: string): Promise<void> {
  const threads = await readThreads();
  assertWritable();
  threads[thread] = [];
  await writeThreads(threads);
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
