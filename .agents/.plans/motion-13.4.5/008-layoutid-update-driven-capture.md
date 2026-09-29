# Plan 008: Capture layoutId handoff rects on updates, not every frame

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. Report results in your final message; the
> reviewer maintains the batch README.
>
> Revision 2026-09-29 (guard pre-flight): 006 and 007 are DONE; baseline is `02938b9b`. `_MotionContainer.svelte`
> line numbers in "Current state" shifted (007 added ~200 lines); locate the loop by searching for
> `requestAnimationFrame(captureRect)` and the consume site by `layoutIdRegistry.consume`. 007 added
> `onProjectionCommit` and `onScreenSnapshot()` in `motionDomProjection.ts`, which are reusable sources for Step 2.
> **Step 0 (added):** in `e2e/layout/layout-group-parity/layout-group-interrupt.spec.ts`, replace Playwright
> `locator.click()` on the animating fixture elements with a native `el.click()` via `page.evaluate` (the
> measurements spec already does this). Cypress's actionability treats <5px/frame motion as stable and clicks
> immediately; Playwright waits ~7s for the 10s tween, which made the port measure the wrong moment. Assertions
> unchanged. Flip that case's `test.fail` only if it passes 3/3; this file is now in scope.
>
> **Drift check (run first)**: `git diff --stat 02938b9b..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/utils/motionDomProjection.ts src/lib/utils/layoutId.ts`
> (The reviewer fills `02938b9b` when dispatching; on mismatch with the excerpts → STOP.)

## Status

- **Priority**: P1 — **release blocker** (maintainer, 2026-09-29: "something we need to do before release")
- **Effort**: M–L
- **Risk**: HIGH (every shared-layout `layoutId` handoff depends on this rect)
- **Depends on**: 006 (motion 13.4.5 installed), 007 (LayoutGroup node groups) — both DONE
- **Category**: perf / upstream parity
- **Planned at**: commit `b791567f`, 2026-09-29 (reviewer re-stamps at dispatch after 007 lands)
- **Upstream reference** (`~/Github/motion`, v13.4.5): `packages/motion-dom/src/projection/node/create-projection-node.ts` (`willUpdate` → `updateSnapshot` → `measure(false)` — one read per update, taken while the element is still mounted), `packages/motion-dom/src/projection/shared/stack.ts` (`NodeStack` promote/relegate, `resumeFrom`), `packages/framer-motion/cypress/integration/layout-group-interrupt-measurements.ts`, `packages/framer-motion/src/components/LayoutGroup/__tests__/relative-child-measurements.test.tsx`

## Why this matters

Every mounted element with a `layoutId` calls `getBoundingClientRect` on
**every animation frame** for its whole lifetime, only so that a last-known
rect exists when it unmounts. That's constant layout-read pressure on every
shared-layout page (tabs underlines, cards, heroes) even when nothing moves,
and it's why two upstream parity specs stay red: upstream measures a
`layoutId` node only when an update actually touches it
(`layout-group-interrupt-measurements.ts` expects 0 reads for a non-animating
relative child; `relative-child-measurements` counts reads per re-layout).
The maintainer requires read-count parity before release.

## Current state

`src/lib/html/_MotionContainer.svelte:742-777` (at planning time):

```ts
    // Keep a live snapshot of the layoutId element's rect so the next element can FLIP from it.
    // We store the last-known-good rect and push it to the registry on cleanup,
    // because onDestroy fires after the element is removed from DOM (rect would be zeros).
    let layoutIdLastRect: DOMRect | null = null
    $effect(() => {
        if (!(element && layoutIdProp && layoutIdRegistry)) return
        // Capture rect on every frame while mounted, in PAGE space ...
        let rafId: number
        const captureRect = () => {
            if (element) {
                layoutIdLastRect = measureRect(element, resolveLayoutScrollAncestors(), 'none', true)
            }
            rafId = requestAnimationFrame(captureRect)
        }
        rafId = requestAnimationFrame(captureRect)
        return () => {
            cancelAnimationFrame(rafId)
            if (layoutIdLastRect && scopedLayoutId) {
                layoutIdRegistry.snapshot(scopedLayoutId, layoutIdLastRect, mergedTransition ?? {})
            }
        }
    })
```

Consumer: `_MotionContainer.svelte:~2759-2770` — on mount, `layoutIdRegistry.consume(scopedLayoutId)` and
`motionDomProjection.commitObservedLayoutChange(prev.rect)`.

Why a loop exists: in Svelte 5, when a block is destroyed the DOM is removed
**before** child effect teardowns run (`destroy_effect` → `remove_effect_dom`
then `execute_effect_teardown`), so the cleanup can't measure. Step 1
re-verifies this.

Sources of a correct rect that need no per-frame DOM read:
1. **Idle:** the adapter's cached page-space layout (`MotionDomProjectionAdapter.lastMeasuredRect`
   / `onMeasure(listener)` in `src/lib/utils/motionDomProjection.ts`), refreshed by
   seeds, observer commits, reactive commits and (after 007) group commits. Page
   space is invariant under window scroll; `layoutScroll` container offsets
   are applied by the existing `measureRect(..., resolveLayoutScrollAncestors(), ...)` conventions.
2. **Mid layout animation:** the projection's current visual box (motion-dom
   keeps the animated target — e.g. `projection.target` / `layoutCorrected`
   with `projectionDelta`; pick the field that equals the on-screen box, prove
   it in a unit test against a mocked layout).
3. **Mid transform animation** (`animate={{ x, scale }}`): layout box with the
   VisualElement's `latestValues` transforms applied (motion-dom `transformBox`).
4. **A single read at a moment the element is guaranteed mounted:** e.g. when
   the node is about to change (`willUpdate`/reactive `$effect.pre`), matching
   upstream's one-read-per-update.

## Commands you will need

| Purpose       | Command | Expected |
| ------------- | ------- | -------- |
| Unit          | `npx vitest run` | all pass |
| Typecheck     | `pnpm check` (via `npx -y pnpm@11.24.0` if global pnpm is broken) | 0 errors |
| Parity        | `npx playwright test -c <private config> e2e/layout/layout-group-parity --project=chromium --repeat-each=3` | see steps |
| Shared layout | `npx playwright test -c <private config> e2e/layout-id e2e/layout e2e/animate-presence e2e/projection e2e/reorder --project=chromium` | all pass |
| Full e2e      | `npx playwright test -c <private config> --project=chromium` | all pass except pre-existing skips |
| Lint/format   | `trunk check` / `trunk fmt` | no new issues |

E2E: never use 4198 or the maintainer's review port; use a private
untracked config (the reviewer supplies the port).

## Scope

**In scope**: `src/lib/html/_MotionContainer.svelte` (the layoutId capture
effect and the consume site only), `src/lib/utils/motionDomProjection.ts`
(+ spec: a read-free "current visual page rect" accessor), `src/lib/utils/layoutId.ts`
(only if the registry API needs a lazy-rect variant), new/updated unit tests,
`e2e/layout/layout-group-parity/*.spec.ts` (flip `test.fail` only when green 3/3),
`.changeset/layoutid-update-driven-capture.md`.

**Out of scope**: the presence exit-clone capture loop (`_MotionContainer.svelte:~712-737`,
reads only while animating, needed for clone exits — separate concern);
LayoutGroup logic (007); any change to handoff *animation* behavior.

## Steps

### Step 1: Pin the teardown ordering and the read budget (red)

1. Unit test (component spec, jsdom): a `layoutId` element inside `{#if}` —
   assert in an `$effect` cleanup whether `element.isConnected` is false when
   the block is removed. Record the result; if it's **true** (DOM still
   attached at teardown), the fix is simply "measure once in cleanup" — skip
   to Step 3 with that approach and say so.
2. E2E red: add `e2e/layout-id/read-budget.spec.ts` — mount a page with an
   idle `layoutId` element (reuse `src/routes/tests/layout-id` if it has one;
   otherwise create `src/routes/tests/layout-id/read-budget/+page.svelte`),
   count `getBoundingClientRect` reads on that element via `page.addInitScript`
   (same technique as `layout-group-interrupt-measurements.spec.ts`), idle
   for 500ms → expect **0** reads. Current code: ~30.

**Verify**: new e2e fails with ~30 reads; the two interrupt-measurement parity
cases remain red.

### Step 2: Read-free current-rect accessor

Add `MotionDomProjectionAdapter.currentVisualPageRect(): RectLike | null`
composing sources 1–3 above without DOM reads. Unit-test each branch (idle,
mid-projection-animation, mid-transform-animation, `layoutScroll` container).

### Step 3: Replace the loop

Remove the rAF loop. Keep `layoutIdLastRect` fresh by:
- subscribing to adapter measurements (`onMeasure`, and 007's `onProjectionCommit`),
- updating it from `currentVisualPageRect()` at the moments the tree changes
  (reactive `$effect.pre`, group fan-out, presence hold events) — never per frame,
- and at cleanup, pushing `currentVisualPageRect() ?? layoutIdLastRect` to the registry.

**Verify**: read-budget e2e → 0 reads; `e2e/layout-id` + shared-layout command all pass.

### Step 4: Parity flips + full gate

Run the parity suite ×3; flip `layout-group-interrupt-measurements` cases (and any
relative-child read-count case) only if green 3/3. Changeset (patch):
"Shared-layout `layoutId` elements no longer measure themselves every animation frame; their handoff rect is captured on updates, matching Motion."
Full gate: `trunk fmt`, `trunk check`, `pnpm check`, `npx vitest run`, `pnpm build`, full e2e.

## Done criteria

- [ ] `grep -n "requestAnimationFrame(captureRect)" src/lib/html/_MotionContainer.svelte` → no match
- [ ] read-budget e2e: 0 idle reads; parity read-count cases green (or each remaining red explained with evidence)
- [ ] `e2e/layout-id`, shared-layout command, full e2e pass
- [ ] unit, check, build pass; changeset exists

## STOP conditions

- Any existing `layoutId` handoff e2e regresses and the cause isn't an obvious bug in the new accessor.
- The on-screen box mid-animation can't be derived from projection/latestValues within 1px of the DOM rect in a unit test.
- Removing the loop requires changing presence exit-clone capture.

## Maintenance notes

- If Svelte ever runs child effect teardown before DOM removal, the simplest
  correct form is a single measure in cleanup — revisit then.
