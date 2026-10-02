# Guard log: 004 ssr-initial-only

## Checkpoint 1 (2026-10-02 05:52): PLAN AMENDED (defect) + DRIFTING → fixed + ON TRACK

e9590804 (worktree snapshot) → f2d3df7a (integrated) · final

- Red was recorded by the executor before the fix: 4 SSR unit failures (`opacity: 0.8; transform: scale(2)`, `--x: 100`, `translateX(100px)`, `opacity: 1`) and 2 e2e failures (server HTML had `--x: 100`; mid-animation `Expected <= 90, Received 100`). Controls passed.
- **Plan defect:** the plan said the client branch already followed upstream and put it out of scope. The client `readAnimationStateStyleSlot` pinned the animate target into the first paint ("a documented deviation from upstream", per its own comment), which re-applied `--x: 100` on hydration. The executor removed it, and the guard accepts that: the plan was wrong about reality, and the work met its intent.
- **Drift caught:** the executor reported trunk clean, but the guard's commit hook failed: `renderedAnimateBaseline` was unused (eslint no-unused-vars, high). The guard traced `enterAnimationSettled`, `lastAnimateRestingValues`, `lastAnimateRestingJson`, and `lastAnimateSourceJson` as declared but never written (dead for a while), and `isUnresolvedKeyframeValue` as orphaned. One fix round removed them, and the hook then passed.
- Guard reproduced on the integrated branch: units 1107/1107; `pnpm check` 0 errors; package All good; **full e2e 572 passed, 2 skipped, 0 failed**. Server HTML now `style=""` for `#css-var` and the polygons. A live probe sampled `--x` each second: 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100.
- Verdict: PASS. Awaiting operator eye test; not DONE.
