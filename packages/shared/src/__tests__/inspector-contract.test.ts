import { describe, expect, it } from 'vitest';
import { resolveDecidedInFlight } from '../decided.js';
import { sourceRecordKey } from '../source-record.js';

describe('owner-approved existing-source inspector contract', () => {
  it('preserves referrer and candidate roles instead of sorting participants together', () => {
    const result = resolveDecidedInFlight([
      { sourceRecordKey: 'A', id: 'same', status: 'live', open: true },
      { sourceRecordKey: 'B', id: 'same', status: 'live', open: true },
      { sourceRecordKey: 'Z', id: 'child', status: 'live', open: true, refs: ['closes:same'] },
    ]);
    expect(result.diagnostics).toEqual([{ reason: 'target-matches-multiple-records', relation: 'closes', referrerKey: 'Z', targetNativeId: 'same', candidateTargetKeys: ['A', 'B'] }]);
  });
  it('retains directed cycle order, canonically rotated independently of input order', () => {
    const records = [
      { sourceRecordKey: 'Z', id: 'z', status: 'live', open: true, refs: ['closes:a'] },
      { sourceRecordKey: 'A', id: 'a', status: 'live', open: true, refs: ['closes:m'] },
      { sourceRecordKey: 'M', id: 'm', status: 'live', open: true, refs: ['closes:z'] },
    ];
    const expected = [{ reason: 'relation-cycle', relation: 'closes', cycleKeys: ['A', 'Z', 'M'] }];
    expect(resolveDecidedInFlight(records).diagnostics).toEqual(expected);
    expect(resolveDecidedInFlight([...records].reverse()).diagnostics).toEqual(expected);
  });
  it('fails closed for unsupported GitHub resource coordinates even at an untyped boundary', () => {
    expect(() => Reflect.apply(sourceRecordKey, undefined, [{ source: 'github', repository: 'repo', nativeId: '17', sourcePath: null }])).toThrow(/unsupported|source/i);
  });
});
