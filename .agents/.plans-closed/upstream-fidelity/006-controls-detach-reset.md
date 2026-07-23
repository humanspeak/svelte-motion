# Plan 006: Detaching animation controls clears their settle state (last-writer-wins parity)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-fidelity/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6746859..HEAD -- src/lib/html/_MotionContainer.svelte`
> Plan 005 edits `stopAnimationControlsAnimations` in the same file; that is
> expected drift. If the flag declarations or the ternary excerpt below have
> changed beyond plan 005's scope, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 005-controls-stop-freeze.md (same flags/file; sequential execution avoids conflicts)
- **Category**: bug
- **Planned at**: commit `6746859`, 2026-07-22

## Why this matters

Upstream framer-motion is last-writer-wins per motion value: swapping `animate={controls}` → `animate={{scaleX: 1}}` → back to the same `controls` object leaves values wherever the last completed animation put them (the declarative `1`); an idle re-attached controls object resurrects nothing. Our port's `animationControlsHasReceivedCommand` (plain `let`) and `lastAnimationControlsTarget` (`$state`) are set on the first command and never cleared — so re-attaching idle controls forces `renderedInlineStyle` back to the stale imperative target (e.g. `scaleX 0.66`) even though a declarative animation legitimately moved the element since. Narrow, but a real "who wins" divergence.

## Current state

- `src/lib/html/_MotionContainer.svelte`:
    - `:943-944` — flag declarations: `let animationControlsHasReceivedCommand = ...` and `let lastAnimationControlsTarget = $state(...)`; neither is ever reset.
    - `:1447-1465` — `renderedInlineStyle` ternary: whenever `animateControls && animationControlsHasReceivedCommand`, the style slot is `lastAnimationControlsTarget` (both the settled and unsettled branches).
    - `animateControls` — derived from the `animate` prop when it is an AnimationControls object (mutually exclusive with `declarativeAnimateProp`; see `:621-622` region). When the prop swaps to a declarative object, `animateControls` becomes `undefined` and the subscription effect (search `subscribe` near `:2590-2600`, wiring `start/stop/set` handlers) tears down; when swapped back, it re-subscribes.
- Upstream reference (read-only): `~/Github/motion/packages/motion-dom/src/render/utils/animation-state.ts` (`prevProp` diffing — an unchanged/idle animation source does not re-fire) and `setters.ts` (`setTarget` writes values that simply persist).

## Commands you will need

| Purpose       | Command                                                                                                                                        | Expected on success |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck     | `pnpm check`                                                                                                                                   | exit 0              |
| E2e           | `PW_REUSE_SERVER=1 npx playwright test e2e/utilities/animation-controls.spec.ts --reporter=line` if 4198 has a listener, else drop the env var | pass                |
| Format / Lint | `trunk fmt <files>` / `trunk check <files>`                                                                                                    | clean               |

**NEVER kill any process listening on port 4198.**

## Scope

**In scope**:

- `src/lib/html/_MotionContainer.svelte` (controls attach/detach effect + flags only)
- `src/routes/tests/animation-controls/+page.svelte` (add a swap toggle)
- `e2e/utilities/animation-controls.spec.ts` (red test)

**Out of scope**:

- The ternary and `applyAnimationControlsTarget` (mechanisms stay).
- `useAnimationControls` hook file.

## Git workflow

- Current branch; `test(controls): …` then `fix(controls): …`. Do NOT push.

## Steps

### Step 1: Failing e2e — swap controls → declarative → controls

Extend `src/routes/tests/animation-controls/+page.svelte` with a toggle button that swaps the beam's `animate` prop between the existing `controls` object and the literal `{ scaleX: 1 }` (a `$state` boolean choosing which to pass). Test flow in `e2e/utilities/animation-controls.spec.ts`:

1. Click the existing button that runs `controls.start` to `scaleX 0.66`; poll until `scaleX` ≈ 0.66.
2. Toggle to declarative `{ scaleX: 1 }`; poll until `scaleX` ≈ 1.
3. Toggle back to `controls` (no new command). Wait 300ms.
4. Assert `scaleX` stays ≈ 1. Current code re-renders `lastAnimationControlsTarget` → snaps to 0.66 (red).

**Verify**: `PW_REUSE_SERVER=1 npx playwright test e2e/utilities/animation-controls.spec.ts --reporter=line -g "re-attach"` → FAILS (0.66 after step 3).

### Step 2: Clear settle state on detach

In the effect that subscribes/unsubscribes the controls object (the one wiring `start/stop/set` handlers): in its teardown (or in an `$effect` watching `animateControls` becoming `undefined`/changing identity), reset `animationControlsHasReceivedCommand = false` and `lastAnimationControlsTarget = undefined`. Detach-time only — a re-render that keeps the SAME controls object attached must NOT clear (upstream: values persist while the source is attached; guard on identity change, not on effect re-run — capture the previous controls object and compare).

**Verify**: Step 1 test PASSES; the full `animation-controls.spec.ts` file (including plan 005's tests and the pre-existing non-neutral-hold test) passes.

### Step 3: Full gate

`pnpm check` → 0. `pnpm vitest run` → pass. Full `e2e/utilities/animation-controls.spec.ts` → pass. `trunk fmt`/`trunk check` → clean.

## Test plan

- Red anchor: step-3 snap to 0.66 today; stays 1 after.
- Guard case (same spec): controls attached the whole time across an unrelated re-render (use the reactive-poke button from plan 005's page work) — imperative value must STILL hold (protects against over-eager clearing).
- Model: existing animation-controls spec structure.

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] Step 1 test + guard case pass; full spec green
- [ ] No out-of-scope files modified; README row updated

## STOP conditions

- The attach/detach wiring is not identity-observable (e.g. the subscription effect re-runs on every render with the same object) — report the actual dependency graph instead of guessing.
- Plan 005's tests regress.

## Maintenance notes

- Reviewer: the identity guard is the whole fix — clearing on every effect re-run would regress the settle-hold behavior (`e2e/utilities/animation-controls.spec.ts` non-neutral-hold test is the tripwire).
- Interaction with plan 005: stop-freeze snapshots INTO `lastAnimationControlsTarget`; detach clears it. Both behaviors are per-attachment-session, which matches upstream motion-value lifetimes bound to the VisualElement.
