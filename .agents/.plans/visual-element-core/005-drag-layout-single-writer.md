# Plan 005: Drag and layout write through the VisualElement (single-writer completion)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/visual-element-core/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7eba0bd..HEAD -- src/lib/utils/drag.ts src/lib/utils/layout.ts src/lib/utils/dragInertia.ts`
> These three files should be UNCHANGED since `7eba0bd` except by this plan;
> container/projection changes from plans 001–004 are expected.

## Status

- **Priority**: P2 — explicitly deferrable; BLOCKED is an acceptable outcome
- **Effort**: L
- **Risk**: HIGH — drag parity was recently rebuilt and user-signed-off
  (#399–#415); regressions here are expensive
- **Depends on**: 003-gestures-setactive.md (DONE)
- **Category**: tech-debt (architecture migration, GitHub issue #449)
- **Planned at**: commit `7eba0bd`, 2026-07-24

## Why this matters

Drag is the last writer that bypasses the VisualElement: it composes a
transform string and writes `el.style.transform` up to three times per change
(sync, microtask, rAF) purely to win races against the reactive style effect —
races that stop existing once the VE is the only style writer. Upstream drag
writes axis MotionValues obtained from `visualElement.getValue('x'|'y')` and
calls `visualElement.render()` synchronously; the VE composes the full
transform. Moving to that model deletes the composer/race machinery and makes
`whileDrag` a real `setActive` priority level. The legacy FLIP fallback in
`layout.ts` similarly duplicates what the projection node (a VE renderer since
plan 001 unified them) already does.

## Current state

- **Our writer** — `src/lib/utils/drag.ts:596-652` `setXYImmediate(x, y)`:

```ts
// drag.ts:603-604 — bound MotionValues stay the public source of truth (#421)
if (boundX && boundX.get() !== x) boundX.set(x)
if (boundY && boundY.get() !== y) boundY.set(y)
// drag.ts:633-649 — composed string written 3× to win writer races
composedTransform = buildDragTransform(latestValues, opts.getBaseTransform?.() ?? '', opts.transformTemplate) || 'none'
el.dataset.svelteMotionDragTransform = composedTransform
const writeComposedTransform = () => { ... el.style.transform = composedTransform }
writeComposedTransform(); queueMicrotask(writeComposedTransform); requestAnimationFrame(writeComposedTransform)
```

plus a rAF composer loop (`startTransformComposer`, `:654-690`), per-channel
whileDrag animations (`startWhileDrag`/`endWhileDrag`, `:812-880`), inertia
driving `setXYImmediate` (`:1136-1330`), no-momentum settle (`:1330-1500`),
origin adjustment ported from upstream (`adjustOrigin`, `:767-810`, cites
`VisualElementDragControls.ts:742-758`), a `svelte-motion:drag-start` event
(`:924`) that plan 003's hover guard listens for via dataset, and
ResizeObserver-driven constraint rescaling (`:576-584`).

- **Upstream reference** —
  `~/Github/motion/packages/framer-motion/src/gestures/drag/VisualElementDragControls.ts`:
  `getAxisMotionValue(axis)` returns `props._dragX/_dragY` or
  `visualElement.getValue(axis, latestValues[axis] ?? 0)` (`:544-556`); writes
  via `axisValue.set(next)` (`:319-337`); synchronous
  `visualElement.render()` mid-drag (`:216`, `:658`, `:756`);
  `setActive("whileDrag", true)` at drag start (`:174-176`), false at end
  (`:305`); projection `isAnimationBlocked` toggles (`:138-140`, `:290-293`);
  inertia through `startAnimation` on the same axis values with
  `type: "inertia"`.
  Drag lock: `setDragLock`/`isDragActive` are exported by motion-dom — upstream
  hover/press consult the lock; our plan-003 handlers used a dataset guard.
- **Layout FLIP fallback** — `src/lib/utils/layout.ts`: `runFlipAnimation`
  (`:424-472`, writes `transformOrigin`/`transform` then `animate(el, ...)`),
  `runBoxSizeAnimation` (`:169-330`, writes width/height + per-frame
  `writeBox`), used by the container's layout effect ONLY when the
  motion-dom projection adapter is absent (fallback branch,
  `_MotionContainer.svelte:2661-2860` region: `commitObservedLayout` chooses
  `commitDraggedLayoutChange` / `commitObservedLayoutChange` / legacy
  `runFlipAnimation`) and by the layoutId FLIP effect (`:2862-2883`, bypassed
  when `motionDomProjection && layoutProp`).
- **Reorder** — `src/lib/components/Reorder/Item.svelte:55-59, 101-108` passes
  `x`/`y` MotionValues via `style`, so post-002 they're bound to the VE;
  drag's `boundX.set()` already routes through them.
- **Drag e2e surface** (the bar): `e2e/drag` (including
  `while-drag-write-coalescing.spec.ts`), `e2e/reorder`, `e2e/layout`,
  `e2e/projection`, plus `src/lib/utils/drag.spec.ts` unit contracts.

## Commands you will need

| Purpose     | Command                                                 | Expected      |
| ----------- | ------------------------------------------------------- | ------------- |
| Typecheck   | `pnpm check`                                            | 0 errors      |
| Unit        | `pnpm test:only`                                        | all pass      |
| Drag e2e    | `pnpm test:e2e e2e/drag e2e/reorder`                    | all pass      |
| Layout e2e  | `pnpm test:e2e e2e/layout e2e/layout-id e2e/projection` | all pass      |
| Format/lint | `trunk fmt` / `trunk check`                             | no new issues |

## Scope

**In scope**:

- `src/lib/utils/drag.ts` (writer swap; keep gesture-recognition, constraints,
  elastic, momentum math, keyboard drag)
- `src/lib/utils/dragInertia.ts` (retarget onto axis MotionValues if needed)
- `src/lib/utils/layout.ts` (retire FLIP paths that the projection now owns —
  deletion only where provably unreachable)
- `src/lib/html/_MotionContainer.svelte` (fallback-branch removal, whileDrag
  wiring)
- `src/lib/utils/drag.spec.ts`, `src/lib/utils/layout.spec.ts`
- `src/lib/utils/transformComposer.ts` (delete if now unreferenced)

**Out of scope**:

- `src/lib/utils/pan.ts`, `dragControls.ts` public API, `dragMath.ts`,
  `dragParams.ts` (pure math — reuse as-is)
- Reorder component logic
- Any public type in `src/lib/types.ts`

## Git workflow

- Branch `issue-449-visual-element-core`; conventional commits,
  e.g. `feat(drag): write through VisualElement axis values (#449)`.
- Do NOT push.

## Steps

### Step 1: Characterization baseline

Run all four e2e commands above + `pnpm test:only`; record per-suite counts.
Read `e2e/drag/while-drag-write-coalescing.spec.ts` and
`src/lib/utils/drag.spec.ts` fully before touching code.

**Verify**: recorded; all pass.

### Step 2: Axis values through the VE

In `drag.ts`, replace the composed-string writer: obtain
`xValue = ve.getValue('x', 0)` / `yValue = ve.getValue('y', 0)` (bound style
MotionValues are ALREADY these, post-002 — verify identity with the
`visualElementStore`), write via `.set()`, call `ve.render()` synchronously
after each pointer-move batch (upstream `:216`). Delete
`setXYImmediate`'s triple-write + dataset machinery and the
`startTransformComposer` rAF loop. `crossAxisOffset`/unbound-axis pixel-offset
logic moves into values (offsets add onto the axis value, matching upstream's
"drag writes the same x/y channel" model). Keep `adjustOrigin` semantics by
operating on the values.

**Verify**: `pnpm test:only src/lib/utils/drag.spec.ts` → all pass (update
assertions that pinned the dataset/triple-write mechanics — justify each in
NOTES); `pnpm test:e2e e2e/drag` → all pass.

### Step 3: whileDrag + drag lock

Replace `startWhileDrag`/`endWhileDrag` with
`ve.animationState.setActive('whileDrag', bool)` at the exact points drag
start/end fire today, add `setDragLock`/release per upstream
(`VisualElementDragControls.ts:157-166` region — read it), and remove the
plan-003 dataset guard in `gestures.ts` in favor of the lock. Toggle
`projection.isAnimationBlocked` equivalents via the existing adapter methods
(`blockLayoutAnimation`/`unblockLayoutAnimation`,
`motionDomProjection.ts:565-583`).

**Verify**: `pnpm test:e2e e2e/drag e2e/motion` → all pass.

### Step 4: Inertia onto the same values

`dragInertia.ts` currently animates a detached value with `onUpdate →
setXYImmediate`. Retarget: animate the axis MotionValues directly
(`animateMotionValue`/`startAnimation` with `type: 'inertia'`), boundary
clamp/spring via the existing `completeAxis` math operating on values.

**Verify**: `pnpm test:only src/lib/utils/dragInertia.spec.ts` (update) →
pass; `pnpm test:e2e e2e/drag` → all pass (momentum + release-continuity
specs are the bar).

### Step 5: Retire unreachable FLIP fallback

In the container's layout effect, determine when the legacy branch
(`runFlipAnimation` / `runBoxSizeAnimation`) can still execute now that every
motion component has a VE + (when layout props are set) a projection node. If
provably unreachable, delete the branch and the corresponding `layout.ts`
functions; if still reachable (e.g. `layoutId` without `layout` bypass at
`:2879`), route that case through the projection instead and THEN delete.
`grep -rn "runFlipAnimation\|runBoxSizeAnimation" src/` → no hits when done.

**Verify**: `pnpm test:e2e e2e/layout e2e/layout-id e2e/projection` → all pass.

### Step 6: Full gate

`trunk fmt` → `trunk check` → `pnpm check` → `pnpm test:only` → all four e2e
commands.

**Verify**: matches Step 1 baseline everywhere.

## Test plan

- No red-first test: behavior-preserving migration; the Step 1 baseline
  (notably drag momentum/continuity and write-coalescing specs) is the pin.
- Updated unit specs must keep asserting BEHAVIOR (positions over time,
  velocity continuity) — flag any assertion you weaken.
- Verification: full unit + `e2e/drag e2e/reorder e2e/layout e2e/layout-id
e2e/projection`.

## Done criteria

- [ ] `pnpm check` exits 0; `trunk check` no new issues
- [ ] `pnpm test:only` exits 0
- [ ] `pnpm test:e2e e2e/drag e2e/reorder e2e/layout e2e/layout-id e2e/projection` exits 0, matching baseline
- [ ] `grep -n "svelteMotionDragTransform\|queueMicrotask(writeComposedTransform)" src/lib/utils/drag.ts` → no matches
- [ ] `grep -rn "runFlipAnimation" src/` → no matches
- [ ] `grep -n "setActive('whileDrag'\|setActive(\"whileDrag\"" src/lib/utils/drag.ts` → present
- [ ] No files outside the in-scope list modified
- [ ] README status row updated

## STOP conditions

- Drift in `drag.ts`/`layout.ts` since `7eba0bd`.
- Any drag e2e regression that survives two focused fix attempts — mark
  BLOCKED with the failing spec + measured values. This plan is P2: a BLOCKED
  outcome with a clean report is better than a behavioral regression in
  signed-off drag.
- The `layoutId`-without-`layout` fallback can't be routed through projection
  without touching `AnimatePresence`/`LayoutGroup` semantics.
- You need `_dragX`/`_dragY`-style private props — that's public-API design,
  report instead.

## Maintenance notes

- After this plan the VE is the ONLY element-style writer in the library
  (presence clones excepted). Any future feature that writes styles must go
  through motion values on the VE.
- Reviewer: scrutinize velocity continuity on release (the #413 contract),
  constraint rescale on resize, reorder item coupling, and each weakened unit
  assertion.
- Follow-up candidates (new issues, not this plan): replace remaining
  layout.ts helpers entirely; migrate presence clones to VE-based exits;
  adopt upstream `VisualElementDragControls` wholesale once props shape aligns.
