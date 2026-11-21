# Plan 005: A `PresenceChild` exit reversed by re-entry does not fire `onExitComplete`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 4665b907..HEAD -- src/lib/components/PresenceChild.svelte src/lib/utils/presence.ts src/lib/utils/usePresence.spec.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

> **Revision (2026-11-20, guard):** the first executor stopped in Step 5.
> Three specs in `_MotionContainer.spec.ts` pinned the old behaviour, a
> reversed exit firing `onExitComplete` once. Putting line 381 back made the
> file pass 45/45, so this plan's change is the only cause. Those counts
> contradict upstream, so Step 5a now updates them, and the STOP condition
> allows exactly that edit.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Wave**: 1
- **Category**: bug
- **Planned at**: commit `4665b907`, 2026-11-13

## Why this matters

`<AnimatePresence onExitComplete={…}>` promises to call `onExitComplete` when
exiting content has finished leaving. With the owned form
(`<AnimatePresence present child>`) or a manual `<PresenceChild present>`,
toggling `present` back to `true` while the exit is still running calls
`onExitComplete` anyway, although nothing exited, and also forces the
surrounding `LayoutGroup` to re-render. Typical damage: a modal's
`onExitComplete` cleanup (restore focus, unlock scroll, clear route state)
runs while the modal is back on screen. Upstream deletes a re-entered key from
its exit bookkeeping, so no callback fires. svelte-motion's other exit path
(keyed motion children, exited through a clone) already has the correct
primitive, `cancelExit`, and a test for it; the `PresenceChild` path simply
does not use it. After this plan both paths agree with upstream.

## Current state

- `src/lib/components/PresenceChild.svelte`: holds its children mounted while
  they exit. Its phase effect has a re-entry branch, lines 370–379:

  ```svelte
  } else if (!prevPresent && current && currentPhase === 'holding') {
      // Re-entry mid-hold cancels the exit accounting. Replacing the
      // slot invalidates the cycle's `safeToRemove` for any consumer
      // that captured it.
      cancelWaitEnterBlock()
      exitRegistry.cancel()
      removePop()
      phase = 'idle'
      currentSafeToRemove = noopSafeToRemove
      animatePresence?.notifyExitComplete()
  ```

  The last line is the bug. The same file calls
  `animatePresence?.notifyExitComplete()` in two other places that are
  correct and must stay as they are: line 282 (inside `mintSafeToRemove`, the
  exit really completed) and line 417 (the wrapper is destroyed mid-hold).
  The exit was opened at line 354 with `animatePresence?.notifyExitStart()`.

- `src/lib/utils/presence.ts`: the `AnimatePresence` context. The three
  functions that matter, inside `createAnimatePresenceContext`:

  ```ts
  // line 1907
  const startExit = () => {
      if (disposed) return
      if (mode === 'wait') {
          enterBlocked = true
      }
      inFlightExits += 1
      // Keep departing layoutId snapshots alive until the exit ends (see layoutId.ts).
      layoutIdHolds.push(holdLayoutIdHandoffs())
  }

  // line 1937
  const finishExit = () => {
      if (disposed) return
      layoutIdHolds.pop()?.()
      inFlightExits -= 1
      if (inFlightExits === 0) {
          context.forceRender?.()
          scheduleExitComplete()
          if (mode === 'wait' && enterBlocked) {
              enterBlocked = false
              notifyEnterUnblocked()
          }
      }
  }

  // line 2001
  /**
   * Stop counting an exit that was reversed by a re-entry.
   *
   * Pairs with the exit's {@link startExit} like {@link finishExit}, but a
   * reversed exit never completed: upstream deletes the key from its
   * `exitComplete` map on re-entry (AnimatePresence/index.tsx), so neither
   * `onExitComplete` nor the LayoutGroup re-render fire for it. Enters
   * blocked by `mode='wait'` are still released once nothing is exiting.
   */
  const cancelExit = () => {
      layoutIdHolds.pop()?.()
      inFlightExits -= 1
      if (inFlightExits === 0 && mode === 'wait' && enterBlocked) {
          enterBlocked = false
          notifyEnterUnblocked()
      }
  }
  ```

  `cancelExit` has one caller today, the clone path at line 2821
  (`if (active.started) cancelExit()`). The context object returned at lines
  2874–2889 ends with:

  ```ts
      takeExitHandoff,
      notifyExitStart: startExit,
      notifyExitComplete: finishExit
  }
  ```

  and the context type (the block ending at line 1455) declares:

  ```ts
  /**
   * @internal Used by `PresenceChild` to participate in the same exit
   * accounting as the clone-based motion-element exit path. Increments the
   * in-flight exit counter and applies mode='wait' enter blocking. Not
   * intended for direct consumer use.
   */
  notifyExitStart: () => void
  /**
   * @internal Pairs with `notifyExitStart`. Decrements the in-flight exit
   * counter, fires `onExitComplete` once it reaches zero, and unblocks
   * pending enters in mode='wait'. Not intended for direct consumer use.
   */
  notifyExitComplete: () => void
  ```

  Note that `startExit` and `finishExit` return early when the context is
  `disposed`; `cancelExit` has no such guard.

- Upstream (`~/Github/motion`, tag `v14.12.0`,
  `packages/framer-motion/src/components/AnimatePresence/index.tsx:124-134`):

  ```tsx
  for (let i = 0; i < renderedChildren.length; i++) {
      const key = getChildKey(renderedChildren[i])

      if (!presentKeys.includes(key)) {
          if (exitComplete.get(key) !== true) {
              exitComplete.set(key, false)
          }
      } else {
          exitComplete.delete(key)
          exitingComponents.current.delete(key)
      }
  }
  ```

  and `onExit` at lines 219–231 returns early when `exitComplete` has no entry
  for the key, so `onExitComplete` is never stored for a re-entered child.

- Tests:
  - `src/lib/utils/usePresence.spec.ts`: component specs for `PresenceChild`.
    The case at line 185, "settles exit accounting when the wrapper unmounts
    mid-hold", is the structural pattern:

    ```ts
    const onExitComplete = vi.fn()
    const { rerender } = render(MidHoldDestroyHarness, {
        props: { outer: true, inner: true, onExitComplete }
    })
    // Start a held exit; the consumer never calls safeToRemove.
    await rerender({ outer: true, inner: false, onExitComplete })
    await tick()
    expect(onExitComplete).not.toHaveBeenCalled()
    ...
    await vi.advanceTimersByTimeAsync(100)
    expect(onExitComplete).toHaveBeenCalledTimes(1)
    ```

  - `src/lib/components/__tests__/MidHoldDestroyHarness.svelte`: the harness.
    It renders `<AnimatePresence mode="wait" {onExitComplete}>` around
    `<PresenceChild present={inner}>`, with a probe that registers a
    `usePresence()` participant and never calls `safeToRemove` (props `outer`,
    `inner`, `probe`, `onExitComplete`).
  - The case at line 409, "a re-entry before the microtask keeps the wrapper",
    only asserts that two runs report the same number of `onExitComplete`
    calls. It does not pin the count, and stays valid after this fix.
  - `src/lib/utils/presence.spec.ts` (around lines 1517–1522) pins the clone
    path's reversed exit as "no `onExitComplete`".

## Commands you will need

| Purpose             | Command                                                              | Expected on success |
| ------------------- | -------------------------------------------------------------------- | ------------------- |
| Install             | `pnpm install --frozen-lockfile --config.engine-strict=false`        | exit 0              |
| Build (needed once) | `pnpm build`                                                         | exit 0              |
| Typecheck           | `pnpm check`                                                         | 0 errors            |
| One unit file       | `pnpm exec vitest run src/lib/utils/usePresence.spec.ts`             | see steps           |
| All unit tests      | `pnpm test:only`                                                     | all pass            |
| e2e (own port)      | `PW_PORT=4215 pnpm exec playwright test <paths> --project=chromium`  | all pass            |
| Format / lint       | `trunk fmt <files>` then `trunk check <files>`                       | no issues           |

Notes:

- Run `pnpm build` once before the first `vitest` run on a fresh checkout.
- Port 4198 belongs to the maintainer's live dev server. Never bind, reuse or
  kill it. Always pass `PW_PORT=4215` (or another free port).
- Trunk is the lint and format authority; do not use `pnpm lint` or `prettier`.
- Never use `git stash`.

## Scope

**In scope** (the only files you should modify):

- `src/lib/utils/presence.ts` (the context type and the returned context
  object only)
- `src/lib/components/PresenceChild.svelte` (line 379 only)
- `src/lib/utils/usePresence.spec.ts` (new cases)
- `src/lib/html/_MotionContainer.spec.ts`: only the `onExitComplete` call
  counts in the three specs named in Step 5a (2026-11-20 amendment)
- `.changeset/presence-child-reversed-exit.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- `finishExit`, `startExit`, `scheduleExitComplete` and the body of
  `cancelExit`. Their behavior is pinned by many specs.
- The other two `notifyExitComplete()` calls in `PresenceChild.svelte` (lines
  282 and 417). Those exits really end.
- The clone exit path (`unregisterChild`, `takeExitHandoff`) and anything from
  `.agents/.plans/clone-exit-migration/`.
- `src/lib/components/AnimatePresence.svelte`.

## Git workflow

- Branch: `advisor/005-presence-child-reversed-exit` from `origin/main`.
- Conventional commits, for example
  `fix(presence): a reversed PresenceChild exit no longer fires onExitComplete`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write failing specs for the reversed exit

Add these cases to `src/lib/utils/usePresence.spec.ts`, inside the existing
`describe('inside PresenceChild', …)` block, directly after the case at line
185. Use `MidHoldDestroyHarness` and follow that case's timing calls
(`await rerender(...)`, `await tick()`, `await vi.advanceTimersByTimeAsync(...)`).

1. **a reversed exit does not fire `onExitComplete`**: render with
   `{ outer: true, inner: true, onExitComplete }`; rerender with
   `inner: false` and `await tick()` (the probe holds the exit); rerender with
   `inner: true`; `await tick()`; `await vi.advanceTimersByTimeAsync(1000)`.
   Expect `screen.queryByTestId('held-child')` not to be null and
   `onExitComplete` not to have been called.
2. **a later real exit still completes exactly once**: continue from case 1's
   state (or repeat its setup): rerender with `inner: false`, `await tick()`,
   then rerender with `{ outer: false, inner: false }` to destroy the wrapper
   mid-hold, `await vi.advanceTimersByTimeAsync(100)`. Expect `onExitComplete`
   called exactly once in total. This proves the in-flight counter was
   decremented by the cancel and did not leak or underflow.
3. **a reversed exit before the hold microtask also stays silent**: render
   with `probe: false`; call `void rerender({ … inner: false … })` then
   `void rerender({ … inner: true … })` without awaiting between them (as the
   case at line 409 does); `await tick()`;
   `await vi.advanceTimersByTimeAsync(1000)`. Expect the child still mounted
   and `onExitComplete` not called.

**Verify**: `pnpm exec vitest run src/lib/utils/usePresence.spec.ts`
→ cases 1 and 3 FAIL with "expected spy to not be called" (it was called
once). Case 2 FAILS with 2 calls instead of 1.

If case 1 passes on the unmodified code, the reproduction is wrong: STOP and
report.

### Step 2: Expose the cancel on the context

In `src/lib/utils/presence.ts`:

- In the context type, after `notifyExitComplete`, add:

  ```ts
  /**
   * @internal Pairs with `notifyExitStart` for an exit that was reversed by
   * a re-entry. Decrements the in-flight exit counter and unblocks pending
   * enters in mode='wait', but fires neither `onExitComplete` nor the
   * LayoutGroup re-render: the exit never completed. Not intended for
   * direct consumer use.
   */
  notifyExitCancel: () => void
  ```

- In the returned context object, after `notifyExitComplete: finishExit`, add:

  ```ts
  notifyExitCancel: () => {
      // `startExit` is a no-op once disposed, so its cancel must be too.
      if (!disposed) cancelExit()
  }
  ```

Do not change `cancelExit` itself: the clone path calls it directly and its
behavior after dispose is pinned by existing specs.

**Verify**: `pnpm check` → 0 errors. If the checker reports another object
that implements this context type and now lacks `notifyExitCancel` (a test
harness or fake), add `notifyExitCancel: () => {}` there only if the file is a
spec or a `__tests__` harness, and list the file in your report; if it is
library code, STOP.

### Step 3: Use it for re-entry

In `src/lib/components/PresenceChild.svelte`, in the re-entry branch quoted in
"Current state" (the `else if (!prevPresent && current && currentPhase === 'holding')`
branch), replace the last line
`animatePresence?.notifyExitComplete()` with
`animatePresence?.notifyExitCancel()`, and extend the comment above with one
sentence: a reversed exit never completed, so `onExitComplete` must not fire
(upstream `AnimatePresence/index.tsx:131-133 @ v14.12.0` deletes the key).

**Verify**: `pnpm exec vitest run src/lib/utils/usePresence.spec.ts` → all
pass, including the three new cases and the existing cases at lines 168, 185
and 409.

### Step 4: Changeset

Create `.changeset/presence-child-reversed-exit.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

`onExitComplete` no longer fires when an exit held by `PresenceChild` (or the owned `<AnimatePresence present>` form) is reversed by setting `present` back to `true` before it finishes, matching Motion.
```

### Step 5a: Update the three specs that pinned the old count

Three specs in `src/lib/html/_MotionContainer.spec.ts` assert the behaviour
this plan fixes: a reversed exit firing `onExitComplete` once. Upstream
(`AnimatePresence/index.tsx` @ v14.14.0) deletes a re-entered key from
`exitComplete`, and `onExitComplete` only fires through
`pendingExitComplete` once every exit has completed. So a reversal fires
nothing. Change only the expected counts. Don't change the steps, the
`complete(...)` calls or the presence assertions:

1. `'cancelled owned descendant exits cannot finish a later cycle'` (about
   line 945):
   - right after `await group.update({ present: true })`: `toHaveBeenCalledTimes(1)` → `toHaveBeenCalledTimes(0)`;
   - after `complete('owned-fast', 1)`, with `owned-group` still truthy: `1` → `0`;
   - after `complete('owned-slow', 1)`, with `owned-group` null: `2` → `1`.
2. and 3. `it.each(['promise', 'callback'])('retains the owned child when a
   superseded exit %s completes')` (about line 1003):
   - after the re-entry rerender: `1` → `0`, and replace the comment
     "Cancelling A balances its parent's pending-exit count." with
     "A reversed exit fires nothing (upstream deletes the key); cancelling
     it still balances the parent's pending-exit count, which the final
     removal below proves.";
   - after `first.resolve()`: `1` → `0`;
   - after `second.resolve()`, with the child removed: `2` → `1`;
   - after the late `oldComplete(0)`: `2` → `1`.

**Verify**: `pnpm exec vitest run src/lib/html/_MotionContainer.spec.ts` → all
pass. If any of these specs fails for any other reason (for example the child
is never removed after `second.resolve()`, meaning the pending count is
unbalanced), STOP and report.

### Step 5: Full gate

`pnpm build`, `pnpm check`, `pnpm test:only`, then

```bash
PW_PORT=4215 pnpm exec playwright test e2e/animate-presence --project=chromium
```

then `trunk fmt` and `trunk check` on the four in-scope files, then
`git diff --check`.

**Verify**: every command exits 0. For an e2e failure, re-run that one spec
alone once. `e2e/animate-presence/pop-layout-scroll-siblings.spec.ts` has a
known frame-capture flake under load; if only that spec fails and it passes
alone, record it and continue. Any other repeat failure: STOP and report.

## Test plan

- Red first: the three new cases in `src/lib/utils/usePresence.spec.ts` fail
  on current code (`onExitComplete` called once for a reversed exit; twice
  across a reversed-then-real exit) and pass after Step 3.
- Regression guards that must stay green unchanged:
  `src/lib/utils/presence.spec.ts`,
  `src/lib/components/__tests__/onExitCompleteTiming.svelte.spec.ts`,
  `src/lib/components/waitReleaseSnap.spec.ts`, and `e2e/animate-presence`.
- Pattern: the case at `src/lib/utils/usePresence.spec.ts:185`.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/utils/usePresence.spec.ts` exits 0 with three new cases
- [ ] `grep -c "notifyExitCancel" src/lib/components/PresenceChild.svelte` prints `1`
- [ ] `grep -c "notifyExitComplete()" src/lib/components/PresenceChild.svelte` prints `2`
- [ ] `pnpm check` and `pnpm test:only` exit 0
- [ ] `PW_PORT=4215 pnpm exec playwright test e2e/animate-presence --project=chromium` exits 0 (or only the known flake, passing when run alone)
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git status --short` lists only the in-scope files (plus any spec harness named in the Step 2 report)
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 case 1 passes on the unmodified code.
- The re-entry branch in `PresenceChild.svelte` or the three functions in
  `presence.ts` do not match the excerpts.
- After Step 3, a `mode="wait"` spec fails (an enter stays blocked after a
  reversed exit). `cancelExit` is meant to release it; if it does not, report
  the spec instead of adding a second release.
- Any spec outside `usePresence.spec.ts` needs an edit to pass, other than the
  count changes in Step 5a.

## Maintenance notes

- `.agents/.plans/clone-exit-migration/` plans to move keyed children onto
  the `PresenceChild` path. When that happens this branch becomes the only
  reversed-exit path, and the clone path's `cancelExit` caller goes away; keep
  `notifyExitCancel`.
- Reviewer: confirm the `layoutId` hold is released on cancel (`cancelExit`
  pops `layoutIdHolds`) and that the two remaining `notifyExitComplete()`
  calls in `PresenceChild.svelte` are untouched.
- The Motion 14.14.0 bump does not change this accounting; no interaction
  expected.
- Deferred, in the batch README: `AnimatePresence` reads `mode` once at mount,
  and the clone path leaves `position: relative` on the parent after an exit.
