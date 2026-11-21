# Plan 013: Under reduced motion, transform and layout values jump to their target instead of being dropped

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update the status row for this plan
> in `.agents/.plans/reactive-tracking-leaks/README.md`, unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat a33531a2..HEAD -- src/lib/html/_MotionContainer.svelte src/lib/utils/reducedMotionConfig.svelte.ts src/lib/utils/reducedMotionConfig.svelte.spec.ts src/lib/types.ts src/lib/components/__tests__ src/lib/components/MotionConfig.reducedMotion.spec.ts src/routes/tests/motion-config-reduced-motion src/routes/tests/ve-signoff e2e/utilities/motion-config-reduced-motion.spec.ts docs/src/routes/docs/motion-config docs/src/routes/docs/use-reduced-motion-config docs/src/routes/examples/use-reduced-motion-config`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. `_MotionContainer.svelte` is also
> edited by other plans in this batch (003 owns the `onLayoutMeasure` effect
> at about lines 3078–3096). Changes outside the line ranges quoted below are
> not a mismatch.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (deliberate, visible behavior change; an e2e spec and the docs currently pin the old behavior)
- **Depends on**: none
- **Wave**: 1
- **Category**: bug (upstream divergence)
- **Planned at**: commit `a33531a2`, 2026-11-20

## Why this matters

Under `<MotionConfig reducedMotion="always">` (or `"user"` with the OS set to
reduce motion), this library deletes transform keys (`x`, `y`, `scale`,
`rotate`, …) from every `initial`, `animate`, variant, `while*` and `exit`
target. So `animate={{ x: 200 }}` leaves the element at 0, and a layout that
depends on the element ending up at 200 is simply wrong. Motion does
something different: it keeps the target and drops only the tween. Transform
and layout keys (`x`, `y`, `scale`, `rotate`, `width`, `height`, `top`,
`left`, …) jump straight to their target, and everything else (opacity,
colour, filter) still animates. Code ported from framer-motion therefore
lands in a different place here. The project rule is to adopt upstream, so
this plan does that, flips the e2e spec that pins the old behavior, and
corrects the docs (one docs page already describes the upstream behavior and
contradicts the others).

## Current state

### Upstream semantics (verified at `~/Github/motion`, tag `v14.14.0`)

- `packages/motion-dom/src/animation/interfaces/visual-element-target.ts:150-164`:

  ```ts
  const shouldReduceMotion =
      reduceMotion ?? visualElement.shouldReduceMotion

  value.run(
      animateMotionValue(
          key,
          value,
          valueTarget,
          shouldReduceMotion && positionalKeys.has(key)
              ? { type: false }
              : valueTransition,
          visualElement,
          isHandoff
      )
  )
  ```

  `reduceMotion` is `transition.reduceMotion` (line 50). The target is never
  removed; only the transition is replaced by `{ type: false }` (instant).

- `packages/motion-dom/src/render/utils/keys-position.ts`: `positionalKeys` is
  `width`, `height`, `top`, `left`, `right`, `bottom` plus every key in
  `transformPropOrder` (`render/utils/keys-transform.ts`):
  `transformPerspective`, `x`, `y`, `z`, `translateX`, `translateY`,
  `translateZ`, `scale`, `scaleX`, `scaleY`, `scaleZ`, `rotate`, `rotateX`,
  `rotateY`, `rotateZ`, `skew`, `skewX`, `skewY`. Opacity, colours and every
  other key keep their transition.

- `packages/motion-dom/src/render/VisualElement.ts:498-507`, in `mount()`:

  ```ts
  if (this.reducedMotionConfig === "never") {
      this.shouldReduceMotion = false
  } else if (this.reducedMotionConfig === "always") {
      this.shouldReduceMotion = true
  } else {
      if (!hasReducedMotionListener.current) {
          initPrefersReducedMotion()
      }
      this.shouldReduceMotion = prefersReducedMotion.current
  }
  ```

  So `"user"` follows `matchMedia("(prefers-reduced-motion)")`
  (`render/utils/reduced-motion/index.ts`). The default is `"never"`
  (`framer-motion/src/context/MotionConfigContext.tsx:73`).

- `packages/motion-dom/src/projection/node/create-projection-node.ts:720-726`:
  layout animations are also instant when `visualElement.shouldReduceMotion`.

- `packages/motion-dom/src/animation/animate/effects.ts:73` and `:109-117`:
  the vanilla `animate(element, keyframes, { reduceMotion: true })` applies
  the same `positionalKeys` → `{ type: false }` rule. Without the option, an
  element animated by vanilla `animate()` is not reduced.

### This library today

- `src/lib/utils/reducedMotionConfig.svelte.ts` (151 lines):
  - Lines 11–33: a private `TRANSFORM_KEYS` set.
  - Lines 69–79, the stripping helper (internal; not exported from
    `src/lib/index.ts`):

    ```ts
    export const filterReducedMotionKeyframes = <T extends Record<string, unknown> | undefined>(
        keyframes: T,
        reduced: boolean
    ): T => {
        if (!reduced || !keyframes) return keyframes
        const out: Record<string, unknown> = {}
        for (const key of Object.keys(keyframes)) {
            if (!TRANSFORM_KEYS.has(key)) out[key] = keyframes[key]
        }
        return out as T
    }
    ```

  - Lines 118–151: `useReducedMotionConfig()`, public, exported from
    `src/lib/index.ts:254`. It stays.

- `src/lib/html/_MotionContainer.svelte` (4155 lines). Every stripping site:
  - Lines 18–21, the import:

    ```ts
    import {
        filterReducedMotionKeyframes,
        useReducedMotionConfig
    } from '$lib/utils/reducedMotionConfig.svelte'
    ```

  - Lines 321–325: `const reducedMotionState = useReducedMotionConfig()` and
    `const reducedMotion = $derived(reducedMotionState.current)`. Keep both.
  - Lines 326–331: the `skipAnimations` derived. Pattern to mirror.
  - Lines 589–632: `filterReducedMotionDefinition` and the
    `reducedMotionVariants` derived (filters every variant, wrapping
    function variants).
  - Lines 657–663 (comment + `initial: filterReducedMotionDefinition(effectiveInitialProp)`),
    676–678 (`animate: ... filterReducedMotionDefinition(resolveRelativeAnimate(declarativeAnimateProp))`,
    `variants: reducedMotionVariants`) and 693–698 (`whileHover` …
    `whilePinch: filterReducedMotionDefinition(...)`), inside
    `buildMotionNodeProps`.
  - Lines 1068–1078, the exit resolver:

    ```ts
    const resolvePresenceExit = (custom: unknown) => {
        const resolved = resolveExit(
            exitProp,
            variantsProp,
            custom !== undefined ? custom : effectiveCustom
        )
        if (!resolved) return undefined
        return filterReducedMotionKeyframes(
            resolved as Record<string, unknown>,
            reducedMotion
        ) as DOMKeyframesDefinition
    }
    ```

  - Lines 1084–1095, the exit transition handed to the presence context. The
    `skipAnimations` threading is the pattern to copy:

    ```ts
    // A clone that isn't held animates a copy with no
    // VisualElement, so `shouldSkipAnimations` cannot reach it; a
    // held clone animates through the re-homed VisualElement (plan
    // 012), whose `animate(clone, …)` copies the transition too.
    // motion-dom's `animateTarget` copies `transition.skipAnimations`
    // onto every per-value transition, so threading it here is what
    // makes exits instant under `<MotionConfig skipAnimations>`.
    ...
    skipAnimations ? { ...mergedTransition, skipAnimations: true } : mergedTransition,
    ```

    An unheld clone is animated by `src/lib/utils/presence.ts:2721`,
    `animate(clone, exitKeyframes, finalTransition)` (vanilla `animate` from
    `motion`), with `finalTransition` merged from this transition. So an
    unheld clone is only reduced if `reduceMotion: true` rides on this
    transition.

  - Lines 1580–1611: `keyChangeInitialKeyframes`, `initialKeyframes` and
    `animateKeyframes` each wrap their value in
    `filterReducedMotionKeyframes(..., reducedMotion)`. Lines 1603–1605 is a
    comment saying "Filtered exactly like `initialKeyframes` so transforms
    are stripped under reduced motion".
  - Lines 1466: the VisualElement is already created with
    `reducedMotionConfig: motionConfig?.reducedMotion ?? 'never'`, so
    motion-dom's `mount()` already sets `shouldReduceMotion` and would apply
    the instant rule by itself. The stripping is the only thing in the way.
  - Lines 2146–2154: a comment about a removed post-mount strip pass.
  - Lines 2413–2424, the precedent for re-asserting a config flag on the
    node, because this library's `MotionConfig` is reactive and upstream's
    `mount()` only latches once:

    ```ts
    // `VisualElement.mount()` latches `shouldSkipAnimations` from the PRIVATE
    // constructor option (`this.shouldSkipAnimations = this.skipAnimationsConfig ?? false`),
    // so a `<MotionConfig skipAnimations>` toggled after mount would never
    // reach an already-mounted node. Unlike React, this library's config is
    // reactive (MotionConfig exposes property getters), so re-assert the
    // public field here. Declared AFTER the mount effect on purpose: `mount()`
    // must have latched before this overwrites it, and depending on `element`
    // means a remount re-applies the current value.
    $effect(() => {
        if (!visualElement || !element) return
        visualElement.shouldSkipAnimations = skipAnimations
    })
    ```

    The props effect that runs `animateChanges` follows directly (about line
    2435).

- `e2e/utilities/motion-config-reduced-motion.spec.ts` (63 lines) pins the
  old behavior. Lines 22–35:

  ```ts
  test("policy='always' strips transforms but still fades in opacity", async ({ page }) => {
      await page.goto(ROUTE)
      await page.getByTestId('policy-always').check()
      ...
      expect(transform === 'none' || /matrix\(1, 0, 0, 1, 0, 0\)/.test(transform)).toBe(true)
  ```

  Lines 49–62 assert the same for `policy='user'` with the OS emulated to
  `reduce`. Lines 37–47 (`'never'` reaches `matrix(1, 0, 0, 1, 200, …)`) stay
  true.

- `src/routes/tests/motion-config-reduced-motion/+page.svelte` (75 lines): the
  page behind that spec. `let policy = $state<ReducedMotionConfig>('always')`,
  radio inputs `data-testid="policy-always|user|never"`, and inside
  `<MotionConfig reducedMotion={policy}>{#key policy}` a
  `motion.div data-testid="motion-box"` with
  `initial={{ x: -200, opacity: 0 }}`, `animate={{ x: 200, opacity: 1 }}`,
  `transition={{ duration: 1.2, ease: 'easeOut' }}`. Its explanatory text
  (lines 10–17 and 52–65) describes stripping.

- `src/routes/tests/ve-signoff/+page.svelte` §6 (lines 311–376): a sign-off
  section whose text says that under `always` the box "stays put and ONLY
  fades".

- Unit-test exemplar: `src/lib/components/MotionConfig.skipAnimations.spec.ts`
  with `src/lib/components/__tests__/SkipAnimationsHarness.svelte`. It
  switches to real timers and a 16 ms `requestAnimationFrame` in
  `beforeEach`, renders, `await sleep(120)`, and reads
  `visualElementStore.get(el)!.latestValues.x`. It also has
  "applies a changed config to the next animation without remounting".
  Copy that structure.

- Docs that describe the old behavior:
  - `docs/src/routes/docs/motion-config/+page.svx`: line 83
    ("`reducedMotion` controls how transform animations behave"), line 88 (the
    `'always'` row: "Strip transform keys (`x`, `y`, `scale`, `rotate`, `skew`, …).
    Other props (opacity, color, etc.) still animate"), lines 91–101 (example
    text "Translation only runs for users who haven't requested reduced
    motion"), line 108 ("strips only transform keys"), line 182 ("go beyond
    stripping transforms").
  - `docs/src/routes/docs/use-reduced-motion-config/+page.svx`: lines 51–57
    (same table), the example text at line 71, and line 79.
  - `docs/src/routes/examples/use-reduced-motion-config/+page.svelte:77-79`
    recommends `filterReducedMotionKeyframes`, which is not a public export.
  - `docs/src/routes/docs/create-scoped-animate/+page.svx:47` already states
    the upstream behavior ("transform and layout values animate instantly, as
    `MotionConfig reducedMotion="always"` does"). Leave it.
  - `src/lib/types.ts:1055-1066` (`ReducedMotionConfig` JSDoc: "Transform
    animations … are skipped") and `:1110` ("which only strips transform
    keys").

## Commands you will need

| Purpose        | Command                                                              | Expected on success |
| -------------- | -------------------------------------------------------------------- | ------------------- |
| Install        | `pnpm install --frozen-lockfile --config.engine-strict=false`        | exit 0              |
| Browsers       | `pnpm exec playwright install chromium`                              | exit 0              |
| Unit (one)     | `pnpm exec vitest run <path>`                                        | see steps           |
| Build          | `pnpm build`                                                         | exit 0              |
| Typecheck      | `pnpm check`                                                         | 0 errors            |
| All unit tests | `pnpm test:only`                                                     | all pass            |
| e2e (own port) | `PW_PORT=4223 pnpm exec playwright test <paths> --project=chromium`  | see steps           |
| Docs build     | `pnpm --dir docs build` (after `pnpm build`)                         | exit 0              |
| Format / lint  | `trunk fmt <files>` then `trunk check <files>`                       | no issues           |

Notes:

- Port 4198 is the maintainer's live dev server. Never bind, reuse or kill it.
  Always pass `PW_PORT=4223`. Never set `PW_REUSE_SERVER`. Playwright builds
  and previews the app itself.
- Trunk is the lint and format authority. Do not run `pnpm lint` or prettier.
- Never use `git stash`.
- The docs build fetches GitHub statistics. If the network blocks it, report
  that as an environment limit, not a failure of this plan.

## Scope

**In scope** (the only files you should modify):

- `src/lib/html/_MotionContainer.svelte` (only the ranges listed in "Current state": 18–21, 321–325 comments, 589–632, 657–698, 1060–1100, 1575–1611, 2146–2154, and one new effect next to 2413–2424)
- `src/lib/utils/reducedMotionConfig.svelte.ts`
- `src/lib/utils/reducedMotionConfig.svelte.spec.ts`
- `src/lib/types.ts` (the two JSDoc passages only)
- `src/lib/components/__tests__/ReducedMotionHarness.svelte` (create)
- `src/lib/components/MotionConfig.reducedMotion.spec.ts` (create)
- `src/routes/tests/motion-config-reduced-motion/+page.svelte`
- `src/routes/tests/ve-signoff/+page.svelte` (§6 text only)
- `e2e/utilities/motion-config-reduced-motion.spec.ts`
- `docs/src/routes/docs/motion-config/+page.svx`
- `docs/src/routes/docs/use-reduced-motion-config/+page.svx`
- `docs/src/routes/examples/use-reduced-motion-config/+page.svelte` (the one sentence at lines 77–79)
- `.changeset/reduced-motion-instant-transforms.md` (create)

**Out of scope** (do NOT touch, even though they look related):

- The `onLayoutMeasure` effect in `_MotionContainer.svelte` (about lines
  3078–3096): plan 003 owns it.
- The relative-keyframe memo just above line 589 (`resolveRelativeAnimate`,
  about lines 551–587). Another audit finding targets it; keep your edit
  starting at the `filterReducedMotionDefinition` doc comment.
- `src/lib/utils/presence.ts`. The fix rides on the transition the container
  already passes in; presence needs no change.
- `src/lib/utils/animate.svelte.ts`, `animateValue.ts`, `createScopedAnimate`:
  `useAnimate` already forwards `reduceMotion` to Motion.
- `useReducedMotion` / `useReducedMotionConfig` behavior and exports.
- `docs/src/lib/examples/use-reduced-motion-config/demos/Default.svelte`. It
  calls `useReducedMotionConfig()` outside its own `<MotionConfig>`, so its
  readout ignores the radio. That is a separate docs bug: report it, do not
  fix it here.
- `docs/src/routes/docs/create-scoped-animate/+page.svx` (already correct).

## Git workflow

- Branch: `advisor/013-reduced-motion-instant-transforms`, created by hand
  from the commit that added this plan (not from `origin/main`).
- Conventional commits, for example
  `fix(motion-config): apply transform targets instantly under reduced motion, as Motion does`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Failing unit tests

Create `src/lib/components/__tests__/ReducedMotionHarness.svelte`, modelled on
`SkipAnimationsHarness.svelte`:

```svelte
<script lang="ts">
    import MotionConfig from '$lib/components/MotionConfig.svelte'
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { ReducedMotionConfig } from '$lib/types.js'

    let {
        reducedMotion = undefined,
        animateX = 200
    }: { reducedMotion?: ReducedMotionConfig; animateX?: number } = $props()
</script>

<MotionConfig {reducedMotion}>
    <MotionContainer
        tag="div"
        initial={{ x: 0, opacity: 0 }}
        animate={{ x: animateX, opacity: 1 }}
        transition={{ duration: 2, ease: 'linear' }}
    />
</MotionConfig>
```

Create `src/lib/components/MotionConfig.reducedMotion.spec.ts`. Copy the
`beforeEach` (real timers, 16 ms rAF) from `MotionConfig.skipAnimations.spec.ts`
lines 8–18, and a helper that renders the harness, `await sleep(120)`, and
returns `visualElementStore.get(el)!.latestValues`. Add a file comment citing
`visual-element-target.ts:150-164` @ v14.14.0. Tests:

1. **`'always'` jumps transforms to the target**: `latestValues.x` is `200`.
2. **`'always'` still tweens opacity**: `Number(latestValues.opacity)` is
   greater than `0` and less than `0.5` (2 s linear, read at ~120 ms).
3. **`'never'` tweens transforms**: `Number(latestValues.x)` is `>= 0` and `< 190`.
4. **no `reducedMotion` (default `'never'`) tweens transforms**: same as 3.
5. **a changed policy applies to the next animation without remounting**:
   render with `{ reducedMotion: 'never', animateX: 200 }`, `sleep(100)`,
   check `x < 190`; `rerender({ reducedMotion: 'always', animateX: 400 })`,
   `sleep(100)`; the element is the same node and `latestValues.x` is `400`.

`'user'` is not unit-tested: jsdom has no `matchMedia`. The e2e covers it.

**Verify**: `pnpm exec vitest run src/lib/components/MotionConfig.reducedMotion.spec.ts`
→ tests 1 and 5 FAIL (test 1: `expected undefined to be 200`, or `0`, because
`x` was stripped from both `initial` and `animate`; test 5: `x` stays at its
mid-tween value instead of `400`). Tests 2, 3 and 4 pass.

If test 1 passes on unmodified code, STOP and report `latestValues`.

### Step 2: Flip the e2e spec and extend its page (red)

Edit `src/routes/tests/motion-config-reduced-motion/+page.svelte`:

1. Inside the existing `{#key policy}`, after `motion-box`, add an exit
   fixture:

   ```svelte
   <AnimatePresence>
       {#if showExitBox}
           <motion.div
               data-testid="exit-box"
               initial={false}
               exit={{ x: 200, opacity: 0 }}
               transition={{ duration: 1.2, ease: 'linear' }}
               class="box"
           />
       {/if}
   </AnimatePresence>
   ```

   with `let showExitBox = $state(true)`, a button
   `data-testid="toggle-exit"` that flips it, and `showExitBox = true` reset
   when the policy changes (set it in each radio's `onchange`). Import
   `AnimatePresence` from `$lib`.
2. Rewrite the explanatory text (lines 10–17 and 52–65) to the new behavior:
   under `always` the box appears at its final position at once (no slide)
   and fades in; `user` follows the OS setting; `never` slides and fades.
3. Add a `TesterPanel` (`import TesterPanel, { type TesterStep } from '../layout/_parity/TesterPanel.svelte'`;
   see `src/routes/tests/reorder/keyboard/+page.svelte` for usage) with
   `eyebrow="Motion 14.14.0 · visual-element-target.ts"`,
   `title="MotionConfig reducedMotion"`,
   `status="Covered by e2e/utilities/motion-config-reduced-motion.spec.ts."`
   and steps:
   1. "Load the page (policy `always`)." Expected: "The box appears on the
      right at once, with no slide, and fades in over about a second."
   2. "Click Hide exit box." Expected: "The lower box jumps 200 px right at
      once and fades out there. It never slides."
   3. "Choose `never`." Expected: "The box slides in from the left while
      fading in; Hide exit box slides it right while fading."
   4. "Choose `user`, then toggle DevTools > Rendering > Emulate
      prefers-reduced-motion, and choose `user` again." Expected: "With
      `reduce` it behaves like `always`; with `no-preference`, like `never`."

Edit `e2e/utilities/motion-config-reduced-motion.spec.ts`:

1. In `test.beforeEach`, before navigation, install a per-frame sampler with
   `page.addInitScript`. It records, every animation frame, one sample per
   element matching `[data-testid="motion-box"], [data-testid="exit-box"]`:
   `{ id: el.dataset.testid, sid, tx, opacity }`, where `sid` is a number
   assigned to each element the first time it is seen (store it on the element,
   e.g. `el.__sid ??= ++counter`) so samples from a box replaced by
   `{#key policy}` can be told apart, `tx` is `0` for `transform: none` or
   `new DOMMatrixReadOnly(transform).m41` otherwise, and `opacity` is
   `Number(getComputedStyle(el).opacity)`. Push to `window.__samples`.
   Add a helper that returns the samples for one `id`, restricted to the
   highest `sid` seen for it (the box that is mounted now).
2. Replace the `'always'` test (lines 22–35) with
   **"policy='always' applies transforms instantly while opacity still fades"**:
   go to `ROUTE`; check `policy-always`; wait with the existing
   `waitForAnimationsToFinish`; assert the final transform matches
   `/matrix\(1,\s*0,\s*0,\s*1,\s*200/`; assert some `motion-box` sample has
   `Math.abs(tx - 200) < 0.5` and `0.05 < opacity < 0.95` (at 200 while still
   fading in); assert no sample has `-190 < tx < 190` (no intermediate
   translate).
3. Keep the `'never'` test (lines 37–47) and add: some `motion-box` sample
   has `-190 < tx < 190` (it really tweened).
4. Replace the `'user'` + OS `reduce` test (lines 49–62) with the same
   assertions as the new `'always'` test.
5. Add **"policy='user' with no OS preference tweens transforms"**:
   `emulateMedia({ reducedMotion: 'no-preference' })` (already done by
   `beforeEach`), check `policy-user`, then the `'never'` assertions.
6. Add **"policy='always' exit jumps transforms and fades opacity"**: go to
   `ROUTE`, check `policy-always`, wait for `motion-box` to finish, click
   `toggle-exit`, then `expect.poll` until no `[data-testid="exit-box"]` is
   attached; assert some `exit-box` sample taken after the click has
   `Math.abs(tx - 200) < 0.5` and `0.05 < opacity < 0.95`, and none has
   `10 < tx < 190`. (Clear `window.__samples` just before the click so only
   exit samples count. The exit clone keeps `data-testid`.)
7. Add **"policy='never' exit tweens transforms"**: the same with
   `policy-never`, asserting some exit sample has `10 < tx < 190`.

Rename the `test.describe` comment or title only if needed; keep the route.

**Verify**: `PW_PORT=4223 pnpm exec playwright test e2e/utilities/motion-config-reduced-motion.spec.ts --project=chromium`
→ the new `'always'`, `'user'` + reduce, and `'always'` exit tests FAIL (the
box stays at `tx` 0: the final-transform assertion reports
`matrix(1, 0, 0, 1, 0, 0)` or `none`; the exit samples never reach 200). The
`'never'`, `'user'` + no-preference and `'never'` exit tests PASS.

If the `'always'` enter test passes on unmodified code, STOP and report the
samples.

### Step 3: Stop stripping; let motion-dom apply the instant rule

In `src/lib/html/_MotionContainer.svelte`:

1. Delete `filterReducedMotionDefinition` and `reducedMotionVariants`
   (lines 589–632, doc comments included).
2. In `buildMotionNodeProps`, pass the values unfiltered:
   `initial: effectiveInitialProp`,
   `animate: animateControls ? undefined : resolveRelativeAnimate(declarativeAnimateProp)`,
   `variants: variantsProp`, and `whileHover: whileHoverProp` … `whilePinch: whilePinchProp`.
   Replace the comment at lines 657–662 ("Filtered too: under a reducing
   policy …") with one line saying reduced motion is applied by motion-dom
   per value (`visual-element-target.ts:150-164` @ v14.14.0), not by
   filtering targets.
3. In `resolvePresenceExit` (lines 1068–1078), return
   `resolved as DOMKeyframesDefinition` without filtering.
4. Thread `reduceMotion` into the exit transition next to `skipAnimations`
   (line 1095), so an unheld clone animated by vanilla `animate()` is reduced
   too (`effects.ts:73` @ v14.14.0):

   ```ts
   {
       ...mergedTransition,
       ...(skipAnimations ? { skipAnimations: true } : {}),
       ...(reducedMotion ? { reduceMotion: true } : {})
   },
   ```

   Extend the comment above it by one sentence covering `reduceMotion`. If
   the transition's type rejects `reduceMotion`, cast that one spread
   (`as MotionTransition`) rather than widening a public type.
5. Remove the `filterReducedMotionKeyframes(...)` wrappers from
   `keyChangeInitialKeyframes`, `initialKeyframes` and `animateKeyframes`
   (lines 1580–1611), keeping each inner expression and its cast, and fix the
   comment at lines 1603–1605 so it no longer says transforms are stripped.
6. Rewrite the comment at lines 2146–2154 in two sentences: there is no
   strip pass; reduced motion is the node's `shouldReduceMotion`.
7. Directly after the `shouldSkipAnimations` effect (lines 2413–2424) and
   before the props effect, add:

   ```ts
   // `VisualElement.mount()` latches `shouldReduceMotion` from the
   // `reducedMotionConfig` given at creation (VisualElement.ts:498-507 @
   // v14.14.0). This library's MotionConfig and the OS preference are
   // reactive, so re-assert the resolved policy, as for skipAnimations
   // above. motion-dom then makes positional values (transforms, width,
   // height, top/left/right/bottom) and layout animations instant, and
   // leaves the rest animating.
   $effect(() => {
       if (!visualElement || !element) return
       visualElement.shouldReduceMotion = reducedMotion
   })
   ```

8. Change the import at lines 18–21 to
   `import { useReducedMotionConfig } from '$lib/utils/reducedMotionConfig.svelte'`.

**Verify**:

- `grep -c "filterReducedMotion" src/lib/html/_MotionContainer.svelte` prints `0`.
- `pnpm exec vitest run src/lib/components/MotionConfig.reducedMotion.spec.ts` → all 5 PASS.
- `PW_PORT=4223 pnpm exec playwright test e2e/utilities/motion-config-reduced-motion.spec.ts --project=chromium` → all PASS.

If the e2e exit test still fails while the enter tests pass, check whether the
exit box's clone was "held" (it should not be: it has no `layout`). STOP and
report if `reduceMotion` on the transition does not reach the clone's
animation.

### Step 4: Delete the dead helper

In `src/lib/utils/reducedMotionConfig.svelte.ts`, delete `TRANSFORM_KEYS`
(lines 5–33) and `filterReducedMotionKeyframes` with its JSDoc (lines 35–79).
In `src/lib/utils/reducedMotionConfig.svelte.spec.ts`, delete the
`describe('filterReducedMotionKeyframes', …)` block (lines 42–75) and drop the
name from the import (line 10). Leave every `useReducedMotionConfig` test.

**Verify**:

- `grep -rn "filterReducedMotionKeyframes" src docs/src` returns nothing
  (the docs mention is removed in Step 5; run this check again after Step 5
  if it still lists the docs file).
- `pnpm exec vitest run src/lib/utils/reducedMotionConfig.svelte.spec.ts` → all pass.
- `pnpm check` → 0 errors.

### Step 5: Docs, JSDoc and the sign-off page

Use upstream's wording as the reference: Motion switches transform (and
layout) animations off, it does not remove the values.

- `docs/src/routes/docs/motion-config/+page.svx`:
  - Line 83: "`reducedMotion` controls whether transform and layout
    animations run for descendants."
  - The `'always'` row (line 88): "Transform and layout values (`x`, `y`,
    `scale`, `rotate`, `skew`, `width`, `height`, `top`, `left`, …) jump
    straight to their target with no animation. Other values (opacity,
    colour, etc.) still animate."
  - The example (lines 91–101): keep the code; change the text to "Always
    fades in. It slides in only for users who haven't asked for reduced
    motion; otherwise it appears in place and fades."
  - Line 108: "Unlike `reducedMotion="always"`, which only makes transform
    and layout values instant while opacity, colour and other values keep
    animating, …"
  - Line 182: "beyond making transforms instant".
- `docs/src/routes/docs/use-reduced-motion-config/+page.svx`: the same
  changes to lines 51–57 (table and lead sentence), the example text at line
  71, and line 79.
- `docs/src/routes/examples/use-reduced-motion-config/+page.svelte:77-79`:
  replace "Pair with `filterReducedMotionKeyframes` if you're hand-rolling
  animation paths." with "For hand-rolled animations, pass it to
  `useAnimate` or `createScopedAnimate({ reduceMotion })`." (keep the
  `<code>` markup style of the surrounding text).
- `src/lib/types.ts:1055-1066`: the `'always'` bullet becomes "Transform and
  layout values (x, y, scale, rotate, skew, width, height, top, left, …)
  are applied instantly instead of animating. Other properties such as
  `opacity` and `color` still animate." At line 1110: "which only makes
  transform and layout values instant".
- `src/routes/tests/ve-signoff/+page.svelte` §6 (lines 311–376): update the
  "Exercises" paragraph (no filter; the node's `shouldReduceMotion`), the
  REFRESH TEST paragraph ("PASS: it appears at its final position with no
  slide and fades in"), and the PASS/FAIL boxes ("On `always` it appears at
  the right at once and only fades … FAIL: under `always` the box slides, or
  stays at the left, or the fade re-runs").

**Verify**:

- `grep -rn -i "strip transform\|strips only transform\|stripping transforms\|only strips transform" docs/src src/lib src/routes` returns nothing.
- `pnpm build && pnpm --dir docs build` → exit 0.

### Step 6: Regression gate

```bash
pnpm test:only
PW_PORT=4223 pnpm exec playwright test e2e/utilities e2e/animate-presence e2e/motion/ai-glow-border.spec.ts --project=chromium
```

**Verify**: all pass. For an e2e failure, re-run that one spec alone once. If
it fails again and passes on the code before Step 3, STOP and report the spec
and assertion.

### Step 7: Changeset

Create `.changeset/reduced-motion-instant-transforms.md`:

```md
---
'@humanspeak/svelte-motion': patch
---

Under `<MotionConfig reducedMotion="always">`, or `"user"` when the OS asks for reduced motion, transform and layout values (`x`, `y`, `scale`, `rotate`, `width`, `height`, `top`, `left`, …) now jump straight to their target instead of being dropped, as in Motion. `animate={{ x: 200, opacity: 1 }}` puts the element at 200 at once and fades it in; before, it stayed at 0. Opacity, colour and other values still animate. Exit animations follow the same rule.
```

### Step 8: Full gate

Run `pnpm build`, `pnpm check`, `pnpm test:only`, the e2e commands from Steps
3 and 6 once more, then `trunk fmt` and `trunk check` on every in-scope file,
then `git diff --check`.

**Verify**: every command exits 0; `trunk check` reports no issues.

## Test plan

- Red first, two layers:
  - Unit `MotionConfig.reducedMotion.spec.ts` tests 1 and 5 fail on current
    code (`x` is `undefined`/`0` under `'always'`; a live policy flip does not
    make the next animation instant) and pass after Step 3.
  - e2e `motion-config-reduced-motion.spec.ts`: the flipped `'always'` and
    `'user'` + reduce tests fail with the box at `matrix(1, 0, 0, 1, 0, 0)`,
    and the `'always'` exit test fails with the clone never reaching 200.
- Controls that pass before and after: unit tests 2–4; e2e `'never'`,
  `'user'` + no-preference, `'never'` exit.
- `'user'` honoring `prefers-reduced-motion` is checked both ways in e2e
  (`emulateMedia` `reduce` and `no-preference`).
- Patterns: `MotionConfig.skipAnimations.spec.ts` + `SkipAnimationsHarness.svelte`
  (unit); the existing spec file itself (e2e); the keyboard Reorder page for
  `TesterPanel` usage.

## Done criteria

- [ ] `pnpm exec vitest run src/lib/components/MotionConfig.reducedMotion.spec.ts` exits 0 (5 tests)
- [ ] `PW_PORT=4223 pnpm exec playwright test e2e/utilities e2e/animate-presence e2e/motion/ai-glow-border.spec.ts --project=chromium` exits 0
- [ ] `pnpm check`, `pnpm test:only`, `pnpm build` and `pnpm --dir docs build` exit 0
- [ ] `grep -rn "filterReducedMotionKeyframes\|TRANSFORM_KEYS" src docs/src` returns nothing
- [ ] `grep -c "shouldReduceMotion = reducedMotion" src/lib/html/_MotionContainer.svelte` prints `1`
- [ ] `grep -c "reduceMotion: true" src/lib/html/_MotionContainer.svelte` prints `1`
- [ ] `grep -c "strips transforms but still fades" e2e/utilities/motion-config-reduced-motion.spec.ts` prints `0`
- [ ] `trunk check` on the changed files reports no issues
- [ ] `git status --short` lists only in-scope files
- [ ] The status row in `.agents/.plans/reactive-tracking-leaks/README.md` is updated

## STOP conditions

Stop and report back (do not improvise) if:

- Unit test 1 or the e2e `'always'` enter test passes on unmodified code.
- Any excerpt in "Current state" does not match the live code.
- With stripping removed, transforms still tween under `'always'` (that would
  mean the VisualElement's `shouldReduceMotion` is not reaching motion-dom,
  and the plan's premise is wrong).
- The fix appears to need changes in `presence.ts`, `motionDomProjection.ts`
  or another out-of-scope file.
- An e2e spec outside `motion-config-reduced-motion.spec.ts` fails after
  Step 3 and passes before it.

## Maintenance notes

- **Overlap with other plans** (same files, different regions; no plan needs
  code from another, so no `Depends on`):
  - `_MotionContainer.svelte`: 003 edits only the `onLayoutMeasure` effect
    (about 3078–3096); 006 the gesture effects (about 3589–3625); 007 (wave 2)
    the key-transition effect (about 3795–3917); 014 (wave 2) the gesture
    effects after 006. This plan's ranges (18–21, 589–698, 1060–1100,
    1575–1611, 2146–2154, 2413–2435) touch none of them. Any future plan for
    the relative-keyframe memo (`resolveRelativeAnimate`, about 551–587) sits
    directly above this plan's first deletion at 589; whichever lands second
    rebases that boundary by hand.
  - `src/lib/types.ts`: 014 edits the gesture callback types (about 466–480);
    this plan edits only the JSDoc at 1055–1066 and 1110.
  - The coordinator should decide whether same-file, disjoint-region overlap
    in wave 1 is acceptable (003 and 006 already share `_MotionContainer.svelte`
    in wave 1) or whether to move this plan to wave 2 for merge order.
- **Live policy changes** go slightly beyond upstream on purpose, following
  the repo's `skipAnimations` precedent: upstream latches `shouldReduceMotion`
  at mount; here the effect re-asserts it when `MotionConfig reducedMotion` or
  the OS preference changes. In-flight animations are not retargeted; the
  next animation uses the new policy.
- Layout (FLIP) animations were already instant under a reducing policy
  before this plan, because the VisualElement was already created with
  `reducedMotionConfig` and the projection reads `shouldReduceMotion`. They
  now also follow live policy changes.
- The batch README says size and inset keys "still tween" today. By reading,
  motion-dom already made them instant (they are in `positionalKeys` and the
  node already had `shouldReduceMotion`), so only transforms visibly change.
  Not verified by a test in this plan.
- Reviewer: check that nothing still removes keys from targets under reduced
  motion, and that the exit transition carries `reduceMotion` only when
  reducing (an explicit `false` would be harmless, but keep the diff minimal).
- Follow-up, not done here: the docs demo
  `docs/src/lib/examples/use-reduced-motion-config/demos/Default.svelte` reads
  `useReducedMotionConfig()` outside the `<MotionConfig>` it renders, so its
  "resolved" readout never reflects the radio.
