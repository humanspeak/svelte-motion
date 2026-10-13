# Plan 002: Layout measurements never include a compositor-accelerated transform

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When done, update this plan's status row in
> `.agents/.plans/motion-14-2-0/README.md`, unless a reviewer dispatched you
> and told you they maintain the index.
>
> **Revision 2026-10-13 (guard, after 001 triage)**: run this **after plan 005**. Until 005 lands, every `layout`
> element is moved off the compositor right after mount by a mount-time `willUpdate()`, so this plan's red test
> can't reproduce (the box is never accelerated when the width changes: the "count 0 at 600 ms" STOP). Once 005
> lands, the upstream parity test `e2e/independent-transforms/basic.spec.ts` › "a layout animation moves the element
> to the main thread" is a second red anchor. After 005 it may fail on its `x` range (lines 96-97) or final bounds,
> and this plan must turn it green unchanged. Add it to Step 1's red run and to the done criteria. Workspace:
> `/Users/jasonkummerl/Github/svelte-motion-1420`, branch `feat/motion-14.2.0`. Drift-check baseline: the commit
> that lands 005. The `_MotionContainer.svelte` diff from 005 (the mount-pass guard) is expected.
>
> **Never use `git stash`.**
>
> **Drift check (run first)**: `git diff --stat b9e59066..HEAD -- src/lib/utils/motionDomProjection.ts src/lib/html/_MotionContainer.svelte src/lib/utils/motionDomProjection.spec.ts`
> Plan 001 must already be on the branch (pins at 14.2.0) and should not have touched these
> files. If they changed, compare the excerpts below against live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: MED. Touches the measurement path every `layout` element uses.
- **Depends on**: 001-bump-motion-14-2-0.md (needs motion-dom 14.2.0 installed), 005-no-layout-update-on-mount.md
- **Category**: bug (a regression introduced by the 14.2.0 bump)
- **Planned at**: commit `b9e59066`, 2026-10-13

## Why this matters

Motion 14.2.0 runs `x`/`y`/`scale`/`rotate` animations as one compositor (WAAPI)
`transform` animation per element. A WAAPI animation **overrides inline style**, so
temporarily writing `el.style.transform = base` no longer removes the in-flight
transform from a measurement. Upstream handles this by "demoting" the element's transform
group back to the main thread before projection measures. That happens in
`projectionNode.willUpdate()` and `projectionNode.resetTransform()`
(`packages/motion-dom/src/projection/node/create-projection-node.ts` @ `v14.2.0`, helper
`demoteTransforms`).

svelte-motion has its own measurement entry points that strip transforms physically
and run **before** (or without) `willUpdate()`. The most common one is the reactive
pre-patch snapshot in `_MotionContainer.svelte`. Example: a `layout` element whose width changes
while it animates `x` takes its "before" box with the accelerated `x` still applied.
The layout FLIP then starts from the wrong box and the element visibly jumps sideways.
This plan reproduces that jump with a painted-frame e2e test, then demotes before every
strip.

## Current state

- `src/lib/html/_MotionContainer.svelte:2325-2340`: the reactive snapshot measures **before**
  `willUpdate()` (the upstream demote point):
  ```ts
  $effect.pre(() => {
      const shouldProject = element && layoutProp && isLoaded === 'ready' && hasLayoutFeatures
      ...
      // 'snapshot' phase: the pre-patch side of the update boundary.
      explicitLayoutSnapshot = measureLayoutRect('snapshot')
      motionDomProjection?.willUpdate()
      motionDomProjectionUpdatePending = true
  })
  ```
- `measureLayoutRect` (`_MotionContainer.svelte:644-650`) calls `motionDomProjection.measurePageRect(phase, options)`.
- `src/lib/utils/motionDomProjection.ts`, class `MotionDomProjectionAdapter` (line ~184). It has
  `readonly visualElement` and `readonly projection: IProjectionNode<HTMLElement>`, plus a static
  `adapters` map from projection node to adapter. Three callers strip transforms before reading:
  `refreshLayout()` (~line 489), `measurePageRect()` (~line 549) and `commitDraggedLayoutChange()` (~line 848).
  All three go through one private helper:
  ```ts
  // src/lib/utils/motionDomProjection.ts ~1285
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
      return () => { ...restore in reverse... }
  }
  ```
- motion-dom does **not** export `transformGroups` (checked: `packages/motion-dom/src/index.ts` @ `v14.2.0`).
  The only public routes to a demote are `projection.willUpdate()` (too many side effects here)
  and `projection.resetTransform()`. That method demotes when `isLayoutDirty || shouldResetTransform || options.alwaysMeasureLayout`,
  then may write `instance.style.transform` to the template value or `'none'` and `scheduleRender()`:
  ```ts
  // motion-dom create-projection-node.ts @ v14.2.0, resetTransform()
  const isResetRequested = this.isLayoutDirty || this.shouldResetTransform || this.options.alwaysMeasureLayout
  isResetRequested && demoteTransforms(this)
  ...
  if (isResetRequested && this.instance && (hasProjection || hasTransform(this.latestValues) || transformTemplateHasChanged)) {
      resetTransform(this.instance, transformTemplateValue)   // HTML: style.transform = value ?? "none"
      this.shouldResetTransform = false
      this.scheduleRender()
  }
  ```
  Demote itself (`TransformAnimation.ts`, `demote()`) syncs each track's MotionValue to its live value,
  commits the live transform inline, cancels the WAAPI animation and restarts the JS driver.
- Public helpers you may use: `transformPropOrder` (exported by `motion-dom`), `MotionValue.isAnimating()`,
  `VisualElement.getValue(key)`, `VisualElement.render()`.
- Test-page and painted-frame conventions: sample **every** `requestAnimationFrame` inside the page
  (never a few `boundingBox()` calls from Playwright). See any spec under `e2e/layout/` that collects
  rAF samples via `page.evaluate`. Pages carry a human guided panel hidden under `@isPlaywright=true`
  (copy from `src/routes/tests/animate-layout/toggle/+page.svelte`).

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| New e2e | `pnpm playwright test e2e/independent-transforms/layout-measure.spec.ts` | see steps |
| Layout e2e areas | `pnpm playwright test e2e/layout e2e/layout-id e2e/projection e2e/reorder e2e/drag e2e/independent-transforms` | all pass (or match plan-001 triage) |
| Unit | `pnpm test:only` | pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint | `trunk check` | no new issues |

Port 4198 rule: check `lsof -ti :4198 -sTCP:LISTEN` before Playwright. If occupied, STOP and ask. Never kill it.

## Scope

**In scope**:
- `src/routes/tests/independent-transforms/layout-measure/+page.svelte` (create)
- `e2e/independent-transforms/layout-measure.spec.ts` (create)
- `src/routes/+page.svelte` (one link under the "Independent transforms (Motion 14.2)" section from plan 001)
- `src/lib/utils/motionDomProjection.ts` (`stripToBaseTransforms` plus one new private helper)
- `src/lib/utils/motionDomProjection.spec.ts` (only if a jsdom unit test is meaningful; see Test plan)
- `.changeset/motion-14-2-0.md` (append one sentence only if the fix lands)

**Out of scope**:
- Reordering `measureLayoutRect('snapshot')` and `willUpdate()` in `_MotionContainer.svelte`. Their
  order is load-bearing for other paths; fixing inside `stripToBaseTransforms` covers every caller at once.
- `src/lib/utils/layout.ts` and `src/lib/utils/drag.ts` direct `style.transform` writes. Report them if
  e2e implicates them; do not change them here.
- Any global switch disabling acceleration.

## Steps

### Step 1: Red test: the width change must not make the box jump sideways

Create `src/routes/tests/independent-transforms/layout-measure/+page.svelte`. It holds one `motion.div`, `id="box"`,
100×50, `layout`, `animate={{ x: 200 }}`,
`transition={{ x: { duration: 2, ease: 'linear' }, layout: { duration: 0.3 } }}`, and a width bound to `$state`
(100 → 200) toggled by a button `#widen`. Expose
`window.countTransformAnimations` as in plan 001's page.
Also expose `window.sampleLeft = (ms) => new Promise(resolve => { /* push box.getBoundingClientRect().left every rAF for ms, then resolve(array) */ })`.

Create `e2e/independent-transforms/layout-measure.spec.ts`:
1. Go to `/tests/independent-transforms/layout-measure?@isPlaywright=true`, wait 600 ms.
2. Assert precondition: `countTransformAnimations('box') === 1` (accelerated). If it is 0, STOP: the
   scenario doesn't reproduce acceleration.
3. Start `sampleLeft(800)` and click `#widen` while it runs (`Promise.all`).
4. Compute the max absolute difference between consecutive samples. `x` moves at 100 px/s (~1.7 px/frame).
   Assert `maxStep <= 10`.
5. After settling (wait 2 s), assert the final `boundingBox()` has `x ≈ initialLeft + 200` (±2) and `width ≈ 200` (±2).

**Verify**: `pnpm playwright test e2e/independent-transforms/layout-measure.spec.ts` → FAILS on the
`maxStep` assertion (expect a step of roughly the in-flight `x`, tens of px).
- If it **passes** on unfixed code, upstream's own demote already covers this path. Keep the test as a
  regression guard. Record "no fix needed: red not reproducible" in the README row and skip Steps 2–3.
- If it fails on some other assertion, STOP and report.

### Step 2: Demote before stripping

In `MotionDomProjectionAdapter`, add a private helper and call it from `strip` **before** `prev` is read:

```ts
/**
 * Hand an element's compositor-accelerated transforms back to the main
 * thread before a measurement. A WAAPI transform overrides the inline style
 * we strip, so the read would include the in-flight value. Mirrors
 * upstream's `demoteTransforms` in willUpdate()/resetTransform()
 * (motion-dom create-projection-node.ts @ v14.2.0). motion-dom doesn't
 * export transformGroups, so this goes through resetTransform()'s
 * reset-requested branch, then re-renders the now-current latestValues.
 */
private demoteAcceleratedTransforms(adapter: MotionDomProjectionAdapter): void
```

Implementation shape:
1. Return early unless some `key` in `transformPropOrder` has `adapter.visualElement.getValue(key)?.isAnimating()`.
   This keeps idle measurements free of extra writes.
2. `const node = adapter.projection; const was = node.shouldResetTransform; node.shouldResetTransform = true; node.resetTransform(); node.shouldResetTransform = was`.
3. `adapter.visualElement.render()` so the inline transform is the live value again before `strip` captures `prev`.

Then in `strip`, call `this.demoteAcceleratedTransforms(adapter)` as the first line after the `el` guard.

**Verify**: `pnpm playwright test e2e/independent-transforms/layout-measure.spec.ts` → PASSES.
If it still fails after one reasonable adjustment, STOP and report the samples.
Do not try `willUpdate()` or private motion-dom imports.

### Step 3: Regression sweep

**Verify**:
- `pnpm playwright test e2e/layout e2e/layout-id e2e/projection e2e/reorder e2e/drag e2e/independent-transforms` →
  same pass/fail set as plan 001's triage (no new failures).
- `pnpm test:only` → pass. `pnpm check` → 0 errors. `trunk check` → clean.

### Step 4: Link and changeset

Add a link "Accelerated x + layout width change (measurement)" under the plan-001 section in `src/routes/+page.svelte`.
Append one sentence to `.changeset/motion-14-2-0.md`: layout measurements now hand accelerated transforms
back to the main thread first, so a `layout` element that changes size mid-`x` animation doesn't jump.

## Test plan

- Red anchor: `e2e/independent-transforms/layout-measure.spec.ts` `maxStep <= 10` fails before Step 2 and passes after it.
- A jsdom unit test can't observe this (no WAAPI). Skip it unless you can assert that
  `demoteAcceleratedTransforms` is a no-op (no `style.transform` write) when nothing animates. If you add that,
  put it in `src/lib/utils/motionDomProjection.spec.ts` following its existing adapter-construction pattern.

## Done criteria

- [ ] Red test observed failing (or "not reproducible" recorded) and now passing
- [ ] `stripToBaseTransforms` demotes before reading `prev`; no private `motion-dom` deep imports (`grep -n "motion-dom/" src/lib/utils/motionDomProjection.ts` → no matches)
- [ ] Layout-area e2e: no new failures vs plan 001 triage
- [ ] `pnpm check`, `pnpm test:only`, `trunk check` clean
- [ ] Only in-scope files changed (`git status`)
- [ ] README status row updated

## STOP conditions

- Precondition fails: the box isn't accelerated (count 0) at 600 ms.
- The fix needs `_MotionContainer.svelte` changes or a private motion-dom import.
- Any previously passing layout/projection/reorder/drag spec starts failing.
- A painted flash to `x = 0` appears (sampled `left` drops to the start position for a frame).
  That means `resetTransform()`'s `'none'` write is reaching paint, so `render()` isn't restoring it.

## Maintenance notes

- This leans on `resetTransform()` demoting when `shouldResetTransform` is set. Re-check on every Motion bump
  (`git -C ~/Github/motion log -p <old>..<new> -- packages/motion-dom/src/projection/node/create-projection-node.ts`).
- Worth an upstream ask: export `transformGroups` (or a `demoteTransforms(element)` helper) from motion-dom.
  Then step 2 collapses to one call.
- The `isAnimating()` precheck keeps idle measurements write-free. A future change that measures every frame must keep it.
