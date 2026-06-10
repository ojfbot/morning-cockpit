import { useEffect, useState } from 'react';
import type { CrossLinkSuggestion, PaperItem, ProfileNode, ReaderProfile } from '@cockpit/shared';
import {
  fetchPapers,
  fetchPaperDeepDive,
  fetchPaperExplainer,
  fetchSuggestions,
  stageSuggestion,
  dismissSuggestion,
  type ExplainerResponse,
} from '../api.js';
import { Section } from './Section.js';
import { SummaryView } from './SummaryView.js';

const POLL_MS = 30 * 60_000;
const VAULT_NAME = 'selfco';

/** Build an obsidian:// deep link to a vault note (path is vault-relative, .md optional). */
function obsidianUrl(vaultPath: string): string {
  const file = vaultPath.replace(/\.md$/, '');
  return `obsidian://open?vault=${encodeURIComponent(VAULT_NAME)}&file=${encodeURIComponent(file)}`;
}

function ProfileStrip({ profile }: { profile: ReaderProfile }) {
  const chip = (n: ProfileNode, cls: string) => (
    <span key={`${n.kind}:${n.key}`} className={`profile-chip ${cls}${n.recent ? ' recent' : ''}`} title={n.label}>
      {n.label}
      {n.recent && <span className="profile-chip-dot" title="active in your working notes">●</span>}
    </span>
  );
  return (
    <div className="profile-strip">
      <span className="profile-strip-label">reading as</span>
      {profile.strengths.map((n) => chip(n, 'strength'))}
      {profile.learning.map((n) => chip(n, 'learning'))}
      {profile.domains.map((n) => chip(n, 'domain'))}
    </div>
  );
}

function PaperCard({
  paper,
  profile,
  onStaged,
  stagedKeys,
}: {
  paper: PaperItem;
  profile: ReaderProfile;
  onStaged: () => void;
  stagedKeys: Set<string>;
}) {
  const [explainer, setExplainer] = useState<ExplainerResponse | null>(null);
  const [loadingExpl, setLoadingExpl] = useState(false);
  const [deep, setDeep] = useState<ExplainerResponse | null>(null);
  const [loadingDeep, setLoadingDeep] = useState(false);
  const [showDeep, setShowDeep] = useState(false);

  // Lazily fetch the local explainer once (cached server-side by paper + profile signature).
  useEffect(() => {
    let active = true;
    setLoadingExpl(true);
    fetchPaperExplainer(paper.id, false)
      .then((e) => active && setExplainer(e))
      .catch(() => {})
      .finally(() => active && setLoadingExpl(false));
    return () => {
      active = false;
    };
  }, [paper.id]);

  const resynth = async () => {
    setLoadingExpl(true);
    try {
      setExplainer(await fetchPaperExplainer(paper.id, true));
    } catch {
      /* keep */
    } finally {
      setLoadingExpl(false);
    }
  };

  const runDeepDive = async (force = false) => {
    setShowDeep(true);
    setLoadingDeep(true);
    try {
      setDeep(await fetchPaperDeepDive(paper.id, force));
    } catch {
      /* keep */
    } finally {
      setLoadingDeep(false);
    }
  };

  const stage = async (node: ProfileNode) => {
    try {
      await stageSuggestion({
        paperId: paper.id,
        paperTitle: paper.title,
        nodeKey: node.key,
        nodeLabel: node.label,
        vaultPath: node.vaultPath,
        rationale: explainer?.explainer.headline ?? '',
      });
      onStaged();
    } catch {
      /* ignore */
    }
  };

  const related = (explainer?.explainer.relatedNodes ?? [])
    .map((key) => [...profile.domains, ...profile.strengths, ...profile.learning].find((n) => n.key === key))
    .filter((n): n is ProfileNode => Boolean(n));

  return (
    <article className="paper-card">
      <div className="paper-head">
        <a className="paper-title" href={paper.url} target="_blank" rel="noreferrer">
          {paper.title}
        </a>
        <div className="paper-meta">
          {paper.upvotes != null && <span className="paper-upvotes">▲ {paper.upvotes}</span>}
          <a href={paper.pdfUrl} target="_blank" rel="noreferrer">
            PDF
          </a>
          <a href={paper.url} target="_blank" rel="noreferrer">
            HF
          </a>
        </div>
      </div>
      {paper.authors.length > 0 && (
        <p className="paper-authors">
          {paper.authors.slice(0, 5).join(', ')}
          {paper.authors.length > 5 ? ' et al.' : ''}
        </p>
      )}

      <SummaryView
        tag="Explainer"
        summary={explainer?.explainer ?? { source: 'deterministic', headline: paper.title, bullets: ['Loading explainer…'] }}
        loading={loadingExpl}
        onSynthesize={resynth}
        disabled={explainer?.disabled === true}
        reason={explainer?.reason}
        error={explainer?.error}
      />

      {explainer?.explainer.prerequisites && explainer.explainer.prerequisites.length > 0 && (
        <p className="paper-prereqs">
          <span className="paper-prereqs-label">prereqs</span>
          {explainer.explainer.prerequisites.join(' · ')}
        </p>
      )}

      {related.length > 0 && (
        <div className="crosslinks">
          <span className="crosslinks-label">connects to</span>
          {related.map((node) => {
            const staged = stagedKeys.has(`${paper.id}:${node.key}`);
            return (
              <span key={node.key} className="crosslink-chip">
                {node.vaultPath ? (
                  <a href={obsidianUrl(node.vaultPath)} title={`Open ${node.vaultPath} in Obsidian`}>
                    {node.label}
                  </a>
                ) : (
                  <span>{node.label}</span>
                )}
                <button
                  className="crosslink-stage"
                  onClick={() => stage(node)}
                  disabled={staged}
                  title={staged ? 'Staged for review' : 'Stage this cross-link for review'}
                >
                  {staged ? '✓' : '+'}
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="paper-actions">
        <button className="deepdive-btn" onClick={() => runDeepDive(false)} disabled={loadingDeep}>
          {loadingDeep ? 'Reading PDF…' : showDeep ? '↻ Re-run deep dive' : '⌖ Deep dive (Sonnet, full PDF)'}
        </button>
      </div>

      {showDeep && (
        <div className="deepdive-panel">
          <SummaryView
            tag="Deep dive"
            summary={deep?.explainer ?? { source: 'deterministic', headline: paper.title, bullets: ['Reading the full PDF with Claude Sonnet…'] }}
            loading={loadingDeep}
            onSynthesize={() => runDeepDive(true)}
            disabled={deep?.disabled === true}
            reason={deep?.reason}
            error={deep?.error}
          />
        </div>
      )}
    </article>
  );
}

export function PapersSection() {
  const [snap, setSnap] = useState<Awaited<ReturnType<typeof fetchPapers>> | null>(null);
  const [suggestions, setSuggestions] = useState<CrossLinkSuggestion[]>([]);

  const loadSuggestions = () => {
    fetchSuggestions()
      .then(setSuggestions)
      .catch(() => {});
  };

  useEffect(() => {
    let active = true;
    const load = () =>
      fetchPapers()
        .then((s) => active && setSnap(s))
        .catch(() => {});
    void load();
    loadSuggestions();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const dismiss = async (id: string) => {
    try {
      await dismissSuggestion(id);
      loadSuggestions();
    } catch {
      /* ignore */
    }
  };

  const papers = snap?.papers ?? [];
  const profile = snap?.profile;
  const stagedKeys = new Set(suggestions.map((s) => `${s.paperId}:${s.nodeKey}`));

  return (
    <Section title="Research" subtitle={`HF Daily Papers — top ${papers.length} · explained for you`}>
      {profile && <ProfileStrip profile={profile} />}

      <div className="papers-grid">
        {papers.length === 0 ? (
          <div className="lane-empty">No trending papers right now.</div>
        ) : (
          profile &&
          papers.map((p) => (
            <PaperCard key={p.id} paper={p} profile={profile} onStaged={loadSuggestions} stagedKeys={stagedKeys} />
          ))
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="suggestions">
          <span className="suggestions-label">staged cross-links ({suggestions.length})</span>
          {suggestions.map((s) => (
            <span key={s.id} className="suggestion-chip" title={s.rationale}>
              {s.nodeLabel} ← <em>{s.paperTitle}</em>
              <button className="suggestion-dismiss" onClick={() => dismiss(s.id)} title="Dismiss">
                ×
              </button>
            </span>
          ))}
          <span className="suggestions-note">staged locally for review — not yet written to the vault</span>
        </div>
      )}
    </Section>
  );
}
