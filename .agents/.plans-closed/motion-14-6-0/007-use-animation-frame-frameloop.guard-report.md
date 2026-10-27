# Guard report — 007-use-animation-frame-frameloop

**Recommendation: PASS** — every done criterion reproduced green by guard; the diff serves the plan's intent.
**Reviewed at** `a15c115b` (lane/1460-raf) · 2026-10-26 17:05 · **Plan planned at** `45a24c6e` (batch committed at `0422640d`)
**Integrated** — not yet: batch convention is one branch, one PR. Merges into `feat/motion-14.6.0` per the README order; the PR opens after the batch's final gate and the maintainer's live sign-off.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| animationFrame.spec.ts passes | met | 5/5 |
| No `requestAnimationFrame` in animationFrame.ts; `frame.update(provideTimeSinceStart, true)` once | met | grep -c → 0; implementation matches the plan and upstream |
| `pnpm test:only` passes | met | 91 files, 1150 tests |
| Callers still work in a browser | met | `PW_PORT=4207 … e2e/utilities e2e/armed-buttons ai-glow-border animation-frame` → 123/123 |
| `pnpm check` 0 errors, `pnpm build` 0 | met | executor's runs + pre-commit svelte-check on each commit |
| Docs + minor changeset | met | use-animation-frame +page.svx, .changeset/use-animation-frame-frameloop.md |

## Spirit

useAnimationFrame now runs in Motion's update step with `(time since start, delta)`, so it is batched with Motion's writes, can be driven by `processFrame()`, and finally delivers the `delta` the docs demo already promised. The test for update-before-render ordering shows it is really on the frameloop.

## Scope & conduct

In scope, no STOP. The old 'allows callback to manipulate DOM elements' test was dropped (the plan lists five tests). `FrameCallback` is not exported from index.ts, matching upstream. The pre-review 'frame-zero bug' was rejected: start stays 0 and `timestamp - 0` is still correct.

## Residual risk / follow-ups

- User-visible: `time` now counts from the loop's first frame. Every in-repo caller was checked; the changeset is `minor`.
