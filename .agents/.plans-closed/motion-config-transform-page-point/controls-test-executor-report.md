Implemented the approved controls amendment.

Changed only [e2e/drag/controls.spec.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/e2e/drag/controls.spec.ts).

- Protected first test remains byte-identical.
- Added exact React 13.2.0 tiny-nudge expectations and a separate active x-only drag.
- Added viewport, geometry, pointer-input, lifecycle, initial-transform, and repeated-position assertions.
- Repeated drags now assert `(650,427)`, `(600,377)`, and delta `(-50,-50)`.

Checks:

- Prettier: passed
- Targeted ESLint: passed
- Targeted TypeScript: passed
- `npm run check`: passed with 0 errors and 39 existing warnings
- Diff/scope checks: passed; one modified file
- Repository-wide raw `tsc`: encountered pre-existing unrelated errors in `usePresence.spec.ts` and `element-ref-resize/+page.ts`

No build, browser/e2e run, commit, or other file changes were performed. Browser pass remains unclaimed pending guard verification.
