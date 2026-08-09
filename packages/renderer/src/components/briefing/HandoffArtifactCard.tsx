import { useState } from 'react';
import type { BriefingArtifact } from '@cockpit/shared';
import { emitBriefingArtifact, claimTask } from '../../api.js';

type EmitState =
  | { phase: 'draft' }
  | { phase: 'emitting' }
  | { phase: 'emitted'; path?: string; beadId?: string; claimNote?: string }
  | { phase: 'error'; errors: string[] };

/**
 * Markdown-ledger bead ids (date-stamped .handoff filenames) and Dolt bead ids are
 * DISJOINT namespaces. queue-claim only knows Dolt ids — calling it with a handoff id
 * is a guaranteed no-op that used to be swallowed by an empty .catch, so the operator
 * believed routing happened when nothing did. A claim that silently fails is worse
 * than no claim mechanism.
 */
const isHandoffBeadId = (id: string) => /^\d{4}-?\d{2}-?\d{2}/.test(id);

/**
 * The terminal state of a deliver branch: a draft Handoff Artifact. Approve & emit reuses the
 * gated handoff write path (POST /api/briefing/emit → ADR-0005). On success it flips to a green
 * EMITTED state with Undo (clears the approval — the file stays written; Undo only resets the UI).
 */
export function HandoffArtifactCard({
  artifact,
  approved,
  onApprove,
  onUndo,
  emittable,
}: {
  artifact: BriefingArtifact;
  approved: boolean;
  onApprove: () => void;
  onUndo: () => void;
  /** false for the repo-scaffold case (target repo does not exist yet — §6). */
  emittable: boolean;
}) {
  const [state, setState] = useState<EmitState>(approved ? { phase: 'emitted' } : { phase: 'draft' });

  const emit = async () => {
    setState({ phase: 'emitting' });
    try {
      const res = await emitBriefingArtifact(artifact);
      if (res.written) {
        // Emit defines + delegates the work; also TAKE OWNERSHIP of the bead it closes (S4
        // auto-claim). Best-effort: a lost/failed claim doesn't undo the written brief —
        // but a failed claim is SAID, never swallowed, and handoff-namespace ids are not
        // sent to the Dolt claim at all (wave-2 /api/handoff/claim is where that lands).
        let claimNote: string | undefined;
        if (artifact.closes) {
          if (isHandoffBeadId(artifact.closes)) {
            claimNote = `bead ${artifact.closes} not claimed — handoff-ledger claim verb not built yet`;
          } else {
            try {
              await claimTask(artifact.closes);
            } catch (e) {
              claimNote = `claim of ${artifact.closes} failed: ${e instanceof Error ? e.message : String(e)}`;
            }
          }
        }
        setState({ phase: 'emitted', path: res.path, beadId: res.beadId, claimNote });
        onApprove();
      } else {
        setState({ phase: 'error', errors: res.errors ?? ['emit refused'] });
      }
    } catch (err) {
      setState({ phase: 'error', errors: [err instanceof Error ? err.message : String(err)] });
    }
  };

  const undo = () => {
    setState({ phase: 'draft' });
    onUndo();
  };

  const emitted = state.phase === 'emitted';

  return (
    <div className={`artifact${emitted ? ' artifact--emitted' : ''}`}>
      <div className="artifact-head">
        <span className="artifact-tag">{emitted ? '✓ Emitted' : 'Handoff Artifact · Draft'}</span>
        <span className="artifact-target">{artifact.target}</span>
      </div>

      {emitted ? (
        <div className="artifact-emitted">
          <p>
            Brief written to <code>{state.phase === 'emitted' && state.path ? state.path : artifact.target}</code>.
            The delivery task is spawned with its acceptance criteria — meeting them closes{' '}
            <strong>{artifact.closes}</strong>.
          </p>
          {state.phase === 'emitted' && state.claimNote && (
            <p className="artifact-claim-note">⚠ {state.claimNote}</p>
          )}
          <button className="artifact-undo" onClick={undo}>
            Undo
          </button>
        </div>
      ) : (
        <>
          <h4 className="artifact-title">{artifact.title}</h4>
          <Field label="Align">{artifact.align}</Field>
          <Field label="Delivery task">{artifact.task}</Field>
          <div className="artifact-field">
            <span className="artifact-label">Acceptance criteria</span>
            <ul className="artifact-criteria">
              {artifact.criteria.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
          <p className="artifact-foot">On delivery → closes {artifact.closes}</p>

          {state.phase === 'error' && (
            <ul className="artifact-errors">
              {state.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}

          <div className="artifact-actions">
            <button
              className="artifact-approve"
              onClick={() => void emit()}
              disabled={!emittable || state.phase === 'emitting'}
              title={emittable ? 'Write the brief into the target repo' : 'repo-scaffold not built yet — coordination-design §6'}
            >
              {state.phase === 'emitting' ? 'Emitting…' : 'Approve & emit →'}
            </button>
            {!emittable && <span className="artifact-blocked">repo-scaffold verb not built (§6)</span>}
          </div>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="artifact-field">
      <span className="artifact-label">{label}</span>
      <p className="artifact-value">{children}</p>
    </div>
  );
}
