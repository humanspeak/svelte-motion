# Guard log: plan 004 (`pinch` prop, `whilePinch`, `pinchFeatures`)

- **Executors**: Claude Opus 5.5, twice. Steps 1-5 in worktree `t3/5fefad79` (cut from `dd040bf0`); steps 6-8 in worktree `t3/a56845fc` (cut from `c3599140`).
- **Guard**: session agent, 2026-11-12.
- **Commits judged**: `2ff143bc`, `85857860` (steps 1-5); `ed95d0ad`, `50703809`, `7c8d4824` (steps 6-8).

## History

1. The first executor stopped at step 5: 3 of 19 ported unit tests failed (`expected 0.5 to be 1`). It did not weaken them. Cause: an older bug, not pinch code (see plan 006).
2. Guard merged steps 1-5 at `e4449617`, wrote plan 006, and it landed at `ff15b87c`. The three tests went green.
3. Guard amended this plan (second revision note) to resume at step 6, and a second executor finished steps 6-8.

## Final pass

| Done criterion | Reproduced by guard | Result |
| --- | --- | --- |
| `pnpm check` → 0 errors | 0 errors, 36 warnings (none in pinch files) | PASS |
| `pnpm test:only` | 122 files, 1711 tests passed (includes `pinch.spec.ts` 23, `pinchFeature.spec.ts`, `features/index.spec.ts`) | PASS |
| `e2e/pinch/prop.spec.ts` → 7 passed, three runs | `e2e/pinch` (both specs, 18 tests) with `--repeat-each=10` on `PW_PORT=4265` → 180 passed | PASS |
| Tree-shaking | `pnpm build`, `pnpm package` (publint "All good!"), consumer test → "Tree-shaking consumer checks passed." | PASS |
| `pinchFeatures` and `MotionWhilePinch` exported | in `src/lib/index.ts` | PASS |
| Feature never assigns `element.style.touchAction` | read `src/lib/utils/pinchFeature.ts` in full: no assignment; `resolvePinchTouchAction` feeds the container's style string | PASS |
| Full chromium e2e | Not re-run by guard. Executor: 956 passed, 2 skipped, 1 failed (see below). | PASS with note |
| Only in-scope files | steps 6-8: page, spec, `+page.svelte` link, `verify-tree-shaking.mjs`, changeset | PASS |

## Fidelity to upstream

`e2e/pinch/prop.spec.ts` has exactly the seven test names of `tests/react/pinch.spec.ts` at `v14.12.0`. `PinchGestureFeature` follows `gestures/pinch.ts`; both Svelte deviations (retry attach in `update()`, declarative `touch-action`) are documented in its JSDoc.

## Notes

- **`--no-verify` on the red commit `2ff143bc`**: the hook's svelte-check rejects tests that import modules that do not exist yet. Formatting had run. Process deviation; the content was re-checked by every later hook run and by guard's `pnpm check`.
- **Fixed sleeps replaced by condition waits** in the ported e2e (upstream's 1500 ms and 300 ms waits became `expect.poll`). Assertions unchanged. Accepted; it is why the spec survives repetition.
- **`pop-layout-container-move.spec.ts:282` failed once in the full run** (drift 38.7, expected < 1) and passed alone. Same test, same number as in plan 006's full run. It did not fail in plan 001's full run. Not a pinch page. It needs its own investigation before the PR; see the batch README.

## Open for sign-off

Not driven on a touch device: rotation snap on the photo card, drag-then-pinch with no jump (the page marks it "judge by eye"), page zoom on the card outside `LazyMotion`, and the verdict readouts during a real gesture.

## Verdict

PASS. Merged onto `feat/motion-14.12.0` at `c0843d78`.
