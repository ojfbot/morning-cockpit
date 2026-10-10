## 2026-10-10 — MC-UX-01 qualified evidence inspector

**Deferred decisions**
- Final acceptance of the typed `/api/cockpit` unresolved-relation diagnostic shape — unblocked by: dedicated morning-cockpit contract review and explicit owner approval before merge.
- Fleet-wide process identity, recipient authority, correspondence, execution receipt, and original-action settlement semantics — unblocked by: their existing core fleet-runner decision venues; they are outside this cockpit read slice.

**Unvalidated assumptions**
- The smallest additive diagnostic record can carry every affected qualified source identity without requiring GraphQL parity or a raw-body reader.
- A bounded test-only HTTP harness can exercise fixture collection through `/api/cockpit` without adding a production fixture route or arbitrary source-root control.

**Standard considerations not covered**
- Long-term compatibility policy for additional REST consumers beyond the current renderer.
- Final shell placement and default-route adoption, which remain behind Q2.
