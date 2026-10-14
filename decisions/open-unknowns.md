## 2026-10-10 — MC-UX-01 source evidence inspector

**Deferred decisions**
- Final acceptance of the typed `/api/cockpit` unresolved-relation diagnostic shape — unblocked by: dedicated morning-cockpit contract review and explicit owner approval before merge.
- Fleet-wide process identity, recipient authority, correspondence, execution receipt, and original-action settlement semantics — unblocked by: their existing core fleet-runner decision venues; they are outside this cockpit read slice.

**Unvalidated assumptions**
- The smallest additive diagnostic record can carry every affected source record reference without requiring GraphQL parity or a raw-body reader.
- A bounded test-only HTTP harness can exercise fixture collection through `/api/cockpit` without adding a production fixture route or arbitrary source-root control.

**Standard considerations not covered**
- Long-term compatibility policy for additional REST consumers beyond the current renderer.
- Final shell placement and default-route adoption, which remain behind Q2.

## 2026-10-13 — Decision11 bounded local repair

Decision11 approves finishing the existing Dolt/handoff inspector. The local candidate uses the existing core-owned SDL/codegen path, on-demand pinned GraphQL reads and explicit historical production states; it supersedes the assumption that a REST-only diagnostic addition can bypass parity. It neither accepts the current draft PR56 nor grants publication/merge.

Still required: core owner acceptance of `packages/read-model-contract/inspector-contract.md` and its precise producer mint/restart/unknown/trace semantics, coupled landing order, and separate activation approval before requiring trace fields on actual cockpit emissions. Enforcement remains inactive; the existing approved emission path is unchanged. Full GitHub/login/device identity, process/recipient authority, correspondence, receipts and settlement remain outside this slice. No Proposed MC-UX policy or source readiness is promoted by these local candidates.
