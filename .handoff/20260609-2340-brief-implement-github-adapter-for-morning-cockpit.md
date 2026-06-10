---
id: 20260609-2340-brief-implement-github-adapter-for-morning-cockpit
type: brief
title: "Implement GitHub Adapter for Morning-Cockpit"
actor: morning-cockpit-chat
to: code-claude
session_id: 2026-06-10T04:40:23.826Z
status: live
created_at: 2026-06-10T04:40:23.826Z
refs:
  - daily-logger/collection-context.ts
  - morning-cockpit/CLAUDE.md
  - dolt adapter in morning-cockpit
  - handoff adapter in morning-cockpit
labels:
  project: morning-cockpit
  emitted_by: morning-cockpit-chat
---

## Context

The morning-cockpit project has existing adapters for dolt and handoff, and the next task is to add a GitHub adapter.

## Goal

Create an adapter in morning-cockpit that uses the gh CLI collectors from daily-logger to surface PRs and issues into the lanes of morning-cockpit. The adapter should include health reporting similar to the existing dolt and handoff adapters, using TtlCache for caching data.

## Acceptance criteria

- [ ] Adapter/github.ts in morning-cockpit contains the gh CLI collectors from daily-logger
- [ ] PRs and issues are correctly surfaced into the lanes of morning-cockpit
- [ ] Health reporting is implemented with AdapterHealth
- [ ] TtlCache pattern is used for caching data

## References

- daily-logger/collection-context.ts
- morning-cockpit/CLAUDE.md
- dolt adapter in morning-cockpit
- handoff adapter in morning-cockpit

## Flag back

Do not implement the adapter without reusing the existing gh CLI collectors from daily-logger.
