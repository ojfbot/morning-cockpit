import type {
  SourceRecord,
  EvidenceRecordResult,
} from '@cockpit/shared/inspector-contract';
// @ts-expect-error Query/operation wrappers are not a public consumer contract.
import type { Query } from '@cockpit/shared/inspector-contract';
// @ts-expect-error Generated implementation files are not package exports.
import type { Scalars } from '@cockpit/shared/internal/inspector-model';
type DoltRef = Extract<SourceRecord, { __typename: 'DoltBeadSourceRecord' }>;
const wrongSource: DoltRef = {
  __typename: 'DoltBeadSourceRecord',
  kind: 'dolt-bead-v1',
  // @ts-expect-error A concrete Dolt source cannot carry a handoff namespace.
  source: 'handoff-bead',
  repository: null,
  nativeId: 'native',
  sourcePath: null,
};
const wrongPath: DoltRef = {
  __typename: 'DoltBeadSourceRecord',
  kind: 'dolt-bead-v1',
  source: 'dolt-bead',
  repository: null,
  nativeId: 'native',
  // @ts-expect-error Dolt path is null-only.
  sourcePath: 'file',
};
// @ts-expect-error Selected nullable fields are still required.
const omittedNull: DoltRef = {
  __typename: 'DoltBeadSourceRecord',
  kind: 'dolt-bead-v1',
  source: 'dolt-bead',
  nativeId: 'native',
  sourcePath: null,
};
// @ts-expect-error Concrete result discriminants are required.
const missingResultTag: EvidenceRecordResult = {
  status: 'refresh-required',
  snapshotId: 'pin',
  reason: 'expired',
};
export {};
