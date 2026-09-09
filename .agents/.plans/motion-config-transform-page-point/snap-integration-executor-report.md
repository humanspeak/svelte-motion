Implemented the narrow reactive integration fix in [_MotionContainer.svelte](/Users/jasonkummerl/Github/svelte-motion-transform-page-point/src/lib/html/_MotionContainer.svelte:1579):

- Wrapped `attachDrag(...)` in `untrack`, capturing the narrowed element as `dragTarget`.
- Kept `resolveDragOptions()` reactive, while wrapping imperative `updateOptions(...)` in `untrack`.
- Confirmed the commit-time drag update at line 2210 was already untracked.

Verified:

- Focused Reorder: 14/14 passed.
- Drag/gesture/config suites: 89/89 passed across 8 files.
- Prettier: passed.
- `svelte-check`: 0 errors, 39 existing warnings.
- `git diff --check`: passed.
- `e2e/drag/controls.spec.ts`: unchanged.
- No browser/e2e, build, install, dependency, test, docs, plan, or commit operations performed.

Only source file written: `src/lib/html/_MotionContainer.svelte`. Concurrent guard artifacts under `.agents/.plans/...` were preserved untouched. The failed `pnpm exec` created `.pnpm-store`; I moved it recoverably to `/private/tmp/svelte-motion-transform-page-point-pnpm-store-created-by-codex-20260908-1348`.
