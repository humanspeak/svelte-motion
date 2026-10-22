# Plan 001: Drive `drag` with motion-dom's `VisualElementDragControls`, with upstream behavior throughout

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> When done, update this plan's row in `.agents/.plans/upstream-drag/README.md`, unless a reviewer dispatched you and
> told you they maintain the index.
>
> **Never use `git stash`.** Prefix every Playwright command with this lane's `PW_PORT` (see README). Never touch
> port 4198.
>
> **Drift check (run first)**: `git diff --stat 20ca271c..HEAD -- src/lib e2e/drag e2e/reorder src/routes/tests/drag`
> Expect no output (this branch starts at `20ca271c`). On any output, compare against "Current state", and on a
> mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH. Every `drag` element, Reorder, and `dragControls` changes implementation. Behavior visible to users
  changes in the five places listed under "Decided behavior changes".
- **Depends on**: none (starts from `feat/motion-14.5.0` at `20ca271c`)
- **Category**: migration / tech-debt (upstream parity)
- **Planned at**: commit `20ca271c`, 2026-10-21

## Why this matters

svelte-motion has its own ~2.5k-line drag stack (`src/lib/utils/drag.ts`, `pan.ts`, `dragInertia.ts`,
`dragMath.ts`, `dragParams.ts`). Every upstream drag fix has to be hand-ported, and it has drifted. A spike
(`spike/upstream-drag`, report at `.agents/.plans-closed/motion-14-5-0/006-spike-report.md` on `feat/motion-14.5.0`)
showed that Motion 14.4+'s host-agnostic `VisualElementDragControls` drives svelte-motion's `drag` with no change to
motion-dom. With it, 7 acceptance tests that fail today pass: window scroll during a held drag, a `var()`/`%` drag
origin, and the default `touch-action`/`user-select`/`draggable` styles. There are no regressions outside drag, and
Reorder passes 21/21. This plan makes the controller the only implementation for `motion.*` drag. Plan 002 then
deletes the dead legacy code.

**Maintainer rule (2026-10-21): "Always update upstream."** Wherever svelte-motion's drag differs from upstream on
purpose, adopt upstream's behavior and rewrite the tests that pinned svelte-motion's behavior. Do not keep shims for
svelte-motion-only contracts.

## Decided behavior changes (adopt upstream; rewrite the pinning tests)

| # | Behavior | svelte-motion today | Upstream (adopt) | Spec(s) to rewrite |
| --- | --- | --- | --- | --- |
| 1 | Default drag styles beat class CSS | `touch-action` from the user's CSS | inline `touch-action: none` / `pan-y` / `pan-x` + `user-select: none` + `draggable="false"` (framer-motion `render/html/use-props.ts:59-73`) | `e2e/drag/axis-handoff.spec.ts` (2 tests): drop the fixture's `touch-action` assertion, or assert upstream's inline value |
| 2 | Re-grab outside the constraints | stretches from the caught origin | constraints are applied from the boundary, so the box jumps back toward the edge (`VisualElementDragControls.updateAxis`) | `e2e/drag/settle-cancel.spec.ts` "slow settle follows rightward movement after re-grab" |
| 3 | `pointercancel` | settles with no fling | treated like pointerup, so momentum is kept (`PanSession.handlePointerUp`) | `e2e/drag/pointer-cancel.spec.ts` |
| 4 | `dragConstraints` swapped to a new element | the new element is observed for resizes | only the first constraint element is observed (`startResizeObservers` guarded by `if (!stopResizeObservers)`) | `e2e/drag/element-ref-resize.spec.ts` "replacement-only resize follows B" and "resizing the active ref constrains a stationary held pointer" |
| 5 | Constraint element resizes while the box rests | offset kept | offset remapped by progress (`scalePositionWithinConstraints`) | `e2e/drag/transform-page-point.spec.ts` "numeric, ref, and resized ref bounds" |
| 6 | `dragControls.stop()`/`cancel()` with no live drag | stop the post-release glide | no-op (upstream `stop()` returns early when not dragging) | `e2e/drag/controls-cancel-inertia.spec.ts` |
| 7 | Drag-start signal | `data-svelte-motion-drag-active` attribute + `svelte-motion:drag-start` event | none (internal plumbing is gone) | `e2e/drag/controls.spec.ts`, `e2e/drag/element-ref-resize.spec.ts`, `e2e/reorder/basic.spec.ts`: observe `onDragStart`/`onDragEnd` state that the fixture page exposes instead |
| 8 | snapToCursor paint | synchronous | next frame | `e2e/drag/controls.spec.ts` "snapToCursor does not creep": wait one rAF before reading |

**How to rewrite a pinning test.** Change its assertions to what upstream does, and cite the upstream file/line in
a comment (e.g. `// Motion 14.5 PanSession treats pointercancel as pointerup (keeps momentum)`). Where the test's
whole point was the svelte-motion-only behavior (#4's two tests), replace it with a test of the upstream behavior
that would catch a regression (e.g. "after swapping constraints to B, the original element's resize is still
observed"), or delete it if no upstream-observable behavior remains. Say which in your report. Never loosen an
assertion just to pass: each new expectation must be derived from upstream's code.

For #5 the spike saw values that varied between runs (x 366 vs 246, or centre 590 vs 530). Derive the expected value
from `scalePositionWithinConstraints` (`~/Github/motion` @ `v14.5.0`,
`packages/motion-dom/src/gestures/drag/VisualElementDragControls.ts:605-683`). If the observed value is not
deterministic across 3 solo runs, STOP and report: that points to an integration bug, not a parity choice.

## Current state

- The prototype lives on branch `spike/upstream-drag` (never merged) as three commits, cherry-pickable onto
  `20ca271c`:
  - `4891c506` acceptance specs: `e2e/drag/window-scroll-hold.spec.ts`, `css-variable-origin.spec.ts`,
    `default-styles.spec.ts` + pages `src/routes/tests/drag/window-scroll-hold/`, `css-variable-origin/`
  - `3918cc16` prototype behind `VITE_UPSTREAM_DRAG`: `src/lib/utils/dragImpl.ts`, a `DragGestureFeature` in
    `src/lib/utils/visualElementCore.ts`, drag-prop forwarding + default styles + `alwaysMeasureLayout` in
    `src/lib/html/_MotionContainer.svelte`, `alwaysMeasureLayout` passthrough in `src/lib/utils/motionDomProjection.ts`,
    a `componentControls` Set in `src/lib/utils/dragControls.ts`, plus a spike-only `/tests/drag/impl-flag` page and
    spec
  - `927c9bdf` shims (marker/event in `DragGestureFeature`, glide-stop in `dragControls.ts`). **These shims are
    removed by this plan** (#6, #7).
  Read them with `git show <sha>`.
- `src/lib/types.ts:517-529`, the public `DragControls` type:
  ```ts
  export type DragControls = {
      start: (event: PointerEvent, options?: { snapToCursor?: boolean; distanceThreshold?: number }) => void
      cancel: () => void
      stop: () => void
      /** Subscribe the controls to a target element. */
      subscribe: (el: HTMLElement) => void
  }
  ```
  `createDragControls` (`src/lib/utils/dragControls.ts`) is exported from `src/lib/index.ts:170`.
- Upstream `DragControls` (`~/Github/motion` @ `v14.5.0`, `packages/framer-motion/src/gestures/drag/use-drag-controls.ts`):
  a `Set<VisualElementDragControls>`. `subscribe(controls)` returns an unsubscribe (`@internal`), and
  `start(event, options)`, `cancel()` and `stop()` fan out to every subscriber. Upstream `DragGesture`:
  `packages/framer-motion/src/gestures/drag/index.ts` (~60 lines).
- Legacy wiring in `src/lib/html/_MotionContainer.svelte`: `resolveDragOptions()` and two `$effect`s calling
  `attachDrag`/`teardownDrag.updateOptions` (around lines 1565-1720 on `20ca271c`), and an
  `element?.dataset.svelteMotionDragActive === 'true' && teardownDrag` check in the props-sync effect (around
  line 2250).
- `src/lib/utils/vanillaDrag.ts` (plan 008 of the 14.5.0 batch) guards with `svelteMotionDragElements` from
  `drag.ts`. Plan 002 here switches it.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Typecheck | `pnpm check` | 0 errors |
| Unit | `pnpm test:only` | all pass |
| Lint | `trunk fmt <files>` then `trunk check <files>` | clean |
| e2e area | `PW_PORT=<lane> pnpm exec playwright test e2e/drag e2e/reorder` | see steps |
| Full e2e | `PW_PORT=<lane> pnpm test:e2e` | 0 failures |
| Package | `pnpm build` | exit 0 |

## Scope

**In scope**:
- `src/lib/utils/visualElementCore.ts`, `src/lib/html/_MotionContainer.svelte`, `src/lib/utils/motionDomProjection.ts`,
  `src/lib/utils/dragControls.ts`, `src/lib/types.ts` (the `DragControls` type only)
- the spike's acceptance pages/specs (cherry-picked) and links in `src/routes/+page.svelte`
- the e2e specs and their fixture pages listed in "Decided behavior changes"
- `src/lib/components/Reorder/reorder.component.spec.ts` (only the `commitDraggedLayoutChange` case)
- unit specs for the feature and `DragControls` (create)
- `docs/src/routes/docs/drag/+page.svx` (a "Behavior" note on default styles, pointercancel, and constraint
  resizing)
- `.changeset/upstream-drag-controller.md` (create, `minor`)

**Out of scope**: deleting `drag.ts`/`dragInertia.ts`/`dragMath.ts`/`dragParams.ts` and their specs (plan 002);
`pan.ts` and the pan gesture (plan 003); `src/lib/utils/vanillaDrag.ts` (plan 002); motion-dom itself.

## Git workflow

Branch `feat/upstream-drag`, created from `feat/motion-14.5.0` at `20ca271c` (it stacks on the 14.5.0 PR).
Conventional commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

## Steps

### Step 1: Red acceptance tests

`git cherry-pick 4891c506`. Link `/tests/drag/window-scroll-hold` and `/tests/drag/css-variable-origin` in
`src/routes/+page.svelte`'s drag section.

**Verify**: `PW_PORT=<lane> pnpm exec playwright test e2e/drag/window-scroll-hold.spec.ts e2e/drag/css-variable-origin.spec.ts e2e/drag/default-styles.spec.ts`
→ 6 failed, 1 passed (the `animate` variant of css-variable-origin already passes). This is the spike's recorded red.

### Step 2: Bring in the prototype and make it unconditional

`git cherry-pick 3918cc16 927c9bdf`, then:

- Delete `src/lib/utils/dragImpl.ts`, `src/routes/tests/drag/impl-flag/` and `e2e/drag/impl-flag.spec.ts`. Replace
  every `USE_UPSTREAM_DRAG` condition with its upstream branch. Register the `drag` feature unconditionally, enabled
  by `isDragFeatureEnabled`.
- Keep the LazyMotion gate: the drag props, default styles and `alwaysMeasureLayout` only apply when
  `hasDragFeatures` (`domAnimation` users must still get no drag).
- `_MotionContainer.svelte`: remove both legacy drag `$effect`s, `resolveDragOptions`, the `attachDrag` import and
  `teardownDrag`. The props-sync check becomes `!!elementDragControls.get(visualElement)?.isDragging`. Leave
  `commitDraggedLayoutChange` in `motionDomProjection.ts` (plan 002 removes it once unreferenced).
- Remove the shims from `DragGestureFeature` (#7): no `readProps` wrapper, no marker/event, no `cancel` override.
  The constructor becomes `this.controls = new VisualElementDragControls(node)`. Keep the two documented Svelte
  deviations (retry `addListeners()` in `update()` when the instance wasn't ready; re-fire projection `'measure'`
  when `dragConstraints` changes), each with its comment.
- Rewrite `dragControls.ts` to upstream's `DragControls` shape (#6): a `Set<VisualElementDragControls>`,
  `subscribe(controls): () => void` (`@internal`), and `start`/`cancel`/`stop` fanning out, with options
  (including `distanceThreshold`) passed through. `DragGestureFeature` subscribes via `dragControls.subscribe(this.controls)`.
  Update the `DragControls` type in `types.ts` to match, with Google-style JSDoc citing `use-drag-controls.ts @ v14.5.0`.
  Remove the container's `controls.subscribe(element)` call.

**Verify**: `pnpm check` → 0 errors. The Step 1 specs → 7 passed.

### Step 3: Rewrite the pinning tests (decided behavior changes 1-8)

Work through the table. For each spec: run it, rewrite it per "How to rewrite a pinning test", and run it again.
Fixture pages may gain a `data-dragging` attribute driven by `onDragStart`/`onDragEnd` to replace the removed
marker (#7). In `reorder.component.spec.ts`, rewrite the `commitDraggedLayoutChange` case to assert the observable
result (the held item's slot rebase) instead of the internal call, or delete it if jsdom can't observe it, and say
which.

**Verify**: `PW_PORT=<lane> pnpm exec playwright test e2e/drag e2e/reorder` → 0 failures (re-run any failure solo
once before counting it). `pnpm test:only` → all pass.

### Step 4: Unit coverage

Add `src/lib/utils/dragControls.spec.ts`: fan-out to two subscribed controls, unsubscribe, `distanceThreshold`
passed through. This also guards the legacy bug where only the last subscriber was driven. Add a
`DragGestureFeature` case to the existing `visualElementCore` spec: mount subscribes `dragControls`, a
`dragControls` identity change re-subscribes, unmount removes listeners.

**Verify**: both spec files pass.

### Step 5: Docs and changeset

- `docs/src/routes/docs/drag/+page.svx`: a short "Behavior" section listing default styles (#1), pointercancel
  momentum (#3), constraint swapping/resizing (#4, #5), and `dragControls` semantics (#6), matching Motion's.
- `.changeset/upstream-drag-controller.md` (`minor`): "`drag` is now powered by Motion's own drag controller. Fixes:
  window scroll during a held drag, dragging from a `var()` or `%` value, default `touch-action`/`user-select`/`draggable`.
  `dragControls` now drives every subscribed element and honors `distanceThreshold`. Behavior now matches Motion:" and
  then list #1-#6 in one line each.

**Verify**: `trunk check` on the changed docs/changeset → clean.

### Step 6: Full gate

**Verify**: `pnpm build` (exit 0), `pnpm check` (0 errors), `pnpm test:only` (all pass),
`PW_PORT=<lane> pnpm test:e2e` (0 failures after solo re-runs), `git status` (in-scope only).

## Test plan

- Red anchors: the spike's 7 acceptance tests (6 red on legacy), green after Step 2.
- Behavior changes 1-8 each end with a rewritten spec asserting upstream's behavior, citing upstream code.
- New unit specs for `DragControls` fan-out and the feature's lifecycle.
- Full e2e is the regression net (the spike: no non-drag regressions).

## Done criteria

- [ ] `grep -rn "USE_UPSTREAM_DRAG\|svelteMotionDragActive\|svelte-motion:drag-start" src e2e` → only `src/lib/utils/drag.ts` / `drag.spec.ts` (deleted by plan 002)
- [ ] `grep -n "attachDrag" src/lib/html/_MotionContainer.svelte` → no matches
- [ ] `pnpm check` 0 errors; `pnpm test:only` passes; `pnpm build` exits 0
- [ ] Full e2e 0 failures; Step 1 specs pass
- [ ] Each rewritten spec has an upstream citation comment; the report lists rewritten vs deleted tests
- [ ] Changeset + docs section exist; README row updated

## STOP conditions

- A cherry-pick conflicts in a file outside the in-scope list.
- A non-drag e2e spec fails and reproduces on a solo re-run (the spike saw none).
- #5's observed value is not deterministic across 3 solo runs.
- Making the feature unconditional breaks LazyMotion's `domAnimation`/`domMin` (`e2e/lazy-motion`).
- A fix seems to need patching motion-dom.

## Maintenance notes

- From here on, drag fixes arrive with the Motion pin. Before porting any drag fix by hand, check whether it's in
  `VisualElementDragControls`/`PanSession`.
- The two Svelte deviations in `DragGestureFeature` (listener retry, constraint re-measure) are the only places
  where svelte-motion's drag differs from React's. Re-check both on each Motion bump.
