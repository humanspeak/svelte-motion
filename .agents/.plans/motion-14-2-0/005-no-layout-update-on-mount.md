# Plan 005: `layout` elements keep their transforms on the compositor (no mount-time update, compositor-proof measurements)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. The guard (your dispatcher) maintains the README
> index; don't edit it.
>
> **Revision 2026-10-14 (guard, after the first 005 run STOPPED; maintainer approved)**: the first run added the
> mount-pass guard (Step 2 below, **already in the working tree, uncommitted**) plus the `layout-idle` page and spec
> (also uncommitted). The guard removes the mount-time `willUpdate()`, but `#layout` still lost acceleration in some
> runs. Second cause, traced by the executor and the guard:
> the self `ResizeObserver` in `observeLayoutChanges` (`src/lib/utils/layout.ts` ~706) always notifies once at
> mount; `schedule()` then re-runs `onChange` on a trailing rAF. By that frame the entry `x` is on the compositor,
> `stripToBaseTransforms` can't remove it (WAAPI overrides inline style), the measured rect differs from `lastRect`,
> and `commitObservedLayout` → `commitObservedLayoutChange` → projection `update()` → `resetTransform` → demote.
> This is plan 002's measurement bug, reached through the observer. 002's planned fix (demote before every measure)
> would itself kill acceleration on every observer read, so **002 is superseded and folded in here** as Steps 3-4,
> using a different technique: detach the element's WAAPI transform animations for the synchronous read, then
> reattach. Guard-validated in Chromium on the branch build mid-animation: detached read gave the true layout
> (`left: 0` vs 17.35 attached); after reattach still 1 animation, `running`, `currentTime` unchanged (231.4 ms);
> next frames continued smoothly (24.8 → 36.5 px in ~1.7 px steps) and it finished at x = 100.
>
> **Never use `git stash`** (the stash is shared by every worktree of this repo).
>
> **Workspace**: `/Users/jasonkummerl/Github/svelte-motion-1420`, branch `feat/motion-14.2.0`
> (Motion 14.2.0 installed by plan 001).
>
> **Drift check (run first)**: `git diff --stat a8a6b7ff..HEAD -- src/lib src/routes/tests/independent-transforms e2e/independent-transforms`
> → empty (only this plan's commit sits on top). Then `git status --short` → exactly
> `M src/lib/html/_MotionContainer.svelte`, `?? e2e/independent-transforms/layout-idle.spec.ts`,
> `?? src/routes/tests/independent-transforms/layout-idle/`. `git diff src/lib/html/_MotionContainer.svelte` must be
> only the Step 2 guard (two `let`s with comments, two early returns). Anything else: STOP.

## Status

- **Priority**: P1 (blocks plan 001's parity spec)
- **Effort**: M
- **Risk**: MED. Touches the pre-update snapshot and the measurement helper every `layout` element uses.
- **Depends on**: 001 (landed `a5e4da8d`)
- **Supersedes**: 002 (its red test and parity anchor move here)
- **Category**: bug (upstream parity; exposed by the 14.2.0 bump)
- **Planned at**: commit `a483a4ab`, 2026-10-13; amended at `a8a6b7ff`, 2026-10-14

## Why this matters

Motion 14.2.0 runs `x`/`y`/`scale`/`rotate` animations on the compositor as one WAAPI `transform` animation per
element. It moves them back to the main thread ("demotes") when the projection node's `willUpdate()` or a dirty
`resetTransform()` runs, because a layout update is about to measure and animate the element.

svelte-motion demotes `layout` elements when nothing changed, for two reasons:

1. **Mount-time `willUpdate()`** (fixed by Step 2, already in the tree). Upstream's
   `MeasureLayout.componentDidMount` (framer-motion `packages/framer-motion/src/motion/features/layout/MeasureLayout.tsx:39-65`
   @ `v14.2.0`) never calls `willUpdate()`; only `getSnapshotBeforeUpdate` does (lines 68-98).
2. **Measurements that see the compositor transform.** svelte-motion measures layout itself (observer path,
   reactive snapshot, `refreshLayout`, drag commits), all through `MotionDomProjectionAdapter.stripToBaseTransforms`,
   which writes the base transform inline. A WAAPI animation overrides inline style, so the read includes the
   in-flight `x`. The observer then sees a fake layout change and commits it (demote); the reactive snapshot takes a
   wrong "before" box, so a `layout` element whose size changes mid-`x` animation jumps sideways (plan 002's bug).

Upstream doesn't have svelte-motion's observer-driven measurements, so it only measures inside real updates, after
`willUpdate()` has demoted. We measure speculatively, so our measurement must be compositor-proof **without**
demoting.

Failing upstream parity test (must go green unchanged):

```
e2e/independent-transforms/basic.spec.ts:92  "a layout animation moves the element to the main thread"
expect(await count(page, 'layout')).toBe(1)   →   Expected: 1, Received: 0
```

## Current state

1. `src/lib/html/_MotionContainer.svelte`: the two `$effect.pre` blocks (~2340 and ~2514) now carry the mount-pass
   guard (`git diff` shows it). Don't change it further.
2. `src/lib/utils/motionDomProjection.ts` ~1285, the single strip helper used by `refreshLayout()` (~489),
   `measurePageRect()` (~549) and `commitDraggedLayoutChange()` (~848):
   ```ts
    private stripToBaseTransforms(): () => void {
        const restoreList: Array<{ el: HTMLElement; prev: string }> = []
        const strip = (adapter: MotionDomProjectionAdapter) => {
            const el = adapter.element
            if (!el) return
            const prev = el.style.transform
            const base = adapter.getBaseTransform?.() ?? 'none'
            if (prev === base) return
            restoreList.push({ el, prev })
            el.style.transform = base
        }
        for (const node of this.projection.path) {
            const ancestor = MotionDomProjectionAdapter.adapters.get(node)
            if (ancestor) strip(ancestor)
        }
        strip(this)
        return () => {
            for (let i = restoreList.length - 1; i >= 0; i--) {
                restoreList[i].el.style.transform = restoreList[i].prev
            }
        }
    }
   ```
   Note the early `return` when `prev === base`: an accelerated element usually has `prev === base` (motion-dom
   doesn't write the inline transform while WAAPI drives it), so a detach step must run **before** that return.
3. Uncommitted `src/routes/tests/independent-transforms/layout-idle/+page.svelte` and
   `e2e/independent-transforms/layout-idle.spec.ts` from the first run (four boxes `#layout`, `#layout-dependency`,
   `#layout-id`, `#control`; samples at 150/450/800 ms expect count 1). Keep them.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Idle spec (flake-sensitive) | `pnpm playwright test e2e/independent-transforms/layout-idle.spec.ts --repeat-each=5` | see steps |
| Measure spec | `pnpm playwright test e2e/independent-transforms/layout-measure.spec.ts --repeat-each=3` | see steps |
| Parity spec | `pnpm playwright test e2e/independent-transforms/basic.spec.ts --repeat-each=3` | see steps |
| Layout area | `pnpm playwright test e2e/layout e2e/layout-id e2e/projection e2e/animate-layout e2e/animate-presence e2e/reorder e2e/drag e2e/motion e2e/independent-transforms` | all pass |
| Full e2e | `pnpm test:e2e` | see Step 6 |
| Unit | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint | `trunk fmt` then `trunk check` | clean |

**Port 4198 rule**: before any Playwright run, check `lsof -ti :4198 -sTCP:LISTEN`. If anything is listening,
STOP and ask. Never kill it. Do NOT set `PW_REUSE_SERVER`. Port 4199 serves a build for the maintainer; leave it
alone. Use other ports (e.g. 4212/4213) for any diagnostic server and stop them when done. Verify against the
built preview (the Playwright default), not `vite dev`: the dev server doesn't reproduce this bug.

## Scope

**In scope**:

- `src/lib/html/_MotionContainer.svelte`: keep the existing guard; no further edits.
- `src/lib/utils/motionDomProjection.ts`: `stripToBaseTransforms` plus one new private (or module-level) helper.
- `src/lib/utils/motionDomProjection.spec.ts`: unit tests for the helper (Step 4).
- `src/routes/tests/independent-transforms/layout-idle/+page.svelte` (exists),
  `src/routes/tests/independent-transforms/layout-measure/+page.svelte` (create)
- `e2e/independent-transforms/layout-idle.spec.ts` (exists), `e2e/independent-transforms/layout-measure.spec.ts` (create)
- `src/routes/+page.svelte`: two links in the "Independent transforms (Motion 14.2)" section (~line 407)
- `.changeset/layout-stays-accelerated.md` (create, `patch`)

**Out of scope**:

- `e2e/independent-transforms/basic.spec.ts` and its page (upstream ports, must stay unchanged).
- `src/lib/utils/layout.ts` (observer scheduling) and `drag.ts`. Don't suppress the mount ResizeObserver
  notification or debounce the observer; the measurement fix makes those reads correct instead.
- Demoting (`resetTransform`, `willUpdate`, cancelling animations) inside any measurement. That's plan 002's
  superseded approach and kills acceleration on every observer read.
- Private `motion-dom/...` deep imports.
- The mount effect's `isLoaded`/`runAnimation` ordering (AnimatePresence wait mode and optimized-appear depend on it).

## Steps

### Step 1: Red, with the guard alone

The guard is in the tree; the measurement fix isn't. Run:

- `pnpm playwright test e2e/independent-transforms/layout-idle.spec.ts --repeat-each=5`
- `pnpm playwright test e2e/independent-transforms/basic.spec.ts --repeat-each=3`

**Verify**: quote every failure. Expected: at least one `#layout` (or `#layout-dependency`) failure
`Expected: 1, Received: 0`, and the parity `layout` test failing. If **all** idle runs and the parity test pass,
increase to `--repeat-each=10`; if still green, STOP (the observer diagnosis is wrong).

### Step 2: (done) mount-pass guard

Already applied by the first run. Confirm the diff matches the drift check, nothing more.

### Step 3: Red test for the size-change jump (from plan 002)

Create `src/routes/tests/independent-transforms/layout-measure/+page.svelte`, modelled on the `layout-idle` page
(same `countTransformAnimations` helper on `window`, fixed top-left `.fixture`, `TesterPanel` hidden under
`@isPlaywright=true` with steps / expected / live verdict). One `motion.div`, `id="box"`, height 50, `layout`,
`animate={{ x: 200 }}`, `transition={{ x: { duration: 2, ease: 'linear' }, layout: { duration: 0.3 } }}`, width bound to
`$state` (100 → 200) toggled by a button `#widen`. Also expose
`window.sampleLeft = (ms) => Promise<number[]>`, pushing `box.getBoundingClientRect().left` on **every**
`requestAnimationFrame` for `ms`.

Create `e2e/independent-transforms/layout-measure.spec.ts` (viewport 500×500, `?@isPlaywright=true`):

1. Wait 600 ms. Assert `countTransformAnimations('box') === 1` (accelerated precondition).
2. `Promise.all([sampleLeft(800), click #widen])`.
3. Max absolute difference between consecutive samples `<= 10` (`x` moves ~1.7 px/frame).
4. Wait 2 s; final `boundingBox()` has `x ≈ initialLeft + 200` (±2) and `width ≈ 200` (±2).

**Verify**: `pnpm playwright test e2e/independent-transforms/layout-measure.spec.ts --repeat-each=3` and quote the
result. Expected red: either the precondition (count 0 at 600 ms, the observer demote) or `maxStep`. Either is
acceptable red; record which. If it passes 3/3 on this code, keep it as a regression guard and say so.

### Step 4: Compositor-proof measurement

In `motionDomProjection.ts`, add a helper that detaches the element's script-created WAAPI transform animations and
returns a restore function. Shape:

```ts
/**
 * Detach an element's compositor transform animations for a synchronous read.
 *
 * Motion 14.2 runs x/y/scale/rotate as one WAAPI `transform` animation, and a
 * WAAPI animation overrides the inline transform `stripToBaseTransforms`
 * writes, so the read would include the in-flight value. Upstream only
 * measures inside a real update, after `willUpdate()` demotes; svelte-motion
 * also measures speculatively (layout observers), where demoting would move
 * every observed element off the compositor. Clearing `effect.target` removes
 * the animation's effect without touching its timing; restoring it before the
 * next frame keeps `currentTime` and `playState`, so nothing is painted detached.
 *
 * @param el - Element about to be measured.
 * @returns Restore function that reattaches every detached effect.
 */
```

Rules:

- Guard `typeof el.getAnimations === 'function'` (jsdom/SSR → no-op).
- Use `el.getAnimations()` (no `subtree`). Only detach animations that are **not** `CSSAnimation`/`CSSTransition`
  (check via `'animationName' in a` / `'transitionProperty' in a`, so it works where those globals are absent),
  whose `effect` is a `KeyframeEffect` with `effect.target === el`, and whose `getKeyframes()` has a `transform` key.
  User CSS animations stay part of the measured layout, as before.
- Set `effect.target = null`; the restore sets it back to `el`, in reverse order.
- In `stripToBaseTransforms`' `strip`: call it right after the `el` guard, **before** the `prev === base` early
  return; push its restore so the returned function runs it after restoring inline styles. Applies to ancestors in
  the path too (an accelerated ancestor shifts the child's read).

Unit tests in `motionDomProjection.spec.ts` (follow the file's existing adapter-construction pattern, stub
`el.getAnimations`):

- a transform keyframe animation has `effect.target === null` during `measurePageRect`'s read (capture it from a
  stubbed `getBoundingClientRect` or the projection measure) and `=== el` afterwards;
- a non-transform (`opacity`) animation and a CSS animation (`animationName` present) are never detached;
- no `getAnimations` on the element → measurement still works.

**Verify**:

- `pnpm playwright test e2e/independent-transforms/layout-idle.spec.ts --repeat-each=5` → all pass.
- `pnpm playwright test e2e/independent-transforms/layout-measure.spec.ts --repeat-each=3` → all pass.
- `pnpm playwright test e2e/independent-transforms/basic.spec.ts --repeat-each=3` → all pass (parity `layout` test
  green unchanged).
- `pnpm test:only` → all pass.

If a spec still fails after one reasonable adjustment, STOP and report the samples / traces.

### Step 5: Gate the layout area

**Verify**:

- Layout-area command (table above) → all pass.
- `pnpm check` → 0 errors. `trunk fmt` then `trunk check` → clean.
- `grep -n "from 'motion-dom/" src/lib/utils/motionDomProjection.ts` → no output.

### Step 6: Links, changeset, full suite

1. Link "Layout elements stay accelerated at rest" (`layout-idle`) and "Accelerated x + layout width change"
   (`layout-measure`) in `src/routes/+page.svelte`, Independent transforms section.
2. `.changeset/layout-stays-accelerated.md` (`patch`): `layout` elements keep Motion 14.2's hardware-accelerated
   transforms. Mounting no longer runs a layout update, and layout measurements ignore an in-flight accelerated
   transform, so a `layout` element that changes size mid-animation doesn't jump.
3. `pnpm test:e2e`. Baseline (plan 001 + 004): 587 + 4 passed; failures only the parity `layout` test; 1 known
   flaky (`motion/ai-glow-border` frame budget).

**Verify**: no failures beyond that baseline, and the parity `layout` test passes. Report a table of every failure
and flaky.

## Test plan

- Red anchors: `layout-idle` (Step 1, guard alone), `layout-measure` (Step 3), parity `basic.spec.ts` `layout`.
- Unit: detach/restore helper behaviour in jsdom with stubbed animations.
- Painted frames: `layout-measure` samples every rAF across the width change.
- Regression net: layout-area directories, then the full suite.

## Done criteria

- [ ] Step 1 red quoted; Step 3 red (or "not reproducible") quoted
- [ ] `layout-idle` 20/20, `layout-measure` 3/3, parity `basic.spec.ts` all green with `--repeat-each`
- [ ] Measurement never demotes: no `resetTransform`/`willUpdate`/`cancel` added to `motionDomProjection.ts`
- [ ] Layout-area e2e all pass; full e2e has no failures beyond baseline
- [ ] `pnpm test:only` passes; `pnpm check` 0 errors; `trunk check` clean
- [ ] `git status` shows only in-scope files; changeset and two index links present

## STOP conditions

- Drift check or `git status` doesn't match.
- Step 1 stays green at `--repeat-each=10`.
- Any existing layout-area spec fails after Step 4, especially `onProjectionUpdate` event counts
  (`e2e/projection/sibling-swap.spec.ts`), layoutId hand-offs, AnimatePresence re-entry, Reorder or drag. Report the
  spec, assertion and output. Don't adjust the test.
- A painted frame jumps to the start position (sampled `left` drops to `initialLeft`): the detach is reaching paint.
- The fix seems to need `layout.ts`/`drag.ts` changes, a demote, or a private motion-dom import.
- Port 4198 occupied.

## Maintenance notes

- If motion-dom ever exports a "measure without transforms" or `transformGroups` helper, revisit the detach.
- The detach relies on `KeyframeEffect.target` being writable (all evergreen browsers) and on reads being
  synchronous. Never `await` between detach and restore.
- Real updates still demote through upstream's `willUpdate()` (the parity test checks it), so a layout animation
  and an accelerated transform never both drive the element.
- The mount guard is keyed by element identity, so a re-mounted element gets its own skipped mount pass, matching
  a React remount.
