/**
 * Research context — trending papers (Hugging Face Daily Papers) surfaced as a distinct
 * cockpit section, each with a leveled AI explainer conditioned on a living reader profile.
 *
 * Read-only v1: papers come from HF; the reader profile is *re-derived* each refresh from the
 * user's evolving Claude memory index + selfco vault hub notes (see adapters/profile.ts). The
 * explainer relates each paper to the profile's cross-link nodes (mirroring the vault's
 * [[wikilink]] mesh); proposed links can be STAGED into the cockpit's own store but are never
 * written back to the vault here (that write-path is deferred — see ADR-0004 / ADR-0002).
 */

import type { AdapterHealth, SynthSummary } from './work-item.js';

export interface PaperItem {
  /** arXiv id (also the HF paper id), e.g. "2606.01000". */
  id: string;
  title: string;
  authors: string[];
  /** HF papers page (carries upvotes + discussion). */
  url: string;
  /** arXiv PDF — the source for the opt-in Claude deep-dive. */
  pdfUrl: string;
  abstract: string;
  publishedAt?: string;
  upvotes?: number;
  source: 'hf-daily';
}

/**
 * One node in the reader profile's cross-link graph. A `domain` node carries the path to its
 * selfco vault hub note (so the UI can open it via obsidian://) and/or its Claude memory file.
 */
export interface ProfileNode {
  /** Stable key the explainer cites in `relatedNodes` (e.g. "llm-tooling"). */
  key: string;
  label: string;
  kind: 'strength' | 'learning' | 'domain';
  note?: string;
  /** Vault-relative note path, e.g. "wiki/concepts/llm-tooling.md". */
  vaultPath?: string;
  /** Claude memory filename, e.g. "project_llm_tooling_domain.md". */
  memoryFile?: string;
  tags?: string[];
  /** True when this node currently appears in the vault's _hot router → actively in focus. */
  recent?: boolean;
}

/** A living model of what the reader knows / is learning / researches. Re-derived each refresh. */
export interface ReaderProfile {
  generatedAt: string;
  strengths: ProfileNode[];
  learning: ProfileNode[];
  domains: ProfileNode[];
}

/** A leveled explainer for one paper. `local` = abstract-level (qwen); `deep` = full-PDF (Claude). */
export interface PaperExplainer extends SynthSummary {
  paperId: string;
  tier: 'local' | 'deep';
  /** Profile node keys this paper connects to — surfaced as clickable cross-link chips. */
  relatedNodes: string[];
  /** Concepts to learn first to follow the paper. */
  prerequisites?: string[];
}

/** A proposed paper→concept cross-link the user can stage for later review (cockpit-local only). */
export interface CrossLinkSuggestion {
  id: string;
  paperId: string;
  paperTitle: string;
  nodeKey: string;
  nodeLabel: string;
  vaultPath?: string;
  rationale: string;
  status: 'staged' | 'dismissed';
  stagedAt: string;
}

export interface PapersSnapshot {
  generatedAt: string;
  papers: PaperItem[];
  profile: ReaderProfile;
  health: AdapterHealth[];
}

// ── Pure helpers (no I/O — unit-tested) ────────────────────────────────────

interface HfDailyEntry {
  title?: string;
  summary?: string;
  publishedAt?: string;
  paper?: {
    id?: string;
    title?: string;
    summary?: string;
    upvotes?: number;
    authors?: Array<{ name?: string }>;
  };
}

/** Normalize the HF /api/daily_papers response → top-N PaperItems by upvotes. */
export function normalizeHfDaily(json: unknown, count: number): PaperItem[] {
  const arr: unknown[] = Array.isArray(json) ? json : [];
  const items = arr
    .map((raw): PaperItem | null => {
      const e = (raw ?? {}) as HfDailyEntry;
      const p = e.paper ?? {};
      const id = typeof p.id === 'string' ? p.id : '';
      if (!id) return null;
      const authors = Array.isArray(p.authors)
        ? p.authors.map((a) => a?.name).filter((n): n is string => typeof n === 'string')
        : [];
      return {
        id,
        title: e.title ?? p.title ?? '(untitled)',
        authors,
        url: `https://huggingface.co/papers/${id}`,
        pdfUrl: `https://arxiv.org/pdf/${id}`,
        abstract: (e.summary ?? p.summary ?? '').trim(),
        publishedAt: typeof e.publishedAt === 'string' ? e.publishedAt : undefined,
        upvotes: typeof p.upvotes === 'number' ? p.upvotes : undefined,
        source: 'hf-daily',
      } satisfies PaperItem;
    })
    .filter((x): x is PaperItem => x !== null);
  items.sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0));
  return items.slice(0, Math.max(0, count));
}

/** A domain definition (from config), enriched by the adapter with live vault frontmatter. */
export interface DomainSeed {
  key: string;
  label: string;
  vaultPath?: string;
  memoryFile?: string;
  tags?: string[];
  /** Vault note frontmatter `status` (e.g. "growing"), if read from disk. */
  status?: string;
}

export interface ProfileInputs {
  generatedAt: string;
  /** Contents of the vault's wiki/_hot.md router (or '' if unreadable). */
  hotText: string;
  seedStrengths: Array<Omit<ProfileNode, 'kind'>>;
  seedLearning: Array<Omit<ProfileNode, 'kind'>>;
  domains: DomainSeed[];
}

/**
 * Assemble the reader profile from already-read inputs. Pure: the adapter does disk I/O and
 * passes contents in. A domain is flagged `recent` when its key appears in the _hot router —
 * that's the "evolving" signal: as the vault changes, the profile shifts with no code change.
 */
export function assembleProfile(inp: ProfileInputs): ReaderProfile {
  const hot = inp.hotText.toLowerCase();
  // The _hot router names domains three ways: slug, file path, and prose label. Match any —
  // matching only the slug silently misses real activity logged as "Systems Engineering".
  const isRecent = (d: DomainSeed): boolean =>
    [d.key, d.vaultPath, d.label].some((s) => typeof s === 'string' && s.length > 2 && hot.includes(s.toLowerCase()));
  const domains: ProfileNode[] = inp.domains.map((d) => ({
    key: d.key,
    label: d.label,
    kind: 'domain',
    note: d.status ? `vault: ${d.status}` : undefined,
    vaultPath: d.vaultPath,
    memoryFile: d.memoryFile,
    tags: d.tags,
    recent: isRecent(d),
  }));
  return {
    generatedAt: inp.generatedAt,
    strengths: inp.seedStrengths.map((s) => ({ ...s, kind: 'strength' as const })),
    learning: inp.seedLearning.map((s) => ({ ...s, kind: 'learning' as const })),
    domains,
  };
}

/** Deterministic explainer floor for one paper — always available, no model required. */
export function paperExplainerFloor(paper: PaperItem): PaperExplainer {
  const authorLine = paper.authors.length
    ? `${paper.authors.slice(0, 3).join(', ')}${paper.authors.length > 3 ? ' et al.' : ''}`
    : 'authors n/a';
  const abstract = paper.abstract.length > 320 ? `${paper.abstract.slice(0, 317)}…` : paper.abstract;
  return {
    paperId: paper.id,
    tier: 'local',
    source: 'deterministic',
    headline: paper.title,
    bullets: [
      authorLine,
      ...(paper.upvotes != null ? [`${paper.upvotes} upvote${paper.upvotes === 1 ? '' : 's'} on HF Daily Papers`] : []),
      ...(abstract ? [abstract] : []),
    ],
    action: 'Synthesize a leveled explainer with the local model, or open a Claude deep-dive.',
    relatedNodes: [],
  };
}

/** All profile node keys (for validating/filtering the explainer's relatedNodes). */
export function profileNodeKeys(profile: ReaderProfile): Set<string> {
  return new Set([...profile.strengths, ...profile.learning, ...profile.domains].map((n) => n.key));
}
