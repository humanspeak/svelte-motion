Implemented the narrow correction in [src/lib/utils/drag.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/utils/drag.ts:48):

- Imported public Svelte `untrack` as `untrackSvelte`.
- Untracked both axis MotionValue reads in `captureProjectionAxisValues`.
- Preserved the paired projection-layout/axis-value measurement boundary and existing ownership/listeners.
- No other files changed.

Verification:

- Focused units: 16 files, 132 tests passed.
- Prettier: passed.
- ESLint: passed.
- `svelte-check`: 0 errors, 39 pre-existing warnings.
- `git diff --check`: passed.

Guard-owned strict29/isolated browser checks remain unrun, as required. Full-browser, build, container, and the unrelated opacity failure were untouched.
