#!/usr/bin/env node
/**
 * Re-vendor the read-model SDL from core (ADR-0013). Copies core's canonical
 * `packages/read-model-contract/schema.graphql` into the cockpit byte-identically and records the
 * source SHA. CI git-clones core and sets CORE_REPO; locally it resolves the sibling `../core`.
 *
 * After syncing, run `pnpm --filter @cockpit/server contract:codegen` to regenerate the types.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const coreRepo = process.env.CORE_REPO ?? fileURLToPath(new URL('../../../../core', import.meta.url));
const src = `${coreRepo}/packages/read-model-contract/schema.graphql`;
const destDir = fileURLToPath(new URL('../src/schema/', import.meta.url));

if (!existsSync(src)) {
  console.error(`✗ core SDL not found at ${src}. Set CORE_REPO to a core checkout.`);
  process.exit(1);
}

writeFileSync(`${destDir}read-model.graphql`, readFileSync(src));
let sha = 'unknown';
try {
  sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: coreRepo }).toString().trim();
} catch {
  /* core checkout may be a shallow clone without full history — sha stays 'unknown' */
}
writeFileSync(`${destDir}read-model.graphql.sha`, `${sha}\n`);
console.log(`✓ vendored core read-model SDL @ ${sha}`);
