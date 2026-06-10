import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { assembleProfile, type AdapterHealth, type DomainSeed, type ReaderProfile } from '@cockpit/shared';
import { config } from '../config.js';

/**
 * Read-only reader-profile adapter. Re-derives the profile each refresh from on-disk sources:
 *   - the vault's wiki/_hot.md router → which domains are currently in focus (`recent`)
 *   - each domain hub note's frontmatter (status, tags) → live domain metadata
 * The seed strengths/learning come from config. This NEVER writes to the vault or memory —
 * paper→concept write-back is a deferred, gated slice (ADR-0004).
 */

const FRONTMATTER_RE = /^---\n([\s\S]+?)\n---/;

async function readText(file: string): Promise<string> {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return '';
  }
}

/** Pull `status` + `tags` from a vault note's YAML frontmatter, if present. */
function parseFrontmatter(text: string): { status?: string; tags?: string[] } {
  const m = FRONTMATTER_RE.exec(text);
  if (!m) return {};
  try {
    const fm = (parseYaml(m[1]!) ?? {}) as Record<string, unknown>;
    const status = typeof fm['status'] === 'string' ? fm['status'] : undefined;
    const tags = Array.isArray(fm['tags'])
      ? fm['tags'].filter((t): t is string => typeof t === 'string')
      : undefined;
    return { status, tags };
  } catch {
    return {};
  }
}

export async function fetchProfile(now = new Date()): Promise<{ profile: ReaderProfile; health: AdapterHealth }> {
  try {
    const { vaultRoot, hotNote, domainHubs, seed } = config.profile;
    const hotText = await readText(path.join(vaultRoot, hotNote));

    const domains: DomainSeed[] = await Promise.all(
      domainHubs.map(async (h) => {
        const text = h.vaultPath ? await readText(path.join(vaultRoot, h.vaultPath)) : '';
        const fm = text ? parseFrontmatter(text) : {};
        return {
          key: h.key,
          label: h.label,
          vaultPath: h.vaultPath,
          memoryFile: h.memoryFile,
          tags: fm.tags,
          status: fm.status,
        } satisfies DomainSeed;
      }),
    );

    const profile = assembleProfile({
      generatedAt: now.toISOString(),
      hotText,
      seedStrengths: [...seed.strengths],
      seedLearning: [...seed.learning],
      domains,
    });

    const found = domains.filter((d) => d.status || (d.tags && d.tags.length)).length;
    const active = profile.domains.filter((d) => d.recent).length;
    return {
      profile,
      health: {
        name: 'profile',
        status: hotText || found > 0 ? 'up' : 'degraded',
        itemCount: profile.domains.length,
        note: `${profile.domains.length} domains · ${found} hub notes read · ${active} active in _hot`,
      },
    };
  } catch (err) {
    // Never crash the section — return an empty profile and report it.
    return {
      profile: { generatedAt: now.toISOString(), strengths: [], learning: [], domains: [] },
      health: { name: 'profile', status: 'down', itemCount: 0, lastError: err instanceof Error ? err.message : String(err) },
    };
  }
}
