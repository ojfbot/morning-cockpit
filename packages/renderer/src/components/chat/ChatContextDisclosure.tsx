import type { ChatContextResponse } from '../../api.js';

/**
 * "Grounding context" disclosure — shows VERBATIM what the model receives as its system
 * prompt (Index Skeleton + Day-Goal Brief), so the preload is inspectable, not implied.
 */
export function ChatContextDisclosure({
  context,
  onRefresh,
}: {
  context: ChatContextResponse | null;
  onRefresh: () => void;
}) {
  return (
    <details className="chat-context">
      <summary className="chat-context-summary">
        grounding context{context ? ` · ${context.model}` : ''}
        <button
          className="chat-context-refresh"
          onClick={(e) => {
            e.preventDefault();
            onRefresh();
          }}
          title="Rebuild the preload from current caches"
        >
          ↻
        </button>
      </summary>
      <pre className="chat-context-body">{context ? context.systemPrompt : 'loading…'}</pre>
    </details>
  );
}
