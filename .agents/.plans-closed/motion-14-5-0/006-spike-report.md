# Spike 006 report: driving `drag` with motion-dom's `VisualElementDragControls`

Branch `spike/upstream-drag` (worktree `../svelte-motion-drag-spike`), off `feat/motion-14.5.0` at `737dba70`
(motion / motion-dom 14.5.0). Executed 2026-10-21. Every Playwright run used `PW_PORT=4204` and no
`PW_REUSE_SERVER`. Raw JSON reports were kept under `/tmp/spike006/` (not committed).

## Summary: GO-WITH-CONDITIONS

The upstream controller runs under svelte-motion with **no changes to motion-dom**. It took a ~245-line prototype
(5 files, all behind `VITE_UPSTREAM_DRAG=1`). With the flag on:

- All 7 Step 1 acceptance tests pass. The legacy drag fails 6 of them: window-scroll compensation, a
  CSS-variable or `%` drag origin, and the default drag styles.
- Full e2e suite: **623 pass / 8 fail / 2 skip**. The legacy run gets **625 / 6 / 2**, and its 6 failures are
  exactly the red acceptance tests. Every upstream-only failure is in `e2e/drag/`. There are **no regressions
  outside drag**: Reorder, layout, presence, gestures, variants and the rest are all green, including all 21
  Reorder tests.
- Unit suite: 1 failure (`reorder.component.spec.ts` asserts that svelte-motion's own
  `commitDraggedLayoutChange` runs; the controller's `didUpdate` handler replaces that path).
- `pnpm check`: 0 errors.

The 8 remaining failures come down to **five behavior differences**. None is a crash or a broken interaction:

1. **Default `touch-action` overrides a stylesheet value** (2 tests, `axis-handoff`). This is upstream parity
   and an intended change. The fixture's class CSS sets `touch-action: none`, and upstream's inline `pan-y` for
   `drag="x"` wins over it. Fix the fixture, not the code.
2. **Drag that starts outside the constraints** (1 test, `settle-cancel`). svelte-motion's
   `applyDragOriginConstraints` stretches from the caught origin. Upstream applies constraints from the boundary,
   so the box jumps back toward the edge on re-grab. The hook (`updateAxis`) is private, so this cannot be shimmed
   without patching or subclassing the controller.
3. **`pointercancel` flings** (1 test, `pointer-cancel`). Upstream `PanSession.handlePointerUp` treats
   `pointercancel` like `pointerup` and keeps the momentum. svelte-motion deliberately forces a settle with no
   momentum.
4. **Constraint-element replacement** (2 tests, `element-ref-resize`). Upstream starts its ResizeObservers once,
   on the first constraint element (`if (!stopResizeObservers)`), so after swapping `dragConstraints` to element
   B, resizing B is never observed. The `live-drag-constraint-observer` changeset pins svelte-motion's
   behavior here.
5. **Remapping on constraint resize** (1 test, `transform-page-point` "resized ref bounds"). Upstream's
   `scalePositionWithinConstraints` remaps the dragged offset by progress, and lands 60-120 px from where
   svelte-motion keeps it (`drag-origin-resize` changeset). The test fails at a slightly different assertion from
   run to run. Its cause is not fully pinned down (see Unknowns).

There is also one **timing difference**: `controls.spec` "snapToCursor does not creep". Upstream sets the
MotionValue in `onSessionStart` and paints on the next frame, whereas legacy paints synchronously. The spec
reads the box immediately after `pointerdown`, so it failed in 5 of 6 upstream runs and passed once, when re-run alone. The end
positions never creep.

**Conditions for GO:**

- **(a)** The maintainer decides whether items 2, 3 and 5 are svelte-motion features worth keeping. Keeping item 2
  requires owning a controller fork or an upstream PR. Items 3 and 5 can be dropped for parity, or proposed
  upstream.
- **(b)** Item 4 needs an upstream fix, which is cheap: re-observe when the constraint element changes. Until
  then, it needs a small svelte-side workaround, or the behavior is dropped.
- **(c)** The fixtures and specs coupled to legacy internals get rewritten. That is the
  `data-svelte-motion-drag-active` marker, the `svelte-motion:drag-start` event, synchronous snap paint, and the
  fixture `touch-action`. The prototype shims the marker and the event so the comparison measures behavior, not
  plumbing.
- **(d)** The `dragControls.stop()/cancel()` "stop the glide" extension is kept as the 10-line shim the
  prototype uses, or dropped.

## Step 1: acceptance tests (red on the current drag)

Committed separately in `4891c506` so it can be cherry-picked. It contains the pages `src/routes/tests/drag/window-scroll-hold/`
and `src/routes/tests/drag/css-variable-origin/`, plus the specs `e2e/drag/window-scroll-hold.spec.ts`,
`css-variable-origin.spec.ts` and `default-styles.spec.ts`. The pages are not linked from `src/routes/+page.svelte`,
because that is outside the plan's in-scope paths. Link them when cherry-picking.

| Spec / test | Legacy result (assertion output) | Upstream |
| --- | --- | --- |
| `window-scroll-hold` | FAIL: `Math.abs(afterScroll - grabbed)` expected <= 5, **received 100**. The box scrolls away from the held pointer | PASS |
| `css-variable-origin` animate → `var(--slide-to)` | **PASS, already at parity.** Kept as a regression guard and **dropped from the red yardstick** | PASS |
| `css-variable-origin` `useMotionValue('var(--slide-to)')` | FAIL: midDrag expected ~130, **received 50**. `parseFloat('var(…)')` is NaN, so the origin becomes 0 | PASS |
| `css-variable-origin` `useMotionValue('20%')` | FAIL: expected ~130, **received 70**. `20%` is read as 20 px | PASS |
| `default-styles` `/tests/drag/basic` | FAIL: touch-action expected `none`, **received `auto`** | PASS |
| `default-styles` `/tests/drag/axis-x` | FAIL: expected `pan-y`, **received `auto`** | PASS |
| `default-styles` `/tests/drag/axis-y` | FAIL: expected `pan-x`, **received `auto`** | PASS |

## Step 2: the prototype

Commits `3918cc16` and `927c9bdf`; the diff against `737dba70` is about 245 lines in `src/lib`.

- `src/lib/utils/dragImpl.ts`: `USE_UPSTREAM_DRAG = import.meta.env.VITE_UPSTREAM_DRAG === '1'`.
- `src/lib/utils/visualElementCore.ts`: `DragGestureFeature`, a port of framer-motion `gestures/drag/index.ts`. It is
  registered as the `drag` feature only under the flag, and is enabled by `drag || dragControls`.
  - Svelte deviation: the feature can be instantiated by the props-sync pass before the VisualElement has an
    instance, so `addListeners()` is retried in `update()`.
  - Svelte deviation: when `dragConstraints` changes, the feature re-fires the projection `'measure'` event.
    React gets this from MeasureLayout's per-commit measure. Without it, a constraint ref bound after mount is
    never measured or observed.
  - Shim: `readProps` wraps `onDragStart` and `cancel` to mirror the legacy `data-svelte-motion-drag-active`
    marker and the `svelte-motion:drag-start` event.
- `src/lib/html/_MotionContainer.svelte`:
  - Under the flag, and gated on the LazyMotion drag bundle, it forwards these props to the VisualElement:
    `drag`, `dragConstraints`, `dragElastic`, `dragMomentum`, `dragTransition`, `dragDirectionLock`,
    `dragPropagation`, `dragSnapToOrigin`, `dragListener`, `dragControls`, `onDirectionLock` and
    `onDragTransitionEnd`. `whileDrag`, `onDragStart/onDrag/onDragEnd` and `transformPagePoint` were already
    forwarded.
  - It skips both `attachDrag` effects.
  - It prepends upstream's default styles to the inline style string, so the user's `style` wins, and adds
    `draggable="false"` unless the user set it. It only does this when `drag && dragListener !== false`.
  - It sets `alwaysMeasureLayout` on the projection, following upstream `use-visual-element.ts`.
  - The active-drag commit check reads `elementDragControls.get(ve).isDragging`.
- `src/lib/utils/motionDomProjection.ts`: passes `alwaysMeasureLayout` through to `projection.setOptions`.
- `src/lib/utils/dragControls.ts`: `_subscribeControls(VisualElementDragControls)` plus a `Set` fan-out for
  `start/stop/cancel`, as in upstream `DragControls`. The public `subscribe(el)` signature is unchanged.
  `stop()/cancel()` also call `stopAnimation()` when no drag is live; this is the svelte-motion contract.
- `_dragX`/`_dragY` were **not needed**. A `style={{ y }}` MotionValue is already bound as the VisualElement's
  `y` value, so `getAxisMotionValue` returns it, the same way it works in React.
- **`commitDraggedLayoutChange` double-handling:** no double-handling, because that path is gated on the
  legacy marker plus `teardownDrag` (null under the flag). It is bypassed automatically, and the controller's
  `didUpdate` handler shifts the origin instead. The Reorder suite is 21/21 under the flag.
- The flag passthrough was confirmed with a spike-only page and spec (`/tests/drag/impl-flag`,
  `e2e/drag/impl-flag.spec.ts`). The spec asserts the page reports `upstream` iff `VITE_UPSTREAM_DRAG=1`, and it
  passed in every run in both modes. `VITE_UPSTREAM_DRAG=1 PW_PORT=4204 pnpm exec playwright test …` reaches
  `vite build` inside the webServer, so no hard-coding was needed.

**Verify results:**

- `VITE_UPSTREAM_DRAG=1 pnpm check`: **0 errors**, 33 warnings, none in the changed lines (I did not separately
  count the flag-off baseline warnings).
- `VITE_UPSTREAM_DRAG=1 pnpm test:only`: **1182 pass / 1 fail**. The failure is `Reorder/reorder.component.spec.ts`
  › "rebases an active drag when a keyed reorder moves its layout slot", which expects `commitDraggedLayoutChange`
  to be called 1 time and gets 0.
- Flag off: 1183 / 1183.
- Unit tests that are irrelevant under the flag because they test `attachDrag`/`attachPan` internals directly:
  - `src/lib/utils/drag.spec.ts` (1617 lines)
  - `dragInertia.spec.ts` (135)
  - `dragMath.spec.ts` (33)
  - `dragParams.spec.ts` (37)
  - `pan.spec.ts` (334): stays relevant while the pan gesture uses `pan.ts`
  - the `commitDraggedLayoutChange` case in `reorder.component.spec.ts`

  They still pass under the flag only because they call those functions directly.

## Step 3: results table

Final runs, on commit `927c9bdf`:

- **Full suite, both ways** (633 tests, about 18 min each): legacy **625 pass / 6 fail / 2 skip**, upstream
  **623 / 8 / 2**.
- **Coverage note:** I ran the full suite both ways, so the "full suite only with the flag on" time-box fallback
  was not needed. Outside `e2e/drag/` and `e2e/reorder/`, both modes are identical: everything passes except the
  2 pre-existing skips.
- **Earlier pre-shim upstream run** (`3918cc16`, with no marker/event/controls shims or constraint re-measure):
  `e2e/drag` + `e2e/reorder` had 15 upstream-only failures, and all 15 reproduced when the 9 spec files were
  re-run on their own. Six of them were caused by test coupling to the legacy marker and drag-start event, or
  by the constraint-ref measure gap. They are listed in the second table.
- **Re-run rule:** every upstream-only failure below was re-run by itself (its spec file without the rest of the
  suite) at least once, and failed again, except where noted.

| Spec | Legacy | Upstream |
| --- | --- | --- |
| `drag/axis-handoff.spec.ts` | 4/4 pass | 2/4 pass |
| `drag/axis-x.spec.ts` | 3/3 pass | 3/3 pass |
| `drag/axis-y.spec.ts` | 2/2 pass | 2/2 pass |
| `drag/basic.spec.ts` | 3/3 pass | 3/3 pass |
| `drag/brutalist-stage.spec.ts` | 7/7 pass | 7/7 pass |
| `drag/constraints-ref.spec.ts` | 1/1 pass | 1/1 pass |
| `drag/controls-cancel-inertia.spec.ts` | 1/1 pass | 1/1 pass (needs the controls shim) |
| `drag/controls.spec.ts` | 3/3 pass | 2/3 pass (snapToCursor timing, flaky) |
| `drag/css-variable-origin.spec.ts` (Step 1) | 1/3 pass | 3/3 pass |
| `drag/default-styles.spec.ts` (Step 1) | 0/3 pass | 3/3 pass |
| `drag/elastic.spec.ts` | 8/8 pass | 8/8 pass |
| `drag/element-ref-resize.spec.ts` | 14/14 pass | 12/14 pass |
| `drag/hover-during-glide.spec.ts` | 2/2 pass | 2/2 pass |
| `drag/impl-flag.spec.ts` (spike-only) | 1/1 pass | 1/1 pass |
| `drag/lock-direction.spec.ts` | 1/1 pass | 1/1 pass |
| `drag/mobile-drawer.spec.ts` | 4/4 pass | 4/4 pass |
| `drag/momentum.spec.ts` | 1/1 pass | 1/1 pass |
| `drag/motion-dev-constraints.spec.ts` | 5/5 pass | 5/5 pass |
| `drag/pointer-cancel.spec.ts` | 1/1 pass | 0/1 pass |
| `drag/release-before-frame.spec.ts` | 2/2 pass | 2/2 pass |
| `drag/settle-cancel.spec.ts` | 5/5 pass | 4/5 pass |
| `drag/single-frame.spec.ts` | 1 skip | 1 skip |
| `drag/snap-to-origin.spec.ts` | 5/5 pass | 5/5 pass |
| `drag/stale-velocity.spec.ts` | 1/1 pass | 1/1 pass |
| `drag/subpixel-constraints.spec.ts` | 1/1 pass | 1/1 pass |
| `drag/transform-page-point.spec.ts` | 11/11 pass | 10/11 pass |
| `drag/while-drag-restore.spec.ts` | 1/1 pass | 1/1 pass |
| `drag/while-drag-transforms.spec.ts` | 7/7 pass | 7/7 pass |
| `drag/while-drag-write-coalescing.spec.ts` | 1/1 pass | 1/1 pass |
| `drag/window-scroll-hold.spec.ts` (Step 1) | 0/1 pass | 1/1 pass |
| `reorder/*` (10 specs, 21 tests) | 21/21 pass | 21/21 pass |
| **Full suite (633 tests)** | **625 / 6 fail / 2 skip** | **623 / 8 fail / 2 skip** |

One-line causes of the upstream-only failures, on the final code:

| Test | Cause |
| --- | --- |
| `axis-handoff` › pointer wins over a foreign x animation | Fixture asserts its class CSS `touch-action: none`. Upstream's inline default `pan-y` (drag="x") overrides it. Intended parity change; update the fixture. |
| `axis-handoff` › foreign retarget mid-glide | Same fixture assertion as above. |
| `controls` › snapToCursor does not creep | Timing, not creep. Upstream paints the snap on the next frame; the spec reads the box synchronously after pointerdown. End positions are identical across drags. Failed 5 of 6 upstream runs and passed once, alone. |
| `element-ref-resize` › replacement-only resize follows B | Upstream observes only the FIRST constraint element (`startResizeObservers` guarded by `if (!stopResizeObservers)`), so resizing replacement B is never seen (off by 38 px). |
| `element-ref-resize` › resizing the active ref constrains a stationary held pointer | Same: the card was switched to B and B's resize is not observed (off by 118 px). |
| `pointer-cancel` › clamps without fling | Upstream `PanSession` treats `pointercancel` as pointerup with the last move info and keeps the momentum, so the card flings to 114-116 px against an assertion of <= 101. svelte-motion's no-fling is its own choice. |
| `settle-cancel` › slow settle follows rightward movement after re-grab | Upstream `updateAxis` applies constraints from the boundary when the origin is beyond it, so the re-grabbed card jumps ~35 px back toward the edge. svelte-motion's `applyDragOriginConstraints` stretches from the caught origin. |
| `transform-page-point` › numeric, ref, and resized ref bounds | After the board resize, upstream `scalePositionWithinConstraints` remaps the resting dragged offset (x 366 vs 246, or the target centre 590 vs 530 depending on the run). svelte-motion preserves it (`drag-origin-resize`). The exact cause under a scaled parent is unconfirmed. |

Pre-shim failures that the shims resolved:

| Test | Cause | Resolved by |
| --- | --- | --- |
| `controls-cancel-inertia` › stop() freezes the card mid-release spring-back | Upstream `stop()` returns early when no drag is live (`if (!isDragging …) return`) and never stops the glide | `dragControls` shim (`stopAnimation()` when no drag is live) |
| `controls` › tiny right nudge does NOT teleport | Waited on the legacy marker and the `svelte-motion:drag-start` event | marker/event shim |
| `element-ref-resize` › switching to smaller B while pressed | Waited on the legacy marker | marker shim |
| `element-ref-resize` › delayed ref replacement | Waited on the legacy marker | marker shim |
| `reorder/basic` › held item pinned during upward swaps | The sampler only records while `dataset.svelteMotionDragActive === 'true'` | marker shim |
| `reorder/grid` › FLIPs displaced siblings | Failed (sibling translation 0) before the shims | Passed after. Not individually attributed: the marker and the constraint re-measure changed together. |
| `transform-page-point` › scrolled controls snap | x 60 vs 0 before the shims | Passed after; same attribution caveat as above |

## Step 4: gap inventory

Classification key:

- **covered**: the upstream controller does it.
- **svm-only, needed**: svelte-motion-only behavior pinned by a spec or changeset.
- **svm-only, droppable**: behavior upstream deliberately lacks.

### `AttachDragOptions` fields

| Field | Classification | Notes |
| --- | --- | --- |
| `axis` | covered | `drag` |
| `constraints` | covered | Upstream accepts a box, an `Element` or a `{ current }` ref, the same set as svelte-motion. The legacy null-ref deferral is unnecessary: refs resolve at drag start, plus the prototype's measure re-fire. |
| `elastic`, `momentum`, `transition`, `directionLock`, `propagation`, `snapToOrigin` | covered | `snap-to-origin`, `elastic`, `momentum` and `lock-direction` are all green. |
| `listener` | covered | `dragListener` |
| `controls` | covered | Through the `_subscribeControls` adapter. The legacy "stop/cancel stop the glide" behavior is **svm-only, needed** (`controls-cancel-inertia` spec), kept as a 10-line shim. |
| `whileDrag`, `mergedTransition` | covered | `animationState.setActive('whileDrag')`; the `while-drag-*` specs are green. |
| `callbacks` (`onStart/onMove/onEnd/onDirectionLock/onTransitionEnd`) | covered | Upstream fires `onDragStart`/`onDrag` on `frame.update` and `onDragEnd` on `postRender`. |
| `baselineSources`, `getBaseTransformValues` | covered | `latestValues` is already the single source; the controller reads `getValue(axis, latestValues[axis])`. |
| `getBaseTransform` (authored non-numeric / `calc()` transform) | covered as far as tested | `brutalist-stage`, `while-drag-transforms` and `axis-handoff` (apart from the fixture style) are green. No spec targets a raw `calc()` authored transform under drag; see Unknowns. |
| `transformTemplate` | covered | The VisualElement composes it (`buildHTMLStyles`). |
| `transformPagePoint` | covered | `getTransformPagePoint()` reads props; 10/11 of `transform-page-point` pass. |
| `boundMotionValues` | covered | A `style`-bound MotionValue IS the VisualElement's axis value, so no `_dragX` is needed. The Step 1 `mv-var`/`mv-percent` cases now pass. |

### `drag.ts` behaviors

| Behavior | Classification | Notes |
| --- | --- | --- |
| Window/ancestor scroll compensation (`pan.ts` `handleScroll`) | covered, and legacy is buggy | Step 1 red test, green upstream. |
| `var()` / `%` origin | covered, and legacy is buggy | Step 1 red tests, green upstream. |
| Default drag styles | covered, legacy lacks them | Step 1 red test, green upstream. |
| `adjustOrigin` for Reorder layout shifts | covered | Projection `didUpdate` listener; Reorder 21/21. |
| Accelerated-value freeze on `stop()` | covered | `stopAnimation()` calls `value.stop()` per axis, the same motion-dom freeze. `axis-handoff`'s handoff assertions pass; only its fixture-style assertion fails. |
| Constraint ResizeObserver, same element resized | covered | `container shrink/grow mid-inertia` and the asymmetric-card tests pass. |
| Constraint ResizeObserver following a **replaced** constraint element | **svm-only, needed** | `.changeset/live-drag-constraint-observer.md`; `element-ref-resize` (2 tests). Upstream gap. |
| Resting-origin preservation on constraint resize | **svm-only, needed or an upstream divergence (unclear)** | `.changeset/drag-origin-resize.md`; `transform-page-point` "resized ref bounds". Upstream skips axes resting at exactly 0 but remaps every other offset by progress. |
| Drag starting outside bounds stretches from the caught origin (`applyDragOriginConstraints`) | **svm-only; maintainer call, droppable for parity** | `settle-cancel` (1 test). Not shimmable: `updateAxis` is private. |
| `pointercancel` settles without fling | **svm-only, droppable** | `pointer-cancel` spec. Upstream deliberately reuses the last move info and keeps the velocity. |
| `snapToCursor` live box + `transformPagePoint` | covered | `.changeset/snap-to-cursor-live-box.md` behavior is upstream's own (`snapToCursor` measures the live box). Only paint timing differs. |
| Final pointermove applied in the same frame as pointerup | covered | `.changeset/pan-final-move.md`; `PanSession.handlePointerUp` flushes `hasPendingMove`. `release-before-frame` is green. |
| `setPointerCapture` on drag start | svm-only, droppable | Upstream uses window listeners; no spec depends on it. |
| `data-svelte-motion-drag-active` marker / `svelte-motion:drag-start` event | svm-only, droppable after test rewrites | Internal plumbing used by the container's dragged-layout path (retired) and by specs. Shimmed in the prototype only. |
| Drag attaches only once `isLoaded === 'ready'` | svm-only, droppable | Upstream attaches at mount; no regression observed. |
| `onDragTransitionEnd` skipped on interruption | covered | Same as upstream; the legacy code documents matching it. |

## Bugs found in svelte-motion's drag along the way

1. **Window scroll during a held drag is not compensated.** Confirmed: the box drifts 100 px for a 100 px scroll
   (`window-scroll-hold`).
2. **A bound `var(--y)` or `%` drag origin jumps.** Confirmed: `var(…)` is read as 0 and `20%` as 20 px
   (`css-variable-origin`).
3. **No default drag styles.** Confirmed: `touch-action: auto`, with no `user-select` and no `draggable=false`.
   Several fixtures (for example `axis-handoff`) hand-author `touch-action: none` / `user-select: none` to work
   around it.
4. **New: legacy `dragControls.stop()` / `cancel()` do nothing to a LIVE drag.** Both only call
   `stopInertia` (`drag.ts` `_bind(..., () => stopInertia?.())`). Upstream `stop()` ends the drag with momentum
   and `cancel()` ends it without.
5. **New: legacy `createDragControls()` drives only the last subscribed element.** It has a single `target`,
   where upstream fans out to a `Set`. The `distanceThreshold` option in `DragControls.start`'s public type is
   silently ignored, because the legacy starter only takes `snap`.

## Estimated migration size

**Delete:**

- `src/lib/utils/drag.ts` (1722 lines), `dragInertia.ts` (166), `dragMath.ts` (84) and `dragParams.ts` (54),
  about 2.0k lines in total.
- `pan.ts` (573) if the pan gesture follows; see below.

**Change:**

- `_MotionContainer.svelte`: remove `resolveDragOptions`, the two drag effects, `commitDraggedLayoutChange`
  wiring and the `teardownDrag` references (17 references), and keep the prop forwarding and default styles
  from the prototype.
- `motionDomProjection.ts`: `commitDraggedLayoutChange` (about 60 lines) and probably `stripToBaseTransforms`'
  drag-specific use.
- `visualElementCore.ts`: the feature, about 120 lines with docs.
- `dragControls.ts`: rewrite to upstream's `DragControls` class, about 60 lines.
- `types.ts`: `DragControls.subscribe` gains or replaces its signature, which is a minor public type change.

**Tests to retire:** `drag.spec.ts` (1617), `dragInertia.spec.ts` (135), `dragMath.spec.ts` (33),
`dragParams.spec.ts` (37), and the `commitDraggedLayoutChange` case in `reorder.component.spec.ts`.
`pan.spec.ts` (334) goes too if pan follows.

**Tests to port or adjust:**

- `axis-handoff` fixture style assertion.
- `controls.spec` snap read: wait one frame.
- The specs that wait on `data-svelte-motion-drag-active` / `svelte-motion:drag-start`, which need a public
  signal or `onDragStart`: `controls`, `element-ref-resize` and `reorder/basic`.
- Plus the outcome of the decisions on `settle-cancel`, `pointer-cancel`, `element-ref-resize` (x2) and
  `transform-page-point`.

**Add:** a unit spec for the feature and `DragControls`. The Step 1 specs are already written.

**Net:** about -2.5k lines of library code and about -1.8k lines of unit tests, for about +250 lines.

## Proposed migration plan outline

1. **Red tests.** Cherry-pick `4891c506` (Step 1 specs) onto the migration branch; 6 tests are red on the
   legacy drag. Link the two new pages from `src/routes/+page.svelte`.
2. **Decide on the svelte-motion-only behaviors** (maintainer):
   - `applyDragOriginConstraints`: drop it, or upstream a PR.
   - `pointercancel` no-fling: drop it.
   - Constraint-element replacement: upstream a fix, and add a temporary feature-level workaround if needed.
     The feature can tear down and re-run `addListeners()` when `dragConstraints` changes identity while no
     drag is live; while one is live, keep a small observer in the feature.
   - Resting-origin preservation on resize: investigate first (see Unknowns).
   - Controls stop/cancel glide: keep the shim.
3. **Land the feature** (`DragGestureFeature`, prop forwarding, default styles, `alwaysMeasureLayout`, a
   `DragControls` class) unconditionally, without the flag.
4. **Delete** `attachDrag`/`drag.ts`/`dragInertia`/`dragMath`/`dragParams` and the container's
   `commitDraggedLayoutChange` path.
5. **Rewrite the coupled e2e specs** to observe public behavior. Replace the marker with `onDragStart`/`onDragEnd`
   state on the fixture pages.
6. **Run the full gate** (`pnpm build`, `pnpm check`, `pnpm test:only`, a full e2e run), then the maintainer
   drives the live demos (drag sign-off page, Reorder, mobile drawer) on touch hardware too. Default
   `touch-action` changes how touch devices behave.

**Risks:**

- **Touch scrolling changes.** That is the point, but it is user-visible: page scroll no longer starts on a drag
  element along its dragged axis.
- **Inline default styles override class CSS** for `touch-action` / `user-select`.
- **Paint timing:** upstream paints on the next frame, not synchronously.
- **LazyMotion:** `domAnimation` users without the drag bundle must still get no drag. The prototype gates the
  props on `hasDragFeatures`.
- **Plan 008** (vanilla `drag()`) shares this controller. Its double-attach guard must check
  `elementDragControls` rather than `drag.ts` state.

## Should `pan.ts` follow via `PanSession`?

**Yes, as a separate follow-up step.**

- **Redundant under drag.** `drag.ts` is `pan.ts`'s only consumer apart from the pan gesture wiring in
  `_MotionContainer.svelte`. Under the flag, `pan.ts` is already unused for drag, since the controller brings
  its own `PanSession`.
- **Covers the pan gesture.** motion-dom 14.5.0 exports `PanSession`, with `onSessionStart/onStart/onMove/onEnd/
  onSessionEnd`, `transformPagePoint`, `contextWindow`, `distanceThreshold`, `element`-based scroll
  compensation and `updateHandlers()`. That covers what `pan.ts` provides, including the handler hot-swap the
  container's swap effect uses.
- **Small port.** Upstream `PanGesture` (framer-motion `gestures/pan/index.ts`) is about 60 lines and does the
  same `frame.update` / `frame.postRender` handler scheduling that `pan.ts` hand-rolls.
- **Not prototyped**, per scope. A port would delete `pan.ts` (573 lines) and `pan.spec.ts` (334 lines).
- **Verification still needed:** the `e2e/pan*` / gesture specs. I did not inventory whether `pan.ts` has
  behaviors (for example the stale-origin velocity tweak) that differ from `PanSession`.

## Unknowns

- **Cause of the `transform-page-point` "resized ref bounds" failure.** The upstream remap differs by a varying
  amount (366 vs 246, or 590 vs 530), so it fails at a different assertion from run to run. It could be upstream
  `scalePositionWithinConstraints` semantics or an integration issue (scaled parent plus
  `projection.updateLayout()`); not investigated within the time box.
- **Touch input.** The touch behavior that default `touch-action` enables was not exercised. All runs used
  desktop Chromium with the mouse.
- **Raw `calc()` / `%` authored `transform` strings** on a dragged element (the `getBaseTransform` path) have
  no dedicated spec, so "covered" means "no regression observed".
- **Performance.** Upstream calls `visualElement.render()` per move, as legacy did. Not measured.
- **Load.** Another lane was running Playwright on this machine. Upstream-only failures were re-run alone and
  reproduced (except the snapToCursor timing test, which is flaky under both load and isolation).
