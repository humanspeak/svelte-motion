# Plan 001: Composed hover channels use upstream per-value default transitions, full keyframe arrays, and unit-value interpolation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/upstream-fidelity/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6746859..HEAD -- src/lib/utils/hover.ts src/lib/utils/transformComposer.ts e2e/motion/ src/routes/tests/motion/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6746859`, 2026-07-22

## Why this matters

`@humanspeak/svelte-motion` is a Framer Motion-compatible port; parity with upstream (`~/Github/motion`) is a core product promise. When `whileHover` includes `scale`, the hover system routes ALL transform channels through a "composed writer" that calls motion-dom's low-level `animateValue`. With no explicit transition, `animateValue` defaults to a ~0.3s keyframes **tween** — but upstream framer-motion applies per-value defaults at a higher layer: `scale` gets a critically-damped **spring** (stiffness 550, damping 30) and `x`/`y`/`rotate` get an under-damped spring (stiffness 500, damping 25). So every default-transition hover with scale feels wrong versus framer-motion, and is inconsistent with our own tap path (which correctly passes `undefined` to the high-level `animate()` and gets springs). Two more divergences live in the same function: keyframe arrays collapse to their final value (upstream plays the full sequence with the keyframes-duration default), and non-numeric targets like `'-50%'` snap instantly instead of animating.

## Current state

- `src/lib/utils/hover.ts` — hover gesture attachment. The composed-writer path (engaged whenever `scale` is in the hover target) lives in `animateComposedChannel` / `animateGestureTarget` / `writeComposedChannels`.
- `src/lib/utils/transformComposer.ts` — `buildGestureTransform` (wraps motion-dom `buildTransform`), `splitGestureTransformValues`.
- Upstream reference (READ THESE, do not modify): `~/Github/motion/packages/motion-dom/src/animation/utils/default-transitions.ts` (`getDefaultTransition`: scale → criticallyDampedSpring 550/30; x/y/rotate → underDampedSpring 500/25; keyframes.length > 2 → keyframes transition, duration 0.8), `~/Github/motion/packages/motion-dom/src/animation/JSAnimation.ts` (no `type` → keyframes tween default).

Current code, `src/lib/utils/hover.ts` (verbatim at plan time):

```ts
const getFinalNumber = (value: unknown): number | null => {
    const raw: unknown = Array.isArray(value) ? value[value.length - 1] : value
    const parsed = typeof raw === 'number' ? raw : Number.parseFloat(String(raw))
    return Number.isFinite(parsed) ? parsed : null
}
```

```ts
    const animateComposedChannel = (
        key: string,
        target: unknown,
        transition: AnimationOptions | undefined
    ) => {
        // ...
        channelAnimations.get(key)?.stop?.()
        channelAnimations.delete(key)

        const targetNumber = getFinalNumber(target)
        if (targetNumber == null) {
            // Non-numeric channel value (e.g. '-50%'): apply without tweening
            if (typeof target === 'string') {
                liveChannelValues[key] = target
                writeComposedChannels()
            }
            return
        }

        const registration: { unregister?: () => void } = {}
        const animation = animateValue({
            ...toMillisecondsTransition(transition ?? mergedTransition),
            keyframes: [readChannelStart(key), targetNumber],
            onUpdate: (value: number) => { ... },
            onComplete: () => { ... }
        })
```

Key facts:

- `mergedTransition` is `{}` when neither the component `transition` prop nor `<MotionConfig>` provides one — so `animateValue` receives no `type` and tweens.
- The tap path exemplar for correct default-transition behavior is `src/lib/utils/interaction.ts:120-150` — it passes `undefined` as the transition to the high-level `animate()` from `'motion'`, letting motion-dom apply `getDefaultTransition` per value. The long comment there documents the exact upstream defaults; keep this plan consistent with it.
- `toMillisecondsTransition` (hover.ts:74-84) converts seconds→ms because `animateValue` is an ms API. Any default you inject must ALSO be expressed for the ms API (upstream's spring stiffness/damping are time-unit-free; `duration: 0.8` for keyframes must become `800`).
- Repo conventions: Google-style JSDoc on exported functions; comments state constraints, not narration.

## Commands you will need

| Purpose      | Command                                                                                                                                                                                 | Expected on success |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Typecheck    | `pnpm check`                                                                                                                                                                            | exit 0              |
| Unit tests   | `pnpm vitest run src/lib/utils`                                                                                                                                                         | all pass            |
| One e2e spec | `PW_REUSE_SERVER=1 npx playwright test e2e/motion/<spec> --reporter=line` if port 4198 already has a listener, else drop the env var (playwright then builds + previews on 4198 itself) | pass                |
| Format       | `trunk fmt <files>`                                                                                                                                                                     | exit 0              |
| Lint         | `trunk check <files>`                                                                                                                                                                   | no new issues       |

**NEVER kill any process listening on port 4198** — it may be the maintainer's live browser session. If 4198 is occupied, always use `PW_REUSE_SERVER=1`.

## Scope

**In scope** (the only files you should modify):

- `src/lib/utils/hover.ts`
- `src/routes/tests/motion/hover-default-spring/+page.svelte` (create)
- `e2e/motion/hover-default-spring.spec.ts` (create)
- `src/lib/utils/hover.spec.ts` (create or extend if it exists)

**Out of scope** (do NOT touch):

- `src/lib/utils/interaction.ts` — the tap path already has correct defaults.
- `src/lib/utils/gestureCoordinator.ts`.
- Upstream repo `~/Github/motion` — read-only reference.
- Do not change the native (no-scale) hover path's transition selection — it already flows through the high-level `animate()`.

## Git workflow

- Work on the current branch (`style/brutalist-examples`) — these fixes ship in the open PR.
- Repo convention is red-test commit then fix commit (see `git log`: `e42d364 test(motion): capture press snap…` then `d2c8d75 fix(gestures): seed tap animations…`). Match it: one `test(hover): …` commit, then one `fix(hover): …` commit.
- Do NOT push.

## Steps

### Step 1: Write a failing e2e test that captures the spring default

Create `src/routes/tests/motion/hover-default-spring/+page.svelte` modeled exactly on `src/routes/tests/motion/hover-transform-channels/+page.svelte` (same shell), but with **no** `MotionConfig` wrapper and **no** transition prop, so defaults apply:

```svelte
<motion.div
    whileHover={{ scale: 1.5, y: -8 }}
    style="width: 100px; height: 100px; background-color: #247768;"
    data-testid="motion-hover-default-spring"
/>
```

Create `e2e/motion/hover-default-spring.spec.ts` modeled on `e2e/motion/hover-transform-channels.spec.ts` (reuse its `readTransform` matrix-parsing helper). Assert the upstream-spring signature: a stiffness-550/damping-30 critically-damped spring from 1 → 1.5 overshoots slightly (~7%, per the documented upstream behavior in `src/lib/utils/interaction.ts:124`). Test: hover, poll `scale` samples every ~16ms for ~600ms, and assert `Math.max(...samples) > 1.51` (overshoot beyond the target proves spring; the current tween never exceeds 1.5). Also assert a second test case: with `whileHover={{ scale: [1, 1.8, 1.2] }}` on a second element on the same page, the sampled scale must exceed 1.5 at some point (the 1.8 waypoint), which the current collapse-to-final behavior never reaches.

**Verify**: `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-default-spring.spec.ts --reporter=line` → both tests FAIL (max scale ≈ 1.5, never > 1.51; waypoint never observed).

### Step 2: Resolve per-value default transitions for composed channels

In `src/lib/utils/hover.ts`, import `getDefaultTransition` from motion-dom if exported (check `node_modules/motion-dom/dist` exports; upstream source is `~/Github/motion/packages/motion-dom/src/animation/utils/default-transitions.ts`). If it is exported, in `animateComposedChannel` when the caller supplied no explicit transition (`transition ?? mergedTransition` is empty — treat `{}` as empty via `Object.keys(...).length === 0`), replace the spread with the per-value default: `getDefaultTransition(key, { keyframes })` converted to ms via `toMillisecondsTransition`. If it is NOT exported, inline the upstream values with a comment citing the upstream file: scale/scaleX/scaleY → `{ type: 'spring', stiffness: 550, damping: 30, restSpeed: 10 }`; x/y/rotate/translate channels → `{ type: 'spring', stiffness: 500, damping: 25, restSpeed: 10 }` (copy the exact fields from the upstream source you read, do not trust this plan's memory of them — cite lines in your comment). Note springs are duration-free so ms conversion is a no-op for them; keyframe-array targets (Step 3) use `duration: 800` ms.

**Verify**: `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-default-spring.spec.ts --reporter=line` → the overshoot test now PASSES (waypoint test still fails until Step 3).

### Step 3: Play full keyframe arrays on the composed path

In `animateComposedChannel`, when `target` is an array with length > 1: build the `animateValue` keyframes as `[readChannelStart(key), ...numericArrayValues.slice(1)]`? No — mirror upstream: upstream plays the authored array as-is (the first element is the explicit start). Pass the full numeric array as `keyframes` and select the keyframes default (`{ duration: 800, ease: 'easeInOut' }` — confirm exact upstream default in `default-transitions.ts` and match it) when no explicit transition exists and length > 2. Keep `getFinalNumber` for the non-array path only. If any array element is non-numeric, fall through to the Step 4 handling.

**Verify**: `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-default-spring.spec.ts --reporter=line` → BOTH tests pass.

### Step 4: Animate non-numeric unit values instead of snapping

Replace the instant-write branch (`if (typeof target === 'string') { liveChannelValues[key] = target; writeComposedChannels() }`) with interpolation: use motion-dom's `mix`/unit-value interpolation if available (check for `mixNumber`/`mix` exports, upstream `motion-dom/src/utils/mix`), animating a 0→1 progress via `animateValue` and mixing start→target strings when both share a unit; when the start value's unit differs or is unknown (e.g. current is a number, target is `'-50%'`), keep the instant write as the fallback and leave a comment stating why. Add a unit test in `src/lib/utils/hover.spec.ts` for whichever helper you extract (pure-function tests only — do not attempt to run `animateValue` in jsdom).

**Verify**: `pnpm vitest run src/lib/utils/hover.spec.ts` → new tests pass.

### Step 5: Full gate

Run: `pnpm check` → exit 0. `pnpm vitest run src/lib/utils` → all pass. `PW_REUSE_SERVER=1 npx playwright test e2e/motion/hover-default-spring.spec.ts e2e/motion/hover-transform-channels.spec.ts e2e/motion/hover-and-tap.test.ts e2e/motion/hover-authored-transforms.spec.ts e2e/motion/tap-authored-transforms.spec.ts e2e/motion/rapid-tap.test.ts --reporter=line` → all pass. `trunk fmt` on touched files, `trunk check` on touched files → clean.

## Test plan

- Step 1's red e2e is the anchor: overshoot-signature FAIL (tween never exceeds target) → PASS after Step 2; keyframe-waypoint FAIL → PASS after Step 3.
- Unit tests for any extracted pure helpers (array normalization, unit-mix guard) in `src/lib/utils/hover.spec.ts`, modeled on `src/lib/utils/gestureCoordinator.spec.ts`.
- Regression suite: the six e2e specs in Step 5 (they cover the paths this function serves).

## Done criteria

- [ ] `pnpm check` exits 0
- [ ] `pnpm vitest run src/lib/utils` exits 0
- [ ] Step 1 spec exists and passes (it failed at plan time)
- [ ] The six-spec e2e regression set passes
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] README status row updated

## STOP conditions

- The `animateComposedChannel` excerpt doesn't match the live code (drift).
- `getDefaultTransition` exists but its runtime signature rejects the `{ keyframes }` argument shape — report the actual signature instead of guessing.
- The overshoot assertion turns out flaky across 3 runs (springs may settle differently under CI timing) — report observed sample ranges; do not loosen the threshold below 1.505 without reporting.
- Fixing requires touching `interaction.ts` or the native hover path.

## Maintenance notes

- Plan 004 (per-key gesture ownership) restructures the callers of `animateGestureTarget`; it depends on this plan's shape of `animateComposedChannel`. Land this first.
- Reviewer should scrutinize: the empty-transition detection (`{}` from `mergedTransition` must count as "no explicit transition", but a user-supplied `{ duration: 0.6 }` must NOT get springs).
- Deferred: interrupted-spring velocity carry-over across hover↔tap handoffs is NOT addressed here (structurally requires per-key motion values — issue #449).
