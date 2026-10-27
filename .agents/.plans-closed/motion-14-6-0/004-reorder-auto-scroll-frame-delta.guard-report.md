# Guard report — 004-reorder-auto-scroll-frame-delta

**Recommendation: PASS** — every done criterion reproduced green by guard; the diff serves the plan's intent.
**Reviewed at** `b8d3cc78` (lane/1460-autoscroll) · 2026-10-26 17:05 · **Plan planned at** `45a24c6e` (batch committed at `0422640d`)
**Integrated** — not yet: batch convention is one branch, one PR. Merges into `feat/motion-14.6.0` per the README order; the PR opens after the batch's final gate and the maintainer's live sign-off.

## Done criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| autoScroll.spec.ts passes incl. refresh-rate and mid-frame cases | met | 14/14 |
| `scrollSpeed` scales by `frameData.delta`, `maxSpeed = 1.5` | met | `autoScroll.ts` diff; matches upstream v14.6.0 `auto-scroll.ts:5,75` |
| `pnpm check` 0 errors | met | 0 errors, 33 warnings (pre-existing) |
| `pnpm test:only` passes | met | 91 files, 1152 tests |
| `PW_PORT=4204 … e2e/reorder/scrollable.spec.ts` passes | met | 5/5 |
| Only in-scope files | met | autoScroll.ts, autoScroll.spec.ts, changeset |

## Spirit

Auto-scroll speed is now per millisecond, so 30/60/120/240 Hz scroll the same distance per second, and an extra mid-frame onDrag can't double a frame's distance. The red tests showed 1920 vs 960 px and 50 vs 25 px on the old code.

## Scope & conduct

In scope, no STOP, committed per the Git workflow. The `frameData.delta` grep matches 5 lines (1 code, 4 comments); the intent of the criterion (one code use) holds.

## Residual risk / follow-ups

- None beyond upstream's: speed now depends on `frameData.delta` being set, which holds because it runs from `onDrag` inside a frame.
