# MC-UX-01 capture and transition planning

This initiative takes the evolving Claude Design experiments toward a working, tested morning-cockpit implementation. This landing captures evidence and plans only. It selects no final shell and makes no production change.

## Read and review

| Artifact | Purpose |
| --- | --- |
| [Captured design entry point](../../research/design-handoff-mc-ux-01/README.md) | Original prototypes, screenshots, specs, questions and attributed decisions |
| [Capture record](CAPTURE.md) and [inventory](capture.json) | Source authority, exact transferred bytes, application baseline and known export gaps |
| [Transition plan](transition-plan.md) | Reconcile current implementation and roadmap; sequence observable implementation slices |
| [Verification plan](verification-plan.md) | Acceptance checks and repeatable usability experiments tied to exact design and code revisions |
| [Fleet integration proposal](fleet-integration.md) | Pinned core roadmap dependencies, proposed registration amendments, correspondence contract gaps and later-session prompt |

The three plans were assigned to separate subagents by the operator's request. Their authors researched the existing code, tests and upstream contracts. Their suggested slices are planning tasks, not dispatchable work orders.

## What the review needs to resolve

- Reconcile the existing S9 through S18 roadmap work with its actual implementation before registering new tasks. Preserve PR Train work in the parallel checkout.
- Establish a live baseline and compare the competing room and single-page concepts before choosing the production shell, Q2.
- Define actor identity and obligation evidence, Q4/Q12/Q15. An actor string or self-reported tuple cannot establish a verified process identity or a human obligation.
- Decide the correspondence profile and recipients, Q13/Q14, before a preview becomes an executable memo. Preparation, approval and delivery receipts are separate states.
- Keep report emission behind Q3 and the appropriate upstream contract. Preserve the app's existing supported commands and approval behavior while reconciling the source bundle's narrower write claims.

## Design revision loop

1. Continue usability experiments in Claude Design. Preserve each transferred revision and identify changed questions, screens and simulated behavior.
2. Tie each experiment to a source inventory digest, application commit and data fixture. Record task outcome, errors and operator decisions.
3. Amend the proposed task queue when evidence changes a hypothesis. Keep existing accepted ADRs and source snapshots traceable.
4. Register a slice only after its entrance conditions and decisions are satisfied. An imported design decision or a merged Proposed contract does not alone satisfy that gate.

The fleet-runner registration amendment remains a proposal in this repository. The actual implementation and roadmap home is in core; no sibling roadmap or dispatch record was written. The fleet integration document carries the concrete handoff for the later operator-requested fork.

## Checks for this landing

```sh
python3 planning/mc-ux-01/verify-capture.py
git diff --check 1b15bc9 HEAD -- planning/mc-ux-01 implementation-notes.md
```

The capture verifier checks 60 source files, their hashes and byte counts, and 29 declared manifest references. Source whitespace stays intact, including original Markdown hard breaks. These checks validate the handoff transfer. Production tests and usability checks are specified in the verification plan and must be run against each implementation slice.
