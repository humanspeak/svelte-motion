# Plan 001: Gesture channels ride persistent MotionValues — interrupts re-target with velocity, never re-seed

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-parity-next3/README.md` (unless your reviewer
> told you they maintain the index).
>
> **Drift check (run first)**: `git diff --stat 0058f78..HEAD -- src/lib/utils/hover.ts src/lib/utils/interaction.ts src/lib/utils/gestureCoordinator.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: M–L
- **Risk**: MED
- **Depends on**: none (PR #450 merged into the base — this plan targets its code)
- **Category**: bug (upstream parity — the scoped core of issue #449)
- **Planned at**: commit `0058f78`, 2026-07-23

## Why this matters

This is the seam five separate fidelity-audit findings traced back to. Upstream framer-motion backs every animated channel with a persistent `MotionValue`; interrupting a spring re-targets the SAME value, so position AND velocity carry into the next animation (`animateMotionValue` passes the value's live velocity into the generator). Our composed hover writer instead runs throwaway `animateValue` animations per gesture and re-seeds each new one from a computed-style read — position carries (that was the fidelity batch's seeding work), but **velocity is discarded at every hover↔tap handoff and every rapid re-hover**. The result is a subtly dead feel on exactly the interactions framer is famous for: flicking across a hover target, press-during-spring, release-mid-unwind. Adopting per-channel `MotionValue`s inside the existing composed writer closes the gap without the full VisualElement rewrite (#449 stays open for the wholesale adoption; this plan is its highest-value slice).

## Current state

- `src/lib/utils/hover.ts` — the composed writer. Per-channel state at `:412-418`:

```ts
const liveChannelValues: GestureTransformValues = {}
const channelAnimations = new Map<string, { stop?: () => void; unregister?: () => void }>()
```

`runChannelAnimation` (`:506-536`) creates a fresh `animateValue({ ...valueTransition, keyframes, onUpdate, onComplete })` per gesture, writing samples into `liveChannelValues[key]` then `writeComposedChannels()`. `readChannelStart` (`:452-459`) seeds the next animation from `readTransformScale(el)` (scale) or the last `liveChannelValues` number — position-only, zero velocity.

- `src/lib/utils/interaction.ts` — `seedStaleChannels` converts flagged channels to `[current, target]` keyframe pairs before the tap system's element-level `animate()` — again position-only.
- motion-dom (installed, verified exported): `motionValue(initial)` creates a `MotionValue` (`.getVelocity()`, `.on('change', cb)`, `.jump()`, `.stop()`); **`animateMotionValue(name, value, target, transition)`** is upstream's velocity-carrying retarget primitive (`node_modules/motion-dom/dist/index.d.ts:2985`). Upstream reference source: `~/Github/motion/packages/motion-dom/src/animation/interfaces/motion-value.ts`.
- Existing behavioral contracts that MUST NOT regress (each has a spec): default-spring feel (`e2e/motion/hover-default-spring.spec.ts`), multi-channel rendering (`hover-transform-channels.spec.ts`), handoff position continuity (`hover-tap-multichannel-handoff.spec.ts`), per-key ownership (`hover-tap-disjoint-keys.spec.ts` + throttled variant), rapid-tap boundedness (`rapid-tap.test.ts`), authored-transform stacking (`hover-authored-transforms.spec.ts`, `tap-authored-transforms.spec.ts`).

## Commands you will need

| Purpose       | Command                                                                                    | Expected on success |
| ------------- | ------------------------------------------------------------------------------------------ | ------------------- |
| Typecheck     | `pnpm check`                                                                               | exit 0              |
| Unit tests    | `pnpm vitest run src/lib/utils`                                                            | all pass            |
| E2e           | `npx playwright test <specs> --reporter=line` against your own preview port (see workflow) | pass                |
| Format / Lint | `trunk fmt <files>` / `trunk check <files>`                                                | clean               |

**NEVER kill or reuse anything on port 4198.** Edit `playwright.config.ts`'s three `4198` references to your assigned port locally; never commit that edit; use `--strictPort` awareness (kill YOUR stale port's listener with `lsof -ti :<port> -sTCP:LISTEN | xargs kill` before reruns).

## Scope

**In scope**:

- `src/lib/utils/hover.ts` (rework `liveChannelValues`/`runChannelAnimation` onto per-channel MotionValues)
- `src/lib/utils/interaction.ts` (handoff reads velocity from the shared values instead of matrix decomposition where flagged)
- `src/lib/utils/gestureCoordinator.ts` (only if the external-write flags become obsolete for channels now shared — simplification, not new API)
- `src/lib/utils/hover.spec.ts`, `src/routes/tests/motion/hover-velocity-continuity/+page.svelte` (create), `e2e/motion/hover-velocity-continuity.spec.ts` (create)

**Out of scope**:

- Full VisualElement/createAnimationState adoption (issue #449).
- Drag/pan systems; declarative animate pipeline; `_MotionContainer.svelte`.

## Git workflow

- Branch per operator instruction; repo convention: `test(...)` red commit, then `fix(...)`/`refactor(...)`. Do NOT push.

## Steps

### Step 1: Failing e2e capturing velocity discard

Page `src/routes/tests/motion/hover-velocity-continuity/+page.svelte` (model: `hover-default-spring` page — NO explicit transition, so springs apply): one box `whileHover={{ scale: 1.5 }}` `whileTap={{ scale: 0.9 }}`.

Spec `e2e/motion/hover-velocity-continuity.spec.ts`: hover, wait ~120ms (spring mid-flight, high velocity toward 1.5), then `mouse.down()`. Sample scale per frame for 250ms after the press. Assert the OVERSHOOT-THEN-REVERSE signature of velocity carry-over: with velocity preserved, the retarget toward 0.9 launches from a positive (upward) velocity, so scale must continue to INCREASE for at least one sample after the press before reversing (assert `max(samples[0..6]) > samples[0] + 0.01`). Current code re-seeds with zero velocity → scale reverses immediately → red. Also assert the existing continuity bound (no first-frame position jump > 0.03) so the position guarantee is co-tested.

**Verify**: spec FAILS on unfixed code (no post-press increase). If the physics makes the signature flaky across 3 runs, STOP and report observed series — do not tune thresholds past 0.005.

### Step 2: Back channels with persistent MotionValues

In `hover.ts`: replace `liveChannelValues`' plain numbers with a per-element `Map<string, MotionValue<number>>` (create lazily via `motionValue(restingValue)`); `writeComposedChannels` reads `.get()`; `runChannelAnimation` becomes `animateMotionValue(key, value, target, transitionInSeconds)` — note `animateMotionValue` uses upstream's seconds-based transitions, so DROP the `toMillisecondsTransition` conversion on this path (verify against the d.ts signature; keep `animateValue` only if a channel cannot ride a MotionValue, with a comment). Subscribe once per value (`value.on('change', () => writeComposedChannels())`); string/unit channels keep the existing `animateUnitChannel` path driving a progress MotionValue. Interrupts now `.stop()` nothing — a new `animateMotionValue` on the same value retargets with velocity (upstream semantics). Keep coordinator registration per animation for the tap system's stopAll.

**Verify**: Step 1 spec PASSES; `pnpm vitest run src/lib/utils` green.

### Step 3: Handoff reads shared values

In `interaction.ts` `seedStaleChannels`: for channels backed by a shared MotionValue (expose a getter from the hover attachment via the existing composer-options plumbing), seed `[value.get(), target]` and ALSO pass the value's velocity into the tap `animate()` transition if the API accepts per-value velocity; where it cannot, document the residual gap. Consume external-write flags as today.

**Verify**: `hover-tap-multichannel-handoff.spec.ts` + `hover-tap-disjoint-keys.spec.ts` (+ throttled) green.

### Step 4: Full regression gate

`pnpm check` → 0. `pnpm vitest run src/lib/utils` → pass. E2e: the seven contract specs listed in Current state + your new spec → all pass ×2 (`--repeat-each=2`). `trunk fmt`/`trunk check` → clean.

## Test plan

- Red anchor: post-press velocity-continuation signature (Step 1), impossible under re-seeding.
- Unit: MotionValue lifecycle (create-once per key, teardown stops+removes subscriptions — extend `hover.spec.ts` leak tests from plan 011's pattern).
- The seven-spec contract set is mandatory — this touches the arbitration core.

## Done criteria

- [ ] `pnpm check` 0 errors; `pnpm vitest run src/lib/utils` green
- [ ] Step 1 spec exists, failed at plan time, passes ×2 now
- [ ] `grep -n "readChannelStart" src/lib/utils/hover.ts` shows no computed-style seeding on the MotionValue path (scale's `readTransformScale` may remain ONLY as first-creation initializer)
- [ ] Eight-spec e2e set green ×2; no out-of-scope files modified; README row updated

## STOP conditions

- The excerpts don't match live code (drift).
- `animateMotionValue`'s runtime signature rejects the documented shape — report the actual signature.
- Any contract spec fails twice after a fix attempt (arbitration core — report, don't iterate blindly).
- Velocity signature can't be made deterministic locally (report series; the plan may need a unit-level anchor against `MotionValue.getVelocity()` instead).

## Maintenance notes

- This deliberately narrows #449: gesture channels only. When #449's wholesale adoption lands, these MotionValues become the VisualElement's own — keep the map's surface minimal.
- Reviewer: scrutinize teardown (subscriptions + animations per value) and that `markExternalWrite` flags are dropped ONLY for channels the tap path now reads via the shared values.
