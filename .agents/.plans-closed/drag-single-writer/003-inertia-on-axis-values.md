# Plan 003: Inertia and no-momentum settle retargeted onto the axis values

> **Executor instructions**: Follow this plan step by step, verify each
> step, honor STOP conditions, update the README status row when done.
> Required prior reading: plan 001 of this batch (must be DONE).
>
> **Drift check (run first)**: `git diff --stat <001-landing-SHA>..HEAD -- src/lib/utils/dragInertia.ts`
> Expect empty (001 did not touch it; 002 should not have either).

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED — release-continuity and momentum specs are the hard bar
- **Depends on**: 001-axis-writer-through-ve.md (DONE); independent of 002
- **Category**: tech-debt (re-scope of visual-element-core 005 Step 4; #449 follow-up)
- **Planned at**: `04418be` (re-stamped: `bb99032` was squashed away by PRs #454/#457; drag-surface files verified byte-identical to `7eba0bd`; container line references may have shifted with #457's svgEffect removal — locate by grep), 2026-07-25

## Why this matters

After plan 001, inertia still drives a DETACHED value and pipes it through
`setXYImmediate` per frame (`onUpdate → latest → setXYImmediate`). Upstream
animates the axis MotionValues DIRECTLY (`startAnimation` with
`type: 'inertia'` on the same values drag wrote), which is what preserves
velocity continuity structurally: the release animation retargets the value
the pointer was just writing, so `setWithVelocity` state carries over with
no hand-off code. This plan removes the indirection; the per-frame
`setXYImmediate` calls from inertia/settle disappear.

## Current state

(`drag.ts`/`dragInertia.ts` at `7eba0bd` semantics, with 001's writer swap
inside `setXYImmediate`.)

- **Momentum**: `drag.ts:1136-1330` — `startDragInertia` per axis (`:1248`,
  `:1274`) with `onUpdate → latestX/Y; renderLatest() → setXYImmediate`
  (`:1205-1218`); boundary clamp/re-write in `completeAxis` (`:1220-1245`);
  `stopInertia` freezes at latest (`:1310-1327`).
- **No-momentum settle**: `drag.ts:1330-1500` — same writer path with
  `deriveBoundaryPhysics` springs.
- **The helper**: `src/lib/utils/dragInertia.ts:105` `startDragInertia` →
  motion's `animateValue` with `inertia`; `:135`
  `createDragInertiaGenerator` (test sampling — keep, `drag.spec.ts` uses it).
- **Upstream**: `VisualElementDragControls.startAnimation` region — per
  axis, `animateMotionValue(axis, value, target, { type: 'inertia',
velocity, bounceStiffness, bounceDamping, min, max, … })`. The value's
  own animation handle means `value.stop()` freezes correctly (the
  accelerated-freeze machinery from the #449 batch applies).
- **Constraint from the ledger**: freezes go through per-channel
  `value.stop()`; do not hand-roll sampling.

## Commands you will need

| Purpose     | Command                              | Expected      |
| ----------- | ------------------------------------ | ------------- |
| Typecheck   | `pnpm check`                         | 0 errors      |
| Unit        | `pnpm test:only`                     | all pass      |
| Gate        | `pnpm test:e2e e2e/drag e2e/reorder` | all pass      |
| Format/lint | `trunk fmt` / `trunk check`          | no new issues |

## Scope

**In scope**: `src/lib/utils/drag.ts` (inertia/settle call paths),
`src/lib/utils/dragInertia.ts`, `src/lib/utils/dragInertia.spec.ts`,
`src/lib/utils/drag.spec.ts`, batch README.

**Out of scope**: `pan.ts`, `layout.ts`, the container, `gestures.ts`,
`dragMath.ts`/`dragParams.ts` (pure math — reuse).

## Steps

### Step 1: Baseline

`pnpm test:e2e e2e/drag e2e/reorder` + `pnpm test:only`; read the momentum,
release-continuity (`stale-velocity`, `settle-cancel`,
`controls-cancel-inertia`) and `snap-to-origin` specs fully first.

**Verify**: green, counts recorded.

### Step 2: Animate the axis values directly

Retarget `startDragInertia` (and the no-momentum settle) onto the axis
MotionValues from plan 001 (`node.getValue('x'|'y')`): the animation drives
the value, the value drives the VE render — delete the `onUpdate →
setXYImmediate` piping and `renderLatest`. Boundary clamp (`completeAxis`)
operates on the values. `stopInertia` becomes per-channel `value.stop()`.
Keep `createDragInertiaGenerator` for the unit-test sampling contract.

**Verify**: `pnpm test:e2e e2e/drag` → all pass, momentum + continuity
specs first-class.

### Step 3: Full gate

`trunk fmt` → `trunk check` → `pnpm check` → `pnpm test:only` →
`pnpm test:e2e e2e/drag e2e/reorder`.

**Verify**: matches baseline.

## Test plan

- No red-first test: behavior-preserving; the momentum/continuity specs
  are the pin. Unit specs re-pointed where they held the piping mechanics.

## Done criteria

- [ ] Gate + unit + typecheck green, matching baseline
- [ ] `grep -n "renderLatest\|setXYImmediate" src/lib/utils/drag.ts` shows
      `setXYImmediate` no longer called from inertia/settle paths (remaining
      callers: pointer-move, origin adjust, constraints — enumerate in NOTES)
- [ ] `stopInertia` uses per-channel `value.stop()`
- [ ] README status row updated

## STOP conditions

- Drift; any momentum/continuity regression after two attempts (BLOCKED
  beats regression); the boundary-physics math needing changes beyond
  call-site retargeting (the math is signed-off — report instead).

## Maintenance notes

- After this plan `setXYImmediate` should have few callers left — plan 005
  or a later cleanup may inline it. Reviewer: velocity continuity at
  release and boundary bounce behavior are the scrutiny points.
