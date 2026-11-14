# Guard log: plan 007 (default layout transition)

**Verdict: PASS** (2026-11-14), after one amendment. Executor: opus, lane `lane/14140-default-layout-transition` (`bb1f7026` red, `57c388c9` fix, `45e72291` changeset), merged into `feat/motion-14.14.0` without squash.

## Round 1: STOP at Step 2 (correct)
The planned fix (projection `options.transition`) alone still measured 355 ms. Upstream's chain also reads `visualElement.getDefaultTransition()` (= `props.transition`), which `buildMotionNodeProps` set to `{}`. Amendment `b2972e45` put that line in scope after the guard checked motion-dom handles `undefined` on every path (`visual-element-target.ts:45-48`, `motion-value.ts:29`, `visual-element-variant.ts:23`), as React passes it.

## Reproduced by the guard
- Diff: in scope. Both `_MotionContainer.svelte` sites key on "nothing configured" (`motionConfig?.transition === undefined && transitionProp === undefined`), not on `mergedTransition`'s contents; non-layout consumers of `mergedTransition` unchanged.
- `pnpm check`: 0 errors. `pnpm build` ok.
- `e2e/layout/default-transition.spec.ts --repeat-each=3`: first run 8/9 (one timing failure while plan 006's docs lane loaded the machine; not captured), second run 9/9.

## Taken from the executor, not reproduced
- Red 357 ms; `pnpm test:only` 1715/1715; layout, layout-id, animate-layout, animate-presence and variants specs: 376 passed, 0 failed.

## Notes
- The ±60 ms tester windows are tight under load. Watch the full-suite run; if this spec flakes there, widen only our page's guard windows (`#configured`, `#explicit`), never the `#default` 420–530 ms band from upstream.
- Separate divergence left alone: we merge a `transition` prop with a `MotionConfig` transition; upstream lets the prop replace the config.
