# Guard log: plan 005 (an interrupt restarts from the painted box)

**Verdict: PASS** (2026-11-14). Executor: opus, lane `lane/14140-painted-box` (`d4621e32`), merged into `feat/motion-14.14.0` after plan 004 (`2cc9313f`, clean auto-merge).

## Investigation gate: case (a), confirmed
On build + preview, `scheduledReactiveCommit` called `flushFrameSteps()` before snapshotting: `target.x.min` 283.31 (= painted) before the flush, 288.49 after, and `commitObservedLayoutChange` used 288.49.

## Fix
`captureOnScreenSnapshot()` reads the on-screen box and its velocity before the flush; `runReactiveCommit(painted)` passes it to `commitObservedLayoutChange` as `onScreenSnapshot`, which uses it as the committer's snapshot and restores its velocity after the subtree seed. This is upstream's order (`willUpdate()` → `updateSnapshot()` before `update()` flushes, create-projection-node.ts:1046-1091 @ v14.14.0). Callers without a captured box are unchanged.

## Reproduced by the guard
- `pnpm check`: 0 errors. `motionDomProjection.spec.ts`: 123/123 (4 new).
- `e2e/layout/velocity.spec.ts --repeat-each=3`: 36/36, including the four former `test.fixme()` tests; no `test.fixme` left.

## Taken from the executor, not reproduced
- Red margins (tween 3/3, duration 2/3, delay 3/3, mirror 2/3); `pnpm test:only` 1731/1731; layout family + drag 565 passed, 2 skipped, 0 failed.

## Maintainer decision 3 (re-tuning)
No spec tuned by earlier batches moved, so nothing needs re-tuning.
