import { useEffect, useState } from 'react';
import type { ReadingSnapshot, SynthSummary } from '@cockpit/shared';
import { fetchReading, fetchReadingDigest, type ReadingDigestResponse } from '../api.js';
import { Section } from './Section.js';
import { SummaryView } from './SummaryView.js';

const POLL_MS = 5 * 60_000;

function relativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function ReadingSection() {
  const [snap, setSnap] = useState<ReadingSnapshot | null>(null);
  const [digest, setDigest] = useState<ReadingDigestResponse | null>(null);
  const [loadingDigest, setLoadingDigest] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchReading()
        .then((s) => active && setSnap(s))
        .catch(() => {});
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  // Fetch the local-model digest once a snapshot exists (cached server-side by item-set).
  useEffect(() => {
    if (!snap) return;
    let active = true;
    setLoadingDigest(true);
    fetchReadingDigest(false)
      .then((d) => active && setDigest(d))
      .catch(() => {})
      .finally(() => active && setLoadingDigest(false));
    return () => {
      active = false;
    };
  }, [snap?.since]);

  const synthesize = async () => {
    setLoadingDigest(true);
    try {
      setDigest(await fetchReadingDigest(true));
    } catch {
      /* keep */
    } finally {
      setLoadingDigest(false);
    }
  };

  const sources = snap?.sources ?? [];
  const withNew = sources.filter((s) => s.items.some((i) => i.isNew));
  const quiet = sources.filter((s) => !s.items.some((i) => i.isNew) && !s.error).map((s) => s.title);
  const errored = sources.filter((s) => s.error).map((s) => s.title);
  const floor: SynthSummary =
    snap?.digest ?? { source: 'deterministic', headline: 'Loading feeds…', bullets: [] };
  const newCount = withNew.reduce((n, s) => n + s.items.filter((i) => i.isNew).length, 0);

  return (
    <Section title="Reading" subtitle={`curated feeds — ${newCount} new since ${snap ? '48h' : '…'}`}>
      <SummaryView
        tag="Digest"
        summary={digest?.digest ?? floor}
        loading={loadingDigest}
        onSynthesize={synthesize}
        disabled={digest?.disabled === true}
        reason={digest?.reason}
        error={digest?.error}
      />

      <div className="reading-grid">
        {withNew.length === 0 ? (
          <div className="lane-empty">No new posts in the window.</div>
        ) : (
          withNew.map((s) => (
            <div className="reading-source" key={s.title}>
              <div className="reading-source-head">
                <a className="reading-source-name" href={s.siteUrl} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
                {s.tier && <span className="reading-tier">T{s.tier}</span>}
              </div>
              {s.items
                .filter((i) => i.isNew)
                .map((i) => (
                  <a className="reading-item" key={i.id} href={i.url} target="_blank" rel="noreferrer">
                    <span className="reading-item-title">{i.title}</span>
                    <span className="reading-item-meta">{relativeTime(i.publishedAt)}</span>
                  </a>
                ))}
            </div>
          ))
        )}
      </div>

      {(quiet.length > 0 || errored.length > 0) && (
        <p className="reading-quiet">
          {quiet.length > 0 && <>quiet: {quiet.join(', ')}</>}
          {errored.length > 0 && <span className="reading-err"> · unreachable: {errored.join(', ')}</span>}
        </p>
      )}
    </Section>
  );
}
