# Plan 003: Cap Reorder auto-scroll speed at `maxSpeed` when the pointer is past the edge

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> When done, update this plan's row in `.agents/.plans/motion-14-5-0/README.md`, unless a reviewer dispatched you
> and told you they maintain the index.
>
> **Never use `git stash`.**
>
> **Drift check (run first)**: `git diff --stat f2b5d766..HEAD -- src/lib/components/Reorder/autoScroll.ts src/lib/components/Reorder/autoScroll.spec.ts`
> Expect no output. Otherwise compare against "Current state"; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (pure function, one call site)
- **Depends on**: 000 (runs in wave 1, in parallel with 001; no code dependency on the 14.5.0 pins)
- **Category**: bug (upstream parity, Motion 14.5.0)
- **Planned at**: commit `f2b5d766`, 2026-10-21

## Why this matters

When a `Reorder.Item` is dragged past the edge of its scroll container (common: the pointer leaves the list),
svelte-motion's auto-scroll speed grows quadratically with the overshoot. 200 px past the bottom edge scrolls
625 px per frame instead of the intended maximum of 25, so the list flies to its end. Upstream fixed exactly this
in Motion 14.5.0 (commit `840b3dde2`, "cap Reorder auto-scroll intensity at 1"). svelte-motion ports Reorder by
hand, so the fix has to be ported too.

## Current state

- `src/lib/components/Reorder/autoScroll.ts:18-19`: `const threshold = 50`, `const maxSpeed = 25`.
- `src/lib/components/Reorder/autoScroll.ts:91-119`:
  ```ts
  /**
   * Quadratic ease into `maxSpeed` as the pointer approaches the edge:
   * zero at `threshold` px away, full speed at the edge itself.
   */
  const getScrollAmount = (...) => {
      ...
      const distanceFromStart = pointerPosition - start
      const distanceFromEnd = end - pointerPosition

      if (distanceFromStart < threshold) {
          const intensity = 1 - distanceFromStart / threshold
          return { amount: -maxSpeed * intensity * intensity, edge: 'start' }
      } else if (distanceFromEnd < threshold) {
          const intensity = 1 - distanceFromEnd / threshold
          return { amount: maxSpeed * intensity * intensity, edge: 'end' }
      }
      return { amount: 0, edge: null }
  }
  ```
  A pointer past the edge makes `distanceFrom*` negative, so `intensity > 1`.
- Upstream (`~/Github/motion` @ `v14.5.0`, `packages/framer-motion/src/components/Reorder/utils/auto-scroll.ts`):
  ```ts
  /**
   * Speed ramps up towards the edge and is capped at maxSpeed once the
   * pointer reaches or passes it.
   */
  function scrollSpeed(distanceFromEdge: number): number {
      const intensity = Math.min(1, 1 - distanceFromEdge / threshold)
      return maxSpeed * intensity * intensity
  }
  ```
  Upstream tests: `packages/framer-motion/src/components/Reorder/utils/__tests__/auto-scroll.test.ts` (6.25 at
  25 px from the edge, 23.04 at 2 px, exactly 25 beyond the edge).
- The other half of `840b3dde2` (PanSession window-scroll double count) is NOT part of this plan. svelte-motion's
  pan code differs and is handled by the drag-adoption spike (plan 006).
- Test exemplar: `src/lib/components/Reorder/autoScroll.spec.ts`. Its `makeScrollableList()` stubs a 200 px tall
  scroller (`scrollHeight` 600, `getBoundingClientRect` top 0 / bottom 200).

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Unit file | `pnpm exec vitest run src/lib/components/Reorder/autoScroll.spec.ts` | see steps |
| Unit suite | `pnpm test:only` | all pass |
| Typecheck | `pnpm check` | 0 errors |
| Lint | `trunk fmt <files>` then `trunk check <files>` | clean |
| e2e | `pnpm exec playwright test e2e/reorder` | all pass (port 4198 rule: if occupied, STOP and ask; never kill) |

## Scope

**In scope**: `src/lib/components/Reorder/autoScroll.ts`, `src/lib/components/Reorder/autoScroll.spec.ts`,
`.changeset/reorder-auto-scroll-cap.md` (create, `patch`).

**Out of scope**: `src/lib/utils/pan.ts`, `src/lib/utils/drag.ts`, `Item.svelte`, `Group.svelte`.

## Git workflow

Branch `feat/motion-14.5.0`. Commits `test(reorder): pin auto-scroll speed cap` and
`fix(reorder): cap auto-scroll speed past the edge (Motion 14.5.0)`, ending with
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.

## Steps

### Step 1: Failing tests

Add a `describe('scroll speed', …)` block to `autoScroll.spec.ts`. Use a scroller stubbed like
`makeScrollableList()`, but with `scrollHeight` 5000 so the forward-scroll limit never interferes. Start each case
at `scrollTop = 1000` so a start-edge scroll is not clamped at 0. Cases:

- pointer at `bottom - 25` (175), velocity `5` → `scrollTop` grows by `6.25` (`toBeCloseTo`)
- pointer at `bottom - 2` (198) → grows by `23.04` (`toBeCloseTo(23.04, 2)`)
- pointer at `bottom + 200` (400) → grows by exactly `25`
- pointer at `top - 100` (-100), velocity `-5` → shrinks by exactly `25`

Call `resetAutoScrollState()` between cases (the existing `afterEach` does). jsdom stores `scrollTop` as assigned;
if it turns out to clamp or ignore assignment, STOP and report.

**Verify**: `pnpm exec vitest run src/lib/components/Reorder/autoScroll.spec.ts` → the two past-the-edge cases
FAIL (625 and 225 instead of 25); the first two pass.

### Step 2: Port `scrollSpeed`

Add a `scrollSpeed(distanceFromEdge: number): number` helper with upstream's body and JSDoc (cite
`framer-motion Reorder/utils/auto-scroll.ts @ v14.5.0`). Use it on both edges:
`amount: -scrollSpeed(distanceFromStart)` and `amount: scrollSpeed(distanceFromEnd)`. Update the
`getScrollAmount` comment to say the speed is capped at the edge.

**Verify**: the Step 1 tests and all existing tests in the file pass.

### Step 3: Gates and changeset

`.changeset/reorder-auto-scroll-cap.md` (`patch`): "`Reorder`: auto-scroll no longer speeds up past `maxSpeed`
when the pointer is dragged beyond the container edge (Motion 14.5.0)."

**Verify**: `pnpm test:only`, `pnpm check`, `trunk check`, `pnpm exec playwright test e2e/reorder` → all pass.

## Test plan

Red anchor: the two beyond-the-edge cases fail with uncapped amounts and pass after Step 2. The near-edge cases pin
the unchanged ramp, using upstream's values.

## Done criteria

- [ ] `grep -n "Math.min(1" src/lib/components/Reorder/autoScroll.ts` → one match
- [ ] Unit file passes, including 4 new cases; `pnpm test:only` passes
- [ ] `pnpm check` 0 errors; `trunk check` clean; `e2e/reorder` passes
- [ ] Only in-scope files changed; README row updated

## STOP conditions

- The beyond-the-edge tests pass before the fix.
- jsdom doesn't keep assigned `scrollTop` values.
- An `e2e/reorder` spec fails after the fix (report it; do not adjust it).

## Maintenance notes

If plan 006 (drag adoption) proceeds, Reorder keeps this file: upstream's Reorder auto-scroll lives in
framer-motion, not in motion-dom, so it is never shared with the pin.
