# Plan 003: Wildcard and relative keyframes resolve against the live value (upstream fillWildcards parity)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-parity-next3/README.md` (unless your reviewer
> told you they maintain the index).
>
> **Drift check (run first)**: `git diff --stat 0058f78..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/utils/variants.ts`
> Plan 002 edits the same component's render ternary — expected drift; your
> targets are `startAnimationControlsDefinition`'s payload path and
> `resolveRestingValues`. If THOSE differ from the excerpts, STOP.

## Status

- **Priority**: P2
- **Effort**: S–M
- **Risk**: LOW–MED
- **Depends on**: 002 (same-file sequencing only)
- **Category**: bug (upstream parity)
- **Planned at**: commit `0058f78`, 2026-07-23

## Why this matters

Proven by plan 007's probes in the closed upstream-fidelity batch: `controls.start({ x: [0, null] })` from `x=64` lands at **0** — the WAAPI layer drops the channel within one frame — where upstream resolves the `null` wildcard to the value at animation start (64) and animates 0→64. Upstream does this in its keyframe pipeline (`fillWildcards`, exported by motion-dom we already ship; relative `"+=50"` strings resolve against the current value in `resolveFinalValueInKeyframes` / the keyframe resolver). Our port hands raw arrays to `animate()` unresolved. Wildcards are a documented framer-motion feature (`null` = "current value" — motion.dev keyframes docs); consumers migrating from React hit silent wrong-landing animations.

## Current state

- `src/lib/html/_MotionContainer.svelte` — `startAnimationControlsDefinition` (`:1412+`): builds `payload` from the resolved definition (`filterReducedMotionKeyframes` → strip transition/transitionEnd → `transformSVGPathProperties`) and passes it to `animate(element, payload as DOMKeyframesDefinition, transitionAnimate)`. No wildcard/relative resolution anywhere on the path. The declarative animate pipeline in the same file feeds `animate()` similarly (locate via `grep -n "animate(element" src/lib/html/_MotionContainer.svelte` — bring every element-level call site into the sweep, controls AND declarative).
- `src/lib/utils/variants.ts` — `resolveRestingValues` (`:274-289`): `value[value.length - 1]` verbatim; a trailing `null` is stored as `null` (settle side). Its CURRENT verbatim behavior is deliberately pinned by `src/lib/utils/variants.spec.ts` ("plan-007 pinning" block: `{x:[0,null]} → {x:null}`, `{x:['+=50']} → {x:'+=50'}`) — those pins exist so THIS change is deliberate: you will UPDATE them to the new contract as part of the red step.
- motion-dom (installed): **`fillWildcards`** is exported (verify signature in `node_modules/motion-dom/dist/index.d.ts`); upstream source `~/Github/motion/packages/motion-dom` (search `fillWildcards` and `resolveFinalValueInKeyframes` in `render/utils/setters.ts`).
- Reading the live value: for transform channels use the shared readers (`readTransformChannels` in `src/lib/utils/hover.ts`); non-transform via `getComputedStyle`. If plan 001 landed first, the gesture MotionValues are the preferred source for channels they own.

## Commands you will need

| Purpose       | Command                                                                                                    | Expected on success |
| ------------- | ---------------------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck     | `pnpm check`                                                                                               | exit 0              |
| Unit tests    | `pnpm vitest run src/lib/utils`                                                                            | all pass            |
| E2e           | `npx playwright test e2e/utilities/animation-controls.spec.ts <new spec> --reporter=line` on your own port | pass                |
| Format / Lint | `trunk fmt <files>` / `trunk check <files>`                                                                | clean               |

**NEVER kill or reuse anything on port 4198.** Local uncommitted playwright port edit; kill only YOUR port's stale listener.

## Scope

**In scope**:

- `src/lib/html/_MotionContainer.svelte` (a `resolveWildcardKeyframes(el, payload)` pass before element-level `animate()` calls — extract the helper into `src/lib/utils/variants.ts` or a sibling util so it is unit-testable)
- `src/lib/utils/variants.ts` (+ `variants.spec.ts` — update the plan-007 pins deliberately)
- `src/routes/tests/animation-controls/+page.svelte` (wire probe buttons: wildcard + relative)
- `e2e/utilities/wildcard-keyframes.spec.ts` (create)

**Out of scope**:

- Gesture systems (hover/tap composed writer — wildcards in `whileHover` arrays remain the fidelity batch's documented numeric-only bound).
- `resolveRestingValues`' non-array behavior.

## Git workflow

- Branch per operator instruction; `test(...)` red commit then `fix(...)`. Do NOT push.

## Steps

### Step 1: Failing e2e reproducing plan 007's probe

Add two buttons to the animation-controls page: `probe-wildcard` → `controls.start({ x: [0, null], transition: { duration: 0.3 } })`, `probe-relative` → `controls.start({ x: '+=50' })` (the card element, idle x=0; `start-slow` first gives a non-zero baseline x=64 — reuse that choreography from 007's report). Spec `e2e/utilities/wildcard-keyframes.spec.ts` (reuse `readCardX`):

1. `start-slow`, wait for x≈64 settle.
2. `probe-wildcard`; after the 300ms run + settle, assert `x ≈ 64 ± 2` (upstream: `[0, null]` → animates 0→64, lands at start value). Current code lands at 0 → red.
3. Fresh load; `probe-relative` from x=0; assert settle `x ≈ 50 ± 2`. Current: probe-007 observed no transform at all → red.

**Verify**: both assertions FAIL on unfixed code with the 007-documented landings (0 / none). Commit `test(controls): …` together with the UPDATED variants pins (red commit may carry the new pin expectations marked `.fails`? No — vitest has no fails-marker convention here: keep pins unchanged in the red commit; update them in the fix commit and say so in its body).

### Step 2: Resolve wildcards/relatives before the animation layer

New exported helper (unit-testable): for each payload key whose value is an array containing `null`/`undefined` or whose value is a relative string (`/^[-+]=/`), resolve against the element's live value at call time (prefer motion-dom's `fillWildcards` for arrays — read its signature first; hand-roll only the relative-string arithmetic, citing upstream `setters.ts`). Wire it into every element-level `animate()` call site found in the Current-state grep (controls start, declarative animate, reduced-motion variants if they share the path). Then update `resolveRestingValues` so the SETTLE side matches: trailing `null` resolves to the previous concrete element or is omitted; relative strings resolve numerically when a live value was captured — keep it pure by resolving wildcards BEFORE resting-value collapse (the helper output feeds both). Update the plan-007 pinning tests to the new contract with a comment referencing this plan.

**Verify**: Step 1 spec PASSES; `pnpm vitest run src/lib/utils` green with updated pins.

### Step 3: Full gate

`pnpm check` → 0. `pnpm vitest run` → pass. `e2e/utilities/animation-controls.spec.ts` (all 13+ tests incl. plans 005/006/002 work) + new spec → green ×2. `trunk fmt`/`trunk check` → clean.

## Test plan

- Red anchor: wildcard lands at 0 / relative inert today; 64 / 50 after.
- Unit: helper matrix — `[0,null]` with live 64 → `[0,64]`; `[null,100]` → `[64,100]`; `'+=50'` from 64 → `114`; `'-=10'`; non-numeric live value → passthrough unchanged (STOP-adjacent: document); plain arrays untouched.
- Declarative path smoke: `animate={{ x: [0, null] }}` page case if a test page exists; else unit-only with a note.

## Done criteria

- [ ] `pnpm check` 0 errors; `pnpm vitest run src/lib/utils` green (pins updated deliberately)
- [ ] Step 1 spec exists, failed at plan time with 007's landings, passes ×2
- [ ] Full controls spec green ×2
- [ ] `grep -n "fillWildcards\|resolveWildcard" src/lib/` shows the helper wired at every element-level animate() site
- [ ] No out-of-scope files modified; README row updated

## STOP conditions

- `fillWildcards`' runtime signature doesn't fit array-in/array-out use — report it and hand-roll with upstream citation instead (that is allowed; STOP only if BOTH are infeasible).
- Wiring the helper into the declarative path breaks enter-animation specs twice — report; the declarative site may need the resolution deferred to first-frame.
- `controls.start({ x: [0, null] })` starts throwing where it previously animated — worse than the bug; report immediately.

## Maintenance notes

- The whileHover numeric-array bound (fidelity plan 001) intentionally remains — wildcards in gesture arrays are still unsupported; document cross-reference in the helper's JSDoc.
- Reviewer: the pinning-test update is the deliberate-change ritual working as designed — verify the new pins match upstream behavior, not just the new code.
