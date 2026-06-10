import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';

/**
 * Personal reader-profile data (vault path, self-described strengths/learning, research domains)
 * is NOT committed — it loads from a gitignored local file so this repo stays public-safe.
 * Copy `profile.local.example.json` → `profile.local.json` and fill in your own. Override the
 * path with COCKPIT_PROFILE_FILE.
 */
interface ProfileLocal {
  vaultRoot?: string;
  memoryDir?: string;
  seed?: { strengths?: Array<{ key: string; label: string }>; learning?: Array<{ key: string; label: string }> };
  domainHubs?: Array<{ key: string; label: string; vaultPath?: string; memoryFile?: string }>;
}

function loadProfileLocal(): ProfileLocal {
  const file = process.env.COCKPIT_PROFILE_FILE ?? path.join(process.cwd(), 'profile.local.json');
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as ProfileLocal;
  } catch {
    return {}; // no local profile → safe empty defaults (cross-link feature simply has no nodes)
  }
}
const profileLocal = loadProfileLocal();

/** All tunables in one place. Env overrides keep secrets/paths out of code. */
export const config = {
  port: Number(process.env.COCKPIT_PORT ?? 3040),

  /** Overnight window boundary hour (local). Default 18:00 yesterday-evening. */
  overnightBoundaryHour: Number(process.env.COCKPIT_OVERNIGHT_HOUR ?? 18),

  /** Open available items older than this (days) are flagged stale. */
  staleThresholdDays: Number(process.env.COCKPIT_STALE_DAYS ?? 14),

  dolt: {
    host: process.env.COCKPIT_DOLT_HOST ?? '127.0.0.1',
    port: Number(process.env.COCKPIT_DOLT_PORT ?? 3307),
    user: process.env.COCKPIT_DOLT_USER ?? 'root',
    password: process.env.COCKPIT_DOLT_PASSWORD ?? '',
    /** Dolt db name; derived from the ~/.beads-dolt directory (leading dot is real). Overridable. */
    database: process.env.COCKPIT_DOLT_DB ?? '.beads-dolt',
    connectTimeoutMs: 800,
  },

  handoff: {
    /** Glob root for per-repo .handoff dirs. */
    repoRoot: process.env.COCKPIT_REPO_ROOT ?? path.join(os.homedir(), 'ojfbot'),
  },

  /** Cockpit's OWN local state (staged cross-link suggestions). The only write surface. */
  paths: {
    dataDir: process.env.COCKPIT_DATA_DIR ?? path.join(process.cwd(), '.data'),
  },

  /** Per-source cache TTLs (ms). */
  ttl: {
    dolt: 10_000,
    handoff: 15_000,
  },

  /**
   * Lane-summary synthesis. Local-first: default provider is self-hosted Ollama, so the
   * read-model stays offline by default (ADR-0003). Claude is explicit opt-in; there is NO
   * automatic cloud cascade — a local failure falls back to the deterministic summary.
   */
  summary: {
    provider: (process.env.COCKPIT_SUMMARY_PROVIDER ?? 'ollama') as 'ollama' | 'claude' | 'off',
    /** ~500-word executive summary ≈ 700 tokens + JSON overhead; headroom for safety. */
    maxTokens: Number(process.env.COCKPIT_SUMMARY_MAX_TOKENS ?? 1800),
    /** Hard timeout for a synthesis call before falling back to deterministic. */
    timeoutMs: Number(process.env.COCKPIT_SUMMARY_TIMEOUT_MS ?? 45_000),
    ollama: {
      url: process.env.COCKPIT_OLLAMA_URL ?? 'http://localhost:11434',
      model: process.env.COCKPIT_OLLAMA_MODEL ?? 'qwen2.5:7b',
    },
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? '',
      model: process.env.COCKPIT_SUMMARY_MODEL ?? 'claude-haiku-4-5-20251001',
    },
  },

  /**
   * Reading context — curated RSS feeds surfaced as their own cockpit section. Mirrors
   * morning-cockpit/reading.opml. Read-only: "new" is published-within-sinceHours.
   */
  reading: {
    sinceHours: Number(process.env.COCKPIT_READING_SINCE_HOURS ?? 48),
    perSource: Number(process.env.COCKPIT_READING_PER_SOURCE ?? 8),
    fetchTimeoutMs: 8_000,
    ttlMs: 30 * 60_000,
    feeds: [
      { title: 'Steve Yegge', feedUrl: 'https://steveyegge.substack.com/feed', siteUrl: 'https://steveyegge.substack.com', tier: '0' },
      { title: 'Andrej Karpathy', feedUrl: 'https://karpathy.github.io/feed.xml', siteUrl: 'https://karpathy.github.io', tier: '0' },
      { title: 'Karpathy (Bear)', feedUrl: 'https://karpathy.bearblog.dev/feed/', siteUrl: 'https://karpathy.bearblog.dev', tier: '0' },
      { title: 'Simon Willison', feedUrl: 'https://simonwillison.net/atom/everything/', siteUrl: 'https://simonwillison.net', tier: '1' },
      { title: 'Latent Space', feedUrl: 'https://www.latent.space/feed', siteUrl: 'https://www.latent.space', tier: '1' },
      { title: 'The Pragmatic Engineer', feedUrl: 'https://newsletter.pragmaticengineer.com/feed', siteUrl: 'https://newsletter.pragmaticengineer.com', tier: '1' },
      { title: 'Ahead of AI', feedUrl: 'https://magazine.sebastianraschka.com/feed', siteUrl: 'https://magazine.sebastianraschka.com', tier: '1' },
      { title: 'Lilian Weng', feedUrl: 'https://lilianweng.github.io/index.xml', siteUrl: 'https://lilianweng.github.io', tier: '2' },
      { title: 'Eugene Yan', feedUrl: 'https://eugeneyan.com/rss/', siteUrl: 'https://eugeneyan.com', tier: '2' },
      { title: 'Chip Huyen', feedUrl: 'https://huyenchip.com/feed.xml', siteUrl: 'https://huyenchip.com', tier: '2' },
      { title: 'Import AI', feedUrl: 'https://jack-clark.net/feed', siteUrl: 'https://jack-clark.net', tier: '2' },
      { title: 'Dwarkesh Patel', feedUrl: 'https://www.dwarkeshpatel.com/feed', siteUrl: 'https://www.dwarkeshpatel.com', tier: '2' },
    ],
  },

  /**
   * Research context — trending papers from Hugging Face Daily Papers, each with a leveled AI
   * explainer. Local explainer (abstract) uses the ADR-0003 synthesis path; the opt-in full-PDF
   * deep-dive uses Claude Sonnet (separate, stronger model — see deepDive.model).
   */
  papers: {
    source: 'hf-daily' as const,
    hfDailyUrl: process.env.COCKPIT_HF_DAILY_URL ?? 'https://huggingface.co/api/daily_papers',
    count: Number(process.env.COCKPIT_PAPERS_COUNT ?? 3),
    fetchTimeoutMs: 8_000,
    ttlMs: 30 * 60_000,
    deepDive: {
      /** Stronger model for full-PDF deep-dives; gated on ANTHROPIC_API_KEY (reuses summary.claude.apiKey). */
      model: process.env.COCKPIT_DEEPDIVE_MODEL ?? 'claude-sonnet-4-6',
      maxTokens: Number(process.env.COCKPIT_DEEPDIVE_MAX_TOKENS ?? 4000),
      timeoutMs: Number(process.env.COCKPIT_DEEPDIVE_TIMEOUT_MS ?? 120_000),
    },
  },

  /**
   * Reader profile — a *living*, read-only model of what the user knows / is learning /
   * researches, RE-DERIVED each refresh from the Claude memory index + selfco vault hub notes
   * (ADR-0004). The cockpit reads these off disk; it never writes back to the vault or memory.
   */
  profile: {
    vaultRoot: process.env.COCKPIT_VAULT_ROOT ?? profileLocal.vaultRoot ?? path.join(os.homedir(), 'selfco'),
    /** The vault's "now" router — domains mentioned here are flagged currently-active. */
    hotNote: 'wiki/_hot.md',
    memoryDir: process.env.COCKPIT_MEMORY_DIR ?? profileLocal.memoryDir ?? path.join(os.homedir(), '.claude'),
    ttlMs: 30 * 60_000,
    /** Personal — loaded from profile.local.json (gitignored). Empty default keeps the repo public-safe. */
    seed: {
      strengths: profileLocal.seed?.strengths ?? [],
      learning: profileLocal.seed?.learning ?? [],
    },
    /** Domain hubs → cross-link targets. Personal; loaded from profile.local.json. */
    domainHubs: profileLocal.domainHubs ?? [],
  },
};

export type Config = typeof config;
