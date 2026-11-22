# Guard log: plan 007 (a second in-place key change no longer strands the element)

## 2026-11-21, final: PASS

- **Executor:** opus 5.5, lane `lane/2141-007`, on a tip that already had plan 006. The key-tracker and key-effect excerpts matched word for word; only their line numbers had moved. No STOP conditions fired.
- **Red, executor-reported:** `PW_PORT=4217 … e2e/animate-presence/key-change-in-place.spec.ts` → 6/6 failed on unmodified code in `waitVisible` (`Expected: >= 0.99, Received: 0`). The guard didn't re-run the red, because it needs an e2e build. The reasoning was checked against the diff instead: the old cleanup set `keyTransitionStopped` on every re-run, and the `finally` then skipped clearing `keyTrackerIsTransitioning`.
- **Diff read in full:**
  - The four tracker variables are replaced.
  - The key effect returns no cleanup. Every async continuation checks the generation counter.
  - A change back to the exiting key reverses the exit (`setActive('exit', false)`, no rewind). A change to another key mid-exit only moves `keyTrackerPrev`, so the running transition enters with the latest props.
  - There is an `isCurrent()` guard after the re-enter's `await`.
  - The kickoff runs under `untrack`, and a separate teardown effect bumps the generation on unmount.
  - Only the two planned regions of `_MotionContainer.svelte` changed.
- **Executor-reported, not re-run:**
  - the new spec 8/8, with optional test 4 added;
  - `e2e/animate-presence` 218 passed, including `layout-button` (`RollingCopyButton`) and `wait-exit-key-change`;
  - `pnpm test:only` 1787 passed, `pnpm check` 0 errors, `pnpm build` ok, Trunk no new issues.
- **Needs maintainer sign-off:** `/tests/animate-presence/key-change-in-place` is a new tester page.
- **Integrated:** `7355c25f` on `fix/2.14.1`.
