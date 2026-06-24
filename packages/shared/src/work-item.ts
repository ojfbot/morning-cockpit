/**
 * WorkItem — the unified view-model. Every source (Dolt beads, .handoff briefs, GitHub,
 * frame-standup) normalizes into this shape so the renderer is source-agnostic.
 */

export type WorkItemSource = 'dolt-bead' | 'handoff-bead' | 'github' | 'standup';

export type WorkItemLane = 'overnight' | 'pickup' | 'available';

export type WorkItemKind =
  | 'agent' | 'convoy' | 'task' | 'pr' | 'session' // dolt
  | 'brief' | 'report' | 'decision' | 'discovery'  // handoff
  | 'issue' | 'pull_request'                        // github
  | 'priority'                                      // standup
  | 'generic';

/** Normalized status across all sources. */
export type WorkItemStatus =
  | 'running' // active agent/convoy/session, in-flight
  | 'open'    // live brief, open issue/PR, live task — actionable
  | 'done'    // closed/merged
  | 'stale'   // open but past the staleness threshold
  | 'failed'
  | 'unknown';

export type WorkItemDetail =
  | { kind: 'convoy'; convoyStatus: string; total: number; done: number; active: number; pending: number; failed: number; pct: number }
  | { kind: 'agent'; role: string; app: string; agentStatus: string; reportsTo?: string; sessionId?: string }
  | { kind: 'pr'; prNumber?: number; draft?: boolean }
  | { kind: 'issue'; issueNumber: number; labels: string[]; isNew?: boolean }
  | { kind: 'brief'; to?: string; hook?: string; openHook: boolean }
  | { kind: 'priority'; level: 'P0' | 'P1' | 'P2'; command?: string }
  | { kind: 'generic' };

export interface WorkItem {
  /** Globally unique within the cockpit: `${source}:${nativeId}`. */
  id: string;
  /** Native id in the source system (bead id, `repo#123`, handoff filename). */
  nativeId: string;

  source: WorkItemSource;
  kind: WorkItemKind;
  status: WorkItemStatus;
  /** Which of the three lanes this item belongs in (computed). */
  lane: WorkItemLane;

  title: string;
  repo?: string;
  actor?: string;

  /** ISO 8601. updatedAt drives staleness; activityAt drives overnight + sort. */
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string;
  /** The single timestamp that placed this item in its lane (also the sort key). */
  activityAt: string;

  /** Whole days since the relevant timestamp; undefined if N/A. */
  staleDays?: number;

  /**
   * True when this is a REAL unassigned-queue item (`labels.queue === 'available'`, posted via
   * core `queue-post` — ADR-0002/S3), vs an Available-lane item synthesized from open issues/briefs
   * or an unhooked task. Drives the "posted" badge; synthesized items are labelled as such.
   */
  posted?: boolean;

  /** Deep link: GitHub URL, file:// path to a .handoff md, or in-app anchor. */
  url?: string;

  detail: WorkItemDetail;

  provenance: {
    sourcePath?: string;
    labels?: Record<string, string>;
    refs?: string[];
  };
}

/** Per-adapter health, surfaced via /api/health and the renderer HealthBar. */
export interface AdapterHealth {
  /** Adapter label, e.g. a WorkItemSource ('dolt-bead') or a section name ('reading'). */
  name: string;
  status: 'up' | 'down' | 'degraded' | 'disabled';
  itemCount: number;
  /** Adapter-specific note, e.g. "3 repos, 1 file skipped" or "dolt: ECONNREFUSED". */
  note?: string;
  lastError?: string;
}

/** The full payload served by GET /api/cockpit. */
export interface CockpitSnapshot {
  generatedAt: string;
  /** The boundary used for the overnight lane (ISO), surfaced in the UI for legibility. */
  overnightSince: string;
  lanes: {
    overnight: WorkItem[];
    pickup: WorkItem[];
    available: WorkItem[];
  };
  health: AdapterHealth[];
  /** Deterministic per-lane summaries (always present; LLM version fetched separately). */
  summaries: {
    overnight: LaneSummary;
    pickup: LaneSummary;
    available: LaneSummary;
  };
  meta: {
    totalItems: number;
    skipped: number;
  };
}

/**
 * A human-readable synthesized summary — shared by the bead lanes and the reading digest.
 * Same shape whether produced deterministically or by a model.
 */
export interface SynthSummary {
  source: 'deterministic' | 'llm';
  /** One-line framing. */
  headline: string;
  /** Prose lede (2-4 sentences). Only the LLM exec-summary fills this; deterministic omits it. */
  overview?: string;
  /** Key points. Deterministic: terse phrases. LLM: substantive full sentences. */
  bullets: string[];
  /** Recommended action / next moves (optional for non-lane digests). */
  action?: string;
  /** Set when source === 'llm': which backend produced it ('ollama' | 'claude'). */
  provider?: string;
  /** Set when source === 'llm': the model id. */
  model?: string;
  generatedAt?: string;
}

/** A bead-lane summary — a SynthSummary bound to a lane, with a required action. */
export interface LaneSummary extends SynthSummary {
  lane: WorkItemLane;
  action: string;
}
