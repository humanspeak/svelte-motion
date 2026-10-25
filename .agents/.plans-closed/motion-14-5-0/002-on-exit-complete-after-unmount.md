# Plan 002: `AnimatePresence` fires `onExitComplete` after held children have unmounted (#2538)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> When done, update this plan's row in `.agents/.plans/motion-14-5-0/README.md`, unless a reviewer dispatched you
> and told you they maintain the index.
>
> **Revision 2026-10-21 (maintainer decision, after executor STOP at Step 3)**: two existing tests assert a
> synchronous `onExitComplete`: `src/lib/utils/presence.spec.ts:281` (clone path, waits two microtasks) and
> `src/lib/html/_MotionContainer.spec.ts:888` (asserts right after `unmount()`). The maintainer ruled both **stale**:
> upstream defers the callback on every path, so the clone path firing one `tick()` later matches upstream. Add
> `await tick()` before each affected assertion, keep every call-count assertion ("exactly once") unchanged, and
> change nothing else in those tests. Both spec files are now in scope for that edit only.
>
> **Never use `git stash`.**
>
> **Drift check (run first)**: `git diff --stat f2b5d766..HEAD -- src/lib/utils/presence.ts src/lib/components/PresenceChild.svelte src/lib/components/AnimatePresence.svelte src/lib/components/__tests__ src/lib/utils/usePresence.spec.ts`
> Plan 001 does not touch these files, so expect no output. On any difference, compare against "Current state";
> on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW-MED. The change touches the shared exit accounting for every `AnimatePresence`, but only the
  timing of the user callback moves.
- **Depends on**: 000 (runs in wave 1, in parallel with 001; no code dependency on the 14.5.0 pins)
- **Category**: bug (upstream parity, Motion 14.3.1)
- **Planned at**: commit `f2b5d766`, 2026-10-21

## Why this matters

Upstream Motion 14.3.1 fixed #2538: `onExitComplete` used to fire before the exiting children had actually
unmounted, so code in the callback (measuring, moving focus, asserting teardown) still saw the old subtree. Now
it fires in the commit that removes them, after their own cleanups. svelte-motion re-implements
`AnimatePresence`, so the fix does not arrive with the pin. In svelte-motion the bug exists on the **real-node**
path: content held by `<PresenceChild>`, which includes the `AnimatePresence present={…}` + `{#snippet child()}`
form. On that path `onExitComplete` fires synchronously while the held subtree is still in the DOM. The
clone path (plain `{#if}` children of `AnimatePresence`) already matches upstream.

## Current state

- `src/lib/components/PresenceChild.svelte:121-127`: completing an exit flips `phase` and notifies the presence
  context synchronously:
  ```ts
  const self: () => void = () => {
      if (currentSafeToRemove !== self || phase !== 'holding') return
      exitRegistry.cancel()
      phase = 'completed'
      currentSafeToRemove = noopSafeToRemove
      animatePresence?.notifyExitComplete()
  }
  ```
  The held children are only removed when Svelte next flushes the template at line 225:
  `{#if (present && phase !== 'enter-blocked') || phase === 'holding'}`. The same synchronous call happens in
  `onDestroy` (around lines 214-221) and on re-entry (line ~193; that path is `cancelExit`-like and stays as is).
- `src/lib/utils/presence.ts:1102-1113`, `finishExit` (exposed as `notifyExitComplete` at line ~1708):
  ```ts
  const finishExit = () => {
      if (disposed) return
      inFlightExits -= 1
      if (inFlightExits === 0) {
          context.forceRender?.()
          context.onExitComplete?.()
          if (mode === 'wait' && enterBlocked) {
              enterBlocked = false
              notifyEnterUnblocked()
          }
      }
  }
  ```
- The clone path (`presence.ts` around lines 1591-1624) calls `clone.remove()` and `removeExitPlaceholder(...)`
  before `finishExit()`, so it is already correct. Do not change its order.

### Upstream reference (`~/Github/motion` @ `v14.5.0`)

- `packages/framer-motion/src/components/AnimatePresence/index.tsx:101-117`: a `pendingExitComplete` ref, fired
  from the cleanup of an effect keyed on the rendered children ("so it runs in the commit that removes them (or
  when we unmount), after their own effect cleanups").
- Same file, around lines 236-251: when every exit is complete, upstream calls `forceRender?.()` and re-diffs
  the children **immediately**, and only *stores* `onExitComplete` (`pendingExitComplete.current = onExitComplete`).
  So only the user callback is deferred; the LayoutGroup re-render and the children update are not.
- Test: `packages/framer-motion/src/components/AnimatePresence/__tests__/on-exit-complete-timing.test.tsx`, which
  expects `["cleanup", "exitComplete:unmounted"]` and "fires once per exit cycle". Read it with
  `git -C ~/Github/motion show v14.5.0:<path>`.

### Conventions

- Component unit tests use `@testing-library/svelte` with small harness components in
  `src/lib/components/__tests__/`. Exemplars: `AnimatePresenceOwnedChildHarness.svelte` (AnimatePresence with
  `present` + `child` snippet and a short motion exit), `PresenceHarness.svelte` + `PresenceProbe.svelte`
  (PresenceChild with a manual `safeToRemove`), and the specs in `src/lib/utils/usePresence.spec.ts`.
- Comments cite upstream with file and version, e.g. `(framer-motion AnimatePresence/index.tsx @ v14.5.0)`.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| One unit file | `pnpm exec vitest run src/lib/components/__tests__/onExitCompleteTiming.svelte.spec.ts` | see steps |
| Unit suite | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint | `trunk fmt <files>` then `trunk check <files>` | clean |
| e2e area | `pnpm exec playwright test e2e/animate-presence` | all pass (port 4198 rule: if occupied, STOP and ask; never kill it) |

## Scope

**In scope**:

- `src/lib/utils/presence.ts` (`finishExit` and whatever small helper it needs)
- `src/lib/components/__tests__/onExitCompleteTiming.svelte.spec.ts` (create)
- `src/lib/components/__tests__/ExitTimingHarness.svelte` and `ExitTimingChild.svelte` (create)
- `.changeset/on-exit-complete-after-unmount.md` (create, `patch`)

**Out of scope**:

- The clone exit path's ordering in `presence.ts` (already correct).
- `mode="wait"` unblocking (`notifyEnterUnblocked`) and `forceRender`: keep them synchronous, as upstream does.
- `PresenceChild.svelte`, unless Step 2's approach cannot work without it (then STOP and report).

## Git workflow

Branch `feat/motion-14.5.0` (shared by the batch). Commits like `test(presence): pin onExitComplete after unmount (#2538)`
and `fix(presence): fire onExitComplete after held children unmount (#2538)`, each ending with
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

## Steps

### Step 1: Failing test

1. `ExitTimingChild.svelte`: a component that calls `onDestroy(() => log.push('cleanup'))` (receive `log` as a
   prop) and renders `<div id="exit-timing-child" data-testid="exit-timing-child">`.
2. `ExitTimingHarness.svelte`: props `present: boolean`, `log: string[]`. It renders
   `<AnimatePresence {present} onExitComplete={() => log.push(document.getElementById('exit-timing-child') ? 'exitComplete:mounted' : 'exitComplete:unmounted')}>`
   with a `{#snippet child()}` that renders `<ExitTimingChild {log} />` plus a probe that exposes `usePresence()`'s
   `safeToRemove` (reuse `PresenceProbe.svelte`, whose click calls `safeToRemove`).
3. Spec with three tests:
   - **ordering**: render `present: true`, rerender `present: false`, click the probe (calls `safeToRemove`), then
     `await tick()` twice, and expect `log` toEqual `['cleanup', 'exitComplete:unmounted']`.
   - **once per cycle**: two full exit cycles (re-enter with `present: true` between them) give exactly two
     `exitComplete:*` entries.
   - **clone path unchanged**: AnimatePresence with plain `{#if show}<motion.div exit={{ opacity: 0 }} …>` children
     still reports `exitComplete:unmounted`. Mock `motion`'s `animate` to resolve immediately, as
     `src/lib/html/_MotionContainer.spec.ts` does at its top. If that mock makes this test impractical, drop it
     and say so in your report; the e2e area run in Step 3 covers the clone path.

**Verify**: `pnpm exec vitest run src/lib/components/__tests__/onExitCompleteTiming.svelte.spec.ts` → "ordering"
FAILS with `['exitComplete:mounted', 'cleanup']` (or `exitComplete:mounted` appearing before `cleanup`). If it
passes, the reproduction is wrong: STOP.

### Step 2: Defer only the user callback

In `finishExit` (`presence.ts`), keep `forceRender` and the wait-mode unblock synchronous, and schedule
`context.onExitComplete` to run after Svelte has flushed the state change that removes the held children:

- Use `tick()` from `svelte` (`import { tick } from 'svelte'` works in a `.ts` module). `tick()` resolves after
  pending state changes are applied to the DOM, and `PresenceChild` sets `phase = 'completed'` before calling
  `notifyExitComplete`, so the `{#if}` teardown and the child's `onDestroy` run in that flush.
- Upstream fires the stored callback even when AnimatePresence unmounts ("or when we unmount"), so once
  scheduled, the deferred call runs even if `disposed` became true in between. It must still not fire twice for
  one cycle: guard with a local `pendingExitComplete` flag, the same idea as upstream's ref.
- Add a comment citing `framer-motion AnimatePresence/index.tsx @ v14.5.0, lines 101-117 and 236-251` and #2538.

**Verify**: the Step 1 spec passes entirely.

### Step 3: Gates

**Verify**: `pnpm test:only` → all pass (watch especially `usePresence.spec.ts`, `animatePresenceKey.component.spec.ts`
and `_MotionContainer.spec.ts`; any test asserting a *synchronous* `onExitComplete` is a STOP, because the
maintainer decides whether it is stale). `pnpm check` → 0 errors. `trunk check` → clean.
`pnpm exec playwright test e2e/animate-presence` → all pass.

### Step 4: Changeset

`.changeset/on-exit-complete-after-unmount.md`, `patch`: "`AnimatePresence`: `onExitComplete` now fires after
exiting children held by `PresenceChild` (including the `present` + `child` form) have unmounted (Motion 14.3.1, #2538)."

## Test plan

- Red anchor: "ordering" fails on current code with the callback seeing a mounted child, and passes after Step 2.
- "once per cycle" guards against double firing from the deferral.
- The `e2e/animate-presence` suite (wait mode, owned child, boundary teardown) is the regression net for timing.

## Done criteria

- [ ] New spec exists; it failed before Step 2 and passes after
- [ ] `pnpm test:only` passes; `pnpm check` 0 errors; `trunk check` clean
- [ ] `pnpm exec playwright test e2e/animate-presence` passes
- [ ] `git status` shows only in-scope files; README row updated

## STOP conditions

- The red test passes on current code.
- An existing test asserts that `onExitComplete` runs synchronously.
- `tick()` resolves before the held child's `onDestroy` runs (the ordering test still fails after Step 2). Report
  it; do not try to fix it with `setTimeout`/rAF delays.
- The fix seems to need changes to `PresenceChild.svelte` or the clone path.

## Maintenance notes

- Code that calls `notifyExitComplete` from new places inherits the deferral, which is intended.
- Plan 005 (popLayout via PresenceChild) touches the same hold lifecycle. Its pop styles must be removed before
  or in the same flush that unmounts the children, so this callback still sees a clean DOM.
