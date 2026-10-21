# Plan 005: `mode="popLayout"` pops content held by `PresenceChild` (port of #2503)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> When done, update this plan's row in `.agents/.plans/motion-14-5-0/README.md`, unless a reviewer dispatched you
> and told you they maintain the index.
>
> **Never use `git stash`.**
>
> **Drift check (run first)**: `git diff --stat f2b5d766..HEAD -- src/lib/components/PresenceChild.svelte src/lib/components/AnimatePresence.svelte src/lib/utils/visualElementCore.ts src/lib/utils/presence.ts src/lib/utils/presenceExitRegistry.ts`
> Plans 002 and 004 change `presence.ts` (`finishExit`, exit holds). Anything else: compare against "Current state",
> and on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED. The plan adds styles to real (non-clone) exiting elements.
- **Depends on**: 001 (needs motion-dom 14.5.0's `register(id, node)` signature), 002 (same hold lifecycle)
- **Category**: bug (upstream parity, Motion 14.3.1 #2503)
- **Planned at**: commit `f2b5d766`, 2026-10-21

## Why this matters

`<AnimatePresence mode="popLayout">` should take an exiting child out of the layout flow immediately, so siblings
reflow while it animates out. svelte-motion does this only on its clone exit path (plain `{#if}` children). Content
held by `<PresenceChild>`, which includes the `AnimatePresence present={…}` + `{#snippet child()}` form, is never
popped: `PresenceChild.svelte` has no `popLayout` code, so the exiting element stays in flow and siblings jump only
after it is removed. Upstream Motion 14.3.1 (#2503) made popLayout find the outermost motion component's element
through presence registration, for children that can't take a ref. That is the same situation as
svelte-motion's `PresenceChild`, which has no ref to its snippet content.

## Current state

- `src/lib/components/AnimatePresence.svelte:92-100`: the owned form renders
  `<PresenceChild present={present ?? true}>{@render child()}</PresenceChild>`. Mode is available to the child via
  `getAnimatePresenceContext()?.mode`.
- `src/lib/components/PresenceChild.svelte`: phases `'idle' | 'holding' | 'completed' | 'enter-blocked'`. Its
  `$effect.pre` (around lines 150-212) moves `idle → holding` when `present` flips false, **before the DOM update**,
  and `holding → idle` on re-entry. `onDestroy` (around 214-221) settles a pending hold. The context it provides
  (around lines 131-143) includes `register: exitRegistry.register`.
- `src/lib/utils/presenceExitRegistry.ts:36-45`: `register(id)` takes only an id today.
- `src/lib/html/_MotionContainer.svelte:366-379`, `buildPresenceContext()`: every motion element inside a
  PresenceChild gets a fresh presence context whose `register` is the **same function**,
  `presenceChildContext.register`. Its `id` is the element's own `componentHydrationId`, not the PresenceChild's.
- `src/lib/utils/visualElementCore.ts:256-260`: svelte-motion's own port of upstream's exit feature:
  ```ts
  mount(): void {
      const { register, onExitComplete } = this.node.presenceContext ?? {}
      if (onExitComplete) onExitComplete(this.id)
      if (register) this.unmount = register(this.id)
  }
  ```
- Reusable measuring helpers in `src/lib/utils/presence.ts`: `measurePopLayoutSnapshot(element, computedStyle)`
  (around line 433) and `resolvePopLayoutStyles(snapshot, anchorX, anchorY)` (around line 465). Both are already
  modeled on upstream `PopChild`.

### Upstream reference (`~/Github/motion` @ `v14.5.0`, commit `286d39d4d`)

- `packages/framer-motion/src/motion/features/animation/exit.ts:81`: `this.unmount = register(this.id, this.node)`.
- `packages/motion-dom/src/render/types.ts`: `register: (id: string | number, node?: any) => () => void`.
- `packages/framer-motion/src/components/AnimatePresence/PresenceChild.tsx` (around lines 47-79): keeps
  `popNode.current = node` when `node && node.parent?.presenceContext?.id !== id`, i.e. the outermost motion
  component whose parent isn't in the same presence child.
- `packages/framer-motion/src/components/AnimatePresence/PopChild.tsx`: measures the element before the update
  that flips `isPresent` (`getSnapshotBeforeUpdate`). When `!isPresent`, it sets `data-motion-pop-id` and injects
  a `<style>` into `element.ownerDocument.head` (with the MotionConfig `nonce`) holding
  `position: absolute !important; width; height; left|right; top|bottom` (all `!important`). It removes both on
  cleanup (re-entry or unmount). It does nothing if width or height is 0.
- e2e: `dev/react/src/tests/issue-2503.tsx` and `tests/react/issue-2503.spec.ts`.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Unit | `pnpm exec vitest run src/lib/utils/presenceExitRegistry.spec.ts src/lib/utils/visualElementCore.spec.ts` (create the latter only if absent; check first) | pass |
| Unit suite | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint | `trunk fmt <files>` then `trunk check <files>` | clean |
| e2e | `pnpm exec playwright test e2e/animate-presence` | all pass (port 4198 rule: if occupied, STOP and ask; never kill) |

## Scope

**In scope**:

- `src/lib/utils/visualElementCore.ts` (`ExitAnimationFeature.mount` passes `this.node`)
- `src/lib/utils/presenceExitRegistry.ts` (accept the optional node; remember the outermost one)
- `src/lib/components/PresenceChild.svelte` (measure and pop while holding in popLayout)
- `src/routes/tests/animate-presence/owned-pop-layout/+page.svelte` (create)
- `e2e/animate-presence/owned-pop-layout.spec.ts` (create)
- `src/routes/+page.svelte` (link)
- unit spec(s) next to the changed `.ts` files
- `.changeset/pop-layout-presence-child.md` (create, `patch`)

**Out of scope**: the clone path in `presence.ts`, `AnimatePresence.svelte` props (no `anchorX`/`anchorY` props
are added in this plan), `_MotionContainer.svelte`.

## Git workflow

Branch `feat/motion-14.5.0`. Commits `test(presence): popLayout pops PresenceChild content (red)` and
`fix(presence): pop PresenceChild content in popLayout (Motion 14.3.1 #2503)`, ending with
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

## Steps

### Step 1: Failing e2e

1. Create `src/routes/tests/animate-presence/owned-pop-layout/+page.svelte`, modeled on
   `src/routes/tests/animate-presence/owned-child/+page.svelte`. A flex row (`display: flex; gap: 8px;
   position: relative`) holds:
   `<AnimatePresence mode="popLayout" present={show}>{#snippet child()}<motion.div data-testid="exiting" exit={{ opacity: 0 }} transition={{ duration: 1 }} style="width:120px;height:80px">…</motion.div>{/snippet}</AnimatePresence>`
   followed by a sibling `<div data-testid="sibling" style="width:80px;height:80px">`, and a
   `<button data-testid="toggle">` that flips `show`. Add a second row identical except `mode="sync"`, with test
   ids suffixed `-sync`, as a control. Add the guided tester panel used by other visually reviewed pages (steps,
   expected, live verdict), hidden when `@isPlaywright` is in the URL. Copy the panel pattern from
   `src/routes/tests/animate-layout/toggle/+page.svelte`.
2. Create `e2e/animate-presence/owned-pop-layout.spec.ts`: record the sibling's `x`, click toggle, then poll every
   frame for up to 300 ms (the exit takes 1 s). Assert the popLayout sibling's `x` decreased by more than 100 px
   while `exiting` is still in the DOM with opacity > 0. Assert the `-sync` sibling has NOT moved by more than 3 px
   in that window. Model the polling on `e2e/animate-presence/modes.spec.ts` (`framePoll`).
3. Link the page in `src/routes/+page.svelte` next to the other animate-presence links.

**Verify**: `pnpm exec playwright test e2e/animate-presence/owned-pop-layout.spec.ts` → the popLayout assertion
FAILS (the sibling doesn't move until the exit completes); the sync control passes.

### Step 2: Pass the node when registering (upstream exit.ts parity)

- `visualElementCore.ts` `ExitAnimationFeature.mount`: `this.unmount = register(this.id, this.node)`. Comment:
  `framer-motion motion/features/animation/exit.ts:81 @ v14.5.0 (#2503)`.
- `presenceExitRegistry.ts`: `register(id, node?: VisualElement)`. Keep a `popNode` variable. Set it when
  `node && node.parent?.presenceContext?.register !== register`, i.e. the node's parent motion element is not
  registered with this same PresenceChild. svelte-motion's presence context ids are per element (see "Current
  state"), so compare the shared `register` function instead of upstream's `id`. On unregister of that node, clear
  `popNode` if it is the one stored. Expose `getPopElement(): HTMLElement | undefined` (`popNode?.current`).
- Unit-test both in `presenceExitRegistry.spec.ts` (create if absent): an outer node is kept, an inner node whose
  parent shares the register is ignored, and unregistering clears it.

**Verify**: the unit specs pass; `pnpm check` → 0 errors.

### Step 3: Pop while holding

In `PresenceChild.svelte`:

- In the `$effect.pre` branch that moves `idle → holding`, if `animatePresence?.mode === 'popLayout'`, read
  `exitRegistry.getPopElement()`. This runs before the DOM update, so the element is still in flow. If it exists,
  call `measurePopLayoutSnapshot(el, getComputedStyle(el))`. If width and height are non-zero, apply the pop the
  way upstream does: set `el.dataset.motionPopId = <unique id>` and append a `<style>` to `el.ownerDocument.head`
  whose rule `[data-motion-pop-id="<id>"] { … }` holds `resolvePopLayoutStyles(snapshot)` values, each with
  `!important`. Use the MotionConfig `nonce` if svelte-motion's MotionConfig context exposes one
  (`src/lib/components/motionConfig.context.ts`); if it doesn't, skip the nonce and mention it in the report.
- Store a `removePop()` cleanup that removes the attribute and the style. Call it on re-entry
  (`holding → idle`), on completion (in `mintSafeToRemove`'s `self`, before `notifyExitComplete`), and in `onDestroy`.
- Cite `framer-motion AnimatePresence/PopChild.tsx @ v14.5.0` in a comment. Explain that a stylesheet is used
  instead of inline styles so the element's own `style` is untouched.

**Verify**: `pnpm exec playwright test e2e/animate-presence/owned-pop-layout.spec.ts` → passes.

### Step 4: Gates and changeset

**Verify**: `pnpm test:only`, `pnpm check`, `trunk check`, `pnpm exec playwright test e2e/animate-presence` → all pass.

`.changeset/pop-layout-presence-child.md` (`patch`): "`AnimatePresence mode=\"popLayout\"`: content held by
`PresenceChild` (including the `present` + `child` form) is now popped out of the layout while it exits, so
siblings reflow immediately (Motion 14.3.1 #2503)."

## Test plan

- Red anchor: `owned-pop-layout.spec.ts`'s popLayout case fails (sibling waits for the exit) and passes after
  Step 3. The sync row is a control that must keep passing.
- Unit coverage for the outermost-node rule and clearing on unregister.
- `e2e/animate-presence` is the regression net (wait mode, boundary teardown, the existing modes page).

## Done criteria

- [ ] New page, linked; new e2e spec failed before Step 3 and passes after
- [ ] `grep -n "register(this.id, this.node)" src/lib/utils/visualElementCore.ts` → one match
- [ ] `pnpm test:only`, `pnpm check`, `trunk check`, `e2e/animate-presence` all pass
- [ ] Only in-scope files changed; README row updated

## STOP conditions

- `getPopElement()` is undefined for the test page's `motion.div` after Step 2 (registration doesn't carry the
  node). Report what `register` received.
- The pop makes an existing `e2e/animate-presence` spec fail.
- A PresenceChild with no motion element inside (a pure CSS exit) would need popping. That is out of scope;
  upstream only pops via a ref or a motion node too.

## Maintenance notes

- If `AnimatePresence` ever gains `anchorX`/`anchorY` props, pass them to `resolvePopLayoutStyles` here and in
  the clone path.
- Plan 002 defers `onExitComplete` past the flush that unmounts children. The pop cleanup runs before
  `notifyExitComplete`, so the callback never sees pop styles.
