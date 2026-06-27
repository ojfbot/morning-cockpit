/**
 * Vendored-SDL drift gate (ADR-0013, parts 1–2 of 3).
 *
 * The cockpit vendors a byte-identical copy of core's canonical read-model SDL so the facade is
 * buildable offline and the contract is reviewable in cockpit PRs. This module proves the vendored
 * copy has not drifted from core (`vendoredMatchesCore`) and that it stays query-only. In CI core is
 * git-cloned (ADR-0030 precedent); locally it resolves to the sibling `../core` checkout or
 * `$CORE_REPO`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildSchema } from 'graphql';

/** The vendored SDL inside the cockpit (the codegen input). */
export const VENDORED_SDL_PATH = fileURLToPath(new URL('./read-model.graphql', import.meta.url));

/** Core's canonical SDL path within a core checkout. */
export const CORE_SDL_RELPATH = 'packages/read-model-contract/schema.graphql';

export function readVendoredSdl(): string {
  return readFileSync(VENDORED_SDL_PATH, 'utf8');
}

/** Resolve the core checkout: `$CORE_REPO`, else the sibling `../core` of this repo. */
export function resolveCoreRepo(coreRepo = process.env.CORE_REPO): string {
  if (coreRepo) return coreRepo;
  // packages/server/src/schema → repo root is four levels up; core is its sibling.
  return fileURLToPath(new URL('../../../../../core', import.meta.url));
}

export function readCoreSdl(coreRepo?: string): string {
  const root = resolveCoreRepo(coreRepo);
  const path = `${root}/${CORE_SDL_RELPATH}`;
  if (!existsSync(path)) {
    throw new Error(
      `core read-model SDL not found at ${path}. Set CORE_REPO to a core checkout (CI git-clones core; ADR-0013).`,
    );
  }
  return readFileSync(path, 'utf8');
}

/** True when the vendored SDL is byte-identical to core's canonical SDL. */
export function vendoredMatchesCore(coreRepo?: string): boolean {
  return readVendoredSdl() === readCoreSdl(coreRepo);
}

/** True when the SDL declares no `Mutation` / `Subscription` root (query-only — ADR-0011 #4). */
export function isQueryOnly(sdl: string): boolean {
  const schema = buildSchema(sdl);
  return schema.getMutationType() == null && schema.getSubscriptionType() == null;
}
