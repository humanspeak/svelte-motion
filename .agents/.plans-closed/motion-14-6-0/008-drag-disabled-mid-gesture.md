# Plan 008: End the gesture when `drag` is turned off mid-drag (from `onDrag`)

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report.
> Do not improvise. When done, report back to the dispatcher; do not edit the batch README yourself.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Port rule**: this lane's Playwright port is **4208** (`PW_PORT=4208`). Never use or kill port 4198. Never set
> `PW_REUSE_SERVER`.
>
> **Requires plan 001** (pins at Motion 14.6.0): `VisualElementDragControls.stop()` only takes the third
> `dragAxes` argument from 14.6.0. Before starting, confirm `grep -n '"motion-dom": "14.6.0"' package.json` prints
> a line. If not, STOP.
>
> **Revision 2026-10-26 (pre-flight)**: re-baselined to `b5e7e907`, the `feat/motion-14.6.0` tip after every other plan
> merged. Plan 001 legitimately rewrote `e2e/drag/while-drag-transforms.spec.ts` (the cross-axis test, now "an x-only
> drag follows its layout on y", #2255) and its page (new tester panel), and plans 001/005/006/009 added links to
> `src/routes/+page.svelte`. Keep all of that; add your link next to the drag links.
>
> **Drift check (run first)**: `git diff --stat b5e7e907..HEAD -- src/lib/utils/visualElementCore.ts src/lib/utils/visualElementCore.spec.ts src/routes/tests/drag e2e/drag src/routes/+page.svelte`
> Expected: no output. Also confirm `git diff --stat 45a24c6e..b5e7e907 -- src/lib/utils/visualElementCore.ts src/lib/utils/visualElementCore.spec.ts`
> prints nothing (no plan touched those files). On a mismatch, compare the "Current state" excerpts with the live
> code; on a mismatch there, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (one guarded call in the drag feature's `update()`)
- **Depends on**: 001 (needs `stop(…, dragAxes)` from motion-dom 14.6.0)
- **Wave**: 2
- **Category**: bug (upstream parity)
- **Planned at**: commit `45a24c6e` (`origin/main`, v2.5.0, Motion 14.5.0), 2026-10-26; re-baselined to `b5e7e907` (feat/motion-14.6.0, Motion 14.6.0) at dispatch

## Why this matters

If `drag` is turned off while a drag is still in progress (for example, `onDrag` closes an expanded card once it
has been pulled 100 px), the gesture keeps running. The element stays animation-blocked, its layout jump is kept
as a drag offset, and when the pointer is released nothing animates it back, because release only animates axes
that the (now false) `drag` prop allows. Motion 14.6.0 fixed this (#2248, commit `b0060fd42`): when `drag` goes
from truthy to falsy, the drag feature ends the gesture as if released, using the axes it was dragging. The
motion-dom half (`cbc357bab`: layout children keep animating with a card whose drag ended mid-render) arrives with
plan 001's bump but only has an effect once this trigger exists.

## Current state

- `src/lib/utils/visualElementCore.ts:309-387`, `DragGestureFeature`, a port of framer-motion
  `gestures/drag/index.ts` @ v14.5.0. Its `update()`:
  ```ts
      update(): void {
          // Svelte deviation 1: retry when the instance wasn't ready at mount.
          this.attachListeners()
          const { dragControls } = this.node.getProps() as { dragControls?: unknown }
          const { dragControls: prev } = (this.node.prevProps ?? {}) as { dragControls?: unknown }
          if (dragControls !== prev) {
              this.removeGroupControls()
              this.removeGroupControls = () => {}
              this.subscribeControls()
          }
          // Svelte deviation 2: React re-measures (and so re-fires the projection
          // 'measure' event the controller resolves ref constraints from) on
          // every commit via MeasureLayout. A `dragConstraints` ref bound after
          // mount would otherwise never be measured or observed here.
          const { dragConstraints } = this.node.getProps()
          const { dragConstraints: prevConstraints } = (this.node.prevProps ?? {}) as {
              dragConstraints?: unknown
          }
          const projection = this.node.projection as /* … */
          if (dragConstraints !== prevConstraints && projection?.layout) {
              projection.notifyListeners('measure', projection.layout.layoutBox)
          }
      }
  ```
  `this.controls` is motion-dom's `VisualElementDragControls`.
- Why `update()` runs when `drag` becomes false: motion-dom's `VisualElement.updateFeatures()` never unmounts a
  feature that becomes disabled; it calls `update()` on every mounted feature (motion-dom
  `render/VisualElement.ts` `updateFeatures`, around lines 653-687 @ v14.6.0). svelte-motion calls
  `visualElement.update(next, …)` then `visualElement.updateFeatures()` on every prop commit
  (`src/lib/html/_MotionContainer.svelte` around lines 2000-2032), with `projection.willUpdate()` before it during
  an active drag and `root.didUpdate()` after. That is the same order as React, so the stop lands before this
  render's layout change is processed.
- `drag` reaches the VisualElement's props: `_MotionContainer.svelte` forwards `drag: dragProp` (around line 596).
- `src/lib/utils/visualElementCore.spec.ts:458-…`, `describe('DragGestureFeature')`, with a `mountWithDrag(props)`
  helper that stubs `VisualElementDragControls.prototype.addListeners` and mounts a VisualElement:
  ```ts
      const mountWithDrag = (props: Record<string, unknown>) => {
          const removeListeners = vi.fn()
          const addListeners = vi
              .spyOn(VisualElementDragControls.prototype, 'addListeners')
              .mockReturnValue(removeListeners)
          const element = document.createElement('div')
          const ve = createMotionVisualElement({ props })
          ve.mount(element)
          ve.updateFeatures()
          const feature = (ve as unknown as { features: Record<string, unknown> }).features
              .drag as DragGestureFeature
          return { element, ve, feature, addListeners, removeListeners }
      }
  ```
- Drag test pages: `src/routes/tests/drag/<name>/+page.svelte`, specs `e2e/drag/<name>.spec.ts` (for example
  `snap-to-origin`).

### Upstream (verified at `~/Github/motion` tag `v14.6.0`)

`packages/framer-motion/src/gestures/drag/index.ts` `update()`:

```ts
    update() {
        const { dragControls, drag } = this.node.getProps()
        const { dragControls: prevDragControls, drag: prevDrag } =
            this.node.prevProps || {}

        if (dragControls !== prevDragControls) { /* re-subscribe */ }

        /**
         * If drag is disabled mid-gesture, for instance from onDrag, end the
         * gesture as if released. This must happen before this render's
         * layout change is processed, otherwise the element is still
         * animation-blocked, so it jumps to its new layout and keeps that
         * jump as a drag offset, which release wouldn't animate away as
         * drag is now disabled.
         */
        if (prevDrag && !drag)
            this.controls.stop(undefined, undefined, prevDrag)
    }
```

Fixture `dev/react/src/tests/issue-2248.tsx` and spec `tests/react/issue-2248.spec.ts` (read with
`git -C ~/Github/motion show v14.6.0:<path>`): two cards, each `layout`, `drag={isSelected && 'y'}`,
`dragSnapToOrigin`, with a `layout` child; card 0 closes from `onDragEnd`, card 1 from `onDrag` once
`info.offset.y > 100`. Unit test: `packages/framer-motion/src/gestures/drag/__tests__/index.test.tsx` (search for
2248).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| One unit file | `pnpm exec vitest run src/lib/utils/visualElementCore.spec.ts` | all pass |
| Unit tests | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint/format | `trunk fmt <files>` then `trunk check <files>` | no new issues |
| E2E | `PW_PORT=4208 pnpm exec playwright test <paths>` | all pass |

## Scope

**In scope**: `src/lib/utils/visualElementCore.ts` (`DragGestureFeature.update()` and the class JSDoc),
`src/lib/utils/visualElementCore.spec.ts`, `src/routes/tests/drag/disable-from-ondrag/+page.svelte` (create),
`e2e/drag/disable-from-ondrag.spec.ts` (create), `src/routes/+page.svelte` (one link in the drag section),
`.changeset/drag-disabled-mid-gesture.md` (create).

**Out of scope**: `_MotionContainer.svelte` (the call order is already right), `PanGestureFeature`, the drag
controls subscription logic, `package.json`.

## Git workflow

- Lane branch `lane/1460-drag` in `../svelte-motion-1460-drag`, created by the dispatcher from
  `feat/motion-14.6.0` after plan 001 is committed.
- Conventional commits, e.g. `test(drag): disabling drag from onDrag returns the card`,
  `fix(drag): end the gesture when drag turns off mid-drag (Motion 14.6.0)`. End each message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do NOT push or open a PR.

## Steps

### Step 1: Red tests

1. Unit: in `describe('DragGestureFeature')` add
   `it('ends the gesture with the previous drag axes when drag turns off', …)`: `mountWithDrag({ drag: 'y' })`,
   `const stop = vi.spyOn(feature.controls, 'stop')`, then `ve.update({ drag: false } as never, undefined)` and
   `ve.updateFeatures()`; expect `stop` toHaveBeenCalledExactlyOnceWith(`undefined, undefined, 'y'`). Add a second
   case: `drag` stays `'y'` across an update → `stop` not called. (If `ve.update`'s signature in this repo differs,
   match how other tests in the file change props.)
2. E2E: create `src/routes/tests/drag/disable-from-ondrag/+page.svelte`, a port of upstream
   `dev/react/src/tests/issue-2248.tsx`. Each card is a component-local `$state` `isSelected`; the slot is a
   `div` `data-testid="slot-{id}"` 192 px high; the card is a `motion.div` `data-testid="card-{id}"`,
   `data-selected={isSelected}`, `layout`, `transition={{ type: 'spring' }}`, `drag={isSelected ? 'y' : false}`,
   `dragSnapToOrigin`, `onclick` → select; card 0 closes in `onDragEnd`, card 1 in `onDrag`, both when
   `info.offset.y > 100`. Selected style: `position: fixed; inset: 0; width: 50%; height: auto; margin: 48px auto; background: orange`;
   unselected: `width: 100%; height: 100%; background: red`. Each card has a `motion.div` `layout` child
   `data-testid="child-{id}"` (40×40, blue). Wrap both in a 600 px wide container. Header comment citing #2248,
   commits `b0060fd42` and `cbc357bab`.
3. Create `e2e/drag/disable-from-ondrag.spec.ts`, a port of upstream `tests/react/issue-2248.spec.ts` (load
   `/tests/drag/disable-from-ondrag?@isPlaywright=true`; keep upstream's `openAndGrab` and `expectBoxToSettle`
   helpers and both tests: "closed from onDragEnd returns to its slot", and "closed from onDrag animates back to its
   slot while the pointer is down", including the mid-animation width check and the child-follows-card check).
4. Link the page from the drag section of `src/routes/+page.svelte`.

**Verify**:
- `pnpm exec vitest run src/lib/utils/visualElementCore.spec.ts` → the new "turns off" case **FAILS** (`stop` not
  called).
- `PW_PORT=4208 pnpm exec playwright test e2e/drag/disable-from-ondrag.spec.ts` → the onDrag case **FAILS**; the
  onDragEnd case passes. If the onDrag case passes, STOP.

Commit (`test(drag): disabling drag from onDrag returns the card`).

### Step 2: Port the stop

In `DragGestureFeature.update()`, read `drag` alongside `dragControls`
(`const { dragControls, drag } = this.node.getProps() as { dragControls?: unknown; drag?: unknown }`, and the same
for `prevProps`). After the `dragControls` re-subscribe block and **before** the Svelte deviation 2 block, add
upstream's comment and:

```ts
        if (prevDrag && !drag) this.controls.stop(undefined, undefined, prevDrag as never)
```

Use the exact parameter type motion-dom 14.6.0 declares for `stop`'s third argument instead of `as never` if it is
exported; otherwise keep the narrowest cast that compiles. Update the class JSDoc to say the port is now of
`gestures/drag/index.ts` @ v14.6.0.

**Verify**: `pnpm exec vitest run src/lib/utils/visualElementCore.spec.ts` → all pass;
`PW_PORT=4208 pnpm exec playwright test e2e/drag/disable-from-ondrag.spec.ts` → both pass.

### Step 3: Changeset and gate

Create `.changeset/drag-disabled-mid-gesture.md` (bump `patch`): "Turning `drag` off while a drag is in progress
(for example from `onDrag`) now ends the gesture and animates the element back, instead of leaving it stuck with an
offset (Motion 14.6.0, #2248)."

**Verify**: `pnpm check` (0 errors), `pnpm test:only` (all pass),
`PW_PORT=4208 pnpm exec playwright test e2e/drag e2e/reorder` (all pass; re-run a failing spec alone once before
reporting), `trunk check` on changed files (clean), `git status` shows only in-scope files.

## Test plan

- Red-first: the unit "turns off" case and the e2e onDrag case fail before Step 2 and pass after.
- Guards: the unit "drag unchanged" case, the e2e onDragEnd case, and the whole `e2e/drag` and `e2e/reorder` suites
  (Reorder items are drag elements too).

## Done criteria

- [ ] `grep -n "prevDrag && !drag" src/lib/utils/visualElementCore.ts` → one match
- [ ] New unit cases and both e2e cases pass; `e2e/drag` and `e2e/reorder` pass
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `trunk check` clean
- [ ] Changeset exists; page linked; no out-of-scope files modified

## STOP conditions

- `package.json` is not on motion-dom 14.6.0.
- The e2e onDrag case passes before Step 2.
- `stop()` at 14.6.0 doesn't accept a third argument (`pnpm check` error on the call).
- Any `e2e/drag` or `e2e/reorder` spec fails twice after Step 2.

## Maintenance notes

- If svelte-motion ever unmounts disabled features itself, this trigger stops firing; keep features mounted like
  motion-dom does.
- The child-follows-card check depends on motion-dom's `cbc357bab` (arrives with plan 001). If it fails while the
  card itself returns, look at the projection's `followDraggedAncestor` handling in motion-dom first.
