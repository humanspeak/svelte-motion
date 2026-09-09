Implemented the approved narrow amendment in [reorder.component.spec.ts](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/components/Reorder/reorder.component.spec.ts:16).

Changes:

- Added valid primary mouse pointer metadata.
- Added deterministic fake-timer frame advancement after gesture batches.
- Added failure-safe pointer cancellation and callback draining in `afterEach`.
- Preserved all coordinates, axis behavior, reorder counts/order, keyed compensation, and no-double-correction assertions.
- No production, dependency, lockfile, workflow, `.agents`, or git changes made.

Verification:

- `node_modules/.bin/vitest run src/lib/components/Reorder/reorder.component.spec.ts` — 14/14 passed.
- `node_modules/.bin/vitest run` — 82 files, 904/904 tests passed.
- Prettier check — passed, file unchanged.
- ESLint on the spec — passed.
- `git diff --check` — passed.

No remaining failures. Existing guard-owned `.agents` worktree changes were left untouched. No browser-parity claim or browser testing performed.
