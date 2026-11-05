# Plan 002: `useTransform` with a `mixer` stays off scroll acceleration

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do not edit the batch `README.md`.
>
> **Drift check (run first)**: `git diff --stat fb9ed218..HEAD -- src/lib/utils/transform.svelte.ts src/lib/utils/transform.svelte.spec.ts`. Expect no output. Otherwise compare the excerpts below with the live code and STOP on a mismatch.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Wave**: 1
- **Category**: bug (upstream parity)
- **Planned at**: commit `fb9ed218`, 2026-11-04

## Why this matters

`useTransform` maps one motion value to another. When the source is scroll-linked (`useScroll`), the result carries an `accelerate` config, so the browser can run it as a Web Animations (WAAPI) scroll timeline off the main thread. WAAPI can only blend values itself; it can't call a custom JavaScript `mixer` function. Motion 14.8.0 added `transition.mixer` / `TransformOptions.mixer`. Upstream commit 62842dc4b then made `useTransform` skip acceleration whenever `options.mixer` is set. Otherwise the browser animates with its own blending and the custom mixer is silently ignored. Our port is missing that guard.

## Current state

- `src/lib/utils/transform.svelte.ts:202-222`, `propagateAccelerate`, called for the output-map form at `:410` and the single-output form at `:432`:
  ```ts
  const propagateAccelerate = <O>(
      source: unknown,
      input: number[],
      output: O[],
      options: TransformOptions<O> | undefined,
      result: AugmentedMotionValue<O>
  ): void => {
      if (!isMotionValue(source)) return
      const inputAccelerate = (source as MotionValue<number>).accelerate
      if (!inputAccelerate || inputAccelerate.isTransformed || options?.clamp === false) return
      if (output.length === 0 || !isMonotonicUnitRange(input)) return
      ...
  ```
- `TransformOptions` (re-exported from motion-dom at `transform.svelte.ts:127`) already has `mixer?: (from: T, to: T) => (v: number) => any` in 14.7.1. No type change is needed.
- Upstream 14.9.1, `packages/framer-motion/src/value/use-transform.ts:221-233` (read with `git -C ~/Github/motion show v14.9.1:packages/framer-motion/src/value/use-transform.ts`):
  ```ts
  /**
   * WAAPI can't call a mixer.
   */
  if (
      inputAccelerate &&
      !inputAccelerate.isTransformed &&
      typeof inputRangeOrTransformer !== "function" &&
      Array.isArray(outputRangeOrMap) &&
      options?.clamp !== false &&
      !options?.mixer
  ) {
  ```
  Upstream's map form calls `useTransform` per key, so the guard covers both forms. Ours does too, because both call `propagateAccelerate`.
- Exemplar test: `src/lib/utils/transform.svelte.spec.ts:275-330`, `describe('useTransform accelerate propagation')`. It has the helpers `inRoot` (wraps `$effect.root`), `fakeAccelerate()` and `accelerated()` (a `useMotionValue(0)` with a fake `accelerate`), and cases such as `it('partial range holds end values', …)`. Upstream's test is `packages/framer-motion/src/value/__tests__/use-scroll.test.tsx`, "doesn't accelerate useTransform with a mixer, as WAAPI can't call it":
  ```ts
  const filter = useTransform(scrollYProgress, [0, 1], ["blur(0px)", "blur(10px)"], { mixer: () => () => "blur(5px)" })
  expect(filter.accelerate).toBeUndefined()
  ```

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| One spec | `pnpm test:only src/lib/utils/transform.svelte.spec.ts` | as per step |
| Types | `pnpm check` | `0 ERRORS` |
| Unit suite | `pnpm test:only` | all pass |
| e2e (scroll acceleration) | `PW_PORT=4232 pnpm exec playwright test --project=chromium e2e/utilities/use-transform-scroll-accelerate.spec.ts` | all pass |
| Format / lint | `trunk fmt <files>`; `trunk check <files>` | no new issues |

Never use port 4198, never set `PW_REUSE_SERVER`, never `git stash`.

## Scope

**In scope:**
- `src/lib/utils/transform.svelte.ts`: `propagateAccelerate` only
- `src/lib/utils/transform.svelte.spec.ts`
- `.changeset/use-transform-mixer-accelerate.md` (create)

**Out of scope:**
- `createMapValue` and the mixer interpolation itself. Mixing already works on the main thread.
- `optimizedAppear.ts`. It ignores `mixer` exactly as upstream's optimized appear does.

## Git workflow

- Lane branch `lane/1491-transform`. Use conventional commits, e.g. `fix(use-transform): keep a mixer off scroll acceleration`.
- End each commit with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Do not push.

## Steps

### Step 1: Red test

In `describe('useTransform accelerate propagation')` add two cases, using the existing `inRoot`/`accelerated` helpers:
1. `it("doesn't accelerate with a mixer, as WAAPI can't call it", …)`: `useTransform(accelerated(), [0, 1], ['blur(0px)', 'blur(10px)'], { mixer: () => () => 'blur(5px)' })`, then `expect(out.accelerate).toBeUndefined()`.
2. The same for the output-map form: `useTransform(accelerated(), [0, 1], { filter: ['blur(0px)', 'blur(10px)'] }, { mixer: () => () => 'blur(5px)' })`, then `expect(out.filter.accelerate).toBeUndefined()`. Use the call shape the file's existing map-form tests use.

**Verify**: `pnpm test:only src/lib/utils/transform.svelte.spec.ts` → the two new cases FAIL (`accelerate` is defined); all others pass.

### Step 2: The guard

In `propagateAccelerate`, extend the early return:
```ts
// WAAPI can't call a mixer (motion 62842dc4b, framer-motion use-transform.ts:221-233 @ v14.9.1).
if (!inputAccelerate || inputAccelerate.isTransformed || options?.clamp === false || options?.mixer) return
```

**Verify**: `pnpm test:only src/lib/utils/transform.svelte.spec.ts` → all pass.

### Step 3: Changeset and gate

Create `.changeset/use-transform-mixer-accelerate.md` with frontmatter `'@humanspeak/svelte-motion': patch`. Body: "`useTransform` with a `mixer` option no longer runs on a scroll-linked Web Animation, which can't call the mixer, so the mixer is applied (Motion 14.8)."

**Verify**: `pnpm check` (0 errors), `pnpm test:only` (all pass), the e2e file in the table (all pass), and trunk on the changed files.

## Test plan

- Red-first: two unit cases fail on current code (`accelerate` defined) and pass after the guard.
- The existing accelerate cases must stay green. They pin that the guard only drops acceleration when a `mixer` is present.

## Maintenance note

If upstream adds more conditions to that `if`, add them to `propagateAccelerate` as well. It is our single equivalent of upstream's acceleration check.

## STOP conditions

- A new case passes before Step 2. The reproduction is wrong.
- An existing accelerate test fails after Step 2.
