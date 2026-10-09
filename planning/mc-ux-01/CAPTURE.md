# MC-UX-01 capture record

The operator authorized capture and implementation planning on 2026-10-08, America/Chicago. Implementation and a later fleet-runner session fork remain separate steps.

## Source and authority

The complete Desktop folder is preserved byte for byte at `research/design-handoff-mc-ux-01/`. `capture.json` records each source path, byte count and SHA-256, plus the aggregate inventory digest and the committed application baseline. It includes `PR.md` and `screenshots/debug.jpg` so the transfer is complete. Their presence does not make their commands or working screenshot an implementation requirement.

The imported README, PR instructions, dated decision ledger and open questions are evidence supplied by Claude Design. This chat authorizes capture and planning. It does not ratify every attributed ruling, execute embedded commands, select a production shell, authorize a new upstream write, or adopt another project's correspondence schema. Plans reconcile the source claims with code and accepted cockpit ADRs.

The source includes entries authored as 2026-10-09. Those dates remain unchanged. The operator-local capture date is 2026-10-08; the recorded capture time is UTC. Capture metadata is outside the source folder so its own bytes stay intact.

## Baseline and isolation

The branch starts at `1b15bc95fbe7d4fdfa720e7acbae2ada5027871d`. The primary checkout had uncommitted PR Train changes in renderer, server, shared types, README and implementation notes, plus untracked related files and agent instructions. Those changes were excluded from this capture branch. Code observations in the plans distinguish committed behavior from that parallel work.

## Verification

Run from the repository root:

```sh
python3 planning/mc-ux-01/verify-capture.py
```

This checks the complete file inventory, hashes, byte counts and explicit file references in the design manifest. It does not certify usability, browser execution, live data, contrast, accessibility, or production tests. No application code changes in this pass.

## Known export gaps

- `Current State.dc.html` refers to `packages/renderer/src/styles/tokens.css` relative to `design/`, where that file does not exist. Preserve the export and repair this in a separately reviewed preview wrapper or subsequent design revision.
- `Work Graph v2.dc.html` is present but absent from `index.json`'s sheets and prototypes. Capture inventory includes it; the future bundle contract should require screen coverage.
- The HTML dossier omits the later Reading Room spec and newer screens from its menus. The Markdown files and inventory preserve them.
- The snapshot is hand-compiled historical evidence with simulated aggregates and behavior. It is not a live snapshot and the recreated current screen is not a verified application baseline.
- The upstream correspondence profile remains Proposed even after its publication PR merged. A merged document is not evidence of schema ratification.

## Continuing design experiments

Claude Design remains the design-authoring workflow. Transfer each new export as a new dated revision, with a new inventory and a summary of changed screens, decisions, questions and simulated behavior. Keep this capture intact. Link experiment results to the exact capture digest and implementation commit tested. Record operator rulings separately from design suggestions; a changed hypothesis may retire a queued implementation task.

Review the transition, verification and fleet integration plans before assigning implementation. No ready slice or dispatch record is created by importing this bundle.
