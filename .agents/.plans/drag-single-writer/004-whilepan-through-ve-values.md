# Plan 004: whilePan animates VE values (extension semantics, no animationState fork)

> **Executor instructions**: Follow this plan step by step, verify each
> step, honor STOP conditions, update the README status row when done.
> Required prior reading: plan 001 (DONE) and the batch README's rejected
> finding on mapping whilePan to the whileDrag type.
>
> **Drift check (run first)**: `git diff --stat 7eba0bd..HEAD -- src/lib/utils/pan.ts`
> Expect empty — `pan.ts` has survived every batch untouched.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: MED — whilePan is a svelte-motion extension with its own specs;
  no upstream reference exists for the variant half
- **Depends on**: 001-axis-writer-through-ve.md (DONE)
- **Category**: tech-debt (the second blocker from the archived 005: whilePan
  is a distinct writer; #449 follow-up)
- **Planned at**: commit `bb99032`, 2026-07-25

## Why this matters

`whilePan` is svelte-motion's own extension (upstream has `onPan` callbacks
but NO whilePan variant type — `variantPriorityOrder` has no such slot).
Its animation half still runs on the legacy pattern the #449 batch deleted
everywhere else: `hover.ts` baseline helpers + the container's
`liveGestureTransform` channel + direct element animation. It cannot ride
`animationState.setActive` without forking motion-dom's fixed type list —
so it gets EXTENSION SEMANTICS: animate the VisualElement's MotionValues
via `animateTarget` (single-writer compliant, velocity-continuous), with
priority interplay documented rather than resolver-enforced. This also
unblocks finally deleting `hover.ts`'s helper remainder and the
`liveGestureTransform` splice if plan 002 left it for us.

## Current state

- `src/lib/utils/pan.ts:285` `attachPan` — gesture recognition only, no
  writes; the container wires handlers at `_MotionContainer.svelte`
  (search `attachPan` — the wiring moved across the #449 batch; locate by
  grep, not line number).
- The container's whilePan path pre-resolves `resolvedWhilePan` and
  animates via `hover.ts` helpers (`computeHoverBaseline`,
  `splitHoverDefinition`, `readTransformChannels`) plus the
  `liveGestureTransform` channel — grep `whilePan` in the container for
  the current sites; the gestures-batch close-out (archived 003 guard
  report) lists the dependency set.
- motion-dom exports `animateTarget(visualElement, definition, options)` —
  the same engine `animateVisualElement` uses under variants; it resolves
  keyframes from current values (velocity continuity) and returns playback
  controls. This is the sanctioned way to animate a target on a node
  outside the animationState's types.
- Priority reality to preserve BY CONSTRUCTION (not by resolver): pan and
  drag are mutually exclusive gestures on an element in practice (drag
  consumes the pointer session); whileHover/whileTap interplay with
  whilePan is currently whatever the legacy writer did — pin the CURRENT
  behavior with the existing `e2e` pan specs, do not invent new semantics.

## Commands you will need

| Purpose     | Command                             | Expected                                                                                                          |
| ----------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Typecheck   | `pnpm check`                        | 0 errors                                                                                                          |
| Unit        | `pnpm test:only`                    | all pass                                                                                                          |
| Gate        | `pnpm test:e2e e2e/motion e2e/drag` | all pass (pan specs live in e2e/motion — grep `whilePan\|pan` under e2e/ first and include every suite that hits) |
| Format/lint | `trunk fmt` / `trunk check`         | no new issues                                                                                                     |

## Scope

**In scope**: the container's whilePan animation path, `pan.ts` ONLY if the
attach signature must carry the node handle, `hover.ts` (deletion of
helpers whose last caller goes — grep first), the `liveGestureTransform`
channel if this plan removes its final writer, colocated specs, batch README.

**Out of scope**: `dragInertia.ts`, `layout.ts`, animationState/
`visualElementCore.ts` (NO new animation types — the batch README's
rejected finding is binding), public `onPan*` callback API.

## Steps

### Step 1: Baseline + map

Grep every `whilePan` site (container, e2e specs, test routes); run the
covering suites and record counts. Read the specs to learn the pinned
interplay behavior.

**Verify**: green; the site map and spec list in your notes.

### Step 2: Swap the writer

Route whilePan start/end through `animateTarget(node, resolvedDefinition)`
/ a restore `animateTarget` to the pre-pan targets (the node's `baseTarget`
per key — motion-dom's `getBaseTarget` — NOT a computed-style snapshot).
Delete the `hover.ts`-helper usage and the `liveGestureTransform` writes on
this path. Then grep `computeHoverBaseline|splitHoverDefinition|readTransformChannels`
and `liveGestureTransform`: delete whatever now has zero callers
(`hover.ts` may die entirely — if so, delete its spec remainder with it and
note the coverage decision).

**Verify**: the covering suites pass; `pnpm check` clean.

### Step 3: Full gate

`trunk fmt` → `trunk check` → `pnpm check` → `pnpm test:only` → the mapped
suites + `e2e/drag e2e/reorder` (shared transform surface).

**Verify**: matches baseline.

## Test plan

- No red-first test: behavior-preserving; Step 1's mapped specs are the pin.
- If whilePan's e2e coverage turns out to be thin (<2 specs), ADD one
  pinning enter/exit-of-pan restore behavior before the swap — thin
  coverage on an extension writer is how regressions slip.

## Done criteria

- [ ] Gates green, matching baseline
- [ ] `grep -rn "liveGestureTransform" src/` → no matches (or a justified
      survivor in NOTES)
- [ ] `grep -n "animateTarget" <whilePan site>` → present
- [ ] `hover.ts` either deleted or its remaining exports each have a named
      live caller in NOTES
- [ ] README status row updated

## STOP conditions

- Drift in `pan.ts`; interplay behavior changes that existing specs pin
  (report the exact spec, do not loosen); any temptation to add a type to
  the animationState (hard boundary).

## Maintenance notes

- whilePan's priority interplay is by-construction, not resolver-enforced —
  documented here and in code comments; if upstream ever adds a pan variant
  type, revisit.
