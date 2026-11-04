Implemented guard fix round 1 without browser, dependency, `.agents`, `.git`, docs, projection-source, or Reorder edits.

Changes:

- Added public Motion frame subscribers with cleanup and timestamp readiness assertions to both Svelte parity fixtures.
- Fixed snap-to-cursor to use the raw page point against the transformed projection box, matching React’s mixed-domain behavior.
- Refreshed ref-constraint origins during VisualElement commits to prevent stale resize scaling.
- Flushed Motion’s update lane during active drag commits, preserving commit-time `onDrag` samples.
- Observed sibling layout mutations during active layout drags and routed them through existing `commitDraggedLayoutChange`.
- Fixed both `DOMMatrix` calls to read `getComputedStyle(...).transform`.
- Replaced unbounded scroll waits with bounded polling that verifies exact positions and actual event delivery.
- Added a two-axis snap regression proving that mapped session points are not reused at the snap boundary.

Modified scope:

- [drag.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/utils/drag.ts:458)
- [drag.spec.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/utils/drag.spec.ts:482)
- [_MotionContainer.svelte](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/html/_MotionContainer.svelte:2162)
- [drag fixture](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/routes/tests/transform-page-point/drag/+page.svelte:234)
- [pan fixture](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/routes/tests/transform-page-point/pan/+page.svelte:208)
- [drag e2e](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/e2e/drag/transform-page-point.spec.ts:45)
- [pan e2e](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/e2e/motion/pan-transform-page-point.spec.ts:45)

Validation:

- Focused units: 75/75 passed.
- Drag units: 27/27 passed after final edit.
- Svelte check: 0 errors, 39 existing warnings.
- Targeted TypeScript ESLint: passed.
- Full units: 899 passed; only the five guard-reproduced Reorder failures remained.
- Vite build and `svelte-package`: completed. The combined build command stalled when publint invoked `pnpm pack`; direct `publint --pack false` reported “All good.”
- `git diff --check`: passed.

Outstanding:

- Browser tests and the authoritative 29-case comparison were not run, per guard ownership. Parity is not claimed until that rerun.
- The five Reorder failures remain untouched and outside scope.
- Guard-owned `.agents` changes present in the worktree were not modified.
- A cache created by the failed npm wrapper was moved recoverably to `/tmp/svelte-motion-transform-page-point-pnpm-store-executor-round1`.
