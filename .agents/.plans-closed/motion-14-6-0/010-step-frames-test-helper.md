# Plan 010: Add `stepFrames` / `withManualFrames` test helpers on Motion's `processFrame`

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Requires plan 001** (pins at Motion 14.6.0, which adds `processFrame`). Before starting, confirm
> `grep -n '"motion-dom": "14.6.0"' package.json` prints a line. If not, STOP.
>
> **Revision 2026-10-26**: after the adversarial review, case 3 runs inside a `withManualFrames()` block. It
> starts `animate()` before the first `stepFrames()`, which is exactly the case upstream's `withManualFrames` exists
> for; without it the animation's start time comes from the real clock and the ≈50 check is nondeterministic.
>
> **Revision 2026-10-26 (2)** (maintainer-approved, after the first run stopped at Step 4): `pnpm build` copies every
> `__tests__` folder into `dist/` (already true for the existing helpers); `package.json` `files` excludes
> `dist/**/__tests__/**` and `*.spec.*` from the tarball. The "not packaged" check now inspects the tarball
> (`npm pack --dry-run`) instead of `dist/`.
>
> **Drift check (run first)**: `git diff --stat 45a24c6e..HEAD -- src/lib/utils/__tests__ src/lib/utils/effects.spec.ts`
> Expected: no output. On any change, compare the "Current state" excerpts with the live code; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (test code only)
- **Depends on**: 001 (needs `processFrame` from motion-dom 14.6.0)
- **Wave**: 2
- **Category**: dx / tests
- **Planned at**: commit `45a24c6e` (`origin/main`, v2.5.0, Motion 14.5.0), 2026-10-26

## Why this matters

svelte-motion's unit specs drive Motion's frameloop by hand in several different ways: stubbed
`requestAnimationFrame`, fake timers, and hand-written loops over all eight `frameSteps.*.process(frameData)`.
Motion 14.6.0 added `processFrame(timestamp)` and, in its own test suites, two small helpers built on it:
`stepFrames(duration)` advances a manual clock frame by frame, and `withManualFrames()` puts a describe block on a
manual clock. They make time-based tests deterministic. Upstream doesn't export them (its CHANGELOG says "Added:
`stepFrames`", but it only exists in test folders), so this plan adds svelte-motion's own copies in the test-only
helpers folder, unit-tests them, and migrates the one spec that hand-rolls a full frame.

## Current state

- `src/lib/utils/__tests__/` holds test-only helpers excluded from the published bundle (for example
  `intersectionObserver.ts`, whose JSDoc says "Lives under `__tests__/` so it's excluded from the published bundle
  and can freely import `vitest`"). Match that file's style: named exports, Google-style JSDoc with `@example`.
- `src/lib/utils/testing.ts` only exports `sleep`, and `_MotionContainer.svelte:20` imports it at runtime, so it
  ships in the package. **Do not** add the new helpers there.
- `src/lib/utils/effects.spec.ts:111-122`:
  ```ts
      // jsdom has no requestAnimationFrame when motion-dom loads, so its frameloop
      // never self-schedules; drive one batch by hand.
      const flushFrames = () => {
          frameSteps.setup.process(frameData)
          frameSteps.read.process(frameData)
          frameSteps.resolveKeyframes.process(frameData)
          frameSteps.preUpdate.process(frameData)
          frameSteps.update.process(frameData)
          frameSteps.preRender.process(frameData)
          frameSteps.render.process(frameData)
          frameSteps.postRender.process(frameData)
      }
  ```
  used at lines 127, 136, 145, 154.

### Upstream (verified at `~/Github/motion` tag `v14.6.0`)

`packages/motion-dom/src/frameloop/__tests__/utils.ts`:

```ts
import { MotionGlobalConfig } from "motion-utils"
import { frameData } from "../frame-data"
import { processFrame } from "../process-frame"

/**
 * Run each test in the current describe block on a manual clock, for tests
 * whose animations start before the first stepFrames. Frames from
 * requestAnimationFrame still fire but don't advance time.
 */
export const withManualFrames = () => {
    beforeEach(() => {
        MotionGlobalConfig.useManualTiming = true
    })
    afterEach(() => {
        MotionGlobalConfig.useManualTiming = false
    })
}

/**
 * Switch to a manual clock, then advance it by `duration` ms, processing a
 * frame every `frameDuration` ms and letting promises settle between frames.
 * Reset MotionGlobalConfig.useManualTiming after the test.
 */
export const stepFrames = async (
    duration: number,
    frameDuration = 1000 / 60
) => {
    MotionGlobalConfig.useManualTiming = true
    const end = frameData.timestamp + duration
    let timestamp = frameData.timestamp
    while (timestamp < end) {
        processFrame((timestamp = Math.min(timestamp + frameDuration, end)))
        await Promise.resolve()
    }
}
```

`processFrame` (`motion-dom/src/frameloop/process-frame.ts`) runs every frame step, is ignored inside a frame, and
uses the given timestamp as-is when `useManualTiming` is on. In svelte-motion import `MotionGlobalConfig`,
`frameData` and `processFrame` from `motion-dom` (or `motion`); `motion-utils` isn't a direct dependency.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| One unit file | `pnpm exec vitest run <path>` | all pass |
| Unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint/format | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| Package | `pnpm build` | exit 0 (and the helpers are not in the `npm pack` tarball) |

## Scope

**In scope**: `src/lib/utils/__tests__/frames.ts` (create), `src/lib/utils/__tests__/frames.spec.ts` (create),
`src/lib/utils/effects.spec.ts` (replace `flushFrames`'s body).

**Out of scope**: `src/lib/utils/testing.ts`; a public `./testing` package entry (upstream ships none); migrating
other specs (`animationFrame.spec.ts` belongs to plan 007; Reorder specs are being edited by plans 003, 004 and 009).
List further candidates in your report instead.

## Git workflow

- Lane branch `lane/1460-frames` in `../svelte-motion-1460-frames`, created by the dispatcher from
  `feat/motion-14.6.0` after plan 001 is committed.
- Conventional commits, e.g. `test: add stepFrames/withManualFrames helpers on processFrame`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Helper tests first

Create `src/lib/utils/__tests__/frames.spec.ts` importing `stepFrames` and `withManualFrames` from `./frames.js`
(the module doesn't exist yet). Cases:

1. `stepFrames processes a frame per frameDuration and lands on the end time`: record `frameData.timestamp` in a
   `frame.update(cb, true)` keep-alive callback; `await stepFrames(100, 25)` → the callback saw 4 frames, the last
   at `start + 100`. `cancelFrame(cb)` after.
2. `stepFrames lets promises settle between frames`: a `frame.update` callback that resolves a promise whose
   `.then` schedules another `frame.update`; after `stepFrames(50, 1000 / 60)` the second callback ran.
3. `stepFrames drives a JS animation to completion`, inside a nested `describe` that calls `withManualFrames()`
   (the animation starts before the first `stepFrames`, so the clock must already be manual):
   `const value = motionValue(0)`;
   `animate(value, 100, { duration: 0.2, ease: 'linear' })` (import from `motion-dom` or `motion`); `await stepFrames(100)`
   → `value.get()` ≈ 50 (±1); `await stepFrames(150)` → 100.
4. `withManualFrames turns manual timing on inside the block and off after`: a nested `describe` calling
   `withManualFrames()` whose test asserts `MotionGlobalConfig.useManualTiming === true`; a later top-level test
   asserts it's `false`.
5. An `afterEach` at file level resets `MotionGlobalConfig.useManualTiming = false`.

**Verify**: `pnpm exec vitest run src/lib/utils/__tests__/frames.spec.ts` → fails to import `./frames.js`.

### Step 2: The helpers

Create `src/lib/utils/__tests__/frames.ts` with `withManualFrames` and `stepFrames` as in upstream (import
`beforeEach`/`afterEach` from `vitest`; `MotionGlobalConfig`, `frameData`, `processFrame` from `motion-dom`). JSDoc in
Google style with `@param`, `@returns`, `@example`, citing `motion-dom/src/frameloop/__tests__/utils.ts @ v14.6.0`
and noting callers must reset `MotionGlobalConfig.useManualTiming` after a test that calls `stepFrames` without
`withManualFrames`.

**Verify**: `pnpm exec vitest run src/lib/utils/__tests__/frames.spec.ts` → all pass. If case 3 is off by more than
a frame, STOP and report the observed values (it means animations aren't on the manual clock).

### Step 3: Migrate `effects.spec.ts`

Replace the body of `flushFrames` in `src/lib/utils/effects.spec.ts` with a single `processFrame()` call (import it
from `motion-dom`; drop `frameSteps` / `frameData` from the import if now unused) and update its comment to
"drive one frame with Motion's `processFrame` (jsdom never starts the rAF loop)".

**Verify**: `pnpm exec vitest run src/lib/utils/effects.spec.ts` → all pass, with the same number of tests as
before.

### Step 4: Gate

**Verify**: `pnpm check` (0 errors), `pnpm test:only` (all pass), `pnpm build` (exit 0) and
`npm pack --dry-run --json | python3 -c "import json,sys; print([f['path'] for f in json.load(sys.stdin)[0]['files'] if '__tests__' in f['path'] or 'frames' in f['path'] or '.spec.' in f['path']])"` → `[]` (helpers not in the published tarball; if any appear, STOP and report), `trunk check` on the changed files (clean), `git status` shows only in-scope files.

## Test plan

- Tooling plan: no existing behavior to reproduce. `frames.spec.ts` is written first and fails on the missing
  module, then passes.
- `effects.spec.ts` passing unchanged after the migration shows `processFrame` is a drop-in for the hand-written loop.

## Done criteria

- [ ] `src/lib/utils/__tests__/frames.ts` exports `stepFrames` and `withManualFrames`; `frames.spec.ts` passes
- [ ] `grep -n "frameSteps\." src/lib/utils/effects.spec.ts` → no matches
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0; helpers absent from the `npm pack` tarball
- [ ] Report lists further specs that could move to `stepFrames`

## STOP conditions

- `package.json` is not on motion-dom 14.6.0, or `processFrame` isn't exported by it.
- Step 2 case 3 is off by more than a frame.
- `__tests__`, `frames` or `.spec.` files appear in the `npm pack --dry-run` tarball.

## Maintenance notes

- New time-based specs should use `stepFrames` instead of fake timers or rAF stubs.
- `MotionGlobalConfig.useManualTiming` is global; a test that calls `stepFrames` must reset it (or use
  `withManualFrames`), otherwise later tests in the file run with WAAPI disabled.
