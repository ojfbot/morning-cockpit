import { useState } from 'react';
import type { HandoffDraft } from '@cockpit/shared';
import { approveHandoff, rejectHandoff } from '../../api.js';

/**
 * Preview card for a staged handoff brief (ADR-0005). The draft is editable (title, to, body
 * sections); ONLY the explicit Approve button writes the real bead into the target repo's
 * .handoff/ — Reject discards with zero upstream writes.
 */
export function HandoffDraftCard({
  draft,
  onResolved,
}: {
  draft: HandoffDraft;
  onResolved: (outcome: 'approved' | 'rejected') => void;
}) {
  const [title, setTitle] = useState(draft.title);
  const [to, setTo] = useState(draft.to);
  const [context, setContext] = useState(draft.body.context);
  const [goal, setGoal] = useState(draft.body.goal);
  const [acceptance, setAcceptance] = useState(draft.body.acceptance.join('\n'));
  const [flagBack, setFlagBack] = useState(draft.body.flagBack ?? '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [written, setWritten] = useState<{ path: string; beadId: string } | null>(null);

  const approve = async () => {
    setBusy(true);
    setErrors([]);
    try {
      const res = await approveHandoff(draft.id, {
        title,
        to,
        body: {
          context,
          goal,
          acceptance: acceptance.split('\n').map((s) => s.trim()).filter(Boolean),
          flagBack: flagBack.trim() || undefined,
        },
      });
      if (res.written && res.path && res.beadId) {
        setWritten({ path: res.path, beadId: res.beadId });
        onResolved('approved');
      } else {
        setErrors(res.errors ?? ['approve failed']);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    setBusy(true);
    try {
      await rejectHandoff(draft.id);
      onResolved('rejected');
    } catch (err) {
      setErrors([err instanceof Error ? err.message : String(err)]);
    } finally {
      setBusy(false);
    }
  };

  if (written) {
    return (
      <div className="handoff-card written">
        <div className="handoff-head">
          <span className="handoff-tag">handoff emitted</span>
        </div>
        <p className="handoff-written">
          Wrote <code>{written.beadId}</code> — it will surface in the Beads pod on the next poll.
        </p>
        <p className="handoff-path">{written.path}</p>
      </div>
    );
  }

  return (
    <div className="handoff-card">
      <div className="handoff-head">
        <span className="handoff-tag">handoff draft — nothing written yet</span>
        <span className="handoff-meta">
          {draft.repo}/.handoff · {draft.provider} ({draft.model})
        </span>
      </div>

      <div className="handoff-fields">
        <label className="handoff-label">
          title
          <input className="handoff-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="handoff-label">
          to
          <input className="handoff-input" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="handoff-label">
          context
          <textarea className="handoff-area" rows={3} value={context} onChange={(e) => setContext(e.target.value)} />
        </label>
        <label className="handoff-label">
          goal
          <textarea className="handoff-area" rows={3} value={goal} onChange={(e) => setGoal(e.target.value)} />
        </label>
        <label className="handoff-label">
          acceptance criteria (one per line)
          <textarea className="handoff-area" rows={3} value={acceptance} onChange={(e) => setAcceptance(e.target.value)} />
        </label>
        <label className="handoff-label">
          flag back
          <textarea className="handoff-area" rows={2} value={flagBack} onChange={(e) => setFlagBack(e.target.value)} />
        </label>
      </div>

      <div className="handoff-frontmatter">
        <span>type: brief · status: live · actor: morning-cockpit-chat</span>
        <span>→ ~/ojfbot/{draft.repo}/.handoff/&lt;approve-time&gt;-brief-{draft.slug}.md</span>
      </div>

      {errors.length > 0 && (
        <ul className="handoff-errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <div className="handoff-actions">
        <button className="handoff-approve" onClick={() => void approve()} disabled={busy}>
          Approve — write the bead
        </button>
        <button className="handoff-reject" onClick={() => void reject()} disabled={busy}>
          Reject
        </button>
      </div>
    </div>
  );
}
