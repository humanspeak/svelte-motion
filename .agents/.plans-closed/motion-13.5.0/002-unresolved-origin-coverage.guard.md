# Guard log: 002 unresolved-origin-coverage

## Checkpoint 1 (2026-10-02 03:07): ON TRACK

8f2ebe06 (worktree snapshot) → 3d84ecd5 (integrated) · final

- This plan is a characterization: it passed on unmodified library code, so no unresolved-origin bug exists in our first-render path.
- Guard reproduced: spec 3/3; trunk clean; `pnpm check` 0 errors on the integrated branch.
- The tests can't pass vacuously: they require more than 2 recorded `points` writes, and the CSS-variable samples would fail if `--x` started at 0.
- Same stash incident as 001. The guard confirmed the worktree held only 002's 3 in-scope paths.
- Verdict: PASS. Awaiting operator eye test; not DONE.

## Checkpoint 2 (2026-10-02 05:06): DRIFTING (test defect, guard miss)

3d84ecd5 · operator eye test

- The operator saw the `--x` readout stuck at 100. The guard reproduced it: the server HTML ships `style="--x: 100"` (and `style="points: <target>"` on the polygons). With no `initial`, the server render falls back to the `animate` target (`_MotionContainer.svelte` ~1509–1521 → `mergeInlineStyles` animateFallback). Upstream `makeLatestValues` never does this.
- The CSS-variable test was **vacuous**: "≥ 49.9", "> 50.5", and "eventually ≥ 60" all hold when the value jumps to 100. Checkpoint 1's "can't pass vacuously" claim was wrong. The guard did not mutation-check this assertion.
- The polygons are fine. The blue one jumps to its target because the 2-point and 4-point lists can't interpolate (same as upstream). The pink one springs as intended.
- Action: the fix and the strict test go to new plan 004. 002 is reopened: "fixed by 004".
