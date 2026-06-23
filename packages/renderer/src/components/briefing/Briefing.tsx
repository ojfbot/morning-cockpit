import { useEffect, useState } from 'react';
import type { BriefingBranch, BriefingThread, BriefingTag } from '@cockpit/shared';
import type { CockpitUiState } from '../../cockpitState.js';
import { fetchBriefing } from '../../api.js';
import { Section } from '../Section.js';
import { HandoffArtifactCard } from './HandoffArtifactCard.js';
import { MOCK_THREADS } from './threads.js';

const TAG_LABEL: Record<BriefingTag, string> = {
  decision: 'Decision needed',
  stale: 'Going stale',
  quickwin: 'Quick win',
};

/** Which core verb a branch maps to, and whether that verb exists yet (Slice 2 = handoff only). */
function intentFor(branch: BriefingBranch): { verb: string; built: boolean } {
  if (branch.type === 'defer') return { verb: 'bead-snooze', built: false };
  if (branch.type === 'archive') return { verb: 'bead-archive', built: false };
  if (branch.key === 'green') return { verb: 'repo-scaffold', built: false };
  return { verb: 'handoff-emit', built: true };
}

/**
 * 00 · Briefing — the Chief-of-Staff console (ADR-0007). Each seeded thread resolves through a
 * decision tree into an approvable Handoff Artifact. UI state (active thread / chosen / approved
 * branch) is local + persisted (mc.cockpit.v1); the threads are a typed mock until Slice 3 wires
 * the generator. Deliver branches emit for real via the gated handoff write path.
 */
export function Briefing({
  ui,
  setUi,
}: {
  ui: CockpitUiState;
  setUi: (fn: (s: CockpitUiState) => CockpitUiState) => void;
}) {
  const [threads, setThreads] = useState<BriefingThread[]>(MOCK_THREADS);
  const [source, setSource] = useState<'llm' | 'deterministic' | 'loading'>('loading');

  const load = (force = false) => {
    setSource('loading');
    fetchBriefing(force)
      .then((b) => {
        if (b.threads.length > 0) setThreads(b.threads);
        setSource(b.source);
      })
      .catch(() => setSource('deterministic'));
  };

  useEffect(() => {
    let active = true;
    fetchBriefing()
      .then((b) => {
        if (!active) return;
        if (b.threads.length > 0) setThreads(b.threads);
        setSource(b.source);
      })
      .catch(() => active && setSource('deterministic'));
    return () => {
      active = false;
    };
  }, []);

  const active = threads.find((t) => t.id === ui.activeId) ?? threads[0];
  if (!active) return null;

  const recommended = active.branches.find((b) => b.recommended) ?? active.branches[0];
  const chosenKey = ui.chosen[active.id] ?? recommended?.key;
  const chosen = active.branches.find((b) => b.key === chosenKey) ?? recommended;
  const approvedKey = ui.approved[active.id];

  const selectThread = (id: string) => setUi((s) => ({ ...s, activeId: id }));
  const chooseBranch = (key: string) =>
    setUi((s) => ({
      ...s,
      chosen: { ...s.chosen, [active.id]: key },
      approved: { ...s.approved, [active.id]: '' }, // switching branch clears any approval
    }));
  const approveBranch = (key: string) =>
    setUi((s) => ({ ...s, approved: { ...s.approved, [active.id]: key } }));
  const undoBranch = () => setUi((s) => ({ ...s, approved: { ...s.approved, [active.id]: '' } }));

  return (
    <Section
      index="00"
      kicker="BRIEFING"
      title="The First Move"
      caption={
        <span className="section-caption">
          <button
            className="briefing-source"
            onClick={() => load(true)}
            disabled={source === 'loading'}
            title="Regenerate the briefing from the latest snapshot"
          >
            {source === 'loading'
              ? '↻ generating…'
              : source === 'llm'
                ? '✨ Chief of Staff · ↻'
                : 'deterministic · ↻'}
          </button>
          <br />
          every thread ends in a handoff artifact
        </span>
      }
    >
      <div className="briefing">
        <div className="briefing-band">
        {/* Left — seeded thread rail */}
        <nav className="briefing-rail">
          <div className="briefing-rail-head">Seeded threads — {threads.length}</div>
          {threads.map((t) => (
            <button
              key={t.id}
              className={`thread${t.id === active.id ? ' thread--active' : ''}`}
              onClick={() => selectThread(t.id)}
            >
              <span className={`thread-tag thread-tag--${t.tag}`}>{TAG_LABEL[t.tag]}</span>
              <span className="thread-title">{t.title}</span>
              <span className="thread-why">{t.whyNow}</span>
            </button>
          ))}
        </nav>

        {/* Right — conversation */}
        <div className="briefing-convo">
          <header className="convo-head">
            <span className="convo-dot" />
            <span className="convo-who">Chief of Staff</span>
            <span className="convo-id">briefing · {active.id}</span>
          </header>

          <div className="convo-catchup">
            <span className="convo-kicker">Catch-up</span>
            <p>{active.catchUp}</p>
          </div>

          <div className="convo-decision">
            <span className="convo-kicker convo-kicker--red">Decision</span>
            <p className="convo-question">{active.question}</p>

            <div className="branches">
              {active.branches.map((b) => {
                const isChosen = b.key === chosenKey;
                return (
                  <button
                    key={b.key}
                    className={`branch${isChosen ? ' branch--chosen' : ''}`}
                    onClick={() => chooseBranch(b.key)}
                  >
                    <span className="branch-label">{b.label}</span>
                    {b.recommended && <span className="branch-rec">Recommended</span>}
                  </button>
                );
              })}
            </div>

            {chosen && <BranchReveal branch={chosen} approved={approvedKey === chosen.key} onApprove={() => approveBranch(chosen.key)} onUndo={undoBranch} />}
          </div>
        </div>
        </div>

        {/* Composer (re-draft / go deeper — wired in a later slice) */}
        <div className="composer">
          <div className="composer-context">▸ context · this thread · grounded on today's snapshot</div>
          <div className="composer-bar">
            <textarea className="composer-input" placeholder="Re-draft, go deeper, or change the framing…" rows={1} disabled />
            <button className="composer-send" disabled title="Composer wiring lands with the chat rail (Slice 6)">
              Send
            </button>
          </div>
        </div>
      </div>
    </Section>
  );
}

function BranchReveal({
  branch,
  approved,
  onApprove,
  onUndo,
}: {
  branch: BriefingBranch;
  approved: boolean;
  onApprove: () => void;
  onUndo: () => void;
}) {
  const intent = intentFor(branch);

  if (branch.type === 'deliver' && branch.artifact) {
    return (
      <HandoffArtifactCard
        artifact={branch.artifact}
        approved={approved}
        onApprove={onApprove}
        onUndo={onUndo}
        emittable={intent.built}
      />
    );
  }

  // defer / archive — outcome note + an honestly-disabled CTA until the core verb exists (§6).
  return (
    <div className="outcome">
      <p className="outcome-note">{branch.outcome}</p>
      <div className="outcome-actions">
        <button className="outcome-cta" disabled title={`${intent.verb} not built yet — coordination-design §6`}>
          {branch.cta}
        </button>
        <span className="artifact-blocked">{intent.verb} verb not built (§6)</span>
      </div>
    </div>
  );
}
