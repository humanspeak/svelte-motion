# Plan 003: Run the pan gesture on motion-dom's `PanSession` (port of upstream `PanGesture`); remove `whilePan`

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> When done, update this plan's row in `.agents/.plans/upstream-drag/README.md`, unless a reviewer dispatched you and
> told you they maintain the index.
>
> **Never use `git stash`.** Prefix every Playwright command with this lane's `PW_PORT`. Never touch port 4198.
>
> **Drift check (run first)**: plan 002 committed (`ls src/lib/utils/drag.ts` → no such file). `pan.ts` must have
> no importer other than `_MotionContainer.svelte`: `grep -rln "utils/pan'" src/lib | grep -v spec` → only
> `src/lib/html/_MotionContainer.svelte`. Otherwise STOP.

> **Revision (2026-10-22, guard, after plan 002)**: also fix the stale index label at `src/routes/+page.svelte`
> ~line 745: "Drag: vanilla drag() on plain elements (+ motion.* guard)" → "(+ motion.* moves once)". Plan 002
> removed the vanilla `drag()` guard (Motion's `drag` is now re-exported unwrapped). This plan already edits that file.

> **Revision 2 (2026-10-22, guard, after the executor's Step 1 STOP)**: two of this plan's premises were wrong and
> are corrected here.
>
> 1. **There is no pan window-scroll bug.** Upstream `PanGesture` never passes an `element` to `PanSession`
>    (`packages/framer-motion/src/gestures/pan/index.ts:24-33` @ v14.5.0), so pan has no scroll listeners. Ours
>    never sets `trackScrollFrom` either, and both build `info.point` from `pageX`/`pageY`. The "thrown away"
>    adjustment exists in upstream too (`PanSession.ts:228-257`); it only matters for drag, which plan 001 already
>    moved to upstream.
>    - Step 1's page and spec stay as a **characterization pin**: they must pass both before and after the refactor.
>      They are not a red test, and the test commit becomes `test(pan): pin page-coordinate points across window
>      scroll`.
>    - Drop "Red window-scroll pan spec now passes" from Done criteria. Drop "fixes the window-scroll bug" from the
>      changeset text.
>    - The migration is still worth doing: it deletes ~900 lines of hand-ported code and adopts upstream's handler
>      scheduling and `updateHandlers`.
> 2. **Drag and pan co-attach, as upstream does.** Upstream enables `pan` from `onPan`/`onPanStart`/
>    `onPanSessionStart`/`onPanEnd` regardless of `drag` (`packages/framer-motion/src/motion/features/definitions.ts:21`
>    @ v14.5.0), so `<motion.div drag onPan>` runs both gestures. Under "Always update upstream", Step 3 enables
>    `PanGestureFeature` per upstream's definition and does not skip it when `drag` is set.
>    - Add an e2e case (on the Step 1 page or an existing pan page) showing that a `motion.div` with `drag` and
>      `onPan` moves and also fires `onPan`.
>    - Mention the co-attach in the changeset.
>    - The STOP condition "drag must not co-attach pan" is replaced by "a drag spec regresses". Any drag/reorder
>      spec that breaks because pan now co-attaches is a STOP to report, not something to patch around.
>
> **Revision 3 (2026-10-22, guard, after the Step 4 gate)**: three additions before close-out.
>
> - **Flake fix in `e2e/drag/element-ref-resize.spec.ts:136`.** Plan 001 rewrote this test, and it fails about 4 in
>   10 runs at HEAD, always with the same 31.38 px miss. Cause: `held` is captured as soon as
>   `card.x - start.x > 190`, while the card is still catching up to the pointer, so `progress` is computed from a
>   moving position. Fix it as a wait only:
>   - before reading `held`, poll until the card's x is stable across two reads one rAF apart (or within 0.5 px of
>     the pointer-implied offset);
>   - keep every assertion and tolerance unchanged.
>   **Superseded by the executor's frame trace (Revision 3a):** `held` is stable. The progress remap from
>   `scalePositionWithinConstraints` lasts one frame, then `PanSession`'s keep-alive `updatePoint`
>   (`PanSession.ts:243,297`, `render-step.ts:46-50` @ v14.5.0) re-applies the held pointer and clamps it to the new
>   bounds (`VisualElementDragControls.ts:338-356`). Change the assertion so it targets upstream's steady state: card
>   at the new right edge, `expectedX = bounds.x + bounds.width - start.width`. Keep the 0.5 px tolerance. Update the
>   test's comment to cite this, and keep the remaining steps.
> - **Delete the orphaned `src/lib/utils/baseTarget.ts` and its spec.** `whilePan` was the last caller. Update the
>   comments that point at it (`_MotionContainer.svelte:~318`, `_MotionContainer.spec.ts:~651`) if they name the
>   file rather than upstream's `baseTarget`.
> - **Unit tests for the new functions** in `src/lib/utils/visualElementCore.spec.ts`, matching the existing
>   `DragGestureFeature` cases:
>   - `isPanFeatureEnabled` for each `onPan*` prop, with and without `drag`;
>   - `PanGestureFeature`: mount attaches the listener (and retries in `update()`), `update()` calls
>     `session.updateHandlers`, and unmount ends the session;
>   - `getContextWindow`.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (every `onPan*` user; `whilePan` users lose the prop)
- **Depends on**: 002
- **Category**: migration (upstream parity)
- **Planned at**: commit `20ca271c` (+ plans 001-002), 2026-10-21. Revised 2026-10-22: `whilePan` removal decided.

## Why this matters

After plan 002, `src/lib/utils/pan.ts` (573 lines + a 334-line spec) is svelte-motion's own pointer-session code,
used only by the pan gesture (`onPanSessionStart`, `onPanStart`, `onPan`, `onPanEnd`, `whilePan`). It carries the
window-scroll bug the drag spike found: `handleScroll`'s window adjustment is thrown away by `updatePoint`.
motion-dom 14.5.0 exports `PanSession`, the class upstream's own pan and drag gestures use. Upstream's `PanGesture`
feature is about 60 lines. Following the maintainer's rule "Always update upstream", the pan gesture moves onto it.

## Decision (settled 2026-10-22): remove `whilePan`

`whilePan` is **not an upstream prop** and never was. `git -C ~/Github/motion log --all -S whilePan` finds nothing, and
motion-dom's `variantPriorityOrder` is `animate, whileInView, whileFocus, whileHover, whileTap, whileDrag, exit`. It
came into svelte-motion through a wrong assumption in parity issue #312 (built in PR #380). The maintainer decided:
**remove it** outright, with no deprecation period. Replace its uses with upstream idioms: `whileTap` for press-time
visuals (for example `whileTap={{ cursor: 'grabbing' }}`), or state toggled from `onPanStart`/`onPanEnd`.

## Current state

- `src/lib/html/_MotionContainer.svelte` (27 `whilePan` hits) around lines 1670-1830: two effects (`attach`, keyed on
  element/ready/handler presence and the absence of `drag`; `swap`, which hot-swaps handlers through
  `teardownPan.update(next)`), plus the `whilePan` capture/replay. The JSDoc block at ~1672-1695 explains the split.
- `src/lib/types.ts:583`: `whilePan?: MotionWhileDrag` on `MotionProps`.
- `src/lib/utils/hover.ts:12`: a comment that mentions `whilePan`.
- `whilePan` users:
  - `src/routes/tests/motion/pan-authored-transforms/+page.svelte`, its e2e `e2e/motion/pan-authored-transforms.spec.ts`
    and its link in `src/routes/+page.svelte:234`. The page exists only to characterize `whilePan`.
  - `src/routes/tests/drag-signoff/+page.svelte` §5, "whilePan through the same node".
  - `docs/src/routes/docs/pan/+page.svx`: the `## whilePan` section (~line 77) and a mention at ~line 67.
  - `docs/src/lib/examples/pan/demos/Default.svelte:95` and `CardItem.svelte:137` (`whilePan={{ cursor: 'grabbing' }}`).
- Upstream (`~/Github/motion` @ `v14.5.0`) `packages/framer-motion/src/gestures/pan/index.ts`: `PanGesture`:
  - `onPointerDown` creates `new PanSession(event, handlers, { transformPagePoint: node.getTransformPagePoint(), contextWindow })`
  - handlers wrap `onPanSessionStart`/`onPanStart`/`onPan` in `frame.update(..., false, true)` and `onPanEnd` in
    `frame.postRender`
  - `update()` calls `session.updateHandlers(...)`, which replaces svelte-motion's `swap` effect
  - `unmount()` ends the session
  - enabled by `onPan || onPanStart || onPanEnd || onPanSessionStart` (framer-motion `motion/features/definitions.ts`)
- The pattern to follow is `DragGestureFeature` in `src/lib/utils/visualElementCore.ts` (plan 001) and its
  registration in `registerMotionFeatures`.
- e2e coverage: `e2e/motion/pan-transform-page-point.spec.ts`, plus the `drag-signoff` page.

## Scope

**In scope**:
- `src/lib/utils/visualElementCore.ts` (`PanGestureFeature`).
- `src/lib/html/_MotionContainer.svelte` (pan wiring, prop forwarding, `whilePan` removal).
- `src/lib/types.ts` (drop `whilePan`), plus the `hover.ts` comment.
- Delete `src/lib/utils/pan.ts` + `pan.spec.ts`.
- Delete the `pan-authored-transforms` test page, its e2e spec and its index link.
- Remove §5 of `drag-signoff` (renumber the sections that follow it).
- Docs: the pan page and both pan demos.
- A new red e2e for window scroll during pan.
- Any pan spec that pinned svelte-motion-only pan behavior (rewrite it to upstream's, citing upstream).
- `.changeset/upstream-pan-session.md`.

**Out of scope**: drag, and adding any new gesture state.

## Git workflow

Branch `feat/upstream-drag`. Commits:
- `test(pan): pin window-scroll compensation during pan (red)`
- `refactor(pan): run onPan* on motion-dom PanSession`
- `feat(pan)!: remove whilePan (not a Motion prop)`

Each ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Steps

### Step 1: Red test

Add `src/routes/tests/motion/pan-window-scroll/+page.svelte`: a tall page with a `motion.div` whose `onPan` records
`info.point.y` into `data-point-y`. Add `e2e/motion/pan-window-scroll.spec.ts`:
1. Press, move 20 px, and hold still.
2. Run `window.scrollBy(0, 100)` and wait 2 frames.
3. Send one 0-px pointermove.
4. Assert that `info.point.y` grew by ~100: page coordinates follow the scroll, per upstream `PanSession`'s
   window-scroll handling.

Link the page.

**Verify**: the spec FAILS on current code (the point does not include the scroll).

### Step 2: Remove `whilePan`

- Drop `whilePan` from `MotionProps` in `types.ts`. Delete the capture/replay code in `_MotionContainer.svelte`, and
  remove `whilePan` from the `attach` effect's enable condition. Fix the `hover.ts` comment.
- `git rm` the `pan-authored-transforms` page and its e2e spec, and remove the link in `src/routes/+page.svelte`.
- `drag-signoff`: delete §5, renumber the sections after it, and drop `whilePan` from the header copy (lines ~4 and ~30).
- Docs: delete the `## whilePan` section of `docs/src/routes/docs/pan/+page.svx`, and reword the line-67 mention.
  Add one sentence saying Motion has no `whilePan`, and that `whileTap` or `onPanStart`/`onPanEnd` replace it.
- Docs demos: replace `whilePan={{ cursor: 'grabbing' }}` with `whileTap={{ cursor: 'grabbing' }}` (in `CardItem`,
  keep the `isTop ? … : undefined` guard).

**Verify**:
- `git grep -n -i whilepan -- src docs e2e` → no matches, except the changeset and the docs sentence.
- `pnpm check` → 0 errors.
- `PW_PORT=<lane> pnpm exec playwright test e2e/motion/pan-` → pass.

### Step 3: Port `PanGestureFeature`

1. Port upstream `PanGesture` into `visualElementCore.ts`. Use the same Svelte deviation as `DragGestureFeature`:
   in `update()`, retry attaching the listeners until `node.current` exists.
2. Register the feature, enabled per upstream's definition.
3. Forward `onPanSessionStart`/`onPanStart`/`onPan`/`onPanEnd` and `transformPagePoint` to the VisualElement props.
4. Remove the `attach`/`swap` pan effects.
5. `git rm src/lib/utils/pan.ts src/lib/utils/pan.spec.ts`.
6. Rewrite any pan spec that pins svelte-motion-only timing to upstream's (`frame.update`/`frame.postRender`
   delivery), citing the upstream lines.

**Verify**:
- The Step 1 spec passes.
- `pnpm check`, `pnpm test:only`, `pnpm build` and `PW_PORT=<lane> pnpm test:e2e` → all green.
- `grep -rn "utils/pan'" src` → no matches.

### Step 4: Changeset

`.changeset/upstream-pan-session.md` (`minor`): "Pan gestures now run on Motion's `PanSession`: handlers are
delivered on Motion's frame schedule, and page scroll during a pan is compensated. **Removed `whilePan`**: it was
never a Motion prop. Use `whileTap` for press-time styles, or `onPanStart`/`onPanEnd` to toggle state."

## Done criteria

- [ ] `whilePan` is gone from the types, the container, the test pages, the docs and the demos
- [ ] `pan.ts` and `pan.spec.ts` are deleted; `PanGestureFeature` is registered
- [ ] The red window-scroll pan spec now passes
- [ ] Full gate green; README row updated

## STOP conditions

- `PanSession` is missing a hook the container needs (report which).
- A drag spec regresses (pan and drag share pointer handling; drag must not co-attach pan, matching upstream).
- A non-pan feature depends on the `whilePan` code path (report what it is; do not keep `whilePan` alive).
