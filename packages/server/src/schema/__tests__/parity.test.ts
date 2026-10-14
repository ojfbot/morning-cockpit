import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compareSdlToShared, sharedInterfaceFields } from '../parity.js';

const vendoredSdl = readFileSync(
  fileURLToPath(new URL('../read-model.graphql', import.meta.url)),
  'utf8',
);

const sharedDir = fileURLToPath(new URL('../../../../shared/src/', import.meta.url));
const shared = sharedInterfaceFields(
  ['fleet.ts', 'briefing.ts', 'liveness.ts', 'work-item.ts', 'source-record.ts'].map((f) => sharedDir + f),
);

describe('SDL ↔ @cockpit/shared parity', () => {
  it('the real contract has no unbacked SDL fields (forward-declared seams excluded)', () => {
    expect(compareSdlToShared(vendoredSdl, shared)).toEqual([]);
  });

  it('flags an SDL field that has no @cockpit/shared backing (proves the gate bites)', () => {
    // Inject a phantom field into RepoCard — the canonical "silent drift" ADR-0013 kills.
    const drifted = vendoredSdl.replace(
      'type RepoCard {\n  name: String!',
      'type RepoCard {\n  name: String!\n  phantomUnbackedField: String!',
    );
    const mismatches = compareSdlToShared(drifted, shared);
    expect(mismatches).toContainEqual(
      expect.objectContaining({ type: 'RepoCard', field: 'phantomUnbackedField' }),
    );
  });
});

it('rejects shared-only public coordinates instead of accepting a one-way match', () => {
  const changed = { ...shared, WorkItem: new Set([...(shared.WorkItem ?? []), 'sharedOnlyPublicField']) };
  expect(compareSdlToShared(vendoredSdl, changed)).toContainEqual({ type: 'WorkItem', field: 'sharedOnlyPublicField', reason: 'shared field missing from SDL' });
});
