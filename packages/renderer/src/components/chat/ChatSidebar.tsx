import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChatAttachment, ChatHistoryEntry, ChatMessage, ChatTab, HandoffDraft } from '@cockpit/shared';
import {
  clearChatHistory,
  draftHandoff,
  fetchChatContext,
  fetchChatHistory,
  fetchHandoffDrafts,
  streamChat,
  type ChatContextResponse,
  type ChatScope,
} from '../../api.js';
import { ChatComposer } from './ChatComposer.js';
import { ChatContextDisclosure } from './ChatContextDisclosure.js';
import { HandoffDraftCard } from './HandoffDraftCard.js';

/**
 * Cockpit Chat — a collapsible right sidebar (a fourth context, NOT a pod; ADR-0006).
 * Grounded discussion over the pods via local Ollama; honest deterministic fallback.
 *
 * S9: two tabs. `leo` is the original global chief-of-staff thread, unchanged. `northstar` is
 * scoped to the focused Fleet unit — pivoting the tile pivots the conversation, and each unit
 * keeps its own thread server-side.
 */

interface DisplayMessage extends ChatMessage {
  id: string;
  fallback?: boolean;
}

const TAB_LABEL: Record<ChatTab, string> = { leo: 'Leo', northstar: 'Northstar' };

/**
 * Whether the loaded Northstar grounding actually found a registered northstar.
 * `undefined` = context not loaded yet (say nothing rather than guess).
 */
function northstarGrounded(context: ChatContextResponse | null): boolean | undefined {
  if (!context) return undefined;
  const p = context.preload as { grounded?: unknown };
  return typeof p.grounded === 'boolean' ? p.grounded : undefined;
}

let localId = 0;
const nextId = () => `local-${++localId}`;

export function ChatSidebar({
  open,
  onOpenChange,
  tab,
  onTabChange,
  selectedRepo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: ChatTab;
  onTabChange: (tab: ChatTab) => void;
  selectedRepo: string;
}) {
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

  // The conversation this sidebar currently addresses. Northstar re-scopes with the Fleet tile.
  const scope: ChatScope = useMemo(
    () => (tab === 'northstar' ? { tab, repo: selectedRepo } : { tab: 'leo' }),
    [tab, selectedRepo],
  );
  const scopeId = tab === 'northstar' ? `northstar:${selectedRepo}` : 'leo';

  // Switching tab or focused unit is a different thread: drop the view and reload.
  useEffect(() => {
    setLoaded(false);
    setMessages([]);
    setContext(null);
    setError(null);
    setStreamText(null);
  }, [scopeId]);

  // Load history + grounding context on first open of each thread.
  useEffect(() => {
    if (!open || loaded) return;
    let active = true;
    void (async () => {
      try {
        const [history, ctx, drafts] = await Promise.all([
          fetchChatHistory(scope),
          fetchChatContext(scope),
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
  }, [open, loaded, scope]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streamText]);

  const refreshContext = () => {
    void fetchChatContext(scope)
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
      const stream = await streamChat([...history, { role: 'user', content: text }], attachments, scope);
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
    void clearChatHistory(scope)
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
        <button className="chat-rail-toggle" onClick={() => onOpenChange(true)} title="Open cockpit chat" aria-label="Open cockpit chat">
          ▸ Ask the Chief of Staff
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
        <button className="chat-head-btn" onClick={() => onOpenChange(false)} title="Collapse chat" aria-label="Collapse chat">
          ❯
        </button>
      </header>

      <div className="chat-tabs" role="tablist" aria-label="Conversation">
        {(['leo', 'northstar'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`chat-tab${tab === t ? ' chat-tab--on' : ''}`}
            onClick={() => onTabChange(t)}
            disabled={streaming}
            title={
              t === 'northstar'
                ? `Compass conversation for ${selectedRepo} — follows the focused Fleet tile`
                : 'Chief of staff — beads, reading, papers'
            }
          >
            {TAB_LABEL[t]}
            {t === 'northstar' && <span className="chat-tab-unit"> · {selectedRepo}</span>}
          </button>
        ))}
      </div>

      <ChatContextDisclosure context={context} onRefresh={refreshContext} />

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && streamText === null && tab === 'leo' && (
          <p className="chat-empty">
            Pre-grounded in today's beads, reading, and papers — ask away. Answers come from the
            local model and cite real item titles.
          </p>
        )}
        {messages.length === 0 && streamText === null && tab === 'northstar' && (
          <p className="chat-empty">
            {northstarGrounded(context) === false ? (
              <>
                No northstar <em>with a roadmap</em> is surfaced for <strong>{selectedRepo}</strong>.
                That isn't proof it has none — the cockpit reads northstar+roadmap pairs, so an app
                whose northstar has no roadmap yet looks the same from here. Check core's registry
                to tell them apart.
              </>
            ) : (
              <>
                Grounded in <strong>{selectedRepo}</strong>'s compass — properties, honest currents,
                roadmap slices, and recorded movement. Every number is read off disk. This tab can
                propose slice <em>intent</em>; it never writes entrance, success, or check.
              </>
            )}
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

      <ChatComposer
        disabled={streaming}
        onSend={(t, atts) => void send(t, atts)}
        placeholder={
          tab === 'northstar'
            ? `Ask about ${selectedRepo}'s properties, currents, or gap…`
            : 'Ask about beads, reading, or papers…'
        }
      />
    </aside>
  );
}
