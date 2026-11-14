# Guard log: plan 003 (layout velocity)

**Verdict: PASS** (2026-11-14), after one amendment. Executor: opus, lane `lane/14140-layout-velocity` (`28d9ac66` red, `5437af46` port), merged into `feat/motion-14.14.0` without squash.

## Round 1: STOP at Step 2 (correct)
Test 1 passed on unmodified code in 5 of 7 build+preview runs. The box carried no velocity, but its first sample started 4–14 px past the painted box (plan 005's one-frame-late start), which clears upstream's +5 px threshold. The planning numbers came from a dev server. Amendment `7c94d7da`: test 6 became the only red anchor; test 1 must pass `--repeat-each=5` after the port with forward travel shown; tests owned by 004/005 use `test.fixme()` (3 and 8 flip under load); the `atSwap` change in `throw.spec.ts` was accepted (Svelte applies the swap before the first rAF sample).

## Reproduced by the guard
- Diff: eight files, all in scope. `readSnapshotVelocity` is a line-for-line port of `updateSnapshot()`'s velocity block (create-projection-node.ts 1059-1091 @ v14.14.0). Four `recordSnapshotVelocity(projection)` calls; `seedDepartingLeadSnapshot` / `takeOverLiveLeadOnMount` untouched (plan 004's).
- Stale-velocity risk checked: every site assigns a fresh object (`onScreenSnapshot` → `measurementsFromRect`/`rebasedMeasurements` → `cloneMeasurements`, which copies no velocity), so `Object.assign` never leaves an older velocity behind.
- `pnpm check`: 0 errors. `motionDomProjection.spec.ts`: 119/119.
- `PW_PORT=4273` velocity + throw specs: 10 passed, 5 skipped (fixme: 2, 3, 8, 12 → 005; 13 → 004).
- Tests 1 and 6, `--repeat-each=5`: 10/10 passed.

## Taken from the executor, not reproduced
- Red result (test 6 failed, 168.03 vs > 171.97); per-frame samples before and after the port (test 1 keeps moving forward 3–4 frames after it).
- Layout e2e group (layout, layout-id, animate-presence, reorder, projection, animate-layout): 437 passed, 5 skipped, 0 failed. `pnpm test:only` 1721/1721.

## Notes
- Retrying upstream assertions became `expect(...).toPass({ timeout: 4000 })`; no thresholds changed.
- The throw page's blue card still jumps back until plan 004 lands; don't hand it over for sign-off before then.
