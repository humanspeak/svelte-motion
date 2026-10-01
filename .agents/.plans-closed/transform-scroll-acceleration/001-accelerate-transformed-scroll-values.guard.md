# Guard log: 001 accelerate-transformed-scroll-values

## Checkpoint 1 (2026-09-30 07:15): PLAN AMENDED + BLOCKED

261e9a0a · pre-flight and first dispatch

- Pre-flight: the plan told the executor to use `PW_REUSE_SERVER=1`. From a worktree that would test the main checkout's server on port 4198, not the worktree's own code. Added a dated revision: run e2e without reuse, never kill 4198, and report "blocked" if the port is busy.
- Harness `isolation: 'worktree'` created the worktree at `origin/main`, where the plan file doesn't exist. The executor correctly stopped. The harness then auto-deleted the unchanged worktree.
- Action: created a persistent worktree `../svelte-motion-scroll-accel` on `feat/transform-scroll-acceleration` at 261e9a0a and re-dispatched a fresh Sonnet executor.

## Checkpoint 2 (2026-09-30 07:30): PLAN AMENDED

c0d62979 (snapshot) · after first full execution

- Reproduced: transform + scroll specs 40/40; `pnpm test:only` 1039/1039; `pnpm check` 0 errors; `pnpm package` exits 0 with publint "All good!"; trunk reports no issues; e2e new spec + will-change 9/9 on chromium with ScrollTimeline (tests 2–3 ran, not skipped).
- Diff read: `propagateAccelerate` passes the original `source` at both call sites (`transform.svelte.ts`), pads with `ease[0]`, and applies the `isMonotonicUnitRange` guard. Docs are accurate. All files are in scope.
- Mutation probe: dropping the #3857 padding (`times: input`, `keyframes: output`) left e2e test 3 **green**. A probe on the mutated build showed inline `opacity` at the bottom is `"1"`, so JS still writes it. The native keyframes were `[[0.25,"0.2"],[0.5,"1"]]`. Computed opacity therefore cannot observe the padding in this library.
- Classified as a **plan defect**, not executor drift: the plan asserted the test would catch it. The executor had reported the same observation honestly.
- Action: amended the plan (dated revision: assert `getKeyframes()` offsets and values) and fix-dispatched the same executor.

## Checkpoint 3 (2026-09-30 07:42): ON TRACK

e0b8200a (snapshot) · final close-out

- The fix is surgical: only test 3 in the spec gained a `getKeyframes()` assertion.
- Reproduced: real code gives 4/4. With the padding mutation, test 3 fails (1 failed, 3 passed). The source was restored and the tree is clean.
- Integrated onto `chore/upstream-delta-2026-09-30` as 4cf008fd, 023d2174, and 4158073b. On the combined branch: build ✓, unit 1039/1039, consumer suite (including the tree-shaking guard) ✓, `pnpm check` 0 errors, e2e 9/9.
- Action: PASS.
