# Plan 007: Run `useAnimationFrame` on Motion's frameloop, passing `(time since start, delta)`

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4207** (`PW_PORT=4207`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Drift check (run first)**: `git diff --stat 45a24c6e..HEAD -- src/lib/utils/animationFrame.ts src/lib/utils/animationFrame.spec.ts docs/src/routes/docs/use-animation-frame docs/src/lib/examples/use-animation-frame src/routes/tests/animation-frame`
> Expected: no output. On any change, compare the "Current state" excerpts with the live code; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED. The callback's first argument changes meaning (absolute rAF time → time since the loop started),
  which is a user-visible behavior change.
- **Depends on**: none
- **Wave**: 1
- **Category**: migration (upstream parity)
- **Planned at**: commit `45a24c6e` (`origin/main`, v2.5.0, Motion 14.5.0), 2026-10-26

## Why this matters

svelte-motion's `useAnimationFrame` runs its own `requestAnimationFrame` loop and calls `callback(rafTimestamp)`.
Upstream's `useAnimationFrame` schedules on Motion's frameloop (`frame.update(cb, true)`) and calls
`callback(timestamp - startTimestamp, delta)`. The difference matters in three ways:

1. svelte-motion's callback never receives `delta`, although the docs demo
   (`docs/src/lib/examples/use-animation-frame/demos/Default.svelte:4`) already tells users it does:
   "`useAnimationFrame(cb)` calls `cb(time, delta)` every animation frame".
2. It runs outside Motion's frame steps, so its writes aren't batched with Motion's `update` step, and it can't be
   driven by Motion 14.6's `processFrame()` or `MotionGlobalConfig.useManualTiming` (WebXR loops, deterministic
   tests). `useTime` (`src/lib/utils/time.svelte.ts`) already uses the frameloop.
3. Its `time` is the absolute page time, not time since the loop started.

## Current state

- `src/lib/utils/animationFrame.ts:35-56`:
  ```ts
  export const useAnimationFrame = (callback: (time: DOMHighResTimeStamp) => void): (() => void) => {
      // SSR guard
      if (typeof window === 'undefined') return () => {}

      let rafId: number | undefined
      let isActive = true

      const loop = (time: DOMHighResTimeStamp) => {
          callback(time)
          if (isActive) {
              rafId = requestAnimationFrame(loop)
          }
      }

      rafId = requestAnimationFrame(loop)

      return () => {
          isActive = false
          if (rafId !== undefined) {
              cancelAnimationFrame(rafId)
          }
      }
  }
  ```
  Its JSDoc (lines 1-34) says the callback "receives a DOMHighResTimeStamp representing the time elapsed since the
  time origin". The hook returns a cleanup and is used as `$effect(() => useAnimationFrame(cb))`; some callers call
  it without `$effect` (`docs/src/lib/examples/armed-buttons/DeleteArmedWaitButton.svelte:71`). Keep that
  signature and return value.
- `src/lib/utils/time.svelte.ts:41-57`, the frameloop pattern to match:
  ```ts
  const startTimeBase = (): { base: MotionValue<number>; cancel: () => void } => {
      const base = motionValue<number>(0)
      let start = 0
      const tick = ({ timestamp }: FrameData) => {
          if (!start) start = timestamp
          base.set(timestamp - start)
      }
      frame.update(tick, true)
      return {
          base,
          cancel: () => cancelFrame(tick)
      }
  }
  ```
- `src/lib/utils/animationFrame.spec.ts` stubs `requestAnimationFrame` / `cancelAnimationFrame` with
  `vi.stubGlobal` and drives frames by calling the captured callback with timestamps (100, 116.67, 133.33) and
  asserting `toHaveBeenCalledWith(100)` etc. These tests describe the old behavior and get rewritten in Step 1.
- Callers, and why they keep working with time-since-start:
  - `src/routes/tests/animation-frame/+page.svelte` and `docs/src/lib/examples/use-animation-frame/demos/Default.svelte`
    use `Math.sin(t / …)` and `(t / 20) % 360`: periodic, so any origin is fine.
  - `src/routes/tests/ai-glow-border/+page.svelte:153` and `docs/src/lib/examples/ai-glow-border/demos/Default.svelte:163`
    compute `dt` from consecutive `now` values and a phase `now / 1000`: fine.
  - `docs/src/lib/examples/armed-buttons/DeleteArmedWaitButton.svelte:71` and `docs/src/lib/examples/armed-buttons/demos/Default.svelte:50`
    compare `time` with their own `nextSpinAt` values that are derived from `time` in the same callback: fine.
  - Do not edit any of them.

### Upstream (verified at `~/Github/motion` tag `v14.6.0`)

`packages/framer-motion/src/utils/use-animation-frame.ts`:

```ts
export type FrameCallback = (timestamp: number, delta: number) => void

export function useAnimationFrame(callback: FrameCallback) {
    const initialTimestamp = useRef(0)
    const { isStatic } = useContext(MotionConfigContext)

    useEffect(() => {
        if (isStatic) return

        const provideTimeSinceStart = ({ timestamp, delta }: FrameData) => {
            if (!initialTimestamp.current) initialTimestamp.current = timestamp

            callback(timestamp - initialTimestamp.current, delta)
        }

        frame.update(provideTimeSinceStart, true)
        return () => cancelFrame(provideTimeSinceStart)
    }, [callback])
}
```

(`isStatic` is React's static-render mode; svelte-motion has no equivalent, skip it.)

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| One unit file | `pnpm exec vitest run src/lib/utils/animationFrame.spec.ts` | all pass |
| Unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint/format | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| E2E | `PW_PORT=4207 pnpm exec playwright test <paths>` | all pass |

## Scope

**In scope**: `src/lib/utils/animationFrame.ts`, `src/lib/utils/animationFrame.spec.ts`,
`docs/src/routes/docs/use-animation-frame/+page.svx` (describe the arguments),
`.changeset/use-animation-frame-frameloop.md` (create).

**Out of scope**: every caller listed above; `time.svelte.ts`; `src/lib/index.ts` (the export name is unchanged;
export the `FrameCallback` type only if a type is needed, see Step 2).

## Git workflow

- Lane branch `lane/1460-raf` in `../svelte-motion-1460-raf`, created by the dispatcher from the wave-0 commit.
- Conventional commits, e.g. `test(useAnimationFrame): expect time since start and delta from Motion's frameloop`,
  `fix(useAnimationFrame): schedule on Motion's frameloop like upstream`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Red tests (rewrite the spec around the frameloop)

Rewrite `src/lib/utils/animationFrame.spec.ts` to drive Motion's frameloop instead of a stubbed rAF. Use
`frameSteps` and `frameData` from `motion-dom` to process one frame by hand, as other specs do
(`src/lib/utils/effects.spec.ts:112-122` loops over all eight `frameSteps.*.process(frameData)`):

```ts
const runFrame = (timestamp: number, delta: number) => {
    frameData.timestamp = timestamp
    frameData.delta = delta
    frameData.isProcessing = true
    for (const step of Object.values(frameSteps)) step.process(frameData)
    frameData.isProcessing = false
}
```

Tests:

1. `passes time since the first frame and the frame delta`: `useAnimationFrame(cb)`; `runFrame(1000, 16)` →
   `cb` called with `(0, 16)`; `runFrame(1016, 16)` → `(16, 16)`; `runFrame(1050, 34)` → `(50, 34)`.
2. `schedules on Motion's update step`: `frame.update(spy)` scheduled before the hook's first frame runs in the
   same frame as `cb`, and `cb` runs before a `frame.render` callback scheduled in the same frame (record call
   order into an array).
3. `stops after cleanup`: call the returned cleanup, `runFrame(...)` → `cb` not called again.
4. `cleanup inside the callback stops the loop`: the callback calls its own cleanup on the second frame; a third
   frame doesn't call it.
5. Keep the existing SSR test (no `window` → returns a no-op), adapted.

**Verify**: `pnpm exec vitest run src/lib/utils/animationFrame.spec.ts` → tests 1, 2 and 3 **FAIL** (the current
hook never runs on `frameSteps`). If they pass, STOP.

Commit (`test(useAnimationFrame): expect time since start and delta from Motion's frameloop`).

### Step 2: Implement on `frame.update`

Rewrite `useAnimationFrame` in `animationFrame.ts`:

```ts
import { cancelFrame, frame, type FrameData } from 'motion-dom'

/** Callback for {@link useAnimationFrame}: time since the loop started and this frame's delta, both in ms. */
export type FrameCallback = (time: number, delta: number) => void

export const useAnimationFrame = (callback: FrameCallback): (() => void) => {
    if (typeof window === 'undefined') return () => {}

    let start = 0
    const provideTimeSinceStart = ({ timestamp, delta }: FrameData) => {
        if (!start) start = timestamp
        callback(timestamp - start, delta)
    }

    frame.update(provideTimeSinceStart, true)
    return () => cancelFrame(provideTimeSinceStart)
}
```

Rewrite the JSDoc in Google style: it mirrors framer-motion `utils/use-animation-frame.ts` @ v14.6.0; the callback
receives `(time, delta)`, where `time` is milliseconds since the loop's first frame and `delta` the frame's elapsed
time; it runs in Motion's `update` step, so it is driven by `processFrame()` and `MotionGlobalConfig.useManualTiming`
too; SSR-safe; returns a cleanup. Keep the `@example`, switching its parameter to `(time, delta)`.

If `src/lib/index.ts` should expose `FrameCallback`: add `export type { FrameCallback } from '$lib/utils/animationFrame'`
next to the existing `useAnimationFrame` export (line ~165). Then `src/lib/index.ts` is in scope for that one
line only.

**Verify**: `pnpm exec vitest run src/lib/utils/animationFrame.spec.ts` → all pass; `pnpm check` → 0 errors (every
caller still type-checks: a one-parameter callback is assignable to `FrameCallback`).

### Step 3: Callers still work in a browser

**Verify**: `PW_PORT=4207 pnpm exec playwright test e2e/utilities e2e/armed-buttons` → all pass (re-run a failing
spec alone once before reporting). Then `grep -rln "animation-frame\|ai-glow-border" e2e` and run any spec it lists
that isn't already covered; all pass.

### Step 4: Docs and changeset

1. `docs/src/routes/docs/use-animation-frame/+page.svx`: wherever the callback's argument is described, say it
   receives `(time, delta)`: `time` is milliseconds since the loop started (not the page's `performance.now()`),
   `delta` the milliseconds since the previous frame, and it runs in Motion's update step.
2. Create `.changeset/use-animation-frame-frameloop.md` (bump `minor`, since the argument's meaning changes):
   "`useAnimationFrame` now runs on Motion's frameloop, like Motion's own hook. The callback receives `(time, delta)`:
   `time` counts from the loop's first frame instead of the page's time origin, and `delta` is the frame's elapsed
   time. Code that only uses differences between frames or periodic functions of `time` is unaffected. It can now be
   driven by `processFrame()` and manual timing."

**Verify**: `trunk check` on the changed files → clean.

### Step 5: Gate

**Verify**: `pnpm check` (0 errors), `pnpm test:only` (all pass), `pnpm build` (exit 0), `git status` shows only
in-scope files.

## Test plan

- Red-first: the rewritten spec's frameloop tests fail against the rAF implementation and pass after Step 2.
- Browser guards: `e2e/utilities` and `e2e/armed-buttons`, plus any e2e spec covering the `animation-frame` or
  `ai-glow-border` pages.

## Done criteria

- [ ] `grep -n "requestAnimationFrame" src/lib/utils/animationFrame.ts` → no matches outside comments
- [ ] `grep -n "frame.update(provideTimeSinceStart, true)" src/lib/utils/animationFrame.ts` → one match
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0; the Step 3 e2e specs pass
- [ ] Docs and changeset updated; no out-of-scope files modified

## STOP conditions

- The Step 1 frameloop tests pass before Step 2.
- A caller listed above fails to type-check or its e2e spec fails twice.
- A caller depends on the absolute timestamp in a way not listed above (for example comparing with
  `performance.now()`); report it instead of editing it.

## Maintenance notes

- `useAnimationFrame` and `useTime` now share the frameloop. If a user reports `useAnimationFrame` "stopping" in a
  background tab or under manual timing, that is Motion's frameloop behavior, same as upstream.
- Plan 010 adds a `stepFrames` test helper; once it lands, this spec's `runFrame` helper can switch to it.
