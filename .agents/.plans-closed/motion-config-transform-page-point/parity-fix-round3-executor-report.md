Implemented corrective round 3 within scope.

Files changed:

- [drag.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/utils/drag.ts): removed the duplicate rendered-transform reseed during controlled snap.
- [drag.spec.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/utils/drag.spec.ts): added the React-backed repeated `initial {x:100,y:40}` regression and strengthened lock contention with a >3px move/frame sample.
- [MotionConfig.transformPagePoint.spec.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/components/MotionConfig.transformPagePoint.spec.ts): relocated callback-forwarding coverage, including same VisualElement, new callback references, and live-session switching.
- [TransformPagePointHarness.svelte](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/components/__tests__/TransformPagePointHarness.svelte): exposed drag callbacks to the approved test.
- [_MotionContainer.spec.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/html/_MotionContainer.spec.ts): restored exactly to `b5ab7bb`; byte comparison passed.
- [run-controls-reference.mjs](/tmp/svelte-motion-react-parity-1320/run-controls-reference.mjs): compares both coordinates at six-decimal normalization and retains traces when preconditions fail. The final report check still exits nonzero for failed preconditions.

Controls root cause: `applied` had already been calculated as current axis value minus the authored baseline. Replacing it with the rendered CSS translation reintroduced `initial.x/y`, which the compositor then added again. Keeping the relative value and applying React’s raw-page-point minus cached-layout-center delta reproduces the expected repeated snap without projection changes or another transform writer.

Verification:

- Focused plan suite: 77/77 passed.
- Final affected suite: 34/34 passed.
- `npm run check`: 0 errors, existing 39 warnings.
- Targeted ESLint: passed.
- Prettier, `git diff --check`, runner `node --check`: passed.
- Immutable reference, original controls e2e/page: unchanged.
- No browser, build, install, dependency, projection, plan, commit, or staging actions performed. Read-only Git inspection was used for restoration/diff verification.
- The untracked Guard-owned `proposed-controls-test-amendment.md` was untouched.

No scope-expansion STOP is required. Guard still needs to rerun the browser/reference comparison to confirm all 29 strict cases.
