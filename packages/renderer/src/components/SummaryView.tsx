import type { SynthSummary } from '@cockpit/shared';

/**
 * Presentational summary panel — headline + overview + bullets + action + source badge.
 * Shared by the bead lanes (LaneSummaryPanel) and the reading digest (ReadingSection).
 * Stateless: the parent owns fetching and passes the resolved summary + flags.
 */
export function SummaryView({
  tag,
  summary,
  loading = false,
  onSynthesize,
  disabled = false,
  reason,
  error,
}: {
  tag: string;
  summary: SynthSummary;
  loading?: boolean;
  onSynthesize?: () => void;
  disabled?: boolean;
  reason?: string;
  error?: string;
}) {
  const isLlm = summary.source === 'llm';
  return (
    <section className={`summary${loading ? ' summary-loading' : ''}`}>
      <div className="summary-head">
        <span className="summary-tag">{tag}</span>
        <span className={`summary-source ${isLlm ? 'claude' : 'auto'}`}>
          {isLlm ? `✨ ${summary.provider ?? 'llm'} (${summary.model ?? 'synth'})` : 'auto'}
        </span>
        {!disabled && onSynthesize && (
          <button className="summary-btn" onClick={onSynthesize} disabled={loading} title="Re-synthesize with the local model">
            {loading ? '…' : '✨ Synthesize'}
          </button>
        )}
      </div>
      <p className="summary-headline">{summary.headline}</p>
      {summary.overview && <p className="summary-overview">{summary.overview}</p>}
      <ul className="summary-bullets">
        {summary.bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
      {summary.action && <p className="summary-action">→ {summary.action}</p>}
      {disabled && <p className="summary-note">Synthesis disabled — {reason ?? 'showing auto summary'}.</p>}
      {error && <p className="summary-note">Local model unavailable — showing auto summary. ({error})</p>}
    </section>
  );
}
