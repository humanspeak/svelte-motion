# Plan 002: whileDrag via setActive + the global drag lock (hover-during-glide becomes real)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> any STOP condition occurs, stop and report. Update the status row in
> `.agents/.plans/drag-single-writer/README.md` when done. Required prior
> reading: plan 001 of this batch (must be DONE) and the archived
> `.agents/.plans-closed/visual-element-core/005-*.md` revision notes
> (the lock-risk ruling and the operator acceptance criterion live there).
>
> **Drift check (run first)**: `git diff --stat <001-landing-SHA>..HEAD -- src/lib/utils/drag.ts src/lib/utils/gestures.ts src/lib/html/_MotionContainer.svelte`
> Expect empty beyond plan 001's own changes.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — the lock is global (an unreleased lock kills hover/press
  everywhere), which is exactly why it lands HERE, paired, and not alone
- **Depends on**: 001-axis-writer-through-ve.md (DONE)
- **Category**: tech-debt + operator acceptance criterion (#449 follow-up)
- **Planned at**: commit `bb99032`, 2026-07-25

## Why this matters

Three things become possible once drag writes VE values (plan 001), and
they belong in one plan because they are one contract:

1. `whileDrag` becomes a real animationState priority
   (`setActive('whileDrag', bool)`) instead of drag.ts's own per-channel
   animations — the last gesture outside the priority system.
2. The per-element `data-svelte-motion-drag-active` guard is replaced by
   motion-dom's global drag lock (`setDragLock`/`isDragActive`), matching
   upstream's suppression semantics exactly: hover/press suppressed while
   the POINTER IS DOWN, released at pointer-up.
3. **The operator acceptance criterion** (recorded 2026-07-25 during live
   sign-off): hover MUST respond during the post-release momentum glide.
   Today the dataset guard outlives the drag session through the glide
   (`drag.ts:675-682` clears it only after settle) — stricter than
   upstream. With one writer (the VE composes hover scale WITH the
   in-flight translate) the strictness is no longer needed.

## Current state

- **whileDrag animations in drag.ts**: `startWhileDrag()` (`:812-829`,
  `computeHoverBaseline` reuse + per-channel transform animations +
  `animate(el, nativeKeyframes, …)` at `:828`) and `endWhileDrag()`
  (`:831-880`, restore incl. `animate(el, nativeBaseline, …)` at `:843`).
  These import baseline helpers from `hover.ts` (the module plan 003 of the
  gestures batch kept alive as helpers) — after this plan, grep whether
  `computeHoverBaseline`/`splitHoverDefinition` still have callers besides
  `pan.ts`.
- **Guard set/clear**: `markDragTransformActive` (`drag.ts:508-514`), set
  at drag start (`:925`, right after the `svelte-motion:drag-start` event
  dispatch at `:924`), cleared at `:681` (only once dragging AND
  `postReleaseAnimationActive` AND `whileDragRestoreActive` are all false —
  i.e., after the glide) and at teardown (`:1536`).
- **Consumer of the guard**: `src/lib/utils/gestures.ts:25-40` —
  `DRAG_ACTIVE_ATTRIBUTE` + `isDragActiveOn(element)`; its comment at
  `:31` says explicitly: upstream filters via the global lock
  (`isDragActive`), "but our drag implementation does not set that lock
  yet". Hover and press start-handlers early-return on it.
- **motion-dom exports** (installed 12.42.2): `setDragLock`,
  `isDragActive`, `isDragging`. Upstream usage:
  `VisualElementDragControls.ts` acquires via `setDragLock(drag)` at drag
  session start (`:157-166` region — READ IT) and stores the release
  function; releases at session end (pointer-up path), NOT at animation
  end. motion-dom's own `hover`/`press` recognizers also consult the lock
  internally — check whether our thin attachers even need their own check
  once the lock is set (they may get filtering for free).
- **projection blocking**: upstream toggles `isAnimationBlocked` on the
  projection during drag (`:138-140`, `:290-293`); our adapter has
  `blockLayoutAnimation`/`unblockLayoutAnimation`
  (`motionDomProjection.ts:565-583`) already wired from drag — verify this
  plan does not disturb that wiring.
- **animationState types**: `whileDrag` is in `variantPriorityOrder`
  (above whileTap, below exit) — the slot exists and is unused by us.
- **The mirror bridge** (`_MotionContainer.svelte:1550-1570`): plan 001's
  Step 4 proved it a no-op; this plan deletes it (the VE now composes drag
    - gesture channels natively).

## Commands you will need

| Purpose     | Command                                                           | Expected      |
| ----------- | ----------------------------------------------------------------- | ------------- |
| Typecheck   | `pnpm check`                                                      | 0 errors      |
| Unit        | `pnpm test:only`                                                  | all pass      |
| Gate        | `pnpm test:e2e e2e/drag e2e/reorder e2e/motion e2e/armed-buttons` | all pass      |
| Format/lint | `trunk fmt` / `trunk check`                                       | no new issues |

## Scope

**In scope**:

- `src/lib/utils/drag.ts` (whileDrag → setActive; lock acquire/release;
  guard clearing at SESSION end)
- `src/lib/utils/gestures.ts` (dataset guard → lock, or removal if
  motion-dom's recognizers filter for free)
- `src/lib/html/_MotionContainer.svelte` (delete the mirror bridge;
  `liveGestureTransform` splice removal IF it becomes dead — grep first)
- `e2e/drag/hover-during-glide.spec.ts` (create — the acceptance spec)
- `src/lib/utils/drag.spec.ts`, `gestures.spec.ts` updates
- `.agents/.plans/drag-single-writer/README.md`

**Out of scope**:

- `dragInertia.ts` internals (plan 003), `pan.ts` (plan 004),
  `layout.ts` (plan 005).
- `hover.ts` deletion — even if its last drag callers go, `pan.ts` still
  imports it until plan 004; just note the remaining callers.

## Git workflow

Same as plan 001 (conventional commits, never push, WIP before surgery,
never reset past foreign commits).

## Steps

### Step 1: Red test — the operator's acceptance criterion

Create `e2e/drag/hover-during-glide.spec.ts` on a fixture with
`drag` + `whileHover={{ scale: 1.1 }}` + momentum: drag with velocity,
release, and DURING the glide move the pointer onto the element. Assert:
(a) scale rises toward 1.1 while translate keeps changing (hover composes
with the in-flight glide), and (b) the glide's trajectory continues
(no snap in x/y). Reuse/extend an existing momentum fixture page if one
fits; otherwise add one under `src/routes/tests/drag/`.

Run it: it must FAIL today — hover is suppressed through the glide (scale
stays 1). If it passes, the reproduction is wrong: STOP.

**Verify**: spec fails with scale pinned at 1 during the glide.

### Step 2: whileDrag through setActive

Replace `startWhileDrag`/`endWhileDrag` with
`node.animationState?.setActive('whileDrag', bool)` at the exact drag
start/end points. The whileDrag definitions flow via `ve.props.whileDrag`
(already carried by `buildMotionNodeProps` since #449). Delete the
per-channel machinery those functions used; grep `computeHoverBaseline`
callers afterward and note survivors.

**Verify**: `pnpm test:e2e e2e/drag` → all pass (the while-drag suites:
`while-drag-restore`, `while-drag-transforms`, `while-drag-write-coalescing`).

### Step 3: The lock swap

Acquire `setDragLock` at drag session start (where `markDragTransformActive(true)`
sits, `drag.ts:925`); release at SESSION end (pointer-up), NOT at glide
end — upstream semantics. Clear the dataset flag at session end too, then
delete the flag entirely IF `gestures.ts` no longer needs it: check first
whether motion-dom's `hover()`/`press()` recognizers already consult
`isDragActive` internally (read the installed
`node_modules/motion-dom/dist/es/gestures/` sources); if they do, delete
`isDragActiveOn` + the dataset attribute wholesale; if not, swap
`isDragActiveOn` to `isDragActive()`.

**Verify**: Step 1's spec now PASSES 3× consecutive (hover responds
mid-glide, glide uninterrupted); `pnpm test:e2e e2e/motion e2e/armed-buttons`
→ all pass (hover/press suppression during ACTIVE drag must still hold —
covered by existing drag-interplay specs).

### Step 4: Delete the mirror bridge + full gate

Remove the container's `onVisualUpdate` → `setStaticValue` mirror
(`:1550-1570`) and drag's `onVisualUpdate` emission if nothing else
consumes it; grep `liveGestureTransform` — if its only writer was drag's
`onVisualUpdate`, remove the splice and state per the gestures batch's
deferred cleanup. Then `trunk fmt` → `trunk check` → `pnpm check` →
`pnpm test:only` → the full four-suite gate.

**Verify**: all green; greps for the deleted symbols return only plan-doc
hits.

## Test plan

- Red-first anchor: the hover-during-glide spec (fails today by measured
  suppression, passes after the lock swap) — this IS the operator's
  acceptance criterion from the #449 sign-off.
- Deleted-mechanism unit assertions re-pointed, behavioral ones kept.

## Done criteria

- [ ] `pnpm check` exits 0; `trunk check` no new issues; `pnpm test:only` exits 0
- [ ] `pnpm test:e2e e2e/drag e2e/reorder e2e/motion e2e/armed-buttons` exits 0
- [ ] `hover-during-glide.spec.ts` exists, failed at Step 1 as specified,
      passes 3× consecutive after Step 3
- [ ] `grep -rn "svelteMotionDragActive" src/` → no matches (or a justified
      residual documented in NOTES)
- [ ] `grep -n "setActive('whileDrag'" src/lib/utils/drag.ts` → present
- [ ] `grep -n "setDragLock" src/lib/utils/drag.ts` → present, with the
      release provably on the pointer-up path
- [ ] Mirror bridge gone from the container
- [ ] README status row updated

## STOP conditions

- Plan 001 not DONE, or drift beyond it.
- Hover mid-glide composes but the glide SNAPS (two-writer symptom) — that
  means plan 001's single-writer claim has a hole; report, don't patch here.
- The lock's release path can leak (any drag-end route that skips it —
  audit pointer-cancel, keyboard drag end, teardown). If a leak-free
  design needs restructuring beyond this plan's scope, STOP: a leaked
  global lock is strictly worse than the dataset guard.
- `armed-buttons` (keyboard/press) regresses under the lock.

## Maintenance notes

- After this plan, gesture suppression semantics are upstream's; the tour
  page §7's amber KNOWN panel should be updated (or removed) — note it for
  the operator rather than editing the tour unprompted.
- Reviewer: audit every drag-end path for lock release; scrutinize the
  whileDrag priority interplay with whileTap (upstream order: tap < drag).
