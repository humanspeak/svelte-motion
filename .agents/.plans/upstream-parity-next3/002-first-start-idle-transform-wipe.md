# Plan 002: First-ever controls.start() animates FROM the non-neutral idle, not from a wiped base

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-parity-next3/README.md` (unless your reviewer
> told you they maintain the index).
>
> **Drift check (run first)**: `git diff --stat 0058f78..HEAD -- src/lib/html/_MotionContainer.svelte`
> On drift, compare the ternary excerpt below against live code; mismatch = STOP.

## Status

- **Priority**: P1
- **Effort**: S–M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug (upstream parity)
- **Planned at**: commit `0058f78`, 2026-07-23

## Why this matters

Discovered (with diagnostics) by plan 005's executor in the closed upstream-fidelity batch: on the animation-controls test page, the beam idles at `scaleX 0.16` (its `initial` variant), yet the FIRST `controls.start()` toward `scaleX 1` produces **no visible motion** — the element runs 1→1. Upstream framer-motion animates from the rendered idle value (motion values hold it). Our port's `renderedInlineStyle` recompute flips branches the moment the first command arrives: `animationControlsHasReceivedCommand` becomes `true` while `lastAnimationControlsTarget` is still `undefined`, so the inline style DROPS the idle `initialKeyframes` transform (to `none`) exactly when WAAPI is capturing its from-value. Every controls-driven element with a non-neutral idle silently loses its first animation's entire from-side.

## Current state

- `src/lib/html/_MotionContainer.svelte` — the `renderedInlineStyle` target-slot ternary (`:1589-1607`, verbatim):

```ts
            enterAnimationSettled
                ? animateControls && animationControlsHasReceivedCommand
                    ? lastAnimationControlsTarget
                    : renderedAnimateBaseline
                : animateControls &&
                    !animationControlsHasReceivedCommand &&
                    isNotEmpty(initialKeyframes)
                  ? initialKeyframes
                  : animateControls && animationControlsHasReceivedCommand
                    ? lastAnimationControlsTarget
                    : ...
```

The unsettled `hasReceivedCommand` branch (`:1601-1602`) yields `lastAnimationControlsTarget` — `undefined` until the first command COMPLETES (`applyAnimationControlsTarget`) or a stop snapshots (`stopAnimationControlsAnimations`). During the first in-flight run it renders no transform.

- `startAnimationControlsDefinition` (`:1412+`): sets `animationControlsHasReceivedCommand = true` and `enterAnimationSettled = false` before starting the WAAPI animation on the element.
- Test infrastructure: `src/routes/tests/animation-controls/+page.svelte` — beam (`beamVariants` idle `scaleX 0.16`), buttons `start`, `start-slow`, `stop`, `poke`, `toggle-beam-source`; spec `e2e/utilities/animation-controls.spec.ts` (12 tests; `DOMMatrixReadOnly` readers `readBeamScaleX`/`readCardX` — reuse them). Plan 005's report documented the wipe: "beam had a running animation but computed scaleX stayed 1".
- Upstream reference (read-only): `~/Github/motion/packages/motion-dom/src/animation/interfaces/visual-element-target.ts` + motion values — the from-value is whatever the value currently holds; there is no branch that can render a neutral base mid-command.

## Commands you will need

| Purpose       | Command                                                                                         | Expected on success |
| ------------- | ----------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck     | `pnpm check`                                                                                    | exit 0              |
| Unit tests    | `pnpm vitest run`                                                                               | all pass            |
| E2e           | `npx playwright test e2e/utilities/animation-controls.spec.ts --reporter=line` on your own port | pass                |
| Format / Lint | `trunk fmt <files>` / `trunk check <files>`                                                     | clean               |

**NEVER kill or reuse anything on port 4198.** Local uncommitted playwright port edit; kill only YOUR port's stale listener.

## Scope

**In scope**:

- `src/lib/html/_MotionContainer.svelte` (the ternary's unsettled controls branch; if needed, seeding `lastAnimationControlsTarget` from idle at first-command time)
- `src/routes/tests/animation-controls/+page.svelte`, `e2e/utilities/animation-controls.spec.ts`

**Out of scope**:

- `applyAnimationControlsTarget` / `stopAnimationControlsAnimations` mechanics (plans 005/006 territory — their 12 tests are your regression gate).
- The settled branch (`:1594-1596`) — the non-neutral-hold contract lives there.

## Git workflow

- Branch per operator instruction; `test(controls): …` red commit then `fix(controls): …`. Do NOT push.

## Steps

### Step 1: Failing e2e — first start must visibly travel from idle

New test in `e2e/utilities/animation-controls.spec.ts` (fresh page load per test — the bug only exists on the FIRST-ever command): goto, read beam `scaleX` → expect ≈0.16 (idle). Click `start-slow`... check the page: `start-slow` currently drives `launch` (scaleX 1) with duration 2s — ideal. After ~400ms, read scaleX and assert `0.2 < scaleX < 0.9` (mid-travel from 0.16 toward 1). Current code: the from wipes to 1, animation runs 1→1, sample reads ≈1 → red. Also assert no frame ever renders scaleX ≈1 in the first 200ms (sample every ~50ms; guards against wipe-then-animate-back variants).

**Verify**: new test FAILS on unfixed code (scaleX ≈1 at 400ms). Commit `test(controls): …`.

### Step 2: Hold the idle baseline through the first in-flight command

Minimal fix in the ternary's unsettled controls branch: render `lastAnimationControlsTarget ?? (isNotEmpty(initialKeyframes) ? initialKeyframes : undefined)` at `:1601-1602`, so an in-flight FIRST command keeps the idle keyframes as the inline base until a target/stop snapshot exists. Preserve the settled branch untouched. If the WAAPI from-capture still races the recompute (verify empirically), the fallback is seeding: in `startAnimationControlsDefinition`, before flipping flags, snapshot `lastAnimationControlsTarget ??= { ...initialKeyframes-transform-subset }` — prefer the ternary fallback (pure render) and only add seeding with evidence.

**Verify**: Step 1 test PASSES ×3 (`--repeat-each=3` — the race deserves repetition); full `animation-controls.spec.ts` (13 tests now) green — plan 005's stop-freeze trio and 006's detach pair are the tripwires.

### Step 3: Full gate

`pnpm check` → 0. `pnpm vitest run` → pass. Full controls spec ×2 green. `trunk fmt`/`trunk check` → clean.

## Test plan

- Red anchor: first-start mid-travel sample ≈1 today; 0.2–0.9 after.
- Guard cases already in the spec (must stay green): stop-freeze trio, detach/re-attach pair, non-neutral hold, idle-stop no-op.
- Model: existing `readBeamScaleX` tests.

## Done criteria

- [ ] `pnpm check` 0 errors; `pnpm vitest run` green
- [ ] Step 1 test exists, failed at plan time, passes ×3
- [ ] Full `animation-controls.spec.ts` green ×2
- [ ] No out-of-scope files modified; README row updated

## STOP conditions

- The ternary excerpt doesn't match live code.
- The pure-render fallback fixes the sample assertions but plan 005/006 tests regress twice — the branch interplay is subtler than planned; report which state combination broke.
- The fix appears to require touching `applyAnimationControlsTarget`.

## Maintenance notes

- Plan 003 (wildcard keyframes) edits `startAnimationControlsDefinition`'s payload path in the same file — execute sequentially (002 → 003) to avoid conflicts.
- Reviewer: the `??` fallback must NOT resurrect idle keyframes after a target exists (that would regress 006's last-writer semantics) — the detach pair covers it; read the diff for the settled branch being byte-identical.
