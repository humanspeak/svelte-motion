# Plan 001: Expose `skipAnimations` on `<MotionConfig>` as a subtree-wide animation kill switch

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan in
> `.agents/.plans/motion-config-skip-animations/README.md` — unless a reviewer
> dispatched you and told you they maintain the index.
>
> **Drift check (run first)**:
>
> ```bash
> git diff --stat dd838b1..HEAD -- \
>   src/lib/types.ts \
>   src/lib/components/MotionConfig.svelte \
>   src/lib/html/_MotionContainer.svelte \
>   src/lib/utils/animate.svelte.ts \
>   docs/src/routes/docs/motion-config/+page.svx \
>   src/routes/+page.svelte
> ```
>
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: direction (feature parity)
- **Planned at**: commit `dd838b1`, 2026-08-28

## Why this matters

`@humanspeak/svelte-motion` mirrors Framer Motion's API. Upstream
framer-motion 13.1.1 ships `<MotionConfig skipAnimations>` — a boolean that
makes every animation in the subtree jump straight to its final value instead
of tweening. It is the standard escape hatch for E2E tests, visual-regression
screenshots, and "prefers no motion at all" surfaces where `reducedMotion`
(which only strips transforms) is not enough.

This library already threads a `skipAnimations` option into the motion-dom
`VisualElement` it creates (`src/lib/utils/visualElementCore.ts:431`, passed
at `:480`/`:496`), but nothing ever sets it: `MotionConfigProps` has no such
field, so the option is permanently `undefined`. The runtime plumbing that
makes this work — motion-dom's `animateMotionValue` checking
`element?.shouldSkipAnimations` — is already in the installed dependency. This
plan connects the two ends.

Competitive note (context only, do not act on it): this is currently the only
API a rival Svelte port (`motion-sv` 0.1.13) ships that this library does not.

## Current state

### Files involved

- `src/lib/types.ts` — public type surface. `MotionConfigProps` is declared at
  lines 803–812.
- `src/lib/components/MotionConfig.svelte` — the whole component, 35 lines.
- `src/lib/components/motionConfig.context.ts` — `getMotionConfig()` /
  `createMotionConfig()` over a `Symbol('motionConfig')` context key.
- `src/lib/html/_MotionContainer.svelte` — ~3000-line component behind every
  `motion.<tag>`. Creates the `VisualElement`, drives animations, registers
  with `AnimatePresence`.
- `src/lib/utils/animate.svelte.ts` — `useAnimate()`.
- `src/lib/utils/presence.ts` — `AnimatePresence`'s clone-based exit path.
- `src/lib/utils/visualElementCore.ts` — `createMotionVisualElement()`; already
  accepts and forwards `skipAnimations`. **Do not modify this file.**

### `src/lib/types.ts:803-812` (as it exists today)

```ts
export type MotionConfigProps = {
    /** Animation configuration */
    transition?: MotionTransition
    /**
     * Reduced-motion policy applied to descendant motion elements.
     *
     * Defaults to `'never'`. See {@link ReducedMotionConfig}.
     */
    reducedMotion?: ReducedMotionConfig
}
```

### `src/lib/components/MotionConfig.svelte` (entire file, as it exists today)

```svelte
<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { MotionConfigProps } from '$lib/types'
    import { createMotionConfig } from '$lib/components/motionConfig.context'

    /**
     * Provide default Motion configuration to descendants.
     *
     * Wraps content and supplies defaults such as `transition` and
     * `reducedMotion` that are merged with per-element props. Descendants can
     * retrieve config via context.
     *
     * @prop transition Default `AnimationOptions` merged with element props.
     * @prop reducedMotion Reduced-motion policy: `'user' | 'always' | 'never'`.
     *   Defaults to `'never'`.
     * @prop children Slotted content receiving this configuration.
     */
    let { transition, reducedMotion, children }: MotionConfigProps & { children?: Snippet } =
        $props()

    // Use property getters so descendants always read the parent's current
    // prop values — including remounted children inside `{#key}` blocks, which
    // would otherwise see a stale snapshot if we cached the value in $state.
    const motionConfig: MotionConfigProps = {
        get transition() {
            return transition
        },
        get reducedMotion() {
            return reducedMotion
        }
    }
    createMotionConfig(motionConfig)
</script>

{@render children?.()}
```

**Note the bug**: this component does NOT merge the parent `MotionConfig`. A
nested `<MotionConfig transition={...}>` shadows the outer config entirely, so
descendants see `reducedMotion: undefined`. The public docs at
`docs/src/routes/docs/motion-config/+page.svx:106-118` explicitly claim the
opposite ("props from outer configs that aren't overridden still apply"), and
upstream framer-motion does merge
(`config = { ...parentConfig, ...config }`, framer-motion
`src/components/MotionConfig/index.tsx:35`). Left unfixed, a nested
`<MotionConfig>` would silently re-enable animations inside a
`skipAnimations` subtree — so this plan fixes it (Step 3).

### `src/lib/html/_MotionContainer.svelte` — the five touch points

1. **Config read (line 263 and 269–273, as it exists today)**

```ts
    const motionConfig = $derived(getMotionConfig())
    const lazyMotion = getLazyMotionContext()
    const activeFeatures = $derived(lazyMotion?.getFeatures() ?? domMax)
    const hasGestureFeatures = $derived(!!activeFeatures.gestures)
    const hasDragFeatures = $derived(!!activeFeatures.drag)
    const hasLayoutFeatures = $derived(!!activeFeatures.layout)
    const reducedMotionState = useReducedMotionConfig()
    // `.current` is $state-backed inside reducedMotionState; tracking it via
    // $derived makes `reducedMotion` re-evaluate whenever the OS preference
    // or `<MotionConfig reducedMotion>` policy changes.
    const reducedMotion = $derived(reducedMotionState.current)
```

2. **`VisualElement` creation (lines 1069–1074, as it exists today)** — inside
   an `untrack(() => createMotionVisualElement({ ... }))`:

```ts
                      context: {
                          initial: inheritedInitialVariant,
                          animate: effectiveAnimate
                      },
                      reducedMotionConfig: motionConfig?.reducedMotion ?? 'never',
                      isSVG: isSVGTag(String(tag))
                  })
```

3. **`AnimatePresence` registration (lines 763–787, as it exists today)**

```ts
    // Reactively update registration when element/exit/transition props change
    $effect(() => {
        if (element && shouldRegisterPresenceExit && exitProp !== undefined) {
            const resolvePresenceExit = (custom: unknown) => { /* … unchanged … */ }
            const filteredExit = resolvePresenceExit(resolvePresenceCustom())
            context.registerChild(
                presenceKey,
                element,
                filteredExit,
                mergedTransition,
                resolvePresenceExit
            )
        }
    })
```

4. **Optimized-appear gate (lines 1196–1203, as it exists today)**

```ts
    const optimizedAppearId = $derived(
        effectiveInitialProp !== false &&
            isNotEmpty(initialKeyframes) &&
            isNotEmpty(animateKeyframes) &&
            !optimizedAppearSuppressedByTransformTemplate
            ? `svelte-motion-${componentHydrationId}`
            : undefined
    )
```

5. **Mount effect (lines 2071–2111, as it exists today)** — the effect that
   ends with:

```ts
        return () => {
            offStart()
            offComplete()
            if (visualElement.current === mounted) visualElement.unmount()
            visualElementStore.delete(mounted)
        }
    })
```

### How the runtime honors it (already installed, do not modify)

`node_modules/motion-dom@13.1.1`:

- `VisualElement` constructor stores the `skipAnimations` option privately;
  `mount()` latches it: `this.shouldSkipAnimations = this.skipAnimationsConfig ?? false`.
  `shouldSkipAnimations` is a **public, writable** field
  (`node_modules/motion-dom/dist/index.d.ts:1635` — `shouldSkipAnimations: boolean;`).
- `animateMotionValue` skips and jumps to the final keyframe when
  `MotionGlobalConfig.skipAnimations || element?.shouldSkipAnimations ||
  valueTransition.skipAnimations`.
- `animateTarget` copies `transition.skipAnimations` onto every per-value
  transition, so a plain `animate(el, keyframes, { skipAnimations: true })`
  from the `motion` package is also instant (`animate` → `animateSubject` →
  `animateTarget`).
- `createScopedAnimate(options)` accepts `skipAnimations`
  (`ScopedAnimateOptions` at
  `node_modules/.pnpm/framer-motion@13.1.1/node_modules/framer-motion/dist/dom.d.ts:87-91`).

Because every declarative animation in this library already runs through
`visualElement.animationState` → `animateVisualElement` → `animateTarget` →
`animateMotionValue`, setting `shouldSkipAnimations` on the node covers
`animate`, `initial`, `variants`, `exit`, `whileHover`/`whileTap`/`whileFocus`/
`whileInView`/`whileDrag`, and the `useAnimationControls()` imperative path for
free. The paths that need explicit threading are the ones that bypass the node:
the `AnimatePresence` clone exit, the optimized-appear WAAPI bootstrap, and
`useAnimate`.

### Repo conventions to match

- **Google-style JSDoc** on every public type, component prop, and exported
  function. See `src/lib/types.ts:791-801` (the `ReducedMotionConfig` doc block)
  and `src/lib/utils/animate.svelte.ts:25-71` for the house style: a summary
  line, `@param`/`@returns`, an `@example` fenced block, and a `@see` link to
  the matching motion.dev doc.
- **4-space indent, no semicolons, single quotes** (Prettier config is enforced
  by Trunk).
- **Comments explain _why_, and cite upstream** — e.g.
  `src/lib/html/_MotionContainer.svelte:2064-2070`. Match that density; this
  codebase is heavily commented and a bare change will look out of place.
- **Tests** are `*.spec.ts` colocated with the source. Behavioral tests that
  need motion-dom's frame loop must call `vi.useRealTimers()` and shim
  `requestAnimationFrame` — see the exemplar quoted in Step 1.
- **Test/demo pages** live at `src/routes/tests/<feature>/+page.svelte` and are
  linked from `src/routes/+page.svelte`. **E2E specs** live at
  `e2e/<area>/<feature>.spec.ts`.

## Commands you will need

| Purpose         | Command                                                          | Expected on success                     |
| --------------- | ---------------------------------------------------------------- | --------------------------------------- |
| Install         | `pnpm install`                                                    | exit 0                                  |
| Unit tests      | `pnpm test:only`                                                  | all pass                                |
| Single spec     | `npx vitest run <path/to/spec.ts>`                                | as stated per step                      |
| Typecheck       | `pnpm check`                                                      | exit 0, 0 errors                        |
| Package build   | `pnpm build`                                                      | exit 0 (also required before docs work) |
| Lint            | `trunk check --fix`                                               | exit 0 (Trunk is the lint authority)    |
| Format          | `trunk fmt`                                                       | exit 0                                  |
| E2E (one spec)  | `npx playwright test e2e/utilities/motion-config-skip-animations.spec.ts` | all pass                       |

**E2E server rules (important):**

- Playwright is pinned to port **4198** (`playwright.config.ts`). Never kill a
  server on 4198 — a human may be using it for sign-off.
- By default `pnpm test:e2e` runs `npm run build && npm run preview -- --port 4198`.
  If 4198 is already occupied the run fails fast. In that case, run against the
  existing server with `PW_REUSE_SERVER=1 npx playwright test <spec>` **only if
  you know that server is running current code**; otherwise report and stop.

## Scope

**In scope** (the only files you may modify or create):

- `src/lib/types.ts` (modify)
- `src/lib/components/MotionConfig.svelte` (modify)
- `src/lib/html/_MotionContainer.svelte` (modify)
- `src/lib/utils/animate.svelte.ts` (modify)
- `src/lib/components/__tests__/SkipAnimationsHarness.svelte` (create)
- `src/lib/components/__tests__/NestedMotionConfigProbe.svelte` (create)
- `src/lib/components/MotionConfig.skipAnimations.spec.ts` (create)
- `src/lib/components/MotionConfig.spec.ts` (modify — add nesting tests)
- `src/lib/utils/animate.spec.ts` (modify — add one test)
- `src/routes/tests/motion-config-skip-animations/+page.svelte` (create)
- `src/routes/+page.svelte` (modify — one list item)
- `e2e/utilities/motion-config-skip-animations.spec.ts` (create)
- `docs/src/routes/docs/motion-config/+page.svx` (modify)

**Out of scope** (do NOT touch, even though they look related):

- `src/lib/utils/visualElementCore.ts` — already forwards `skipAnimations`
  correctly. No change needed; a change here would be pure churn.
- `src/lib/utils/presence.ts` — the clone exit path is fixed from the
  `_MotionContainer` call site (Step 6), not by editing `presence.ts`. Its
  `registerChild` signature already accepts a transition object.
- `src/lib/utils/drag.ts`, `src/lib/utils/dragInertia.ts` — drag momentum /
  inertia is NOT skipped by upstream's `skipAnimations` either (it does not
  route through `animateMotionValue`'s `element` parameter). Leaving it alone
  is deliberate parity, not an oversight.
- Layout / FLIP projection animations (`src/lib/utils/layout.ts`,
  `src/lib/utils/motionDomProjection.ts`, `src/lib/utils/projection.ts`).
  Upstream's `skipAnimations` does not skip projection animations either. Do
  not add `skipAnimations` to the shared `mergedTransition` derived value —
  that would leak into the projection adapter's `updateOptions({ transition })`
  at `_MotionContainer.svelte:2019-2027` and silently change layout behavior.
- `.competitive-intel/state.json` — a scheduled nightly job owns that file.
- `MotionGlobalConfig.skipAnimations` (the process-wide motion-dom global). It
  already works for consumers via the `motion` package; this plan is about the
  scoped component API only.
- `README.md`, `CHANGELOG.md`, `.changeset/` — the repo's release tooling owns
  those.

## Git workflow

- Branch: `feat/motion-config-skip-animations` (branch from the current HEAD;
  do not commit onto `main`).
- Conventional commits, matching `git log` in this repo — e.g.
  `feat: MotionConfig skipAnimations global animation kill switch`.
- Commit per logical step group is fine.
- Do NOT push or open a PR. The repo owner drives the live demo and sign-off
  before any PR is opened.

## Steps

### Step 1: Write the failing behavioral test (RED)

Create the harness `src/lib/components/__tests__/SkipAnimationsHarness.svelte`:

```svelte
<script lang="ts">
    import MotionConfig from '$lib/components/MotionConfig.svelte'
    import MotionContainer from '$lib/html/_MotionContainer.svelte'

    let { skipAnimations = undefined }: { skipAnimations?: boolean } = $props()
</script>

<MotionConfig {skipAnimations}>
    <MotionContainer
        tag="div"
        initial={{ x: 0 }}
        animate={{ x: 200 }}
        transition={{ duration: 2, ease: 'linear' }}
    />
</MotionConfig>
```

Create `src/lib/components/MotionConfig.skipAnimations.spec.ts`. Model it
structurally on `src/lib/html/_MotionContainer.arc.spec.ts` — in particular
copy its `beforeEach` verbatim, because the shared Vitest setup installs fake
timers that freeze motion-dom's frame loop:

```ts
import { sleep } from '$lib/utils/testing'
import { render } from '@testing-library/svelte'
import { visualElementStore } from 'motion-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SkipAnimationsHarness from './__tests__/SkipAnimationsHarness.svelte'

describe('MotionConfig.skipAnimations', () => {
    beforeEach(() => {
        // The shared Vitest setup installs fake timers; motion-dom's frame
        // loop needs real ones (see vitest-setup-client.ts).
        vi.useRealTimers()
        ;(globalThis as never as { requestAnimationFrame: unknown }).requestAnimationFrame = (
            callback: FrameRequestCallback
        ) => setTimeout(() => callback(performance.now()), 16) as unknown as number
        ;(globalThis as never as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (
            id: number
        ) => clearTimeout(id)
    })

    /** Render the harness, settle a few frames, and read the node's live `x`. */
    const renderAndReadX = async (skipAnimations: boolean | undefined): Promise<unknown> => {
        const { container } = render(SkipAnimationsHarness as unknown as any, {
            props: { skipAnimations }
        })
        await sleep(120)
        const el = container.querySelector('div') as HTMLElement
        return visualElementStore.get(el)!.latestValues.x
    }

    it('jumps straight to the final value instead of tweening', async () => {
        expect(await renderAndReadX(true)).toBe(200)
    })

    it('skipAnimations={false} still tweens', async () => {
        const x = Number(await renderAndReadX(false))
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThan(190)
    })

    it('no skipAnimations still tweens', async () => {
        const x = Number(await renderAndReadX(undefined))
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThan(190)
    })
})
```

**Verify**: `npx vitest run src/lib/components/MotionConfig.skipAnimations.spec.ts`
→ the first test FAILS with roughly `expected <a small number, e.g. 8.7> to be 200`
(the other two PASS). If the first test passes, the reproduction is wrong —
STOP and report.

Do NOT run `pnpm check` yet: `skipAnimations` is not on `MotionConfigProps`
until Step 2, so `svelte-check` will legitimately error here.

### Step 2: Add `skipAnimations` to `MotionConfigProps`

In `src/lib/types.ts`, extend the `MotionConfigProps` type (currently lines
803–812) with a documented `skipAnimations` field:

```ts
export type MotionConfigProps = {
    /** Animation configuration */
    transition?: MotionTransition
    /**
     * Reduced-motion policy applied to descendant motion elements.
     *
     * Defaults to `'never'`. See {@link ReducedMotionConfig}.
     */
    reducedMotion?: ReducedMotionConfig
    /**
     * Skip animations entirely for descendant motion elements.
     *
     * When `true`, every animation in the subtree jumps straight to its final
     * value instead of tweening — `animate`, `initial`, variants, `exit`, the
     * `whileX` gestures, `useAnimationControls()` and `useAnimate()`. Intended
     * for E2E tests and visual-regression screenshots, where a deterministic
     * settled frame matters more than the transition.
     *
     * Unlike {@link ReducedMotionConfig}, which only strips transform keys,
     * this disables the tween for every animated property.
     *
     * Defaults to `false`. Layout/FLIP projection animations and drag momentum
     * are unaffected, matching Framer Motion.
     *
     * @see https://motion.dev/docs/react-motion-config
     */
    skipAnimations?: boolean
}
```

**Verify**: `npx tsc --noEmit -p tsconfig.json 2>&1 | head -20` → no error
mentioning `skipAnimations` on `MotionConfigProps`. (Unrelated pre-existing
errors, if any, are fine; note them and move on.)

### Step 3: Accept the prop in `MotionConfig.svelte` and inherit from the parent config

Rewrite the `<script>` block of `src/lib/components/MotionConfig.svelte` to:

```svelte
<script lang="ts">
    import type { Snippet } from 'svelte'
    import type { MotionConfigProps } from '$lib/types'
    import { createMotionConfig, getMotionConfig } from '$lib/components/motionConfig.context'

    /**
     * Provide default Motion configuration to descendants.
     *
     * Wraps content and supplies defaults such as `transition`,
     * `reducedMotion` and `skipAnimations` that are merged with per-element
     * props. Descendants can retrieve config via context.
     *
     * @prop transition Default `AnimationOptions` merged with element props.
     * @prop reducedMotion Reduced-motion policy: `'user' | 'always' | 'never'`.
     *   Defaults to `'never'`.
     * @prop skipAnimations When `true`, descendant animations jump to their
     *   final value instead of tweening. Defaults to `false`.
     * @prop children Slotted content receiving this configuration.
     */
    let {
        transition,
        reducedMotion,
        skipAnimations,
        children
    }: MotionConfigProps & { children?: Snippet } = $props()

    // Read the ancestor config BEFORE `createMotionConfig` shadows the context
    // key for this subtree. Upstream merges the parent context into its own
    // (`config = { ...parentConfig, ...config }`, framer-motion
    // components/MotionConfig/index.tsx:35), so a nested config that sets only
    // `transition` still inherits the outer `reducedMotion`/`skipAnimations`.
    // Without this, a nested <MotionConfig> silently re-enables animations
    // inside a skipAnimations subtree.
    const parentConfig = getMotionConfig()

    // Use property getters so descendants always read the parent's current
    // prop values — including remounted children inside `{#key}` blocks, which
    // would otherwise see a stale snapshot if we cached the value in $state.
    // The `??` fallbacks stay inside the getters so inheritance is re-resolved
    // on every read rather than frozen at init.
    const motionConfig: MotionConfigProps = {
        get transition() {
            return transition ?? parentConfig?.transition
        },
        get reducedMotion() {
            return reducedMotion ?? parentConfig?.reducedMotion
        },
        get skipAnimations() {
            return skipAnimations ?? parentConfig?.skipAnimations
        }
    }
    createMotionConfig(motionConfig)
</script>

{@render children?.()}
```

Then add nesting coverage to `src/lib/components/MotionConfig.spec.ts`. Create
`src/lib/components/__tests__/NestedMotionConfigProbe.svelte`, modelled on the
existing `src/lib/components/__tests__/MotionConfigWithProbe.svelte` and
`Probe.svelte`:

```svelte
<script lang="ts">
    import MotionConfig from '$lib/components/MotionConfig.svelte'
    import { getMotionConfig } from '$lib/components/motionConfig.context.js'
    import type { ReducedMotionConfig } from '$lib/types'
</script>

{#snippet probe()}
    {@const cfg = getMotionConfig()}
    <div
        data-testid="inner-probe"
        data-duration={(cfg?.transition as { duration?: number } | undefined)?.duration ?? 'none'}
        data-reduced={cfg?.reducedMotion ?? 'none'}
        data-skip={String(cfg?.skipAnimations ?? 'none')}
    ></div>
{/snippet}

<MotionConfig
    transition={{ duration: 0.5 }}
    reducedMotion={'always' as ReducedMotionConfig}
    skipAnimations
>
    <MotionConfig transition={{ duration: 0.2 }}>
        {@render probe()}
    </MotionConfig>
</MotionConfig>
```

> If `getMotionConfig()` inside a `{#snippet}` does not resolve the inner
> config in Svelte 5 (snippets are rendered in the declaring component's
> context), fall back to a separate small probe component under
> `src/lib/components/__tests__/` that calls `getMotionConfig()` at its own
> init and renders the three `data-` attributes — same shape as the existing
> `Probe.svelte`. Either structure is acceptable; the assertions below are what
> matter.

Add to `src/lib/components/MotionConfig.spec.ts`:

```ts
it('nested configs inherit outer props they do not override', async () => {
    render(NestedMotionConfigProbe)
    const inner = await screen.findByTestId('inner-probe')
    // Inner overrides duration…
    expect(inner.getAttribute('data-duration')).toBe('0.2')
    // …and inherits everything it did not set.
    expect(inner.getAttribute('data-reduced')).toBe('always')
    expect(inner.getAttribute('data-skip')).toBe('true')
})
```

**Verify**:

1. `npx vitest run src/lib/components/MotionConfig.spec.ts` → all pass,
   including the new nesting test. (This test fails against the pre-Step-3
   code — `data-reduced` would be `none` — so run it before and after the edit
   if you want the red/green confirmation.)
2. `npx vitest run src/lib/components/MotionConfig.skipAnimations.spec.ts` →
   still the SAME failure as Step 1 (the node does not receive the flag yet).

### Step 4: Thread `skipAnimations` to the `VisualElement`

In `src/lib/html/_MotionContainer.svelte`:

**4a.** Next to the existing `reducedMotion` derived (after line 273), add:

```ts
    // `<MotionConfig skipAnimations>`: descendant animations jump to their
    // final value. motion-dom honors it via `VisualElement.shouldSkipAnimations`,
    // which `animateMotionValue` checks before creating any animation — so this
    // one flag covers animate/initial/variants/exit/whileX and the imperative
    // controls path.
    const skipAnimations = $derived(motionConfig?.skipAnimations ?? false)
```

**4b.** In the `createMotionVisualElement({ … })` call, add the option
immediately after `reducedMotionConfig` (currently line 1072):

```ts
                      reducedMotionConfig: motionConfig?.reducedMotion ?? 'never',
                      skipAnimations,
                      isSVG: isSVGTag(String(tag))
```

**4c.** Immediately AFTER the mount effect that ends with
`visualElementStore.delete(mounted)` (the closing `})` at line ~2111), add:

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

**Verify**: `npx vitest run src/lib/components/MotionConfig.skipAnimations.spec.ts`
→ all three tests PASS (the Step 1 red test is now green).

### Step 5: Suppress the optimized-appear bootstrap under `skipAnimations`

The optimized-appear path starts a WAAPI animation directly via
`startWaapiAnimation` before hydration, bypassing the `VisualElement`. Under
`skipAnimations` it would visibly tween from `initial` to `animate`. Gate it
off.

In `src/lib/html/_MotionContainer.svelte`, change the `optimizedAppearId`
derived (currently lines 1196–1203) to:

```ts
    const optimizedAppearId = $derived(
        effectiveInitialProp !== false &&
            isNotEmpty(initialKeyframes) &&
            isNotEmpty(animateKeyframes) &&
            !optimizedAppearSuppressedByTransformTemplate &&
            // The appear bootstrap drives WAAPI directly (`startWaapiAnimation`),
            // bypassing the VisualElement — so `shouldSkipAnimations` cannot
            // reach it. Suppress the handoff entirely and let the (instant)
            // main-thread enter animation write the final values.
            !skipAnimations
            ? `svelte-motion-${componentHydrationId}`
            : undefined
    )
```

**Verify**: `npx vitest run src/lib/html src/lib/components` → all pass
(no regression in the optimized-appear or motion-container specs).

### Step 6: Make `AnimatePresence` clone exits instant too

`AnimatePresence`'s exit for a plain `motion.<tag>` child clones the element
and animates the clone with `animate(clone, keyframes, transition)` from the
`motion` package (`src/lib/utils/presence.ts:1089`). The clone has no
`VisualElement`, so `shouldSkipAnimations` cannot reach it. But
`animate(element, …)` routes through `animateTarget`, which honors
`transition.skipAnimations` — so pass the flag in the registered transition.

In `src/lib/html/_MotionContainer.svelte`, in the `context.registerChild(…)`
call (currently lines 780–786), replace the `mergedTransition` argument:

```ts
            context.registerChild(
                presenceKey,
                element,
                filteredExit,
                // The clone-based exit animates a DETACHED copy with no
                // VisualElement, so `shouldSkipAnimations` cannot reach it.
                // motion-dom's `animateTarget` copies `transition.skipAnimations`
                // onto every per-value transition, so threading it here is what
                // makes exits instant under `<MotionConfig skipAnimations>`.
                // Deliberately NOT folded into the shared `mergedTransition`
                // derived: that value also feeds the projection adapter, and
                // upstream does not skip layout/FLIP animations.
                skipAnimations ? { ...mergedTransition, skipAnimations: true } : mergedTransition,
                resolvePresenceExit
            )
```

**Verify**: `npx vitest run src/lib/components src/lib/utils/presence` →
all pass. (Exit behavior is covered end-to-end in Step 9.)

### Step 7: Thread `skipAnimations` through `useAnimate()`

Upstream does this at `framer-motion/src/animation/hooks/use-animate.ts:18-22`.

In `src/lib/utils/animate.svelte.ts`:

**7a.** Add the import:

```ts
import { getMotionConfig } from '$lib/components/motionConfig.context.js'
```

**7b.** Replace the `createScopedAnimate` call inside `useAnimate` with:

```ts
    // Upstream reads `MotionConfigContext.skipAnimations` here
    // (framer-motion animation/hooks/use-animate.ts:18-22) so a scoped
    // `animate()` inside `<MotionConfig skipAnimations>` completes instantly.
    //
    // Guarded: `getContext` throws outside Svelte component initialisation,
    // and `useAnimate()` is documented and tested as callable from plain
    // module scope (see `animate.spec.ts`). Absent config = no override.
    let skipAnimations: boolean | undefined
    try {
        skipAnimations = getMotionConfig()?.skipAnimations
    } catch {
        skipAnimations = undefined
    }

    const animate = createScopedAnimate({
        scope: scope as MotionAnimationScope<T>,
        ...(skipAnimations === undefined ? {} : { skipAnimations })
    }) as SvelteMotionAnimate
```

**7c.** Add to the `useAnimate` JSDoc block, after the paragraph about
ignoring calls before the attachment fires:

```
 * Inside a `<MotionConfig skipAnimations>` subtree, animations started through
 * the returned `animate` complete instantly.
```

**7d.** Add one test to `src/lib/utils/animate.spec.ts`, alongside the existing
tests, confirming the guard keeps module-scope usage working:

```ts
it('does not throw when called outside a Svelte component', () => {
    expect(() => useAnimate()).not.toThrow()
})
```

**Verify**: `npx vitest run src/lib/utils/animate.spec.ts` → all pass,
including every pre-existing test (they all call `useAnimate()` from module
scope; if any now throws `lifecycle_outside_component`, the try/catch is
missing or misplaced).

### Step 8: Add the test/demo page and link it

Create `src/routes/tests/motion-config-skip-animations/+page.svelte`. Model it
on `src/routes/tests/motion-config-reduced-motion/+page.svelte` (read that file
first — it is the direct analogue). Requirements:

- A checkbox with `data-testid="toggle-skip"` bound to a
  `let skip = $state(false)`.
- A readout `data-testid="active-skip"` rendering `{String(skip)}`.
- A `{#key skip}` block inside `<MotionConfig skipAnimations={skip}>`
  containing a `motion.div` with `data-testid="motion-box"`,
  `initial={{ x: 0, opacity: 0 }}`, `animate={{ x: 200, opacity: 1 }}`,
  `transition={{ duration: 2, ease: 'linear' }}`, `class="box"`.
- A second, separate section OUTSIDE the `MotionConfig` with a
  `data-testid="outside-box"` and the same animate/transition, proving the
  switch is subtree-scoped.
- An `AnimatePresence` section inside the same `MotionConfig`: a button
  `data-testid="toggle-presence"` toggling a `motion.div`
  `data-testid="exit-box"` with `exit={{ opacity: 0 }}` and
  `transition={{ duration: 2 }}`, so exit skipping is observable.
- Explanatory prose matching the tone of the reduced-motion page, and the same
  `:global(.box)` style block.

Then add a link in `src/routes/+page.svelte`, directly after the existing
`MotionConfig.reducedMotion` list item (lines 789–796):

```svelte
                <li>
                    <a
                        class="text-blue-300 hover:underline"
                        href={resolve('/tests/motion-config-skip-animations') + searchParams}
                    >
                        MotionConfig.skipAnimations
                    </a>
                </li>
```

**Verify**:

1. `pnpm check` → exits 0 with 0 errors.
2. `grep -n "motion-config-skip-animations" src/routes/+page.svelte` → 1 match.

### Step 9: Add the e2e spec

Create `e2e/utilities/motion-config-skip-animations.spec.ts`, modelled on
`e2e/utilities/motion-config-reduced-motion.spec.ts` (read it first). Cover:

1. **`skipAnimations` on → the box is already at its final state.** Check
   `data-testid="toggle-skip"`, then within ~300 ms (far under the 2 s
   transition) assert the computed transform matches
   `/matrix\(1,\s*0,\s*0,\s*1,\s*200/` and computed opacity `> 0.99`.
2. **`skipAnimations` off → the box is still mid-flight.** With the toggle
   unchecked, sample the transform ~300 ms after load and assert the translate
   X is `< 190`.
3. **Subtree-scoped.** With `skipAnimations` on, `data-testid="outside-box"`
   is still mid-flight at ~300 ms (translate X `< 190`).
4. **Exit is instant.** With `skipAnimations` on, click
   `data-testid="toggle-presence"` to remove the element and assert
   `page.getByTestId('exit-box')` detaches within ~500 ms (well under the 2 s
   exit duration).

Read transforms the same way the reduced-motion spec does:

```ts
const readTransform = (locator: Locator) =>
    locator.evaluate((el) => getComputedStyle(el as HTMLElement).transform)
```

**Verify**: `npx playwright test e2e/utilities/motion-config-skip-animations.spec.ts`
→ all 4 tests pass. Respect the E2E server rules in "Commands you will need".

### Step 10: Document it

Edit `docs/src/routes/docs/motion-config/+page.svx`:

**10a.** Add a `## skipAnimations` section immediately after the
`## reducedMotion policy` section (which ends at line 104, just before
`## Nesting`):

- Open with what it does: every animation in the subtree jumps to its final
  value instead of tweening.
- Contrast it with `reducedMotion`: `reducedMotion="always"` strips only
  transform keys and still animates opacity/color; `skipAnimations` disables
  the tween for every property.
- A `svelte` fenced example wrapping a couple of `motion.div`s.
- State the intended use: E2E tests and visual-regression screenshots, where a
  deterministic settled frame beats a transition.
- State the coverage honestly: it covers `animate`, `initial`, variants,
  `exit`, the `whileX` gestures, `useAnimationControls()` and `useAnimate()`.
  It does NOT affect layout/FLIP projection animations or drag momentum —
  matching Framer Motion.
- Mention it is reactive: toggling it re-targets already-mounted elements.

**10b.** Update the frontmatter `description` (line 3) and the `seo.*` block
(lines 11–16) to mention `skipAnimations` — add `'Skip Animations'` to
`seo.ogFeatures`.

**10c.** Update the intro paragraph at line 22 so the listed props include
`skipAnimations`.

**10d.** The `## Nesting` section (lines 106–118) already claims outer props
are inherited. Step 3 made that true. Extend its code sample to show
`skipAnimations` being inherited by a nested config that overrides only
`transition`.

**Verify**:

1. `grep -c "skipAnimations" docs/src/routes/docs/motion-config/+page.svx` → at
   least 6.
2. `trunk fmt` → exit 0.

### Step 11: Full gate

Run, in order, and confirm each:

```bash
trunk fmt
trunk check --fix
pnpm check
pnpm test:only
pnpm build
```

Then the e2e spec from Step 9 (see the E2E server rules).

**Verify**: every command exits 0; `pnpm check` reports 0 errors and 0
warnings introduced by this change; the full unit suite is green.

## Test plan

- **Anchor (red-first)**: `src/lib/components/MotionConfig.skipAnimations.spec.ts`,
  test `'jumps straight to the final value instead of tweening'`. Against
  current code it fails with roughly `expected <small number> to be 200`
  because `MotionConfigProps` has no `skipAnimations`, so the
  `VisualElement` is created with `skipAnimations: undefined` and
  `shouldSkipAnimations` stays `false`. After Step 4 it reads exactly `200`.
- **Second red test**: `'nested configs inherit outer props they do not override'`
  in `src/lib/components/MotionConfig.spec.ts`. Against current code
  `data-reduced` is `none` (the inner `<MotionConfig>` shadows the outer one).
  Green after Step 3.
- **New unit tests**:
  - `MotionConfig.skipAnimations.spec.ts` — instant-complete (happy path),
    `skipAnimations={false}` still tweens (control), no prop still tweens
    (default preserved).
  - `MotionConfig.spec.ts` — nested inheritance across `transition`,
    `reducedMotion` and `skipAnimations`.
  - `animate.spec.ts` — `useAnimate()` still callable outside a component
    (regression guard for the Step 7 `getContext` addition).
- **New e2e tests**: `e2e/utilities/motion-config-skip-animations.spec.ts` —
  four cases listed in Step 9 (instant enter, control, subtree scoping, instant
  exit).
- **Structural patterns to copy**: `src/lib/html/_MotionContainer.arc.spec.ts`
  (real-timer + rAF-shim behavioral spec), `src/lib/components/MotionConfig.spec.ts`
  + `src/lib/components/__tests__/MotionConfigWithProbe.svelte` (context probe),
  `e2e/utilities/motion-config-reduced-motion.spec.ts` (e2e shape).
- **Verification**: `pnpm test:only` → all pass, including 6 new unit tests;
  `npx playwright test e2e/utilities/motion-config-skip-animations.spec.ts` →
  4 pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm check` exits 0 with 0 errors
- [ ] `pnpm test:only` exits 0
- [ ] `pnpm build` exits 0
- [ ] `trunk check --fix` exits 0
- [ ] `npx vitest run src/lib/components/MotionConfig.skipAnimations.spec.ts` →
      3 tests pass (the first one failed at plan time)
- [ ] `npx vitest run src/lib/components/MotionConfig.spec.ts` → the nesting
      test exists and passes
- [ ] `npx playwright test e2e/utilities/motion-config-skip-animations.spec.ts`
      → 4 tests pass
- [ ] `grep -n "skipAnimations" src/lib/types.ts` → matches inside
      `MotionConfigProps`
- [ ] `grep -n "skipAnimations" src/lib/components/MotionConfig.svelte` →
      matches (prop + getter)
- [ ] `grep -c "skipAnimations" src/lib/html/_MotionContainer.svelte` → ≥ 5
- [ ] `grep -n "skipAnimations" src/lib/utils/animate.svelte.ts` → matches
- [ ] `grep -rn "skipAnimations" src/lib/utils/visualElementCore.ts | wc -l` →
      `3` (unchanged — the file must not be edited)
- [ ] `git status --porcelain` lists only files from the "In scope" list
- [ ] `.agents/.plans/motion-config-skip-animations/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The Step 1 test PASSES before any source change — the reproduction is wrong
  and the feature may already exist.
- The code at any location in "Current state" does not match the quoted
  excerpt (the codebase drifted since commit `dd838b1`).
- `visualElement.shouldSkipAnimations = …` (Step 4c) is a TypeScript error
  because the field is readonly in the installed `motion-dom` — the plan
  verified it as public and writable at
  `node_modules/motion-dom/dist/index.d.ts:1635`, so a mismatch means the
  dependency changed. Do NOT cast the error away.
- Step 3's inheritance change breaks any pre-existing test in
  `pnpm test:only` or in the e2e suite. That means something in this repo
  depended on nested configs shadowing rather than inheriting. Report which
  test and what it asserts — the inheritance fix is separable and can be
  dropped from this plan without losing the feature (it is confined to
  `MotionConfig.svelte`).
- Step 6 causes any `AnimatePresence` unit or e2e test to fail — exit
  behavior is delicate in this codebase, and the clone path has many callers.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching a file on the "Out of scope" list —
  in particular `src/lib/utils/visualElementCore.ts`, `src/lib/utils/presence.ts`,
  or anything under the layout/projection utilities.

## Maintenance notes

- **Reviewer focus**: (1) that `skipAnimations` was NOT folded into the shared
  `mergedTransition` derived in `_MotionContainer.svelte` — that value also
  feeds the projection adapter's `updateOptions({ transition })` and would
  silently change layout/FLIP behavior, which upstream does not do; (2) that
  the Step 4c sync effect is declared AFTER the mount effect, since
  `VisualElement.mount()` latches `shouldSkipAnimations` and would otherwise
  overwrite it; (3) that the Step 3 inheritance change did not alter
  single-level `MotionConfig` behavior.
- **Deliberate divergence from upstream**: React creates the `VisualElement`
  once and never re-reads `skipAnimations`, so toggling it post-mount is a
  no-op upstream. Step 4c makes it reactive here because this library's config
  is exposed through property getters and a toggle is the natural test-harness
  shape. If a future upgrade makes motion-dom recompute
  `shouldSkipAnimations` internally, that effect can be dropped.
- **Known non-coverage** (matching upstream, documented in Step 10): layout /
  FLIP projection animations and drag momentum/inertia still animate under
  `skipAnimations`. If a consumer reports this as a bug, it is a deliberate
  parity decision, not a regression — revisit only with a matching upstream
  change.
- **Deferred out of this plan**: moving the `MotionConfig skipAnimations` entry
  from `open_gaps` to `closed_gaps` in `.competitive-intel/state.json`. The
  nightly competitive-intel digest owns that file and will reconcile it on its
  next run.
- **Deferred out of this plan**: `MotionConfig`'s remaining upstream gaps
  (`features`, `transformPagePoint`, `isValidProp`, `nonce`). Now that
  `MotionConfig.svelte` inherits from its parent config, adding those is a
  types.ts field plus a getter each.
