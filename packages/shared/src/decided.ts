/**
 * Decided-in-flight derivation (rm:rm-l1-morning-cockpit#S8) — the read side of the
 * decision→delivery seam.
 *
 * Approve & emit (ADR-0005) writes a successor brief whose frontmatter carries
 * `refs: [closes:<old-bead-id>]`, and mutates nothing else — bead `status:` transitions belong
 * to core's verbs. So between decision and delivery BOTH beads are `status: live`, and a read
 * side that only understands "delivered" double-counts the pair. Instead we derive the seam:
 * a live bead referenced by an OPEN bead's `closes:` ref is `decided-in-flight` — it leaves
 * the Briefing decision pool and folds under its successor as one chained Pickup item. When
 * the successor closes at delivery the derivation ends and the predecessor reads normally
 * again. Derivation, never bead mutation (liveness.ts precedent: derive from evidence, don't
 * trust stored status to tell the whole story).
 */

const CLOSES_PREFIX = 'closes:';

/** Extract the target ids of `closes:<id>` ref tokens; other kinds and blanks are ignored. */
export function parseClosesRefs(refs: readonly string[] | undefined): string[] {
  if (!refs) return [];
  const ids: string[] = [];
  for (const ref of refs) {
    if (typeof ref !== 'string' || !ref.startsWith(CLOSES_PREFIX)) continue;
    const id = ref.slice(CLOSES_PREFIX.length).trim();
    if (id) ids.push(id);
  }
  return ids;
}

/** Minimal projection of a scanned bead — just what the derivation needs (LaneInput precedent). */
export interface DecidedBead {
  id?: string;
  /** Raw frontmatter status (`live` is the only value that can derive). */
  status?: string;
  /** Adapter-computed open hook: a live brief no report responds to. */
  open: boolean;
  /** Raw `refs:` tokens from frontmatter. */
  refs?: string[];
  /** ISO created_at — tie-break when two open successors close the same bead. */
  createdAt?: string;
}

/** The folded predecessor carried on a successor WorkItem. Derived read-side, never stored. */
export interface ChainedPredecessor {
  nativeId: string;
  title: string;
  url?: string;
  createdAt?: string;
  state: 'decided-in-flight';
}

/**
 * Derive the decided-in-flight map: predecessor bead id → the open successor closing it.
 * Rules:
 *  - only OPEN beads' `closes:` refs count — a closed successor ends the derivation;
 *  - the referenced bead must be in the scan and itself live — dangling refs are no-ops,
 *    never a crash or a phantom;
 *  - self-references are ignored;
 *  - two open successors closing the same bead → latest created_at wins (deterministic).
 */
/**
 * The folded stack for an emitted successor: every bead that rides under it, transitively —
 * a successor may itself close a bead that closed another (live example: the S8 delivery brief
 * closes the pick-up brief which closes the northstar brief). Nearest link first; within one
 * depth, sorted by id for determinism. Cycle-safe via the seen set.
 */
export function foldedChainFor(successorId: string, decided: ReadonlyMap<string, string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>([successorId]);
  let frontier = [successorId];
  while (frontier.length > 0) {
    const level: string[] = [];
    for (const [pred, succ] of decided) {
      if (frontier.includes(succ) && !seen.has(pred)) {
        seen.add(pred);
        level.push(pred);
      }
    }
    level.sort();
    out.push(...level);
    frontier = level;
  }
  return out;
}

export function deriveDecidedInFlight(beads: readonly DecidedBead[]): Map<string, string> {
  const liveIds = new Set<string>();
  for (const b of beads) {
    if (b.id && b.status === 'live') liveIds.add(b.id);
  }

  const decided = new Map<string, string>(); // predecessor id → successor id
  const winnerCreated = new Map<string, number>(); // predecessor id → winning successor's created_at
  for (const b of beads) {
    if (!b.open || !b.id) continue;
    for (const target of parseClosesRefs(b.refs)) {
      if (target === b.id || !liveIds.has(target)) continue;
      const created = Date.parse(b.createdAt ?? '') || 0;
      const prev = winnerCreated.get(target);
      if (prev === undefined || created > prev) {
        decided.set(target, b.id);
        winnerCreated.set(target, created);
      }
    }
  }
  return decided;
}
