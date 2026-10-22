# Plan 002: Delete the legacy drag stack now that Motion's controller drives `drag`

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the
> expected result before moving on. If anything in "STOP conditions" occurs, stop and report. Do not improvise.
> When done, update this plan's row in `.agents/.plans/upstream-drag/README.md`, unless a reviewer dispatched you and
> told you they maintain the index.
>
> **Never use `git stash`.** Prefix every Playwright command with this lane's `PW_PORT`. Never touch port 4198.
>
> **Drift check (run first)**: confirm plan 001 is committed: `grep -n "attachDrag" src/lib/html/_MotionContainer.svelte`
> → no matches, and `git log --oneline -5` shows its commits. Otherwise STOP.
>
> **Revision (2026-10-22, guard, after plan 001 landed)**: 001 left two known-red items that this plan owns:
>
> - 5 unit tests in `src/lib/utils/drag.spec.ts` (they drive the removed `_bind` hook). Step 2 deletes that file.
> - `e2e/drag/vanilla.spec.ts` "guard: drag() skips a motion.div that already drags".
>
> The vanilla case fails for two reasons. Step 1 fixes the stale `svelteMotionDragElements` guard. The case also
> asserts `not.toHaveAttribute('draggable', 'false')` (line ~94), which contradicts upstream's default drag styles
> that 001 adopted: a `motion.div` with `drag` now carries `draggable="false"` itself. Step 1 replaces that assertion.
> The guard is proven by the ~100 px (not ~200 px) movement and by `data-skipped`, not by the attribute. Step 3's
> gate must show 0 unit failures and 0 e2e failures.
>
> 001 also already removed `_MotionContainer.svelte`'s `commitDraggedLayoutChange` wrapper and its three call sites.
> Step 2 therefore only removes `MotionDomProjectionAdapter.commitDraggedLayoutChange` and the spike comment next to
> it in `motionDomProjection.ts`.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (deletion; the gate catches anything still referencing it)
- **Depends on**: 001
- **Category**: tech-debt
- **Planned at**: commit `20ca271c` (+ plan 001), 2026-10-21

## Why this matters

After plan 001, `motion.*` drag runs on motion-dom's `VisualElementDragControls`, and svelte-motion's own drag code
is dead weight. That is about 2.0k lines of library code and about 1.8k lines of unit tests: `drag.ts` (1722),
`dragInertia.ts` (166), `dragMath.ts` (84), `dragParams.ts` (54), plus `drag.spec.ts` (1617),
`dragInertia.spec.ts` (135), `dragMath.spec.ts` (33) and `dragParams.spec.ts` (37). Leaving it in place invites
someone to "fix" drag in the wrong file. Two things still reference it: the vanilla `drag()` guard and the
dragged-layout commit path.

## Current state (after plan 001)

- `src/lib/utils/vanillaDrag.ts:1` imports `svelteMotionDragElements` from `$lib/utils/drag`. It filters out
  elements that a `motion.*` component already drags, so upstream's `drag()` never attaches a second controller.
- `src/lib/utils/drag.ts` imports `dragInertia`, `dragMath`, `dragParams` and `attachPan` from `pan.ts`. Keep
  `pan.ts`: the pan gesture still uses it until plan 003.
- `src/lib/utils/motionDomProjection.ts`: `commitDraggedLayoutChange` (around line 995). It was called from
  `_MotionContainer.svelte`'s `commitDraggedLayoutChange` (around line 2482, used at ~2558 and ~2772) for the
  legacy drag's layout shifts. The upstream controller handles those with its own projection `didUpdate` listener.
  `stripToBaseTransforms` is also used by `refreshLayout` and `measurePageRect` (lines ~642 and ~702), so keep it.
- `.changeset/` holds `drag-origin-resize.md` and `live-drag-constraint-observer.md`, which pinned behaviors plan 001
  replaced with upstream's. Don't delete changesets: they are release records.

## Scope

**In scope**: `e2e/drag/vanilla.spec.ts` (case d's attribute assertion only); delete `src/lib/utils/{drag,dragInertia,dragMath,dragParams}.ts` and their `*.spec.ts`; change
`src/lib/utils/vanillaDrag.ts` (+ its spec), `src/lib/html/_MotionContainer.svelte` (dead dragged-layout path),
`src/lib/utils/motionDomProjection.ts` (`commitDraggedLayoutChange` only), and anything else the typecheck shows
still importing the deleted files.

**Out of scope**: `pan.ts`/`pan.spec.ts` (plan 003), behavior changes.

## Git workflow

Same branch `feat/upstream-drag`. Commit message: `refactor(drag): remove the legacy drag stack`, ending with
`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Steps

### Step 1: Re-point the vanilla `drag()` guard

In `vanillaDrag.ts`, replace the `svelteMotionDragElements` check with an upstream-state check: an element is
"already dragged by `motion.*`" when `visualElementStore.get(element)` has a registered drag controller,
`elementDragControls.has(visualElement)` (both exported from `motion-dom`). This also removes the timing limit
documented in its JSDoc ("before the element is ready"). Update that JSDoc and the unit spec, which should now
seed the guard by mounting a VisualElement with `drag`, or by setting `elementDragControls` directly. In
`e2e/drag/vanilla.spec.ts` case (d), drop the `not.toHaveAttribute('draggable', 'false')` line (see Revision). If a
replacement is needed, assert `draggable="false"` is present, since the `motion.div`'s own upstream controller sets it.

**Verify**: `pnpm exec vitest run src/lib/utils/vanillaDrag.spec.ts` → pass; `PW_PORT=<lane> pnpm exec playwright test e2e/drag/vanilla.spec.ts` → pass (case d still moves ~100 px, not 200).

### Step 2: Delete the legacy files

`git rm` the four modules and their four specs. Remove `_MotionContainer.svelte`'s `commitDraggedLayoutChange`
and its call sites if they are reachable only from legacy drag (they were gated on `teardownDrag`/the marker, which
plan 001 removed). Then remove `MotionDomProjectionAdapter.commitDraggedLayoutChange` if nothing calls it. Follow
the typecheck: if a remaining caller is not drag-only, keep it and report it.

**Verify**: `pnpm check` → 0 errors; `grep -rn "utils/drag'\|dragInertia\|dragMath\|dragParams\|commitDraggedLayoutChange" src` → no matches (except `vanillaDrag`).

### Step 3: Gate

**Verify**: `pnpm build` (exit 0), `pnpm test:only` (all pass), `PW_PORT=<lane> pnpm test:e2e` (0 failures after
solo re-runs), `trunk check` (clean).

## Test plan

Pure deletion, so there is no new red test. The full unit and e2e suites (with plan 001's rewritten specs) are the
net. The vanilla `drag()` guard keeps its e2e case (d).

## Done criteria

- [ ] The four modules and four specs are gone; `pnpm check` 0 errors
- [ ] The vanilla guard uses `elementDragControls`; its unit and e2e specs pass
- [ ] Full gate green; README row updated

## STOP conditions

- A non-drag module still needs something from `drag.ts`/`dragMath.ts` (report what; do not move code around).
- Removing `commitDraggedLayoutChange` changes any `e2e/layout*` or `e2e/reorder` result.

## Maintenance notes

`src/lib/utils/` no longer has drag logic. New drag work goes to `DragGestureFeature` (`visualElementCore.ts`) or
upstream.
