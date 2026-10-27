# Plan 002: Retry unresolved refs without stalling motion-dom's `microtask` batcher

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4202** (`PW_PORT=4202`). This plan normally needs no
> Playwright run. Never use or kill port 4198.
>
> **Drift check (run first)**: `git diff --stat 45a24c6e..HEAD -- src/lib/utils/attachable.ts src/lib/utils/attachable.spec.ts src/lib/utils/scroll.svelte.ts src/lib/utils/scroll.svelte.spec.ts src/lib/utils/dom.ts`
> Expected: no output. If any listed file changed, compare the "Current state" excerpts below with the live code;
> on a mismatch, STOP.

## Status

- **Priority**: P1 (a page-wide stall, highest-impact finding in this batch)
- **Effort**: S
- **Risk**: MED. `useInView` and `useScroll` both depend on the retry path.
- **Depends on**: none
- **Wave**: 1
- **Category**: bug
- **Planned at**: commit `45a24c6e` (`origin/main`, v2.5.0, Motion 14.5.0), 2026-10-26

## Why this matters

motion-dom's `microtask` batcher is a page-wide singleton. motion-dom uses it for projection updates
(`didUpdate` → `microtask.read(scheduleUpdate)`), `VisualElement.scheduleRenderMicrotask()` (which
svelte-motion's `_MotionContainer.svelte` calls after every prop commit), `animateView` and `animateLayout`
queues. If a job **re-schedules itself on `microtask` while the batcher is processing**, the batcher never runs
again: every later `microtask.*` job on the page is silently dropped.

svelte-motion does exactly that. `createAttachable` (behind `useInView`) and `useScroll` wait for a `bind:this`
ref by re-scheduling `microtask.read(...)` from inside their own `microtask` job. If the ref is still unresolved
on that second try, the stall happens. Reproduced during planning against the installed motion-dom 14.5.0:

```js
import { microtask } from 'motion-dom'
let n = 0
const tick = () => { n++; if (n < 3) microtask.read(tick) }
microtask.read(tick)
// 20 ms later: microtask.read(() => { laterJobRan = true })
// result: { pollRuns: 1, laterJobRan: false }
```

After this plan, ref retries use their own scheduler and never touch the shared batcher. Same-tick `bind:this`
hydration still attaches on the next microtask, and longer waits retry on animation frames, so a ref that never
resolves (`{#if false}`) can't spin the microtask queue either.

## Current state

### Why the batcher stalls (motion-dom `src/frameloop/batcher.ts` @ v14.5.0 and v14.6.0, identical)

Read it with `git -C ~/Github/motion show v14.6.0:packages/motion-dom/src/frameloop/batcher.ts`. The relevant
lines:

```ts
const processBatch = () => {
    // ...
    runNextFrame = false
    // ...
    state.isProcessing = true
    setup.process(state)
    read.process(state)
    // ... the other steps ...
    state.isProcessing = false

    if (runNextFrame && allowKeepAlive) {      // allowKeepAlive is false for `microtask`
        useDefaultElapsed = false
        scheduleNextBatch(processBatch)
    }
}

const wake = () => {
    runNextFrame = true
    useDefaultElapsed = true
    if (!state.isProcessing) {
        scheduleNextBatch(processBatch)
    }
}

const schedule = stepsOrder.reduce((acc, key) => {
    const step = steps[key]
    acc[key] = (process, keepAlive = false, immediate = false) => {
        if (!runNextFrame) wake()
        return step.schedule(process, keepAlive, immediate)
    }
    return acc
}, {} as Batcher)
```

`motion-dom/src/frameloop/microtask.ts`: `createRenderBatcher(queueMicrotask, false)`. Scheduling during a batch
sets `runNextFrame = true` without scheduling a batch (it's processing); the batch ends without a follow-up
(`allowKeepAlive` false); `runNextFrame` stays `true`, so every later `schedule` skips `wake()`. Nothing resets it.

### svelte-motion call sites

- `src/lib/utils/attachable.ts:1` imports `cancelMicrotask, microtask` from `motion-dom`. Lines 90-99:
  ```ts
      const pollTick = () => {
          pollScheduled = false
          tryAttach()
      }

      const cancelPoll = () => {
          if (pollScheduled) {
              cancelMicrotask(pollTick)
              pollScheduled = false
          }
      }
  ```
  and lines 124-133 inside `tryAttach`:
  ```ts
          if (needsPoll) {
              // Microtask schedule (matches useScroll's pattern) — one frame
              // faster than rAF for refs that hydrate the same tick.
              if (!pollScheduled) {
                  pollScheduled = true
                  microtask.read(pollTick)
              }
              return
          }
  ```
  `pollTick` → `tryAttach` → `microtask.read(pollTick)` again while the batcher is processing: the stall.
- `src/lib/utils/scroll.svelte.ts:1-10` imports `cancelMicrotask, microtask` from `motion-dom`. Two self-rescheduling
  loops:
  - `makeAccelerateConfig` (lines 102-123):
    ```ts
        factory: (animation: AnimationPlaybackControls) => {
            let cleanup: VoidFunction | undefined
            const start = () => {
                if (isRefPending(options.container) || isRefPending(options.target)) {
                    microtask.read(start)
                    return
                }
                cleanup = scroll(animation, { /* … */ })
            }
            microtask.read(start)
            return () => {
                cancelMicrotask(start)
                cleanup?.()
            }
        },
    ```
  - `useScroll` body (lines 205-235):
    ```ts
        let cleanup: VoidFunction | undefined
        const start = () => {
            if (isRefPending(options.container) || isRefPending(options.target)) {
                microtask.read(start)
                return
            }
            cleanup = scroll(/* … */)
        }

        $effect(() => {
            microtask.read(start)
            return () => {
                cancelMicrotask(start)
                cleanup?.()
                // … destroys the four motion values …
            }
        })
    ```
- `src/lib/utils/attachable.spec.ts:1-21` header comment already noticed the symptom and misattributed it: "Running
  it here in isolation is gated by motion-dom's microtask batcher needing an external wake event
  (`allowKeepAlive: false`), which doesn't naturally fire in vitest's jsdom environment."
- `src/lib/utils/dom.ts` exports `resolveElement` and `isRefPending` (lines ~55-70). Module style: named `const`
  arrow exports with Google-style JSDoc (`@param`, `@returns`, `@example`). Match it.

### Upstream note

Upstream `framer-motion/src/value/use-scroll.ts:47-55` @ v14.6.0 has the same self-rescheduling
`microtask.read(start)` pattern, so upstream has this latent bug too. svelte-motion deliberately diverges here;
say so in a comment with the citation `motion-dom/src/frameloop/batcher.ts` (processBatch / wake / schedule).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Install | `pnpm install` | exit 0 |
| Typecheck | `pnpm check` | 0 errors |
| Unit tests | `pnpm test:only` | all pass |
| One unit file | `pnpm exec vitest run <path>` | all pass |
| Lint/format | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| Package | `pnpm build` | exit 0 |

## Scope

**In scope**:

- `src/lib/utils/refRetry.ts` (create) and `src/lib/utils/refRetry.spec.ts` (create)
- `src/lib/utils/attachable.ts`, `src/lib/utils/attachable.spec.ts` (header comment + one new `it`)
- `src/lib/utils/attachable.microtask.spec.ts` (create; red test)
- `src/lib/utils/scroll.svelte.ts`, `src/lib/utils/scroll.svelte.microtask.spec.ts` (create; red test)
- `.changeset/ref-retry-microtask-stall.md` (create)

**Out of scope**:

- `src/lib/utils/inView.svelte.ts` (plan 005 edits it; this plan fixes it through `attachable.ts` only).
- Every other `microtask` use in the library (the projection adapter and `_MotionContainer.svelte` schedule from
  outside a batch or already use plain `queueMicrotask`).
- `package.json` pins (plan 001).

## Git workflow

- Lane branch `lane/1460-refretry` in `../svelte-motion-1460-refretry`, created by the dispatcher from the
  wave-0 commit.
- Conventional commits, e.g. `test: reproduce the microtask batcher stall from ref retries`,
  `fix: retry unresolved refs without re-entering motion-dom's microtask batcher`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Red tests that reproduce the stall

The batcher is a module singleton, and once stalled it stays stalled for the rest of that test file, so each red
test lives in its **own** spec file (vitest isolates modules per file).

1. Create `src/lib/utils/attachable.microtask.spec.ts`:
   - `const ref: { current?: HTMLElement } = {}`; `createAttachable({ refs: { target: () => ref.current }, onAttach })`
     with `onAttach = vi.fn()`; `const release = attachable.subscribe()`.
   - Drain 8 microtasks (`for (let i = 0; i < 8; i++) await Promise.resolve()`) so the retry runs at least twice
     with the ref still missing.
   - Then `let laterJobRan = false; microtask.read(() => { laterJobRan = true })` (import `microtask` from
     `motion-dom`), drain 8 microtasks, and `expect(laterJobRan).toBe(true)` (**the batcher survived**).
   - Then set `ref.current = document.createElement('div')`, wait up to 100 ms
     (`await vi.waitFor(() => expect(onAttach).toHaveBeenCalledOnce(), { timeout: 200 })`), and `release()`.
2. Create `src/lib/utils/scroll.svelte.microtask.spec.ts`. Copy the `vi.mock('motion', …)` / `vi.mock('motion-dom', …)`
   setup and dynamic `useScroll` import from the top of `src/lib/utils/scroll.svelte.spec.ts` (lines 1-50), so
   `scroll()` is a mock. Render `useScroll({ container: () => ref.current })` inside `$effect.root` with the ref
   unset, `flushSync()`, drain 8 microtasks, then run the same `laterJobRan` check as above. Then resolve the ref
   and `vi.waitFor` until `scrollMock` has been called once. Clean up the root.

**Verify**:
- `pnpm exec vitest run src/lib/utils/attachable.microtask.spec.ts` → **FAILS** on `expect(laterJobRan).toBe(true)`
  (received `false`).
- `pnpm exec vitest run src/lib/utils/scroll.svelte.microtask.spec.ts` → **FAILS** on the same assertion.
- If either passes, the reproduction is wrong: STOP and report.

Commit (`test: reproduce the microtask batcher stall from ref retries`).

### Step 2: Add the `refRetry` helper (with its own unit tests)

Create `src/lib/utils/refRetry.ts` exporting one function with Google-style JSDoc:

```ts
/**
 * Schedule `callback` to retry resolving a `bind:this` ref, without using
 * motion-dom's shared `microtask` batcher.
 *
 * Re-scheduling a `microtask` job from inside a running `microtask` batch
 * leaves the batcher's `runNextFrame` flag set with no batch queued, so it
 * never runs again (motion-dom `frameloop/batcher.ts` processBatch / wake /
 * schedule @ v14.6.0; upstream `useScroll` has the same pattern). The first
 * attempt uses `queueMicrotask`, so a ref that hydrates in the same tick
 * attaches before the next frame; later attempts wait an animation frame, so a
 * ref that never resolves can't spin the microtask queue.
 *
 * @param callback - Called once, on the next attempt.
 * @param attempt - 0 for the first retry, then increasing.
 * @returns A cancel function. Calling it after the callback ran is a no-op.
 * @example
 * ```ts
 * const cancel = scheduleRefRetry(tryAttach, attempts++)
 * ```
 */
export const scheduleRefRetry = (callback: () => void, attempt: number): (() => void) => { /* … */ }
```

Implementation: a local `cancelled` flag; `attempt === 0` → `queueMicrotask(() => cancelled || callback())`;
otherwise `requestAnimationFrame` when `typeof requestAnimationFrame === 'function'`, else `setTimeout(…, 16)`;
the returned function sets `cancelled = true` and cancels the rAF/timeout id when one exists.

Create `src/lib/utils/refRetry.spec.ts` covering: attempt 0 runs on a microtask (before a `setTimeout(0)`
resolves); attempt ≥ 1 waits for a stubbed `requestAnimationFrame` (use `vi.stubGlobal`, as
`src/lib/utils/animationFrame.spec.ts` does); cancel before run prevents the call for both kinds; fallback to
`setTimeout` when `requestAnimationFrame` is undefined (`vi.useFakeTimers()`).

**Verify**: `pnpm exec vitest run src/lib/utils/refRetry.spec.ts` → all pass.

### Step 3: Use it in `createAttachable`

In `src/lib/utils/attachable.ts`:

- Replace the `motion-dom` import with `import { scheduleRefRetry } from './refRetry.js'`.
- Replace `pollScheduled` and `pollTick` with `let cancelRetry: (() => void) | undefined` and
  `let retryAttempt = 0`.
- `cancelPoll` → `cancelRetry?.(); cancelRetry = undefined`.
- In `tryAttach`'s `needsPoll` branch: `if (!cancelRetry) cancelRetry = scheduleRefRetry(() => { cancelRetry = undefined; tryAttach() }, retryAttempt++)`.
- Reset `retryAttempt = 0` when `onAttach` runs and in `stop()`.
- Update the comment at the `needsPoll` branch, the `Attachable.subscribe` JSDoc (it says "polls on
  `requestAnimationFrame`"; now: "retries on the next microtask, then on animation frames"), and the module header
  comment in `src/lib/utils/attachable.spec.ts` (delete the paragraph about the batcher needing an external wake;
  replace it with one line pointing at `attachable.microtask.spec.ts`).
- In `src/lib/utils/attachable.spec.ts` add `it('attaches when a getter ref resolves after several retries', …)`:
  stub `requestAnimationFrame` to run callbacks via `setTimeout(cb, 0)`, subscribe with an unset ref, drain 8
  microtasks, set the ref, `vi.waitFor` until `onAttach` is called once.

**Verify**: `pnpm exec vitest run src/lib/utils/attachable.spec.ts src/lib/utils/attachable.microtask.spec.ts src/lib/utils/inView.svelte.spec.ts`
→ all pass (the Step 1 attachable red test is now green).

### Step 4: Use it in `useScroll`

In `src/lib/utils/scroll.svelte.ts`, for **both** `start` loops (`makeAccelerateConfig.factory` and the
`useScroll` body):

- Keep `let cancelRetry: (() => void) | undefined` and `let attempt = 0` next to each `start`.
- In `start`: when a ref is pending, `cancelRetry = scheduleRefRetry(start, attempt++)` and return.
- Replace the initial `microtask.read(start)` with `cancelRetry = scheduleRefRetry(start, attempt++)` (attempt 0, a
  plain microtask: the same "defer until `bind:this` settles" timing as before).
- Replace `cancelMicrotask(start)` in the cleanups with `cancelRetry?.()`.
- Remove `cancelMicrotask` and `microtask` from the `motion-dom` import if nothing else uses them.
- Update the JSDoc on `makeAccelerateConfig` (it says "defers `scroll()` until refs hydrate via `microtask.read`")
  to describe the new retry and cite the divergence from upstream `use-scroll.ts:47-55`.

**Verify**: `pnpm exec vitest run src/lib/utils/scroll.svelte.spec.ts src/lib/utils/scroll.svelte.microtask.spec.ts`
→ all pass. If an existing `scroll.svelte.spec.ts` test that drains microtasks now fails because attachment moved
from the batcher to `queueMicrotask`, adjust only its drain count (more `await Promise.resolve()` ticks), never
its assertions; if more than that seems needed, STOP.

### Step 5: Changeset and full gate

Create `.changeset/ref-retry-microtask-stall.md` (bump `patch`): "`useInView` and `useScroll` no longer stall
Motion's microtask scheduler when their element isn't ready yet. Before, an element that took more than one
microtask to appear (for example rendered later with `{#if}`) could stop layout animations and prop-driven renders
on the whole page."

**Verify**: `pnpm check` (0 errors), `pnpm test:only` (all pass), `pnpm build` (exit 0), `trunk check` on the
changed files (clean), `grep -n "microtask" src/lib/utils/attachable.ts` → only comment lines,
`git status` shows only in-scope files.

## Test plan

- Red-first anchors: `attachable.microtask.spec.ts` and `scroll.svelte.microtask.spec.ts` fail on the current code
  with `laterJobRan` false, and pass after Steps 3-4. Each lives in its own file because a stalled batcher would
  poison every later test in the same file.
- New unit coverage for `scheduleRefRetry` (`refRetry.spec.ts`) and for multi-retry attach
  (`attachable.spec.ts`).
- Existing guards: `inView.svelte.spec.ts` "defers attachment until a `bind:this` getter hydrates" and the
  `useScroll` deferral tests.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/utils/attachable.microtask.spec.ts src/lib/utils/scroll.svelte.microtask.spec.ts src/lib/utils/refRetry.spec.ts` → all pass
- [ ] `grep -nE "microtask\.read|cancelMicrotask" src/lib/utils/attachable.ts src/lib/utils/scroll.svelte.ts` → no matches
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0; `trunk check` clean on changed files
- [ ] `.changeset/ref-retry-microtask-stall.md` exists
- [ ] No files outside the in-scope list modified (`git status`)

## STOP conditions

- Either Step 1 red test passes on the current code.
- The excerpts above don't match the live code.
- A fix seems to need `inView.svelte.ts` or any other out-of-scope file.
- An existing test needs an assertion change (not just a longer microtask drain) to pass.

## Maintenance notes

- Any new "wait for a ref" loop in the library must use `scheduleRefRetry`, never `microtask.*` from inside a
  `microtask` job. A reviewer should grep new code for `microtask.read(` inside the callback it schedules.
- Worth reporting upstream: `framer-motion` `use-scroll.ts:47-55` re-schedules `microtask.read(start)` from inside
  the batch. The maintainer decides whether to file it; this plan doesn't.
- Plan 005 changes `useInView`'s effect. It relies on `attachable.ts`'s public `subscribe()` contract, which this
  plan doesn't change.
