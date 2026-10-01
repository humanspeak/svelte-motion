# Guard log: 001 bundle-tree-shaking-guard

## Checkpoint 1 (2026-09-30 07:15): BLOCKED

5e9d04a0 · first dispatch, before any executor work

- The harness `isolation: 'worktree'` created the executor worktree at `origin/main` (5e9d04a0), not at the plan commit 261e9a0a. The plan file was missing, and the executor correctly stopped instead of reading the main checkout.
- Once the executor stopped with no changes, the harness auto-deleted that worktree, so the resume had nowhere to run.
- Action: created a persistent worktree `../svelte-motion-tree-shaking` on `test/tree-shaking-guard` at 261e9a0a and re-dispatched a fresh Sonnet executor pinned to it.

## Checkpoint 2 (2026-09-30 07:36): ON TRACK

7d39fe5c (snapshot on test/tree-shaking-guard) · final close-out

- Scope: `git diff --stat 261e9a0a..7d39fe5c` shows exactly the 3 in-scope files (verify-tree-shaking.mjs +165, TreeShakeOptimized.svelte +5, verify.mjs +1).
- `pnpm build`, then `pnpm --filter @humanspeak/svelte-motion-consumer-vite6 test`, printed the Reorder, Tree-shaking, and SSR lines, exit 0 (21 s wall-clock).
- Guard reproduced Step 4 independently: after appending the used-import leak to `dist/utils/arc.js`, the check failed with `AssertionError [ERR_ASSERTION]: these exports pull in the motion component layer: arc`. After `pnpm build`, it passed again, and `grep -c __svelteMotionLeak dist/utils/arc.js` returned 0.
- `pnpm check`: 0 errors, 33 warnings, all in untouched files. `trunk check --no-fix` on the 3 files: no issues.
- The assertions are real: the positive controls (motion object; no-plugin fixture) guard against false passes, and every message names the docs promise it protects.
- Minor: `trunk fmt` placed the new import before `./verify-types.mjs` (import sorting), not after it as the plan said. This is harmless.
- Action: cherry-picked onto `chore/upstream-delta-2026-09-30` as 941f2640. PASS.
