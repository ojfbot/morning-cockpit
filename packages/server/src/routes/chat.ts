import { randomUUID } from 'node:crypto';
import { Router, type Request } from 'express';
import {
  buildChatSystemPrompt,
  buildDayGoalBrief,
  buildIndexSkeleton,
  buildNorthstarPreload,
  buildNorthstarSystemPrompt,
  chatFallbackText,
  chatThreadKey,
  formatAttachmentBlock,
  isChatTab,
  northstarFallbackText,
  type ChatAttachment,
  type ChatHistoryEntry,
  type ChatMessage,
  type ChatPreload,
  type ChatTab,
  type NorthstarPreload,
} from '@cockpit/shared';
import { config } from '../config.js';
import { buildSnapshot } from '../aggregate.js';
import { peekReading } from './reading.js';
import { peekPapers } from './papers.js';
import { getDelivery } from './delivery.js';
import { ollamaChatStream } from '../providers/ollama.js';
import { sseEnd, sseInit, sseSend } from '../sse.js';
import { appendExchange, clearHistory, listDrafts, listHistory } from '../chat-store.js';
import { getRegistry, resolveAttachments } from '../chat-context.js';
import { approveDraft, draftFromConversation, rejectDraft, type DraftEdits } from '../handoff-emit.js';

/**
 * Cockpit Chat (ADR-0006): grounded sidebar discussion, Ollama-ONLY. Deliberately bypasses
 * llm.ts's provider selector — even COCKPIT_SUMMARY_PROVIDER=claude never routes chat to the
 * cloud, and any local failure degrades to ONE honest deterministic fallback (annotate.ts
 * discipline: no silent cascade).
 *
 * S9 adds a second TAB (`northstar`), scoped to the focused Fleet unit and grounded on the
 * delivery snapshot instead of the bead lanes. The provider stays Ollama-only here: routing the
 * Northstar tab to a frontier model is a separate, ticket-gated decision, not a side effect of
 * adding the tab.
 */

export const chatRouter: Router = Router();

/** Deterministic preload: TtlCache'd snapshot + peek-only reading/papers (no new fetches, no LLM). */
async function assemblePreload(now: number): Promise<ChatPreload> {
  const snapshot = await buildSnapshot(new Date(now));
  return {
    generatedAt: snapshot.generatedAt,
    indexSkeleton: buildIndexSkeleton(
      snapshot,
      peekReading(now),
      peekPapers(now),
      config.chat.skeletonItemsPerLane,
    ),
    dayGoalBrief: buildDayGoalBrief(snapshot.summaries),
  };
}

/** Compass preload for one focused unit, off the shared delivery cache. */
async function assembleNorthstarPreload(now: number, unit: string): Promise<NorthstarPreload> {
  return buildNorthstarPreload(await getDelivery(now), unit);
}

/** `?tab=` + `?repo=` — unknown/absent values fall back to the original global Leo thread. */
function readScope(req: Request): { tab: ChatTab; unit?: string } {
  const rawTab = typeof req.query.tab === 'string' ? req.query.tab : undefined;
  const tab: ChatTab = isChatTab(rawTab) ? rawTab : 'leo';
  const unit = typeof req.query.repo === 'string' && req.query.repo ? req.query.repo : undefined;
  return tab === 'northstar' && unit ? { tab, unit } : { tab: 'leo' };
}

/** Both tabs' grounding, behind one shape so the disclosure renders either verbatim. */
async function assembleScoped(
  now: number,
  scope: { tab: ChatTab; unit?: string },
): Promise<{ preload: ChatPreload | NorthstarPreload; systemPrompt: string; fallback: string }> {
  if (scope.tab === 'northstar' && scope.unit) {
    const preload = await assembleNorthstarPreload(now, scope.unit);
    return {
      preload,
      systemPrompt: buildNorthstarSystemPrompt(preload),
      fallback: northstarFallbackText(preload),
    };
  }
  const preload = await assemblePreload(now);
  return {
    preload,
    systemPrompt: buildChatSystemPrompt(preload),
    fallback: chatFallbackText(preload),
  };
}

function isChatMessage(m: unknown): m is ChatMessage {
  const x = (m ?? {}) as Record<string, unknown>;
  return (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string';
}

function isAttachment(a: unknown): a is ChatAttachment {
  const x = (a ?? {}) as Record<string, unknown>;
  return typeof x.id === 'string' && (x.type === 'bead' || x.type === 'reading' || x.type === 'paper');
}

// Exactly what the model will receive — the renderer's "grounding context" disclosure shows this verbatim.
chatRouter.get('/api/chat/context', async (req, res) => {
  try {
    const { preload, systemPrompt } = await assembleScoped(Date.now(), readScope(req));
    res.json({ preload, systemPrompt, model: config.summary.ollama.model });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Unified attach registry: every bead/reading-item/paper, flattened for the multiselect.
chatRouter.get('/api/chat/registry', async (_req, res) => {
  try {
    res.json({ items: await getRegistry(Date.now()), generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

chatRouter.get('/api/chat/history', async (req, res) => {
  try {
    const { tab, unit } = readScope(req);
    res.json({ messages: await listHistory(chatThreadKey(tab, unit)) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Clears ONE thread — clearing a Northstar conversation never touches Leo's, or another unit's.
chatRouter.delete('/api/chat/history', async (req, res) => {
  try {
    const { tab, unit } = readScope(req);
    await clearHistory(chatThreadKey(tab, unit));
    res.json({ cleared: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Handoff Emission (ADR-0005): draft → preview → explicit Approve writes the real bead ──

chatRouter.post('/api/chat/handoff/draft', async (req, res) => {
  const body = (req.body ?? {}) as { messages?: unknown };
  const messages = Array.isArray(body.messages) ? body.messages.filter(isChatMessage) : [];
  if (messages.length === 0) {
    return res.status(400).json({ error: 'messages are required to draft a handoff' });
  }
  try {
    const result = await draftFromConversation(messages);
    res.status(result.status === 'ok' ? 200 : 422).json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

chatRouter.post('/api/chat/handoff/approve', async (req, res) => {
  const body = (req.body ?? {}) as { draftId?: unknown; edits?: DraftEdits };
  if (typeof body.draftId !== 'string') {
    return res.status(400).json({ error: 'draftId is required' });
  }
  try {
    const result = await approveDraft(body.draftId, body.edits);
    if (result.status === 'ok') {
      res.json({ written: true, path: result.path, beadId: result.beadId, draft: result.draft });
    } else {
      res.status(400).json({ written: false, errors: result.errors });
    }
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

chatRouter.delete('/api/chat/handoff/draft/:id', async (req, res) => {
  try {
    res.json({ rejected: await rejectDraft(req.params.id) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

chatRouter.get('/api/chat/handoff/drafts', async (_req, res) => {
  try {
    res.json({ drafts: await listDrafts() });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// SSE stream: meta → token* → (fallback?) → done. `done` is always the final event.
chatRouter.post('/api/chat', async (req, res) => {
  const body = (req.body ?? {}) as { messages?: unknown; attachments?: unknown };
  const messages = Array.isArray(body.messages) ? body.messages.filter(isChatMessage) : [];
  const attachments = Array.isArray(body.attachments) ? body.attachments.filter(isAttachment) : [];
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') {
    return res.status(400).json({ error: 'messages must end with a user message' });
  }

  const now = Date.now();
  const scope = readScope(req);
  const { preload, systemPrompt, fallback: floorText } = await assembleScoped(now, scope);
  // Attachments inject into the LATEST user message only (never replayed into prior turns).
  const resolved = await resolveAttachments(attachments, now);
  const lastForModel: ChatMessage = resolved.length
    ? { role: 'user', content: `${formatAttachmentBlock(resolved)}${last.content}` }
    : last;
  const model = config.summary.ollama.model;

  sseInit(res);
  sseSend(res, 'meta', {
    provider: 'ollama',
    model,
    contextGeneratedAt: preload.generatedAt,
    tab: scope.tab,
    ...(scope.unit ? { unit: scope.unit } : {}),
  });

  let assistantText = '';
  let fallback = false;
  if (config.summary.provider === 'off') {
    assistantText = floorText;
    fallback = true;
    sseSend(res, 'fallback', { reason: 'summary provider is off (set COCKPIT_SUMMARY_PROVIDER=ollama)', text: assistantText });
    sseSend(res, 'done', { finish: 'fallback' });
  } else {
    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(0, -1).slice(-(config.chat.maxTurns - 1)),
      lastForModel,
    ];
    try {
      const { finish } = await ollamaChatStream(llmMessages, (t) => {
        assistantText += t;
        sseSend(res, 'token', { text: t });
      });
      sseSend(res, 'done', { finish });
    } catch (err) {
      assistantText = floorText;
      fallback = true;
      sseSend(res, 'fallback', {
        reason: `ollama unreachable: ${err instanceof Error ? err.message : String(err)}`,
        text: assistantText,
      });
      sseSend(res, 'done', { finish: 'fallback' });
    }
  }
  sseEnd(res);

  const createdAt = new Date().toISOString();
  const userEntry: ChatHistoryEntry = {
    id: randomUUID(),
    role: 'user',
    content: last.content,
    createdAt,
    ...(attachments.length ? { attachmentIds: attachments.map((a) => a.id) } : {}),
  };
  const assistantEntry: ChatHistoryEntry = {
    id: randomUUID(),
    role: 'assistant',
    content: assistantText,
    createdAt,
    ...(fallback ? { fallback: true } : {}),
  };
  try {
    await appendExchange(chatThreadKey(scope.tab, scope.unit), userEntry, assistantEntry);
  } catch (err) {
    console.warn(`[chat] history persist failed: ${err instanceof Error ? err.message : String(err)}`);
  }
});
