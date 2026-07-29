/**
 * File-loading half of the feed registry. The validation contract lives in @cockpit/shared
 * (`parseRegistry`) so the Reading pod and the watch poller share one implementation — see
 * ADR-0015. This module only resolves the path, reads the file, and parses YAML.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';
import { parseRegistry, type Registry } from '@cockpit/shared';

export { sourcesFor } from '@cockpit/shared';
export type { Pod, Registry, Source, QuarantinedSource } from '@cockpit/shared';

/** Repo root, resolved from this file — works under tsx, vitest, and launchd alike. */
export function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
}

export function registryPath(): string {
  return resolve(repoRoot(), 'sources.yaml');
}

export function loadRegistry(path = registryPath()): Registry {
  return parseRegistry(parse(readFileSync(path, 'utf8')));
}
