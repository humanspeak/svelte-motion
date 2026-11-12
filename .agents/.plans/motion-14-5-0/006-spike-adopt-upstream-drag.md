# Plan 006 (SPIKE): Can svelte-motion drive `drag` with motion-dom's `VisualElementDragControls`?

> **Executor instructions**: This is a **time-boxed spike**, not a migration. Its product is a written report
> plus a throwaway prototype branch, and it ends in a go/no-go recommendation. Follow the steps in order. Run every
> verification command and record the result in the report, failures included. A failing drag spec is data, not a
> STOP, unless "STOP conditions" says otherwise. When done, update this plan's row in
> `.agents/.plans/motion-14-5-0/README.md`, unless a reviewer dispatched you and told you they maintain the index.
>
> **Never use `git stash`.** Never merge the spike branch into `feat/motion-14.5.0`.
>
> **Drift check (run first)**: `git diff --stat f2b5d766..HEAD -- src/lib/utils/drag.ts src/lib/utils/pan.ts src/lib/utils/dragControls.ts src/lib/utils/dragInertia.ts src/lib/utils/dragMath.ts src/lib/utils/visualElementCore.ts src/lib/components/Reorder src/lib/utils/motionDomProjection.ts`
> Plan 003 changes `Reorder/autoScroll.ts`. Anything else: re-read the files named below before relying on the
> line numbers.

## Status

- **Priority**: P2 (direction; maintainer-requested)
- **Effort**: M (time box: one working session; stop at the box and report what you have)
- **Risk**: LOW for the product (prototype branch only); the migration it informs is HIGH
- **Depends on**: 001 (needs motion-dom 14.5.0, which exports the host-agnostic controller)
- **Category**: direction / tech-debt
- **Planned at**: commit `f2b5d766`, 2026-10-21

## Why this matters

svelte-motion has its own drag stack: `src/lib/utils/drag.ts` (1722 lines), `pan.ts` (573), `dragInertia.ts`,
`dragMath.ts` and `dragControls.ts`, about 2.5k lines plus about 1.8k lines of unit tests. Every upstream drag fix
has to be hand-ported, and some drift has already happened:

- **Window scroll during drag is never compensated.** `pan.ts` `handleScroll` (around lines 550-566) adds the
  window delta to `lastMovePoint`, but `updatePoint` (around line 485) rebuilds `lastMovePoint` from
  `lastRawMovePoint`, which is never adjusted. If you hold the pointer still and scroll the page, the element
  drifts until the next pointermove. Upstream: `PanSession.ts`, plus its 14.5.0 double-count fix (`840b3dde2`, #3944).
- **A bound `var(--y)` or `%` value jumps when a drag starts.** `drag.ts` `readNumericAxisValue` (around lines
  778-782) does `parseFloat`: NaN for `var(...)`, and `50%` becomes 50 px. Upstream resolves CSS variables and
  converts percents against the layout box (`VisualElementDragControls.ts:155-185`, 14.3.1, #2390).
- **No default drag styles.** svelte-motion never sets `touch-action`, `user-select`, `-webkit-touch-callout` or
  `draggable="false"` on drag elements (`grep -rniE "touch-action|user-select|draggable" src/lib` finds only
  comments). On touch devices the page scrolls instead of dragging. Upstream sets them (framer-motion
  `render/html/use-props.ts:59-73`; vanilla `drag()` `applyDragStyles`).

In Motion 14.4.0 upstream made its drag controller host-agnostic. `VisualElementDragControls` now lives in
motion-dom with an injectable props reader, and React's whole `DragGesture` feature is about 60 lines around it.
svelte-motion already runs everything that controller touches: motion-dom's real `HTMLVisualElement`,
`animationState` (which already handles `whileDrag`) and `HTMLProjectionNode`. If the controller works
under svelte-motion, those 2.5k lines and the three bugs above go away, and future drag fixes arrive with pin
bumps. This spike answers whether it does, and what svelte-motion-only behavior would be lost.

## Current state

### svelte-motion

- Wiring: `src/lib/html/_MotionContainer.svelte` around lines 1565-1660. `resolveDragOptions()` builds
  `AttachDragOptions` from props and an `$effect` calls `attachDrag(dragTarget, opts)` once the element is `ready`.
  Options (from `src/lib/utils/drag.ts:73-130`): `axis`, `constraints`, `elastic`, `momentum`, `transition`,
  `directionLock`, `listener`, `controls`, `whileDrag`, `mergedTransition`, `callbacks`
  (`onStart/onMove/onEnd/onDirectionLock/onTransitionEnd`), `baselineSources`, `getBaseTransformValues`,
  `getBaseTransform`, `transformTemplate`, `propagation`, `snapToOrigin`, `boundMotionValues`
  (MotionValues bound through `style={{ x, y }}`), `transformPagePoint`.
- The VisualElement: created in `src/lib/utils/motionDomProjection.ts:353-366` (`new HTMLVisualElement(...)`, then
  `new HTMLProjectionNode(...)`, `visualElement.projection = this.projection`). Its props are kept in sync with the
  component's props ("Keep the node's props in sync, then let the animationState diff them", around
  `_MotionContainer.svelte:2230`). Check whether the `drag*` props are included in what is passed to
  `visualElement.update(...)`.
- Features: `src/lib/utils/visualElementCore.ts` registers svelte-motion's ports of upstream features
  (`AnimationFeature`, `ExitAnimationFeature` at around line 173, registered around line 307). A `DragGesture`
  feature would go next to them.
- Reorder: `src/lib/components/Reorder/Item.svelte` uses a motion element with `drag` and `onDrag`. `drag.ts`
  `adjustOrigin` (around lines 905-935) exists for Reorder's layout shifts. Upstream's controller handles layout
  shifts itself via the projection `didUpdate` listener (`VisualElementDragControls.ts` around line 770).
- Layout/drag interplay owned by svelte-motion: `commitDraggedLayoutChange` and `stripToBaseTransforms` in
  `motionDomProjection.ts` (around lines 1001-1027 and 1464-1506), and `isLayoutMeasurementGated`
  (`_MotionContainer.svelte` around line 2396).
- Tests: `e2e/drag/` (26 specs), `e2e/reorder/` (10 specs), about 115 Playwright tests in total, plus
  `src/lib/utils/drag.spec.ts`, `dragInertia.spec.ts`, `dragMath.spec.ts`, `dragParams.spec.ts`, `pan.spec.ts`,
  `src/lib/components/Reorder/*.spec.ts`.

### Upstream (`~/Github/motion` @ `v14.5.0`)

- `packages/motion-dom/src/gestures/drag/VisualElementDragControls.ts` (899 lines). Constructor
  `(visualElement, readProps = () => visualElement.getProps())` (lines 95-108). It reads `drag`,
  `dragConstraints` (a ref object or an Element), `dragElastic`, `dragMomentum`, `dragTransition`,
  `dragSnapToOrigin`, `dragDirectionLock`, `dragPropagation`, `dragListener`, `onDragStart`, `onDrag`,
  `onDragEnd`, `onDirectionLock`, `onDragTransitionEnd` and `onMeasureDragConstraints`, plus
  `_dragX`/`_dragY` (external MotionValues). It touches `visualElement.projection` (`layout`, `measure`, `root`,
  `updateLayout`, `isAnimationBlocked`, `target`), `animationState.setActive("whileDrag", …)`,
  `getTransformPagePoint()`, `getValue`, `latestValues`, `measureViewportBox` and `render`. Public: `start`,
  `stop`, `cancel`, `endPanSession`, `stopAnimation`, `addListeners`, `isDragging`.
- `packages/framer-motion/src/gestures/drag/index.ts`: the `DragGesture` feature (`mount` subscribes
  `dragControls` and calls `controls.addListeners()`; `update` re-subscribes on a `dragControls` change; `unmount`
  removes listeners and ends the pan session unless dragging).
- `packages/framer-motion/src/gestures/drag/use-drag-controls.ts`: `DragControls` keeps a
  `Set<VisualElementDragControls>`, and `start(event, options)` calls `controls.start(...)` on each.
- `packages/framer-motion/src/render/html/use-props.ts:59-73`: drag default styles.
- `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx`: a `drag` element measures layout
  (`alwaysMeasureLayout`).
- motion-dom's index exports `VisualElementDragControls`, `elementDragControls`, `PanSession` and `drag`.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Unit suite | `pnpm test:only` | record pass/fail counts |
| Typecheck | `pnpm check` | record errors |
| One e2e area | `pnpm exec playwright test e2e/drag` / `e2e/reorder` | record pass/fail per spec |
| Full e2e | `pnpm test:e2e` | record |

**Port 4198 rule**: check `lsof -ti :4198 -sTCP:LISTEN` before every Playwright run. If occupied, STOP and ask.
Never kill it. Do not set `PW_REUSE_SERVER` from a worktree.

## Scope

**In scope (spike branch only)**: anything under `src/lib/` needed for the prototype; new acceptance tests under
`e2e/drag/` and `src/routes/tests/drag/`; the report file
`.agents/.plans/motion-14-5-0/006-spike-report.md` (create). The report and the acceptance tests (Step 1) are
the only things that may later be cherry-picked to `feat/motion-14.5.0`.

**Out of scope**: deleting svelte-motion's drag code (the migration plan decides that); docs; changesets; public API
changes; `pan` gesture props (`onPan`, `whilePan`). Record in the report whether `PanSession` could replace
`pan.ts` too, but do not prototype it.

## Git workflow

Create `spike/upstream-drag` from `feat/motion-14.5.0` after plan 001 lands, in its own worktree
(`git worktree add ../svelte-motion-drag-spike -b spike/upstream-drag feat/motion-14.5.0`). Commit freely on the
spike branch with messages starting `spike(drag):` and ending with
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit the report and the Step 1 acceptance tests as
separate commits so they can be cherry-picked. Do not push.

## Steps

### Step 1: Acceptance tests (red on the current drag)

Write e2e specs that encode upstream behavior svelte-motion lacks. Each must FAIL on the current drag. These are the
spike's yardstick and become the migration's red tests.

1. `e2e/drag/window-scroll-hold.spec.ts` + page `src/routes/tests/drag/window-scroll-hold/+page.svelte`: a tall
   page with a `drag="y"` box. Press, move 20 px (past the 3 px threshold), hold still, `window.scrollBy(0, 100)`,
   wait 2 frames. The box must have moved down ~100 px with the page, i.e. stayed under the pointer (within 5 px).
   Port the intent of upstream's `PanSession.test.ts` window cases and `tests/gestures/drag-scroll.spec.ts` (read
   them at `v14.5.0`).
2. `e2e/drag/css-variable-origin.spec.ts` + page `src/routes/tests/drag/css-variable-origin/+page.svelte`: a port of
   upstream `dev/react/src/tests/issue-2390.tsx` / `tests/react/issue-2390.spec.ts` (read at `v14.5.0`). Include
   the `animate` variant (y animated to `var(--slide-to)`) and a `style={{ y }}` bound MotionValue variant
   (`useMotionValue('var(--slide-to)')`, then `'20%'`). A drag start must not jump.
3. `e2e/drag/default-styles.spec.ts`: on any existing drag page (`/tests/drag/basic`), the drag element's computed
   `touch-action` is `none` (`pan-y` for `drag="x"`, `pan-x` for `drag="y"`), `user-select` is `none`, and the
   element has `draggable="false"`.

**Verify**: each new spec FAILS on the current drag (record the assertion output in the report). If one passes,
note it as "already at parity" and drop it from the yardstick.

### Step 2: Prototype behind an internal switch

Add a module-level internal flag, for example `src/lib/utils/dragImpl.ts` exporting
`USE_UPSTREAM_DRAG = import.meta.env.VITE_UPSTREAM_DRAG === '1'`. Do not use a public prop.

When it is on:

- Port upstream's `DragGesture` feature (framer-motion `gestures/drag/index.ts`, about 60 lines) into
  `visualElementCore.ts` as `DragGestureFeature`, constructing `new VisualElementDragControls(node)`. Register it
  the way `ExitAnimationFeature` is registered, gated on the `drag` prop.
- Make sure the VisualElement's props carry what the controller reads (see the upstream list above). Map
  svelte-motion's names: `dragConstraints` (svelte-motion accepts an element, a `{ current }` ref or a bounding box;
  upstream accepts a ref object or an Element), `dragListener`, `onDirectionLock`, `transformPagePoint` (from
  `MotionConfig`, read by `getTransformPagePoint()`), and `_dragX`/`_dragY` for `style`-bound MotionValues.
- `dragControls`: adapt `src/lib/utils/dragControls.ts` so it can `subscribe(controls: VisualElementDragControls)`
  and `start(event, options)` like upstream's `DragControls`, while keeping its current public API.
- Skip `attachDrag` in `_MotionContainer.svelte` when the flag is on.
- Apply upstream's default drag styles (from `use-props.ts:59-73`) when `drag` is set and `dragListener !== false`.
  User `style` wins.
- `layout`: when `drag` is set, set the projection's `alwaysMeasureLayout` (upstream `MeasureLayout`), and check
  whether svelte-motion's `commitDraggedLayoutChange` path now double-handles layout shifts with the controller's
  own `didUpdate` handler. If so, bypass svelte-motion's path under the flag and record that.

Keep it a prototype: no docs, no cleanup of the old code.

**Verify**: `VITE_UPSTREAM_DRAG=1 pnpm check` → record errors (aim for 0). `VITE_UPSTREAM_DRAG=1 pnpm test:only` →
record failures. Old-drag unit tests that test `attachDrag` internals are expected to be irrelevant under the
flag; list them, don't fix them.

### Step 3: Run the suites both ways

For each of `e2e/drag`, `e2e/reorder`, the three Step 1 specs, and then the full `pnpm test:e2e`, run once with
`VITE_UPSTREAM_DRAG=1` and once without. The flag must reach `vite build` inside Playwright's `webServer`. If env
passthrough doesn't work, temporarily hard-code the flag in a spike-only commit and say so in the report.

**Verify**: a per-spec table in the report: spec, old result, upstream result, and for every upstream-only failure a
one-line cause.

### Step 4: Gap inventory

For each `AttachDragOptions` field and each `drag.ts` behavior with its own comment block (non-numeric authored
transforms via `getBaseTransform`/`calc()`, `boundMotionValues`, `snapToOrigin`, constraint ResizeObserver,
`adjustOrigin`, accelerated-value freeze on `stop()`, `transformTemplate` composition), classify it as:
**covered by upstream**, **svelte-motion-only and needed** (cite the e2e spec or changeset that pins it, e.g.
`.changeset/drag-origin-resize.md`, `live-drag-constraint-observer.md`, `snap-to-cursor-live-box.md`,
`pan-final-move.md`), or **svelte-motion-only, droppable** (the behavior upstream deliberately doesn't have).

### Step 5: Report and recommendation

Write `.agents/.plans/motion-14-5-0/006-spike-report.md` with these sections: Summary (GO / GO-WITH-CONDITIONS / NO-GO
and why); Results table (Step 3); Gap inventory (Step 4); Bugs found in svelte-motion's drag along the way;
Estimated migration size (files deleted/changed, tests to retire/port); Proposed migration plan outline (steps,
red tests = Step 1 specs, risks); whether `pan.ts` should follow via `PanSession`; Unknowns.

**Verify**: the report exists and every section is filled in; `git log spike/upstream-drag --oneline` shows the
report and acceptance-test commits separately.

## Test plan

The Step 1 specs are the red anchors: they fail on the current drag. The spike succeeds as an experiment whether or
not they go green under the flag. What it must produce is a trustworthy comparison.

## Done criteria

- [ ] Three acceptance specs exist, each recorded as failing on the current drag (or dropped as already at parity)
- [ ] Prototype on `spike/upstream-drag` behind an internal flag; `feat/motion-14.5.0` untouched
- [ ] Both-ways results table for `e2e/drag`, `e2e/reorder` and the full suite
- [ ] `006-spike-report.md` written with a GO / GO-WITH-CONDITIONS / NO-GO recommendation
- [ ] README row updated (status DONE with the recommendation in one line)

## STOP conditions

- Port 4198 is occupied.
- `VisualElementDragControls` or `PanSession` is not exported from motion-dom 14.5.0 (check
  `node_modules/motion-dom/dist/index.d.ts`).
- The time box runs out: stop and write the report with what you have, marking unfinished sections.
- The prototype needs changes to motion-dom itself (patching `node_modules`): record it as a NO-GO reason and stop
  prototyping that part.

## Maintenance notes

- If the recommendation is GO, the advisor writes the migration plan from the report. It should delete `drag.ts`,
  `pan.ts` (if covered), `dragInertia.ts` and `dragMath.ts`, keep `Reorder/autoScroll.ts` (framer-motion-side
  code), and turn the Step 1 specs into its red tests.
- Plan 008 (vanilla `drag()`) re-exports the same controller. After a GO migration, motion elements and `drag()`
  share one implementation, and 008's guard against double attachment stays relevant.
