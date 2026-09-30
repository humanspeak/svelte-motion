# Plan 001: `useTransform(scrollYProgress, [range], [output])` runs on the compositor thread, like upstream Motion

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `.agents/.plans/transform-scroll-acceleration/README.md` — unless a
> reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 5e9d04a0..HEAD -- src/lib/utils/transform.svelte.ts src/lib/utils/transform.svelte.spec.ts src/lib/utils/scroll.svelte.ts src/routes/+page.svelte docs/src/routes/docs/use-transform/+page.svx docs/src/routes/docs/use-scroll/+page.svx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> Revision 2026-09-30: this plan is dispatched into an isolated git worktree.
> Run e2e **without** `PW_REUSE_SERVER=1` (for example
> `pnpm exec playwright test e2e/utilities/use-transform-scroll-accelerate.spec.ts`).
> A reused server on 4198 would be serving the main checkout's code, not this
> worktree's. Playwright then builds and previews the worktree itself on port
> 4198. If 4198 is already in use, the run fails fast with "already used". In
> that case do NOT kill the process on 4198 (it is the maintainer's). Report
> e2e as verification-blocked; the guard will run it.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the public `useTransform` path; a malformed accelerate config makes `element.animate()` throw during mount)
- **Depends on**: none
- **Category**: direction (upstream parity / perf)
- **Planned at**: commit `5e9d04a0`, 2026-09-30

## Why this matters

In React Motion, `useTransform(scrollYProgress, [0.25, 0.5], [0.2, 1])` bound to
`style.opacity` runs as a native ScrollTimeline-driven WAAPI animation on the
compositor thread. It stays smooth when the main thread is busy. In this library
only a raw `scrollYProgress` bound directly to a style gets that treatment. Every
transformed scroll value falls back to a JavaScript `scroll()` callback plus a
per-frame style write, because our `useTransform` never copies the source's
`.accelerate` config onto the value it returns. Scroll fades, reveals and parallax
are the most common `useScroll` uses, and all of them go through `useTransform`, so
this is the gap users actually hit. Upstream also just fixed a bug in this exact
path (motion PR #3857, on upstream `main` after v13.4.6): WAAPI fills the missing
0 and 1 offsets with the element's underlying value, so the output snapped back
outside a partial input range. We must implement the **fixed** shape from the
start.

## Current state

### How acceleration works today (no change needed here)

- `src/lib/utils/scroll.svelte.ts:203` — `makeAccelerateConfig(axis, options)` builds
  an `AccelerateConfig` (type from `motion-dom`) describing a 0→1 linear mapping:
  `times: [0, 1]`, `keyframes: [0, 1]`, `ease: (v: number) => v`, `duration: 1`,
  plus a `factory` that attaches the native animation to `scroll()`.
- `src/lib/utils/scroll.svelte.ts:297-303` — `useScroll` attaches it synchronously
  at creation, only when the browser supports it:
  ```ts
  if (canAccelerateScroll(options.target, options.offset)) {
      scrollXProgress.accelerate = makeAccelerateConfig('x', options)
      scrollYProgress.accelerate = makeAccelerateConfig('y', options)
  }
  ```
- The consumer is **motion-dom's** `VisualElement.bindToMotionValue`
  (`node_modules/motion-dom/dist/es/render/VisualElement.mjs:257-279`). Our
  `motion.*` components bind style motion values through it (see the comment at
  `src/lib/html/_MotionContainer.svelte:908-913`). When a bound value has
  `.accelerate` **and** the style key is in motion-dom's `acceleratedValues`
  (`opacity`, `clipPath`, `filter`, `transform`, `backgroundColor`), it builds a
  `NativeAnimation({ element, name: key, keyframes, times, ease, duration })`,
  calls `factory(animation)`, and returns **without** subscribing a JS `change`
  listener. Keys like `x`, `y`, `scale` are NOT in the set, so they always use
  the JS path, in upstream too.
- `AccelerateConfig` in the installed motion-dom
  (`node_modules/motion-dom/dist/index.d.ts`, search `isTransformed`) is:
  ```ts
  interface AccelerateConfig {
      factory: (animation: AnimationPlaybackControlsWithThen) => VoidFunction
      times: number[]
      keyframes: any[]
      ease?: EasingFunction | EasingFunction[]
      duration: number
      isTransformed?: boolean
  }
  ```

### The gap: `src/lib/utils/transform.svelte.ts`

Imports (lines 3–9):

```ts
import { type MotionValue, type TransformOptions } from 'motion-dom'
import { type AugmentedMotionValue } from './augmentMotionValue.svelte.js'
import { resolveMotionValueSource, type MotionValueSource } from './toMotionValue.svelte.js'
import {
    mapValue as createMapValue,
    transformValue as createTransformValue
} from './vanillaValues.svelte.js'
```

Multi-output mapping form (starts line 319; the per-key creation is at line 336):

```ts
        const { value: numericSource, dispose: disposeBridge } = resolveMotionValueSource(source)
        const outputMap = outputOrOutputMap as TransformOutputMap<O>
        const keys = Object.keys(outputMap)
        const result: { [key: string]: AugmentedMotionValue<O> } = {}
        for (const key of keys) {
            result[key] = createMapValue(
                numericSource,
                input,
                outputMap[key],
                options as TransformOptions<O> | undefined
            )
        }
```

Single-output mapping form (lines 352–358):

```ts
    // Single-output mapping form: useTransform(source, [range], [out], options).
    // The vanilla factory resolves the source (bridging readables/getters)
    // and chains that bridge's teardown onto the value's own destroy.
    const output = (outputOrOutputMap as O[]) ?? []
    const value = createMapValue(source, input, output, options as TransformOptions<O> | undefined)
    $effect(() => () => value.destroy())
    return value
```

Neither path reads `source.accelerate`. `grep -n accelerat src/lib/utils/transform.svelte.ts`
returns nothing today.

### Upstream reference (framer-motion `main` after PR #3857)

`~/Github/motion/packages/framer-motion/src/value/use-transform.ts` (read it via
`git -C ~/Github/motion show origin/main:packages/framer-motion/src/value/use-transform.ts`
if the local checkout is behind). The logic runs after the result value is built,
for every non-function, non-array-input call:

```ts
const inputAccelerate = !Array.isArray(input) ? (input as MotionValue).accelerate : undefined

if (
    inputAccelerate &&
    !inputAccelerate.isTransformed &&
    typeof inputRangeOrTransformer !== "function" &&
    Array.isArray(outputRangeOrMap) &&
    options?.clamp !== false
) {
    const ease = options?.ease
    /**
     * WAAPI fills missing 0 and 1 offsets with the underlying value, so
     * hold the end values to match the clamped transform.
     */
    result.accelerate = {
        ...inputAccelerate,
        times: [0, ...(inputRangeOrTransformer as number[]), 1],
        keyframes: [
            outputRangeOrMap[0],
            ...outputRangeOrMap,
            outputRangeOrMap[outputRangeOrMap.length - 1],
        ],
        isTransformed: true,
        ...(ease ? { ease: Array.isArray(ease) ? [ease[0], ...ease] : ease } : {}),
    }
}
```

Upstream's multi-output map form calls `useTransform` once per key, so **each key
gets its own accelerate config**. Chained transforms (source already
`isTransformed`) are deliberately NOT accelerated: they fall back to JS.

### One deliberate deviation from upstream: a monotonic-offset guard

WAAPI requires keyframe offsets to be in `[0, 1]` and non-decreasing.
`startWaapiAnimation` (`node_modules/motion-dom/dist/es/animation/waapi/start-waapi-animation.mjs`)
passes `times` straight to `element.animate()` as `offset`, with no guard. So an input
range that is descending (`[1, 0]` → times `[0, 1, 0, 1]`) or out of bounds
(`[0, 2]`) makes `element.animate()` throw a `TypeError` inside
`bindToMotionValue`, which breaks the component mount. Upstream has this bug
today. We only attach `.accelerate` when **every input stop is within `[0, 1]`
and the stops are non-decreasing**. Otherwise the value stays on the JS path,
which already handles those ranges correctly. This is a strict subset of
upstream's accelerated cases, so it can never render differently from upstream
when both succeed.

### Conventions to match

- Exported helpers use arrow syntax (`useTransform` is the documented exception,
  see the comment above it). A private module-level helper should be a `const`
  arrow function with a short JSDoc block, like `makeAccelerateConfig` in
  `scroll.svelte.ts:196-203`.
- Comments cite upstream by path, e.g. the style in `scroll.svelte.ts:197-201`
  ("Mirrors framer-motion's `makeAccelerateConfig` 1:1: …").
- Unit tests: `src/lib/utils/transform.svelte.spec.ts` (jsdom Vitest project;
  pattern: `inRoot(() => …)` wrapping `$effect.root`, see lines 18–45).
- Human-reviewed test pages use the guided `TesterPanel`
  (`src/routes/tests/layout/_parity/TesterPanel.svelte`; exemplar usage at
  `src/routes/tests/layout-id/read-budget/+page.svelte:203-250`). It renders nothing
  under `?@isPlaywright=true`.
- e2e exemplar: `e2e/utilities/will-change.spec.ts` (URL constant with
  `?@isPlaywright=true`, `data-testid` selectors, `expect.poll`).

## Commands you will need

| Purpose                 | Command                                                                           | Expected on success                   |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------- |
| Unit (targeted)         | `pnpm exec vitest run src/lib/utils/transform.svelte.spec.ts`                     | all pass                              |
| Unit (scroll, unchanged) | `pnpm exec vitest run src/lib/utils/scroll.svelte.spec.ts`                        | all pass                              |
| Unit (full)             | `pnpm test:only`                                                                  | all pass                              |
| Typecheck               | `pnpm check`                                                                      | 0 errors                              |
| Package validation      | `pnpm package`                                                                    | exit 0, publint reports no errors     |
| e2e (targeted)          | `PW_REUSE_SERVER=1 pnpm exec playwright test e2e/utilities/use-transform-scroll-accelerate.spec.ts` | all pass (chromium)                   |
| Lint                    | `trunk check`                                                                     | no new issues                         |
| Format                  | `trunk fmt`                                                                       | exit 0                                |

Notes:

- This repo uses **Trunk** (`.trunk/trunk.yaml`) for lint/format. Do not use
  `pnpm lint`, `prettier` or `eslint` directly.
- e2e: the dev server on port **4198** may belong to the maintainer. **Never kill
  it.** In a worktree, drop `PW_REUSE_SERVER=1` from every e2e command in this
  plan (see the revision note at the top).
- Playwright only runs the `chromium` project (others are commented out in
  `playwright.config.ts`). Chromium supports `ScrollTimeline`.

## Scope

**In scope** (the only files you should modify or create):

- `src/lib/utils/transform.svelte.ts`: add the propagation helper and call it
  from both mapping forms; update the `useTransform` JSDoc.
- `src/lib/utils/transform.svelte.spec.ts`: new unit tests.
- `src/routes/tests/use-transform/scroll-accelerate/+page.svelte` (create): demo/test page.
- `src/routes/+page.svelte`: add one link to the new page.
- `e2e/utilities/use-transform-scroll-accelerate.spec.ts` (create).
- `docs/src/routes/docs/use-transform/+page.svx` and
  `docs/src/routes/docs/use-scroll/+page.svx`: a short docs note (Step 6).
- `.agents/.plans/transform-scroll-acceleration/README.md`: status row only.

**Out of scope** (do NOT touch):

- `src/lib/utils/scroll.svelte.ts`: its accelerate config is already correct.
- `src/lib/utils/vanillaValues.svelte.ts` (`mapValue`): upstream's vanilla
  `mapValue` does not propagate acceleration either. Keep parity. Only the
  `useTransform` hook does it.
- `src/lib/html/_MotionContainer.svelte` and anything under `node_modules/`:
  the consumer side (`bindToMotionValue`) belongs to motion-dom and already works.
- The single-transformer form `useTransform(src, fn)`, the multi-input form, and
  the compute form: upstream does not accelerate these (an arbitrary function
  can't be expressed as WAAPI keyframes).
- `docs/static/docs/*.md`: generated and git-ignored.

## Git workflow

- Branch: `feat/transform-scroll-acceleration` off `origin/main` (or continue on
  the branch the operator put you on).
- Conventional commits, matching `git log`: e.g.
  `feat: accelerate useTransform values derived from scroll progress`,
  `test: cover accelerated useTransform propagation`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Write failing unit tests (red)

Add a `describe('useTransform accelerate propagation', …)` block to
`src/lib/utils/transform.svelte.spec.ts`. Simulate `useScroll`'s output by
creating a source with `useMotionValue(0)` inside `inRoot` and assigning a fake
config to it:

```ts
const fakeAccelerate = () => ({
    factory: () => () => undefined,
    times: [0, 1],
    keyframes: [0, 1],
    ease: (v: number) => v,
    duration: 1
})
```

Cases (each asserts on `.accelerate` of the returned value):

1. **Partial range holds end values**: `useTransform(src, [0.25, 0.5], [0.2, 1])`
   → `times` equals `[0, 0.25, 0.5, 1]`, `keyframes` equals `[0.2, 0.2, 1, 1]`,
   `isTransformed` is `true`, `duration` is `1`, and `factory` is the source's
   factory (same reference). `ease` is inherited from the source (same reference)
   because no `ease` option was passed.
2. **Ease array gets an extra leading ease**: with `{ ease: [e1, e2] }` over
   `[0, 0.5, 1] → [0, 1, 0]` → `accelerate.ease` has length 3 and
   `ease[0] === e1`, `ease[1] === e1`, `ease[2] === e2`.
3. **Single ease function is passed through as-is**: `{ ease: e }` → `accelerate.ease === e`.
4. **`clamp: false` does not accelerate**: `.accelerate` is `undefined`.
5. **Chained transform does not accelerate**: `useTransform(firstTransformed, [0, 1], [1, 0])`
   → `.accelerate` is `undefined` (the first hop has `isTransformed: true`).
6. **Source without accelerate**: plain `useMotionValue` → `.accelerate` is `undefined`.
7. **Non-motion-value sources don't accelerate**: a getter source `() => 0.5`
   and a `readable(0)` source → `.accelerate` is `undefined`.
8. **Multi-output map form**: `useTransform(src, [0, 1], { opacity: [0, 1], blur: [10, 0] })`
   → both keys have their own config with the right `keyframes`
   (`[0, 0, 1, 1]` and `[10, 10, 0, 0]`).
9. **Monotonic guard (deviation from upstream)**: descending `[1, 0]`,
   out-of-bounds `[0, 2]`, and negative `[-0.5, 0.5]` input ranges → `.accelerate`
   is `undefined`.
10. **Non-string, non-number outputs still propagate** (upstream parity):
    `['#ff0000', '#0000ff']` → config present with `keyframes`
    `['#ff0000', '#ff0000', '#0000ff', '#0000ff']`.

**Verify**: `pnpm exec vitest run src/lib/utils/transform.svelte.spec.ts`
→ the positive-case tests (1, 2, 3, 8, 10) FAIL with
`expected undefined to …` / `Cannot read properties of undefined (reading 'times')`.
The negative cases (4–7, 9) pass already. That is expected: they are
regression guards. If any positive case passes, STOP: the gap has already been
closed and this plan is stale.

### Step 2: Implement propagation in `transform.svelte.ts`

1. Change the motion-dom import to also bring in what you need:
   `import { isMotionValue, type AccelerateConfig, type MotionValue, type TransformOptions } from 'motion-dom'`.
   `AccelerateConfig` is exported from `motion-dom`, and `scroll.svelte.ts:8`
   already imports it the same way.
2. Add a private helper above `useTransform` (after the type exports), with a
   JSDoc block that cites
   `framer-motion/src/value/use-transform.ts` (post motion#3857) and explains the
   padding and the monotonic guard. Target shape:

   ```ts
   const propagateAccelerate = <O>(
       source: unknown,
       input: number[],
       output: O[],
       options: TransformOptions<O> | undefined,
       result: MotionValue<O>
   ): void => {
       if (!isMotionValue(source)) return
       const inputAccelerate = (source as MotionValue<number>).accelerate
       if (!inputAccelerate || inputAccelerate.isTransformed || options?.clamp === false) return
       if (output.length === 0 || !isMonotonicUnitRange(input)) return

       const ease = options?.ease
       result.accelerate = {
           ...inputAccelerate,
           times: [0, ...input, 1],
           keyframes: [output[0], ...output, output[output.length - 1]],
           isTransformed: true,
           ...(ease ? { ease: Array.isArray(ease) ? [ease[0], ...ease] : ease } : {})
       } satisfies AccelerateConfig
   }
   ```

   Also add `isMonotonicUnitRange(input: number[]): boolean`, which returns `true` when
   every stop is in `[0, 1]` and each stop is `>=` the previous one. Document it
   as the guard that keeps `element.animate()` from throwing
   (`TypeError: Offsets must be monotonically non-decreasing` / out of `[0, 1]`).

3. Call the helper:
   - In the **multi-output** loop, right after `result[key] = createMapValue(…)`:
     `propagateAccelerate(source, input, outputMap[key], options as TransformOptions<O> | undefined, result[key])`.
     Pass the ORIGINAL `source`, not `numericSource`. A readable or getter
     bridge must not accelerate, and `isMotionValue(source)` handles that.
   - In the **single-output** form, right after `const value = createMapValue(…)`:
     `propagateAccelerate(source, input, output, options as TransformOptions<O> | undefined, value)`.
4. Update the `useTransform` JSDoc (the "Mapping form" bullet) with one sentence:
   when the source is a `useScroll` progress value accelerated by a native scroll
   timeline, the result is accelerated too (first hop only, clamped, input stops
   ascending within 0–1), matching framer-motion.

**Verify**: `pnpm exec vitest run src/lib/utils/transform.svelte.spec.ts` → all
tests pass, including the 10 new ones. Then
`pnpm exec vitest run src/lib/utils/scroll.svelte.spec.ts` → all pass (unchanged).

### Step 3: Typecheck

**Verify**: `pnpm check` → `0 errors`. If `satisfies AccelerateConfig` fails because
of the `keyframes` element type, drop the `satisfies` rather than casting to `any`.
The assignment to `result.accelerate` is already type-checked.

### Step 4: Demo / test page

Create `src/routes/tests/use-transform/scroll-accelerate/+page.svelte`. Model the
structure and styling on `src/routes/tests/will-change/+page.svelte` and the panel
on `src/routes/tests/layout-id/read-budget/+page.svelte`. Contents:

- A tall page (e.g. 4 × `100vh` spacers) with `const { scrollYProgress } = useScroll()`.
- Fixed-position boxes (the upstream fixture is
  `~/Github/motion/dev/react/src/tests/scroll-accelerate.tsx`, so mirror it):
  - `data-testid="partial"`: `opacity = useTransform(scrollYProgress, [0.25, 0.5], [0.2, 1])`.
    This is the #3857 case.
  - `data-testid="direct"`: `opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.5, 0])`
    and `backgroundColor = useTransform(scrollYProgress, [0, 1], ['#ff0000', '#0000ff'])`.
  - `data-testid="chained"`: `intermediate = useTransform(scrollYProgress, [0, 1], [1, 0.5])`,
    `chainedOpacity = useTransform(intermediate, [1, 0.75], [0, 1])`.
  - `data-testid="descending"`: `useTransform(scrollYProgress, [1, 0], [0, 1])`,
    the guard case. It must mount without errors and still fade using JS.
- Readouts with `data-testid`s `partial-accelerated`, `direct-accelerated`,
  `bg-accelerated`, `chained-accelerated`, `descending-accelerated`, each rendering
  `String(!!value.accelerate)`.
- A `<button data-testid="block-main-thread">` that busy-loops for ~2 s. It is for
  the human tester, who scrolls during the block: accelerated boxes keep fading,
  and the chained/descending boxes freeze until the block ends. That freeze is the
  visible "WOW".
- A `TesterPanel` (hidden under `@isPlaywright`) with steps. Each step says what to do
  and what the tester should see: scroll slowly from the top. The `partial` box
  holds at 20 % opacity until a quarter of the way down, fades in to half way,
  then **stays fully opaque to the bottom and does not snap back**. Then press
  "Block main thread" and scroll: the accelerated boxes keep moving and the
  chained box freezes. Include a short note that the effect needs a browser
  with `ScrollTimeline` (Chrome/Edge; recent Safari).

Link it from `src/routes/+page.svelte` in the same `<li><a …>` format as the
`/tests/will-change` entry (around line 155):
`href={resolve('/tests/use-transform/scroll-accelerate') + searchParams}`, label
`useTransform scroll acceleration (compositor-driven scroll fades)`.

**Verify**: `pnpm check` → 0 errors.

### Step 5: e2e spec

Create `e2e/utilities/use-transform-scroll-accelerate.spec.ts` with
`const URL = '/tests/use-transform/scroll-accelerate?@isPlaywright=true'`.
Every assertion that depends on native support should compute
`const supported = await page.evaluate(() => 'ScrollTimeline' in window)` and
expect `'true'` / `'false'` accordingly, the same way the upstream Cypress spec
(`~/Github/motion/packages/framer-motion/cypress/integration/scroll-accelerate.ts`) does.

Tests:

1. `direct-accelerated`, `bg-accelerated`, and `partial-accelerated` read `supported`.
   `chained-accelerated` and `descending-accelerated` read `'false'`.
2. **A real native scroll-timeline animation drives the element** (skip with
   `test.skip(!supported, …)`):
   `page.getByTestId('partial').evaluate(el => el.getAnimations().some(a => a.timeline?.constructor?.name === 'ScrollTimeline'))`
   → `true`. The same check on `chained` → `false`.
3. **End values hold (the #3857 regression)**, skipped when unsupported: scroll to
   the top (`window.scrollTo(0, 0)`) and poll
   `getComputedStyle(partial).opacity` → `'0.2'`. Scroll to the bottom
   (`window.scrollTo(0, document.documentElement.scrollHeight)`) and poll → `'1'`.
   Use `expect.poll`. The timeline updates on the next frame.
4. **No page errors**: collect `page.on('pageerror')` across load and a full scroll.
   The array stays empty. This protects the descending-range guard.

**Verify**: `PW_REUSE_SERVER=1 pnpm exec playwright test e2e/utilities/use-transform-scroll-accelerate.spec.ts`
→ all pass. Sanity check the red side once: temporarily comment out the two
`propagateAccelerate(...)` calls. Tests 1–3 should fail (`partial-accelerated`
reads `'false'`). Restore the calls and confirm green again. Do not commit the
temporary change.

### Step 6: Docs

- `docs/src/routes/docs/use-scroll/+page.svx`, `## Performance` section (line ~156):
  add a short paragraph saying that `scrollXProgress` / `scrollYProgress`, and
  values mapped from them with `useTransform(progress, [input], [output])`, run as
  native scroll-timeline animations when the browser supports them and they are
  bound to `opacity`, `filter`, `clipPath`, `transform`, or `backgroundColor`.
  List the fallbacks: chained transforms, `clamp: false`, function transformers,
  and input stops outside ascending 0–1. Note that `x` / `y` / `scale` shortcuts
  still update in JS (to match upstream). Suggest mapping to a full `transform`
  string when compositor-driven movement is needed.
- `docs/src/routes/docs/use-transform/+page.svx`: add a `### Scroll acceleration`
  subsection under `## How it works` (line ~165) with the same rules in 3–5
  sentences and a small `useScroll` + opacity example.

**Verify**: `trunk fmt` then `trunk check` → no new issues in touched files.

### Step 7: Full gate

**Verify**, all of:

- `pnpm test:only` → all pass
- `pnpm check` → 0 errors
- `pnpm package` → exit 0, publint clean
- `trunk check` → no new issues
- `PW_REUSE_SERVER=1 pnpm exec playwright test e2e/utilities/use-transform-scroll-accelerate.spec.ts e2e/utilities/will-change.spec.ts` → all pass

## Test plan

- **Red first (Step 1)**: the positive propagation cases fail against current
  code because `.accelerate` is `undefined` on every `useTransform` result. After
  Step 2 they pass. The negative cases pin upstream's guards (chained, `clamp: false`,
  non-MV sources) plus our monotonic guard.
- **e2e (Step 5)**: observes the real browser effect. The flag is set, a
  `ScrollTimeline` animation exists on the element, the partial range holds its end
  values, and there are no page errors for the descending range.
- Pattern files: `src/lib/utils/transform.svelte.spec.ts` (unit),
  `e2e/utilities/will-change.spec.ts` (e2e).

## Done criteria

- [ ] `grep -n "propagateAccelerate" src/lib/utils/transform.svelte.ts` shows the definition plus 2 call sites
- [ ] `pnpm exec vitest run src/lib/utils/transform.svelte.spec.ts` passes, including the 10 new cases
- [ ] `pnpm test:only` exits 0
- [ ] `pnpm check` reports 0 errors
- [ ] `pnpm package` exits 0
- [ ] `trunk check` reports no new issues
- [ ] `e2e/utilities/use-transform-scroll-accelerate.spec.ts` exists and passes on chromium
- [ ] `src/routes/+page.svelte` links `/tests/use-transform/scroll-accelerate`
- [ ] `git status` shows changes only to in-scope files
- [ ] README status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any Step 1 positive case already passes (the gap was closed elsewhere).
- `AccelerateConfig` is not exported from `motion-dom`, or it has no `isTransformed`
  field (the dependency version changed).
- `useScroll` no longer sets `.accelerate` synchronously during creation (the
  `scroll.svelte.ts:297-303` excerpt doesn't match). Propagation depends on
  the source's config existing when `useTransform` runs.
- The e2e `getAnimations()` check shows no `ScrollTimeline` animation on
  `partial` while `partial-accelerated` reads `'true'`. That means the
  VisualElement didn't consume the config, which is a binding problem outside
  this plan's scope.
- The e2e dev server is on port 4198 and you are tempted to kill or restart it.
  Don't. Report instead.
- Making it work seems to require editing `_MotionContainer.svelte`,
  `scroll.svelte.ts`, or `vanillaValues.svelte.ts`.

## Maintenance notes

- **Upstream drift**: this mirrors framer-motion's `useTransform` after motion#3857.
  When bumping `motion`, diff `packages/framer-motion/src/value/use-transform.ts`
  and re-sync if the padding, ease or guard logic changes.
- **Deliberate deviation**: the monotonic `[0, 1]` guard is stricter than upstream.
  If upstream adds its own guard, compare them and drop ours if it's equivalent.
  The upstream bug (descending ranges throw in `element.animate`) is worth
  reporting to motiondivision/motion. That is not part of this plan.
- **Known upstream-parity quirk kept as-is**: a custom `mixer` option is ignored on
  the accelerated path (WAAPI interpolates natively), the same as upstream.
- Reviewers: check that the ORIGINAL `source` (not the bridged `numericSource`) is
  passed to the helper, and that the ease padding copies `ease[0]` (not `ease.at(-1)`).
- Deferred: a docs example page under `docs/src/routes/examples/`. It is worth doing
  once this ships, but docs demos consume the built `dist`, so it needs a
  `pnpm build` + docs cache cycle that is better handled separately.
