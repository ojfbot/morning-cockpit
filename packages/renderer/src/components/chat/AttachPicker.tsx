import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { ChatContextItem } from '@cockpit/shared';
import { fetchChatRegistry } from '../../api.js';

/**
 * Autocomplete MULTISELECT over the unified context registry (beads + reading + papers).
 * "+ Attach" opens a popover; filter-as-you-type; Enter toggles; the popover stays open so
 * several items can be attached before closing (Esc or click-away).
 */

const TYPE_ORDER = ['bead', 'reading', 'paper'] as const;
const TYPE_LABELS: Record<(typeof TYPE_ORDER)[number], string> = {
  bead: 'Beads',
  reading: 'Reading',
  paper: 'Papers',
};

export function AttachPicker({
  selected,
  onToggle,
}: {
  selected: ChatContextItem[];
  onToggle: (item: ChatContextItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChatContextItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fresh registry each open (it's cached server-side anyway).
  useEffect(() => {
    if (!open) return;
    setItems(null);
    setError(null);
    setQuery('');
    setCursor(0);
    void fetchChatRegistry()
      .then(setItems)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const hits = q
      ? items.filter((i) => `${i.title} ${i.repo ?? ''} ${i.subtitle ?? ''}`.toLowerCase().includes(q))
      : items;
    return TYPE_ORDER.flatMap((t) => hits.filter((i) => i.type === t)).slice(0, 40);
  }, [items, query]);

  const isSelected = (item: ChatContextItem) => selected.some((s) => s.id === item.id);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[cursor];
      if (item) onToggle(item);
    }
  };

  return (
    <div className="attach" ref={rootRef}>
      <button className="attach-btn" onClick={() => setOpen((o) => !o)} title="Attach beads, reading, or papers">
        + Attach
      </button>
      {open && (
        <div className="attach-pop">
          <input
            ref={inputRef}
            className="attach-filter"
            value={query}
            placeholder="filter by title, repo, source…"
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
          />
          <div className="attach-list">
            {error && <p className="attach-note">registry unavailable — {error}</p>}
            {!error && items === null && <p className="attach-note">loading…</p>}
            {!error && items !== null && filtered.length === 0 && <p className="attach-note">no matches</p>}
            {TYPE_ORDER.map((t) => {
              const group = filtered.filter((i) => i.type === t);
              if (group.length === 0) return null;
              return (
                <div key={t}>
                  <div className="attach-group">{TYPE_LABELS[t]}</div>
                  {group.map((item) => {
                    const idx = filtered.indexOf(item);
                    return (
                      <button
                        key={item.id}
                        className={`attach-item${idx === cursor ? ' cursor' : ''}${isSelected(item) ? ' selected' : ''}`}
                        onMouseEnter={() => setCursor(idx)}
                        onClick={() => onToggle(item)}
                      >
                        <span className="attach-item-title">{item.title}</span>
                        <span className="attach-item-sub">
                          {item.repo ? `${item.repo} · ` : ''}
                          {item.subtitle}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
