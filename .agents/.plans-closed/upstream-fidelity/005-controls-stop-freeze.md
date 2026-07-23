# Plan 005: controls.stop() freezes at the current value instead of reverting to the last completed target

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-fidelity/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6746859..HEAD -- src/lib/html/_MotionContainer.svelte src/routes/tests/animation-controls/ e2e/utilities/animation-controls.spec.ts`
> On any in-scope drift, compare excerpts before proceeding; mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6746859`, 2026-07-22

## Why this matters

Upstream framer-motion's `controls.stop()` stops each motion value at its instantaneous current value and keeps it there indefinitely (`framer-motion/src/animation/hooks/animation-controls.ts` → `stopAnimation(visualElement)` → per-value `value.stop()`). Our port's `stop()` calls `animation.commitStyles()` (freezing the DOM correctly at the mid-flight value) but never records that frozen value in the component's reactive state: `enterAnimationSettled` stays `false` (the interrupted `start()` set it false and its completion handler is generation-guarded out), and `lastAnimationControlsTarget` still holds the _previous completed_ target. The next reactive style flush (any style-affecting prop/state change) rewrites the element's inline style from that stale state — visibly snapping the element back to the pre-stop target, or to base styles if no start ever completed. Upstream never moves it again.

## Current state

- `src/lib/html/_MotionContainer.svelte` — all controls logic.

`stopAnimationControlsAnimations` (`:1246-1276`, verbatim, abridged tail):

```ts
    const stopAnimationControlsAnimations = () => {
        animationControlsHasReceivedCommand = true
        animationControlsGeneration += 1
        cleanupTemplatedTransformAnimations()
        for (const control of activeAnimationControls) { ...stop/cancel... }
        activeAnimationControls.clear()
        if (!element) return
        if (typeof element.getAnimations !== 'function') return
        for (const animation of element.getAnimations()) {
            try { animation.commitStyles?.() } catch { /* ignore */ }
            animation.cancel()
        }
    }
```

`startAnimationControlsDefinition` (`:1278-1351`): sets `enterAnimationSettled = false` (`:1314`), bumps/captures `controlsGeneration` (`:1313`), and on natural completion runs `applyAnimationControlsTarget(definition)` (`:1349`) — which merges the resolved target into `lastAnimationControlsTarget` and sets `enterAnimationSettled = true` (`:1239-1243`). After `stop()`, the generation check at `:1348` (`if (controlsGeneration !== animationControlsGeneration) return`) prevents that apply — correct for not applying the TARGET, but nothing applies the FROZEN value either.

`renderedInlineStyle` ternary (`:1447-1465`): with `enterAnimationSettled === false` and `animationControlsHasReceivedCommand === true`, the style slot resolves to `lastAnimationControlsTarget` (`:1459-1460`) — the stale previous target. `renderedInlineStyle` feeds the element's rendered `style`, so the stale value lands on the next flush that recomputes it.

Test infrastructure that already exists (reuse, do not rebuild): `src/routes/tests/animation-controls/+page.svelte` (beam element, `beamVariants` idle `scaleX 0.16` / launch `1` / success `0.66`) and `e2e/utilities/animation-controls.spec.ts` (reads `scaleX` from computed transform; the "non-neutral hold" test added recently is the structural model for the new test).

## Commands you will need

| Purpose       | Command                                                                                                                                        | Expected on success |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck     | `pnpm check`                                                                                                                                   | exit 0              |
| Unit tests    | `pnpm vitest run`                                                                                                                              | all pass            |
| E2e           | `PW_REUSE_SERVER=1 npx playwright test e2e/utilities/animation-controls.spec.ts --reporter=line` if 4198 has a listener, else drop the env var | pass                |
| Format / Lint | `trunk fmt <files>` / `trunk check <files>`                                                                                                    | clean               |

**NEVER kill any process listening on port 4198.**

## Scope

**In scope**:

- `src/lib/html/_MotionContainer.svelte` (only `stopAnimationControlsAnimations` and, if needed, a small helper near it)
- `src/routes/tests/animation-controls/+page.svelte` (add a stop-mid-flight control/button)
- `e2e/utilities/animation-controls.spec.ts` (add the red test)

**Out of scope**:

- `applyAnimationControlsTarget`, `startAnimationControlsDefinition`, and the `renderedInlineStyle` ternary itself — the fix is to make `stop()` write correct state INTO the existing mechanism, not to change the mechanism.
- `useAnimationControls`/`useAnimate` public API files.
- Plan 006's detach/re-attach flag lifecycle.

## Git workflow

- Current branch; `test(controls): …` red commit then `fix(controls): …`. Do NOT push.

## Steps

### Step 1: Failing e2e — stop mid-flight, then force a reactive flush

Extend `src/routes/tests/animation-controls/+page.svelte` with a "stop" button wired to `controls.stop()`, and a benign reactive style poke (e.g. a button toggling a `$state`-bound unrelated style like `outline-color` on the same motion element) to force a `renderedInlineStyle` recompute after stop.

New test in `e2e/utilities/animation-controls.spec.ts` (model on the existing non-neutral-hold test's transform reading):

1. Trigger a slow start (add a long-duration variant to the page, e.g. `launchSlow` with `transition: { duration: 2 }`, or reuse `launch` with an explicit long transition).
2. Wait ~500ms (mid-flight), click stop.
3. Read `scaleX` → expect a mid value strictly between the endpoints; record it.
4. Click the reactive-poke button; wait 100ms.
5. Read `scaleX` again → assert within 0.02 of the recorded mid value.

Current code: step 5 snaps to the previous completed target (or base) — the assertion fails.

**Verify**: `PW_REUSE_SERVER=1 npx playwright test e2e/utilities/animation-controls.spec.ts --reporter=line -g "stop"` → new test FAILS at step 5's assertion.

### Step 2: Snapshot the frozen value into settle state

In `stopAnimationControlsAnimations`, after the `commitStyles()` loop: read the element's now-committed inline style and fold the animatable channels back into `lastAnimationControlsTarget`, then set `enterAnimationSettled = true`. Implementation guidance:

- `commitStyles()` writes the frozen values into the element's inline `style` attribute — parse the frozen `transform` via the codebase's existing transform-reading utilities (`readTransformScale` in `src/lib/utils/hover.ts`; plan 002 may have added `readTransformChannels` — use it if present) plus `opacity` from `getComputedStyle`.
- Merge ONLY keys that were being animated: the keys of the in-flight definition are not stored today — store them: capture `Object.keys(payload)` into a module-level `activeAnimationControlsKeys: Set<string>` in `startAnimationControlsDefinition`, cleared on natural completion; `stop()` reads it to know which channels to snapshot. This keeps unrelated keys out of `lastAnimationControlsTarget`.
- Guard: if `activeAnimationControlsKeys` is empty (stop with nothing in flight), leave state untouched (today's behavior for idle stop must not change: `enterAnimationSettled` must NOT be forced true when nothing ran — check the existing idle-stop behavior in the spec run before asserting).

**Verify**: the Step 1 test PASSES; the pre-existing animation-controls tests in the same spec still pass.

### Step 3: Full gate

`pnpm check` → 0. `pnpm vitest run` → pass. `PW_REUSE_SERVER=1 npx playwright test e2e/utilities/animation-controls.spec.ts --reporter=line` (full file) → all pass. `trunk fmt`/`trunk check` on touched files → clean.

## Test plan

- Red anchor: mid-flight stop + reactive poke snaps today; holds within 0.02 after.
- Also add (same spec): stop with NO prior completed start (first-ever start interrupted) — element must hold mid value, not revert to base; and stop when idle — no state change (guards Step 2's empty-keys branch).
- Model: the existing beam `scaleX` assertions in `e2e/utilities/animation-controls.spec.ts`.

## Done criteria

- [ ] `pnpm check` exits 0; `pnpm vitest run` exits 0
- [ ] All three new e2e cases pass (mid-flight stop after completed start; first-start stop; idle stop)
- [ ] Existing animation-controls spec fully green
- [ ] No out-of-scope files modified; README row updated

## STOP conditions

- `commitStyles()` turns out not to write the frozen transform into inline style in headless Chromium (verify with a `page.evaluate` read in Step 1 — if the frozen value isn't in the style attribute, the snapshot source must be `getComputedStyle` BEFORE `animation.cancel()`, which changes Step 2's ordering; report if neither yields the mid value).
- The templated-transform path (`transformTemplateProp` set) makes channel parsing infeasible — leave that path as-is with a comment and report (it routes through MotionValues, not `getAnimations()`).
- Any pre-existing test in the spec regresses twice.

## Maintenance notes

- Plan 006 (detach-reset) touches the SAME flags (`animationControlsHasReceivedCommand`, `lastAnimationControlsTarget`) in a different lifecycle moment; execute sequentially and re-run this plan's tests after 006.
- Reviewer: the generation guard at `:1348` must continue to prevent the interrupted start's `applyAnimationControlsTarget` — the new snapshot is the ONLY writer after stop.
