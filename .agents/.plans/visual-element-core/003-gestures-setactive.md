# Plan 003: Reduce gestures to animationState.setActive and delete the coordinator layer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/visual-element-core/README.md`.
>
> **Drift check (run first)**: `git diff --stat 7eba0bd..HEAD -- src/lib/utils/hover.ts src/lib/utils/interaction.ts src/lib/utils/focus.ts src/lib/utils/inView.svelte.ts src/lib/utils/gestureCoordinator.ts`
> Plans 001/002 changed `_MotionContainer.svelte` (expected). The five gesture
> files above should be UNCHANGED since `7eba0bd`; any change there is a STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: 002-animate-through-animation-state.md (must be DONE)
- **Category**: tech-debt (architecture migration, GitHub issue #449)
- **Planned at**: commit `7eba0bd`, 2026-07-24

## Why this matters

Upstream gestures never animate: hover/press/focus/inView handlers flip
`animationState.setActive('whileX', bool)` and the single resolver animates
with priority ordering and protected keys. Our port grew a parallel animation
stack per gesture (~1,400 lines across `hover.ts` + `interaction.ts`) plus a
per-element `gestureCoordinator` that hand-approximates setActive/protectedKeys
— its own header says so (`gestureCoordinator.ts:1-23`: "Mirrors upstream
framer-motion's contract… Our port lets each gesture run its own animations, so
this coordinator supplies the two upstream guarantees the split systems were
missing"). With plan 002's animationState live, the entire layer collapses into
event wiring, and hover↔tap velocity handoff becomes structural (same
MotionValue retargeted) instead of hand-tuned.

## Current state

- **Priority order (upstream, exact)**: `motion-dom` exports
  `variantPriorityOrder = ["animate","whileInView","whileFocus","whileHover","whileTap","whileDrag","exit"]`
  (`node_modules/motion-dom/dist/es/render/utils/variant-props.mjs`). Note
  `whileFocus` sits BELOW `whileHover` — our coordinator only modeled
  `['hover','tap']` (`gestureCoordinator.ts:34`).
- **Upstream handlers to port** (tiny — read them first): - `~/Github/motion/packages/framer-motion/src/gestures/hover.ts:4-35` —
  `hover(element, cb)` from motion-dom; on start/end:
  `node.animationState.setActive("whileHover", isStart)` when
  `props.whileHover` exists; `onHoverStart`/`onHoverEnd` fired via
  `frame.postRender`. - `gestures/press.ts:4-56` — `press(element, cb, { useGlobalTarget,
stopPropagation })`; `setActive("whileTap", isStart)`; `onTapStart` /
  `onTap` (success) / `onTapCancel` via `frame.postRender`; disabled-button
  guard. - `gestures/focus.ts:7-39` — focus/blur DOM events; `:focus-visible` match
  (treat as true when `matches` throws) gates `setActive("whileFocus", true)`. - `motion/features/viewport/index.ts:20-94` — IntersectionObserver;
  `setActive("whileInView", isIntersecting)`; `once` handling;
  `onViewportEnter/Leave` from latest props; observer restart only when
  `root`/`margin`/`amount` change.
- **Our current attachments** — `_MotionContainer.svelte:2885-3010`: a
  `createGestureCoordinator()` per element (`:2889`), a shared
  `gestureChannelValues: Map<string, MotionValue<number>>` (`:2896`), then four
  `$effect`s calling `attachWhileTap` (`:2904`), `attachWhileHover` (`:2936`),
  `attachWhileFocus` (`:2968`), `attachWhileInView` (`:2991`), each handed
  resolved keyframe records plus baseline getters
  (`getBaseStyleValues`, `getStyleTransformValues`, `liveGestureTransformValues`).
- **What the gesture files do today** (all replaced):
    - `hover.ts:390-843` `attachWhileHover` — per-channel MotionValues, a
      composed transform writer (`el.style.transform = transform` at `:458` +
      `markExternalWrite`), `animateNative` → `animate(el, ...)` (`:752-762`),
      coordinator setActive/protected-key filtering on start/end (`:764-825`).
    - `interaction.ts:93-545` `attachWhileTap` — `animate()` calls at `:339`,
      `:391`, `:462`; computed-matrix seeding (`seedStaleChannels`) and velocity
      handoff (`collectHandoffVelocities`).
    - `focus.ts:99-140`, `inView.svelte.ts:224-300` — direct `animate()` +
      baseline restore, no coordinator.
    - The container ALSO has a raw writer effect for hover's composed transform:
      `$effect` at `:381-386` writing `element.style.transform = liveGestureTransform`.
- **Callbacks to preserve** (public API, `src/lib/types.ts`): `onHoverStart`,
  `onHoverEnd`, `onTapStart`, `onTap`, `onTapCancel`, `onFocusStart`(_ours_),
  `onFocusEnd`(_ours_), `onInViewStart`(_ours_), `onInViewEnd`(_ours_),
  `viewport` prop options (`root`, `margin`, `amount`, `once`), and
  keyboard-accessible tap (#414) — motion-dom's `press()` implements
  keyboard/Enter activation natively (`isElementKeyboardAccessible` is
  exported); confirm parity with `e2e/armed-buttons` rather than re-adding
  custom code.
- **Variant string keys on while-props** (#349) work through animationState
  natively — `resolvedWhile*` pre-resolution in the container becomes
  unnecessary; pass the RAW `whileHover`/`whileTap`/… props through
  `buildMotionNodeProps` (plan 001 already passes them; verify they're raw, not
  pre-resolved).
- **Drag interplay**: hover currently ignores enter while
  `el.dataset.svelteMotionDragActive === 'true'` (`hover.ts:765`) and stops on
  a `svelte-motion:drag-start` event. motion-dom's `hover()`/`press()` filter
  via the global drag lock (`isDragActive`) — our drag does NOT set that lock
  (plan 005 does). Until 005 lands, keep the dataset guard in the new thin
  handlers.

## Commands you will need

| Purpose      | Command                                                   | Expected                                        |
| ------------ | --------------------------------------------------------- | ----------------------------------------------- |
| Typecheck    | `pnpm check`                                              | 0 errors                                        |
| Unit         | `pnpm test:only`                                          | all pass                                        |
| Gesture e2e  | `pnpm test:e2e e2e/motion e2e/armed-buttons e2e/variants` | all pass                                        |
| Full-ish e2e | `pnpm test:e2e e2e/drag e2e/reorder`                      | all pass (drag untouched but shares transforms) |
| Format/lint  | `trunk fmt` / `trunk check`                               | no new issues                                   |

## Scope

**In scope**:

- `src/lib/utils/gestures.ts` (create — the four thin attachers)
- `src/lib/utils/gestures.spec.ts` (create)
- `src/lib/html/_MotionContainer.svelte` (swap attachments; delete
  `liveGestureTransform` writer effect + `gestureChannelValues`)
- DELETE: `src/lib/utils/gestureCoordinator.ts`, `gestureCoordinator.spec.ts`,
  `src/lib/utils/hover.ts`, `hover.spec.ts`, `src/lib/utils/interaction.ts`
  (and its spec), `src/lib/utils/focus.ts` (and spec),
  gesture-animation parts of `src/lib/utils/inView.svelte.ts` — but KEEP the
  exported `useInView` hook in that file (public API, unrelated to gestures);
  only `attachWhileInView` goes.
- `src/lib/utils/transformComposer.ts` — delete IF unreferenced after the
  above (drag also imports it — check `drag.ts` imports first; if drag uses
  it, leave it).

**Out of scope**:

- `drag.ts`, `pan.ts` (plan 005). Keep `attachPan` untouched.
- The `whileDrag` animation type — drag still animates its own whileDrag until
  plan 005; do not wire `setActive('whileDrag')` yet.
- Public types in `src/lib/types.ts` — no API change.

## Git workflow

- Branch `issue-449-visual-element-core`; conventional commits, e.g.
  `feat(gestures): route hover/tap/focus/inView through setActive (#449)`.
- Do NOT push.

## Steps

### Step 1: Characterization baseline

Run `pnpm test:e2e e2e/motion e2e/armed-buttons` and record results. The
hover/tap handoff specs (`e2e/motion/hover-tap-multichannel-handoff.spec.ts`,
`e2e/motion/hover-velocity-continuity.spec.ts`) are the hard part of this
plan's bar — read both specs before writing code so you know exactly what
continuity they assert.

**Verify**: suites pass; report counts.

### Step 2: Write the thin attachers

`src/lib/utils/gestures.ts`: four functions, each `(ve: VisualElement, props
accessors, callbacks) => cleanup`, ported line-for-line in spirit from the
upstream files cited above (include `// upstream: framer-motion/src/gestures/hover.ts:11-13`
style citations). Use motion-dom's `hover`, `press`, `frame`; plain
`addEventListener` for focus/blur; `IntersectionObserver` for inView (port the
`amount: 'some'|'all'|number → threshold` mapping from our existing
`inView.svelte.ts` observer options). Keep the `data-svelte-motion-drag-active`
guard in hover/press start handlers (see Current state).

Unit tests (`gestures.spec.ts`, jsdom): each attacher calls
`ve.animationState.setActive` with the right type/flag on synthetic events;
focus requires `:focus-visible`; inView `once` unobserves after first enter;
callbacks fire.

**Verify**: `pnpm test:only src/lib/utils/gestures.spec.ts` → all pass.

### Step 3: Swap the container to the thin attachers

Replace the four attachment `$effect`s (`:2899-3010`) with the new attachers
(they need only `element`, the VE, and the callback props — the while-prop
definitions flow through `ve.props` from `buildMotionNodeProps`; ensure raw
props are passed there, not `resolvedWhile*`). Delete: the coordinator
construction (`:2889`), `gestureChannelValues` (`:2896`), the
`liveGestureTransform` state + writer effect (`:372-386`) and its
`serializedStyleWithLiveGestureTransform` splice, and the baseline getters
that existed only for gestures (`captureBaseStyleValues`/`getBaseStyleValues`
— grep before deleting; hover-end restore is now animationState's
removed-key handling via `baseTarget`).

**Verify**: `pnpm check` → 0 errors; `pnpm test:only` → all pass.

### Step 4: Delete the legacy gesture files

Remove the files listed in scope. `grep -rn "gestureCoordinator\|attachWhileHover\|attachWhileTap\|attachWhileFocus\|attachWhileInView\|liveGestureTransform" src/` → only hits allowed are in `.agents/.plans/`.

**Verify**: `pnpm check` → 0 errors (dangling imports surface here).

### Step 5: Full gate

`trunk fmt` → `trunk check` → `pnpm test:only` →
`pnpm test:e2e e2e/motion e2e/armed-buttons e2e/variants e2e/drag e2e/reorder`.

**Verify**: results match Step 1 baseline (drag/reorder unchanged). If the two
handoff specs fail on TIMING tolerances (not on behavior), report the exact
assertion and measured values — do NOT loosen the specs yourself.

## Test plan

- No red-first test: behavior-preserving migration pinned by the Step 1
  characterization baseline (esp. the two velocity-handoff specs).
- New: `gestures.spec.ts` (Step 2 cases).
- Deleted specs (`gestureCoordinator.spec.ts`, `hover.spec.ts`, interaction
  spec) are intentionally removed WITH their subjects — note this in the
  report so the coverage drop is a reviewed decision.
- Verification: full unit suite + five e2e suites.

## Done criteria

- [ ] `pnpm check` exits 0; `trunk check` no new issues
- [ ] `pnpm test:only` exits 0
- [ ] `pnpm test:e2e e2e/motion e2e/armed-buttons e2e/variants e2e/drag e2e/reorder` exits 0
- [ ] `src/lib/utils/gestureCoordinator.ts`, `hover.ts`, `interaction.ts`,
      `focus.ts` no longer exist; `useInView` hook still exported and covered
- [ ] `grep -rn "setActive" src/lib/utils/gestures.ts` shows all four types
- [ ] No files outside the in-scope list modified
- [ ] README status row updated

## STOP conditions

- Drift in the five gesture files since `7eba0bd`.
- The velocity-continuity or multichannel-handoff specs fail behaviorally
  after two fix attempts — the fallback decision (keep a residual coordinator
  vs. adjust specs) belongs to the reviewer.
- Keyboard-accessible tap (`e2e/armed-buttons`) regresses — motion-dom's
  `press()` may differ from our #414 behavior; report the diff, don't re-add
  the old code unilaterally.
- Deleting `captureBaseStyleValues` breaks non-gesture users (grep hits
  outside gesture paths).
- `transformComposer.ts` is still imported by `drag.ts` (expected — leave it).

## Maintenance notes

- After this plan, gesture semantics (priority, protected keys, restoration)
  are upstream's — bugs in that area should be compared against upstream
  behavior before fixing locally.
- Reviewer: scrutinize hover-during-drag guard, focus `:focus-visible`
  edge (jsdom throws on the selector), inView `once` + `amount` mapping, and
  the deleted-coverage note.
- Deferred: `setActive('whileDrag')` (plan 005); global drag lock.
