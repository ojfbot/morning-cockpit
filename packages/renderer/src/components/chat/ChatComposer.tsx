import { useState, type KeyboardEvent } from 'react';
import type { ChatAttachment, ChatContextItem } from '@cockpit/shared';
import { AttachPicker } from './AttachPicker.js';

/**
 * Chat input bar: typed attachment chips + textarea. Enter sends, Shift+Enter newlines.
 * Attached items inject their full content into the NEXT prompt only; chips clear on send.
 */
export function ChatComposer({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string, attachments: ChatAttachment[]) => void;
}) {
  const [text, setText] = useState('');
  const [attached, setAttached] = useState<ChatContextItem[]>([]);

  const toggle = (item: ChatContextItem) => {
    setAttached((prev) =>
      prev.some((a) => a.id === item.id) ? prev.filter((a) => a.id !== item.id) : [...prev, item],
    );
  };

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed, attached.map((a) => ({ id: a.id, type: a.type })));
    setText('');
    setAttached([]);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="chat-composer-wrap">
      {attached.length > 0 && (
        <div className="chat-chips">
          {attached.map((a) => (
            <span key={a.id} className={`chat-chip ${a.type}`}>
              <span className="chat-chip-type">{a.type}</span>
              <span className="chat-chip-title">{a.title}</span>
              <button className="chat-chip-x" onClick={() => toggle(a)} aria-label={`Remove ${a.title}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="chat-composer">
        <AttachPicker selected={attached} onToggle={toggle} />
        <textarea
          className="chat-input"
          rows={2}
          value={text}
          placeholder="Ask about beads, reading, or papers…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="chat-send" onClick={send} disabled={disabled || !text.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
