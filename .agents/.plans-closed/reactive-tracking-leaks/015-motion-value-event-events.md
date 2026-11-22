# Plan 015: `useMotionValueEvent` observes every motion value event, as in Motion

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a33531a2..HEAD -- src/lib/utils/motionValueEvent.ts src/lib/utils/motionValueEvent.svelte.spec.ts docs/src/routes/docs/use-motion-value-event`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW (the `'change'` path keeps its exact semantics; the new events are additive)
- **Depends on**: none
- **Wave**: 1
- **Category**: bug (upstream divergence)
- **Planned at**: commit `a33531a2`, 2026-11-20

## Why this matters

`useMotionValueEvent` is the public hook that framer-motion users reach for to
react to a motion value. Upstream it subscribes to any of the value's five
events (`change`, `animationStart`, `animationComplete`, `animationCancel`,
`destroy`). Here it only accepts `'change'`, and it ignores the `event`
argument entirely: it always subscribes through the Svelte store contract. So
there is no way to observe when a value's animation starts, finishes or is
interrupted, and a raw motion-dom `MotionValue` (which has no `subscribe`)
throws. The docs page's SEO description already advertises `animationStart`
and `animationComplete`, so readers are told it works. After this plan every
upstream event works on real motion values, readable stores keep working for
`'change'`, and the types reject combinations that cannot work.

## Current state

- `src/lib/utils/motionValueEvent.ts` is the whole implementation (44 lines).
  It is exported from `src/lib/index.ts:247`
  (`export { useMotionValueEvent } from '$lib/utils/motionValueEvent'`).
  Lines 30–44:

  ```ts
  export const useMotionValueEvent = <T>(
      store: Readable<T>,
      event: 'change',
      callback: (latest: T) => void
  ): (() => void) => {
      let initialized = false
      const unsub = store.subscribe((value) => {
          if (!initialized) {
              initialized = true
              return
          }
          callback(value)
      })
      return unsub
  }
  ```

  The JSDoc above it (lines 3–29) says "`'change'` is supported" only, and its
  example cleans up with `onDestroy(unsub)`.

- There is no spec for this file today (`ls src/lib/utils/motionValueEvent*`
  lists only `motionValueEvent.ts`).

- Upstream (`~/Github/motion`, tag `v14.14.0`),
  `packages/framer-motion/src/utils/use-motion-value-event.ts:6-23`:

  ```ts
  export function useMotionValueEvent<
      V,
      EventName extends keyof MotionValueEventCallbacks<V>
  >(
      value: MotionValue<V>,
      event: EventName,
      callback: MotionValueEventCallbacks<V>[EventName]
  ) {
      useInsertionEffect(
          () => value.on(event, callback),
          [value, event, callback]
      )
  }
  ```

  The event map, `packages/motion-dom/src/value/index.ts:30-36` at `v14.14.0`
  (exported from the `motion-dom` package root, which we depend on at
  exactly `14.14.0`):

  ```ts
  export interface MotionValueEventCallbacks<V> {
      animationStart: () => void
      animationComplete: () => void
      animationCancel: () => void
      change: (latestValue: V) => void
      destroy: () => void
  }
  ```

  When they fire (same file): `run()` notifies `animationStart` right after
  starting (`:521`) and `animationComplete` from the completion callback
  (`:514`); `stop()` notifies `animationCancel` only when an animation is
  running (`:529-533`); `destroy()` notifies `destroy` (`:556-558`).
  `value.on('change', cb)` does not emit on subscribe, only on later changes.

- Motion value shapes in this repo:
  - `src/lib/utils/augmentMotionValue.svelte.ts:21-26`: every hook
    (`useMotionValue`, `useSpring`, `useTransform`, `useScroll`, `useTime`,
    `useVelocity`, `useFollowValue`, ...) returns
    `AugmentedMotionValue<T> = Omit<MotionValue<T>, 'current'> & { readonly current: T; subscribe: ... }`.
    It is the same motion-dom object, so `isMotionValue(x)` is true and
    `x.on(...)` exists. Its `subscribe` (lines 160–163) is
    `run(value.get()); return value.on('change', run)`, so routing augmented
    values through `.on('change', ...)` keeps today's behaviour exactly.
    Because `Omit` drops motion-dom's private class members,
    `AugmentedMotionValue<T>` is **not** assignable to motion-dom's
    `MotionValue<T>`; the overload must name both types.
  - `src/lib/utils/motionValue.svelte.ts:14,21`: the package exports
    `MotionValue<T>` (= `AugmentedMotionValue<T>`) and `RawMotionValue<T>`
    (= motion-dom's `MotionValue<T>`).
  - Plan 002 owns `augmentMotionValue.svelte.ts`. This plan only imports a
    type from it; do not edit it.

- Cleanup convention: imperative hooks here return their cleanup and the
  caller registers it, either `return useX(...)` from an `$effect` or
  `onDestroy(unsub)`. Exemplar: `src/lib/utils/animationFrame.ts:23-24,51-63`
  ("Call it inside `$effect` and return its cleanup"). The existing callers of
  `useMotionValueEvent` rely on the returned unsubscribe
  (`src/routes/tests/use-scroll/horizontal-target/+page.svelte:32-35`:
  `const unsub = useMotionValueEvent(scrollXProgress, 'change', ...)` then
  `onDestroy(unsub)`). Keep returning the unsubscribe; do not auto-register
  teardown (that would double-unsubscribe for every existing caller and is
  not this repo's pattern).

- Dev-only warnings use `DEV` from `esm-env`, as in
  `src/lib/utils/arc.ts:32` (`import { DEV } from 'esm-env'`).

- Docs: `docs/src/routes/docs/use-motion-value-event/+page.svx` (168 lines)
  and `+page.ts` (description string). Current problems:
  - line 3 and `+page.ts`: "Subscribe to motion value store changes with
    automatic cleanup." (there is no automatic cleanup);
  - line 12: the SEO description promises `animationStart` and
    `animationComplete` "with automatic cleanup on unmount";
  - lines 78–82: the events table lists only `'change'`;
  - lines 139–157: the signature documents only the readable/`'change'` form.
  The page shows code blocks only and embeds no live example component, so no
  example component is added.

- Unit spec conventions: Vitest, colocated. A spec that calls hooks using
  `$effect` must be named `*.svelte.spec.ts` and run hooks inside
  `$effect.root`; copy the `inRoot` helper from
  `src/lib/utils/motionValue.svelte.spec.ts:19-37`.

## Commands you will need

| Purpose        | Command                                                         | Expected on success |
| -------------- | --------------------------------------------------------------- | ------------------- |
| Install        | `pnpm install --frozen-lockfile --config.engine-strict=false`   | exit 0              |
| Sync / types   | `pnpm check` (also runs `svelte-kit sync`, needed before Vitest) | 0 errors            |
| One unit file  | `pnpm exec vitest run src/lib/utils/motionValueEvent.svelte.spec.ts` | see steps       |
| All unit tests | `pnpm test:only`                                                | all pass            |
| Build          | `pnpm build`                                                    | exit 0              |
| Format / lint  | `trunk fmt <files>` then `trunk check <files>`                  | no issues           |

Notes: Trunk is the lint and format authority; do not use `pnpm lint` or
`prettier`. Never use `git stash`. No e2e is needed: every behaviour here is
observable with a plain motion value in jsdom, so this plan uses no
Playwright port.

## Scope

**In scope** (the only files you should modify):

- `src/lib/utils/motionValueEvent.ts`
- `src/lib/utils/motionValueEvent.svelte.spec.ts` (create)
- `docs/src/routes/docs/use-motion-value-event/+page.svx`
- `docs/src/routes/docs/use-motion-value-event/+page.ts`
- `.changeset/motion-value-event-events.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/utils/augmentMotionValue.svelte.ts`: owned by plan 002.
- `src/lib/index.ts` and `src/lib/index.spec.ts`: the export already exists.
  Re-exporting `MotionValueEventCallbacks` would trip the export tripwire and
  is not needed (users can import the type from `motion-dom`).
- Other docs pages that mention the hook (`motion-values`, `use-scroll`,
  `on-update`): their `'change'` examples stay correct.
- `src/routes/tests/use-scroll/horizontal-target/+page.svelte`: an existing
  caller; it must keep working unchanged (it is your compatibility check).

## Git workflow

- Branch: `advisor/015-motion-value-event-events` from the batch commit.
- Conventional commits, e.g.
  `fix(motion-value-event): subscribe to every MotionValue event, as in Motion`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write failing tests

Create `src/lib/utils/motionValueEvent.svelte.spec.ts`. Imports:

```ts
import { motionValue as rawMotionValue, type StartAnimation } from 'motion-dom'
import { writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMotionValueEvent } from './motionValueEvent.js'
import { useMotionValue } from './motionValue.svelte.js'
```

Copy the `cleanups` / `inRoot` helper from
`src/lib/utils/motionValue.svelte.spec.ts:19-37`.

Use a stub animation so no frameloop is needed. `value.start(fn)` calls `fn`
with a `complete` callback and treats the return value as the running
animation:

```ts
const startStub = (value: { start: (s: StartAnimation) => Promise<void> }) => {
    let complete!: () => void
    value.start((done) => {
        complete = done
        return { stop: vi.fn() } as unknown as ReturnType<StartAnimation>
    })
    return () => complete()
}
```

Tests (one `describe('utils/motionValueEvent - useMotionValueEvent')`):

1. **`change` on a raw motion-dom value**: `const v = rawMotionValue(0)`,
   subscribe a `vi.fn()` to `'change'`, `v.set(5)` → called once with `5`;
   no call happened at subscribe time.
2. **`animationStart`, `animationComplete` on an augmented value**: inside
   `inRoot`, `const v = useMotionValue(0)`; subscribe `onStart` and
   `onComplete`. `const finish = startStub(v)` → `onStart` called once,
   `onComplete` not called. `finish()` → `onComplete` called once. Then
   `v.set(9)` → neither is called again (proves they are not wired to
   `change`).
3. **`animationCancel`**: raw value; subscribe `onCancel`; `startStub(v)`,
   then `v.stop()` → `onCancel` called once.
4. **`destroy`**: raw value; subscribe `onDestroy`; `v.destroy()` → called once.
5. **unsubscribe**: raw value; `const off = useMotionValueEvent(v, 'animationStart', cb)`;
   `off()`; `startStub(v)` → `cb` not called.
6. **readable store keeps `change` semantics**: `const s = writable(1)`;
   subscribe `cb` to `'change'` → not called; `s.set(2)` → called once with
   `2`; `off()`; `s.set(3)` → still one call.
7. **augmented value `change` unchanged**: inside `inRoot`, `useMotionValue(0)`,
   subscribe to `'change'`, `v.set(4)` → called once with `4`, not at
   subscribe time.

Type-level checks in the same file, inside an
`it('types', () => { ... })` whose body is wrapped in `if (false as boolean) { ... }`
so nothing runs (they are verified by `pnpm check`, which type-checks spec
files):

```ts
const n = rawMotionValue(0)
useMotionValueEvent(n, 'change', (latest) => {
    const x: number = latest
    void x
})
useMotionValueEvent(n, 'animationComplete', () => {})
const s = writable('a')
useMotionValueEvent(s, 'change', (latest) => {
    const x: string = latest
    void x
})
// @ts-expect-error readable stores only emit 'change'
useMotionValueEvent(s, 'animationStart', () => {})
// @ts-expect-error not a MotionValue event
useMotionValueEvent(n, 'animationEnd', () => {})
```

Add one augmented-value line too, inside an `inRoot` call in that block:
`useMotionValueEvent(useMotionValue(0), 'animationStart', () => {})`.

**Verify**: `pnpm check` first (it also runs `svelte-kit sync`), then
`pnpm exec vitest run src/lib/utils/motionValueEvent.svelte.spec.ts`:

- Vitest: tests 1, 3, 4 and 5 FAIL with
  `TypeError: store.subscribe is not a function` (raw motion-dom values have
  no `subscribe`); test 2 FAILS with `onStart` expected to be called once but
  called 0 times; tests 6 and 7 PASS (they pin existing behaviour).
- `pnpm check`: errors in the new spec file (raw `MotionValue` is not a
  `Readable`; `'animationComplete'` is not assignable to `'change'`).

If tests 1–5 pass on unmodified code, STOP: the reproduction is wrong. If
test 6 or 7 fails on unmodified code, STOP and report the assertion.

### Step 2: Implement upstream's event subscription with overloads

Rewrite `src/lib/utils/motionValueEvent.ts`. Use `function` overloads (an
arrow `const` cannot carry overloads). Target shape:

```ts
import { DEV } from 'esm-env'
import {
    isMotionValue,
    type MotionValue as MotionDomMotionValue,
    type MotionValueEventCallbacks
} from 'motion-dom'
import type { Readable } from 'svelte/store'
import type { AugmentedMotionValue } from './augmentMotionValue.svelte.js'

export function useMotionValueEvent<V, EventName extends keyof MotionValueEventCallbacks<V>>(
    value: MotionDomMotionValue<V> | AugmentedMotionValue<V>,
    event: EventName,
    callback: MotionValueEventCallbacks<V>[EventName]
): VoidFunction
export function useMotionValueEvent<T>(
    store: Readable<T>,
    event: 'change',
    callback: (latest: T) => void
): VoidFunction
export function useMotionValueEvent(
    source: MotionDomMotionValue<unknown> | AugmentedMotionValue<unknown> | Readable<unknown>,
    event: keyof MotionValueEventCallbacks<unknown>,
    callback: (latest?: unknown) => void
): VoidFunction {
    // Upstream: use-motion-value-event.ts:20-23 @ v14.14.0 subscribes with
    // value.on(event, callback); 'change' does not emit on subscribe.
    if (isMotionValue(source)) {
        return (source as MotionDomMotionValue<unknown>).on(event, callback)
    }
    if (event !== 'change') {
        if (DEV) {
            console.warn(
                `useMotionValueEvent: a Svelte readable store only emits 'change'; '${event}' needs a MotionValue.`
            )
        }
        return () => {}
    }
    // Readable stores emit synchronously on subscribe; skip that emission so
    // the callback, like MotionValue.on('change'), fires only on changes.
    let initialized = false
    return (source as Readable<unknown>).subscribe((value) => {
        if (!initialized) {
            initialized = true
            return
        }
        callback(value)
    })
}
```

Rules:

- The motion-value overload comes first. An augmented value also satisfies
  `Readable`, so the order decides which overload TypeScript picks.
- Check `isMotionValue` before anything else at runtime, for the same reason.
- If TypeScript does not infer `V` from an `AugmentedMotionValue` argument
  (the Step 1 type checks fail on the augmented line), add a separate overload
  for `AugmentedMotionValue<V>` above the raw one rather than casting in the
  spec. If neither works, STOP and report the compiler error.

JSDoc (Google style) on the first overload signature, which is what editors
show. It must cover: a summary that it mirrors framer-motion's
`useMotionValueEvent` and cites
`packages/framer-motion/src/utils/use-motion-value-event.ts @ v14.14.0`; the
five events and when each fires; that `'change'` never fires on subscribe;
that a Svelte readable store is accepted for `'change'` only; that the
function returns an unsubscribe the caller registers (`return` it from an
`$effect`, or pass it to `onDestroy`), matching `useAnimationFrame`;
`@template`, `@param` for each argument, `@returns`, `@see
https://motion.dev/docs/react-use-motion-value-event`, and an `@example`
showing `animationComplete` inside `$effect`:

```svelte
<script>
  import { useMotionValueEvent, useSpring } from '@humanspeak/svelte-motion'

  const x = useSpring(0)

  $effect(() => useMotionValueEvent(x, 'animationComplete', () => {
    console.log('x settled at', x.get())
  }))
</script>
```

Give the second (readable) overload a short JSDoc of its own with `@param` /
`@returns`.

**Verify**:
`pnpm exec vitest run src/lib/utils/motionValueEvent.svelte.spec.ts` → all 8
tests pass. `pnpm check` → 0 errors (both `@ts-expect-error` lines are
consumed, so no "unused directive" error).

### Step 3: Prove existing callers are unaffected

```bash
grep -rn "useMotionValueEvent" src docs/src
pnpm exec vitest run src/lib/utils/scroll.svelte.spec.ts src/lib/utils/motionValue.svelte.spec.ts src/lib/utils/spring.svelte.spec.ts
```

**Verify**: grep shows only `'change'` callers outside the files in scope (the
use-scroll test page and docs code blocks); the three specs pass. `pnpm check`
already covered the use-scroll test page's types in Step 2.

### Step 4: Update the docs page

In `docs/src/routes/docs/use-motion-value-event/+page.svx`:

- Line 3 `description` and the `description` in `+page.ts`: replace with
  `Subscribe to a motion value's change and animation events.` (identical in
  both files).
- Line 12 `seo.description`: `Subscribe to motion value events (change, animationStart, animationComplete, animationCancel, destroy) in Svelte Motion. Returns an unsubscribe function for $effect or onDestroy.`
- Line 22 lede: say it subscribes to a motion value's events, mirrors
  Motion's hook, and also accepts a Svelte readable store for `'change'`.
- "Subscribe to changes" (line 51): "Pass a motion value (or any readable
  store), the event `'change'`, and a callback".
- After that section add `### Animation events` with an example that uses
  `animationStart` and `animationComplete` to toggle an `isAnimating` `$state`
  flag, both registered in one `$effect` that returns a function calling both
  unsubscribes.
- Replace the "Available events" table with five rows: `'change'` (latest
  value; not on subscribe; motion values and readable stores),
  `'animationStart'`, `'animationComplete'`, `'animationCancel'` (an
  animation is stopped or replaced before finishing), `'destroy'` (the value
  is destroyed). Note under the table that only `'change'` works with a plain
  readable store.
- "Signature" (lines 141–147): show both overloads as in Step 2, using
  `MotionValueEventCallbacks` from `motion-dom`.
- "Parameters": `value` is a motion value (any hook's return or
  `motionValue()`) or, for `'change'` only, a readable store; `event` is one
  of the five names; `callback` receives the latest value for `'change'` and
  no arguments otherwise.

Leave the Cleanup, raw-subscribe and See also sections as they are.

**Verify**: `grep -c "animationCancel" docs/src/routes/docs/use-motion-value-event/+page.svx`
prints at least `2`; `grep -c "automatic cleanup" docs/src/routes/docs/use-motion-value-event/+page.svx docs/src/routes/docs/use-motion-value-event/+page.ts`
prints `0` for both files.

### Step 5: Changeset

Create `.changeset/motion-value-event-events.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

`useMotionValueEvent` now subscribes to every motion value event, as in Motion: `change`, `animationStart`, `animationComplete`, `animationCancel` and `destroy`. Raw motion-dom values work too, and Svelte readable stores are still accepted for `change`.
```

### Step 6: Full gate

`pnpm build`, `pnpm check`, `pnpm test:only`, then `trunk fmt` and
`trunk check` on the five in-scope files, then `git diff --check`.

**Verify**: every command exits 0; `trunk check` reports no issues.

## Test plan

- Red first: `motionValueEvent.svelte.spec.ts` tests 1–5 fail on current code
  (`TypeError: store.subscribe is not a function`, or `onStart` called 0
  times) and pass after Step 2. Tests 6–7 pass before and after; they pin the
  `'change'` behaviour existing callers depend on.
- Type tests (same file, run by `pnpm check`): callback parameter typing per
  overload, and `@ts-expect-error` for a readable with a non-`change` event
  and for an unknown event name.
- No e2e: the hook has no DOM behaviour, and jsdom with a stub animation
  observes every event directly.
- Pattern: `src/lib/utils/motionValue.svelte.spec.ts` for `inRoot`.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/utils/motionValueEvent.svelte.spec.ts` exits 0 with 8 tests
- [ ] `pnpm check` exits 0 with 0 errors
- [ ] `pnpm test:only` and `pnpm build` exit 0
- [ ] `grep -c "value.on\|\.on(event" src/lib/utils/motionValueEvent.ts` prints at least `1`
- [ ] `grep -c "automatic cleanup" docs/src/routes/docs/use-motion-value-event/+page.svx` prints `0`
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git status --short` lists only the five in-scope files
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- `src/lib/utils/motionValueEvent.ts` does not match the excerpt.
- Step 1 tests 1–5 pass on unmodified code, or tests 6–7 fail on it.
- `motion-dom` does not export `MotionValueEventCallbacks`, `StartAnimation`
  or `isMotionValue` at the installed version (`pnpm check` reports a missing
  export).
- The overloads cannot type the augmented-value case without casts at call
  sites.
- The fix appears to need a change to `augmentMotionValue.svelte.ts` (plan
  002's file) or to `src/lib/index.ts`.

## Maintenance notes

- Overlap with plan 002: none in files. Plan 002 changes how `set()` is
  tracked inside `augmentMotionValue.svelte.ts`; this plan only imports the
  `AugmentedMotionValue` type from it. If 002 renames that type, update the
  import here.
- Reviewer: check that `isMotionValue` runs before the readable branch (an
  augmented value is both), and that the `'change'` readable path still skips
  exactly one synchronous emission.
- Deferred: upstream subscribes in `useInsertionEffect` and unsubscribes
  automatically. This repo's convention is to return the cleanup; changing
  that would be a breaking API change for every caller that already passes
  the result to `onDestroy`. Not planned.
- Deferred: re-exporting `MotionValueEventCallbacks` from the package root.
  Users can import it from `motion-dom`; adding it means updating the export
  tripwire in `src/lib/index.spec.ts`.
