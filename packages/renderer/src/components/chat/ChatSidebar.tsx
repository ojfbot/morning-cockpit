import { useEffect, useRef, useState } from 'react';
import type { ChatAttachment, ChatHistoryEntry, ChatMessage, HandoffDraft } from '@cockpit/shared';
import {
  clearChatHistory,
  draftHandoff,
  fetchChatContext,
  fetchChatHistory,
  fetchHandoffDrafts,
  streamChat,
  type ChatContextResponse,
} from '../../api.js';
import { ChatComposer } from './ChatComposer.js';
import { ChatContextDisclosure } from './ChatContextDisclosure.js';
import { HandoffDraftCard } from './HandoffDraftCard.js';

/**
 * Cockpit Chat — a collapsible right sidebar (a fourth context, NOT a pod; ADR-0006).
 * Grounded discussion over the pods via local Ollama; honest deterministic fallback.
 */

const OPEN_KEY = 'cockpit-chat-open';

function initialOpen(): boolean {
  try {
    const stored = localStorage.getItem(OPEN_KEY);
    if (stored === 'open' || stored === 'closed') return stored === 'open';
  } catch {
    /* localStorage unavailable */
  }
  return false; // default collapsed (design: the rail is an open line, not a panel that eats width)
}

interface DisplayMessage extends ChatMessage {
  id: string;
  fallback?: boolean;
}

let localId = 0;
const nextId = () => `local-${++localId}`;

export function ChatSidebar() {
  const [open, setOpen] = useState<boolean>(initialOpen);
  const [loaded, setLoaded] = useState(false);
  const [context, setContext] = useState<ChatContextResponse | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<HandoffDraft | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draftNote, setDraftNote] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, open ? 'open' : 'closed');
    } catch {
      /* ignore */
    }
  }, [open]);

  // Load history + grounding context on first open.
  useEffect(() => {
    if (!open || loaded) return;
    let active = true;
    void (async () => {
      try {
        const [history, ctx, drafts] = await Promise.all([
          fetchChatHistory(),
          fetchChatContext(),
          fetchHandoffDrafts().catch(() => [] as HandoffDraft[]),
        ]);
        if (!active) return;
        setMessages(history.map((h: ChatHistoryEntry) => ({ id: h.id, role: h.role, content: h.content, fallback: h.fallback })));
        setContext(ctx);
        setDraft(drafts.find((d) => d.status === 'staged') ?? null); // restore a pending emission
        setLoaded(true);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      active = false;
    };
  }, [open, loaded]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamText]);

  const refreshContext = () => {
    void fetchChatContext()
      .then(setContext)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  };

  const send = async (text: string, attachments: ChatAttachment[]) => {
    const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
    const user: DisplayMessage = { id: nextId(), role: 'user', content: text };
    setMessages((prev) => [...prev, user]);
    setStreaming(true);
    setStreamText('');
    setError(null);

    let acc = '';
    let fallback = false;
    try {
      const stream = await streamChat([...history, { role: 'user', content: text }], attachments);
      for await (const evt of stream) {
        if (evt.event === 'token') {
          acc += (evt.data as { text: string }).text;
          setStreamText(acc);
        } else if (evt.event === 'fallback') {
          const d = evt.data as { reason: string; text: string };
          acc = d.text;
          fallback = true;
          setStreamText(acc);
        }
      }
      if (!acc) throw new Error('stream ended without content');
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: acc, fallback }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setStreaming(false);
      setStreamText(null);
    }
  };

  const clear = () => {
    void clearChatHistory()
      .then(() => setMessages([]))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  };

  // The chat's single action verb — explicit button, never triggered by message parsing.
  const startDraft = async () => {
    setDrafting(true);
    setDraftNote(null);
    try {
      const res = await draftHandoff(messages.map((m) => ({ role: m.role, content: m.content })));
      if (res.status === 'ok') setDraft(res.draft);
      else if (res.status === 'failed_validation') setDraftNote(`draft failed validation: ${res.errors.join('; ')}`);
      else setDraftNote(res.reason);
    } catch (err) {
      setDraftNote(err instanceof Error ? err.message : String(err));
    } finally {
      setDrafting(false);
    }
  };

  if (!open) {
    return (
      <aside className="chat-rail">
        <button className="chat-rail-toggle" onClick={() => setOpen(true)} title="Open cockpit chat" aria-label="Open cockpit chat">
          ❮ chat
        </button>
      </aside>
    );
  }

  return (
    <aside className="chat-sidebar">
      <header className="chat-head">
        <span className="chat-title">Cockpit Chat</span>
        <button
          className="chat-head-btn"
          onClick={() => void startDraft()}
          title="Distill this conversation into a handoff brief (you approve before anything is written)"
          disabled={streaming || drafting || draft?.status === 'staged' || messages.length === 0}
        >
          {drafting ? 'drafting…' : 'draft handoff'}
        </button>
        <button className="chat-head-btn" onClick={clear} title="Clear conversation" disabled={streaming || messages.length === 0}>
          clear
        </button>
        <button className="chat-head-btn" onClick={() => setOpen(false)} title="Collapse chat" aria-label="Collapse chat">
          ❯
        </button>
      </header>

      <ChatContextDisclosure context={context} onRefresh={refreshContext} />

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && streamText === null && (
          <p className="chat-empty">
            Pre-grounded in today's beads, reading, and papers — ask away. Answers come from the
            local model and cite real item titles.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            {m.fallback && <span className="chat-fallback-tag">deterministic fallback</span>}
            <div className="chat-msg-body">{m.content}</div>
          </div>
        ))}
        {streamText !== null && (
          <div className="chat-msg assistant streaming">
            <div className="chat-msg-body">{streamText || '…'}</div>
          </div>
        )}
        {draft && (
          <HandoffDraftCard
            key={draft.id}
            draft={draft}
            onResolved={(outcome) => {
              // rejected → card disappears; approved → confirmation stays, button re-enables
              setDraft(outcome === 'rejected' ? null : { ...draft, status: 'approved' });
            }}
          />
        )}
      </div>

      {draftNote && <p className="chat-error">handoff — {draftNote}</p>}
      {error && <p className="chat-error">chat error — {error}</p>}

      <ChatComposer disabled={streaming} onSend={(t, atts) => void send(t, atts)} />
    </aside>
  );
}
