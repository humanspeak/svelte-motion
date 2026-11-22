# Guard log: plan 006 (hover, focus and in-view get their own effects)

## 2026-11-20, final: PASS

- **Executor:** opus 5.5, lane `lane/2141-006`. No STOP conditions fired.
- **Red reproduced by the guard:** with `_MotionContainer.svelte` and `gestures.ts` reverted, `vitest run src/lib/html/_MotionContainer.spec.ts -t "plan 006"` → 6 failed.
- **Green reproduced:** `_MotionContainer.spec.ts` plus `gestures.spec.ts` → 77/77.
- **Diff read in full:**
  - Per-gesture enable latches follow upstream's `updateFeatures`: once on, a gesture stays on.
  - There are three effects, each reading only element/visualElement/isLoaded/hasGestureFeatures and its own latch. Callbacks are passed as getters.
  - The in-view effect nests an effect keyed on the `amount`/`margin`/`root` deriveds, which calls `startObserver()` under `untrack`.
  - `attachInViewGesture` is kept as a thin wrapper around the new `createInViewGesture`.
  - The press effect is untouched.
- **Executor-reported, not re-run:**
  - the components suite 411/411, the new e2e 4/4 (red first: 4 failed), and `e2e/motion e2e/armed-buttons e2e/lazy-motion e2e/variants` 163 passed and 1 skipped, run twice;
  - `pnpm check` 0 errors, `pnpm build` ok, Trunk no new issues;
  - `pnpm test:only` passed 1743 on the second run.
- **Load flake, seen twice:** the first full run failed `_MotionContainer.transitionOut.spec.ts` › "initial's out transition is used for the mount animation only". It has no gesture props, and it passed alone 3 times. Plan 001's lane saw the same spec fail once under load. It's tracked in the batch README for the final full verification.
- **Unblocks** 007 and 014.
- **Needs maintainer sign-off:** `/tests/motion/gesture-prop-change` is a new tester page.
- **Integrated:** `c7b2bc65` on `fix/2.14.1`.
