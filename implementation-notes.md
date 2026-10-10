## Deviations

- The plan assumed the managed worktree retained a sibling `core` checkout; it did not, so the full suite's SDL drift gate could not resolve its evidence input. Verification uses the documented `CORE_REPO=/Users/yuri/ojfbot/core` override and leaves core read-only.
