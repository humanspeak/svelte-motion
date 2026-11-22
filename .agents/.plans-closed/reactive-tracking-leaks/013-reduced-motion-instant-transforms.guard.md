# Guard log: plan 013 (reduced motion applies transforms instantly)

## 2026-11-20, round 1: STOP, then amended

- With the strip removed, the first SSR load under `'always'` still tweened -200 → 200. The optimized-appear bootstrap now carried a `transform` entry and drove it with WAAPI, outside the VisualElement.
- **Amendment (Step 3 item 9):** `optimizedAppearId` adds `!reducedMotion` next to `!skipAnimations`.

## 2026-11-21, final: PASS

- **Executor:** opus 5.5, resumed at item 9.
- **Red, executor-reported, on fully unmodified code:**
  - unit tests 1 and 5 failed (`expected undefined to be 200`, `expected 8.5 to be 400`);
  - e2e `'always'` enter, `'user'`+reduce enter and `'always'` exit failed.
- **Guard reproduction:**
  - With only `_MotionContainer.svelte` reverted, all 5 unit tests fail. That revert also breaks the import of the deleted helper, so it's weaker evidence than the executor's.
  - Green: the new spec plus `reducedMotionConfig.svelte.spec.ts` → 13/13.
- **Diff read in full:**
  - Every `filterReducedMotion*` call site is removed, along with the dead helper and its unit tests.
  - The exit transition gains `reduceMotion: true`.
  - An effect keeps `visualElement.shouldReduceMotion` live.
  - The appear gate adds `!reducedMotion`.
  - Docs and JSDoc are updated.
- **Executor-reported, not re-run:**
  - `pnpm test:only` 1733/1733, `pnpm check` 0 errors, `pnpm build` and the docs build ok;
  - e2e `utilities + animate-presence + ai-glow-border` 347/347;
  - Trunk no new issues.
- **Known limitation (pre-existing, recorded here because the executor can't edit the plan):** on the server `reducedMotion` is false for `'user'`, since there is no `matchMedia`. A first SSR load under `'user'` with the OS setting on can still tween in the appear bootstrap.
- **Not fixed, out of scope:** `docs/src/lib/examples/use-reduced-motion-config/demos/Default.svelte` reads the config outside its own `<MotionConfig>`.
- **Needs maintainer sign-off:** `/tests/motion-config-reduced-motion`, which has a new tester panel and exit box.
- **Integrated:** `76e10dcc` on `fix/2.14.1`.
