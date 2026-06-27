import { describe, it, expect } from 'vitest';
import { readVendoredSdl, vendoredMatchesCore, isQueryOnly } from '../contract-check.js';

describe('vendored-SDL drift gate', () => {
  it('the vendored SDL is byte-identical to core canonical SDL', () => {
    // Integration: resolves the sibling ../core checkout (CI git-clones core; ADR-0013).
    expect(vendoredMatchesCore()).toBe(true);
  });

  it('the vendored SDL is query-only (no Mutation/Subscription)', () => {
    expect(isQueryOnly(readVendoredSdl())).toBe(true);
  });

  it('isQueryOnly flags an SDL that declares a Mutation (proves the read-only guard bites)', () => {
    const withMutation = `${readVendoredSdl()}\ntype Mutation { evict: Boolean! }`;
    expect(isQueryOnly(withMutation)).toBe(false);
  });
});
