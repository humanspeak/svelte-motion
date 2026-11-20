# Guard log: plan 004 (thrown card → `layoutId` twin)

**Verdict: PASS** (2026-11-14), after three amendments (the fix-loop budget's last round). Executor: opus, lane `lane/14140-throw` (`98668572` red, `53516e08` fix + changeset), merged into `feat/motion-14.14.0` without squash (`074912cc`; the only conflict was this plan file, resolved to the batch branch's copy).

## Rounds
1. **STOP, case (c):** the handoff runs through `seedDepartingLeadSnapshot`, not `takeOverLiveLeadOnMount`. The cached box came from a mount-time unstripped read (`keepsTransforms` true, drag `x` = 0), so the drag offset was never applied (twin started 90 px back).
2. **Amendment `79571b40` (`isDrawn`) → STOP:** fixed the throw, but two tests encoded the old behaviour. The guard authorized two test edits (`45d1c615`): `atSwap` = the removed card's `300 + translateX` (Svelte's swap lands in the same frame as an unpainted inertia step; upstream's snapshot is the DOM at unmount), and the departing-lead unit test now seeds with `x = 80` before the read, plus a new "transform added after an untransformed seed" test.
3. **Re-run → STOP:** `isDrawn` broke 5 `layout-root.spec.ts` tests (off by the ancestor offsets). Svelte mounts children before parents, so an ancestor's painted transform can be missing from `latestValues` at the child's read. **Amendment `5d56de7c`:** keep `keepsTransforms`; record the node's own `x`/`y` at each read; shift the cached box by the change since.
4. **STOP on wording:** "missing translate → no shift" disabled the fix (a drag creates `x`). **Accepted (`9556475e`):** unset = 0; set-but-non-finite = no shift.

## Reproduced by the guard
- Final diff: four files, all in scope. `takeOverLiveLeadOnMount` untouched; `keepsTransforms` identical to base; `recordSnapshotVelocity` after the departing snapshot.
- `pnpm check`: 0 errors. `motionDomProjection.spec.ts`: 120/120.
- `PW_PORT=4274 … throw.spec.ts layout-root.spec.ts`: 33/33 (the five round-3 regressions pass).

## Taken from the executor, not reproduced
- Twin's first frame vs `atSwap`: 90 px before, ~0 after (spring keeps the throw: 403 → 410 → 416). `pnpm test:only` 1728/1728; layout family 443 passed, 4 skipped, 0 failed.

## Known gap (in scope for no plan)
- The shift covers only a change in the element's own `x`/`y` since the read; a changed ancestor transform or own scale/rotate is still assumed unchanged. Doc nit: `ownTranslate()`'s comment says "unless both are finite numbers" but unset counts as 0.
