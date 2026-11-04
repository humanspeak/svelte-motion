import { getMotionConfig } from '$lib/components/motionConfig.context.js'
import type { MotionConfigProps } from '$lib/types.js'
import type { AnimationPlaybackControlsWithThen } from 'motion-dom'
import { createScopedAnimate, type SvelteMotionAnimate } from './animateValue.js'

/**
 * The scope returned by {@link useAnimate}. Functions as a Svelte 5
 * attachment — pass it as `{@attach scope}` on the parent element so the
 * scoped `animate` function can resolve string selectors against it.
 *
 * Mirrors framer-motion's `AnimationScope`. `current` is hydrated once the
 * attachment runs; `animations` tracks every in-flight animation started
 * through the scoped `animate` so they can be stopped together when the
 * element detaches.
 */
export type AnimationScope<T extends Element = HTMLElement> = ((node: T) => () => void) & {
    /** The parent element, populated when the attachment fires. `undefined` before mount or after detach. */
    current: T | undefined
    /** Animations currently scoped to this element. */
    animations: AnimationPlaybackControlsWithThen[]
    /**
     * MotionConfig's resolved `reducedMotion`, read live from the nearest
     * `MotionConfig`. Timelines created with this scope follow it when they
     * rebuild.
     */
    readonly reduceMotion?: boolean
    /**
     * MotionConfig's `skipAnimations`, read live from the nearest
     * `MotionConfig`. Timelines created with this scope follow it when they
     * rebuild.
     */
    readonly skipAnimations?: boolean
}

/**
 * Resolves MotionConfig's `reducedMotion` policy to the boolean Motion's
 * `reduceMotion` option expects, mirroring `useReducedMotionConfig` without
 * hooks so it also works when `useAnimate()` runs at module scope.
 *
 * Upstream `use-animate.ts:17` is `useReducedMotionConfig() ?? undefined`, and
 * React's MotionConfig context defaults to `"never"`, hence `false` with no
 * config.
 *
 * @param config The nearest MotionConfig, if any.
 * @returns `true`/`false` for a resolved policy, or `undefined` when the OS
 *   preference can't be read.
 */
const resolveReduceMotion = (config: MotionConfigProps | undefined): boolean | undefined => {
    const policy = config?.reducedMotion ?? 'never'
    if (policy === 'always') return true
    if (policy === 'never') return false
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
        return undefined
    }
}

/**
 * Imperative animation API mirroring framer-motion's `useAnimate`. Returns a
 * tuple `[scope, animate]`:
 *
 * - `scope` is a Svelte 5 attachment: spread it on the parent element with
 *   `{@attach scope}`. Once mounted, `scope.current` is the element and
 *   `animate('selector', ...)` resolves selectors against it.
 * - `animate(target, keyframes, transition)` accepts the same overloads as
 *   motion's standalone `animate` — strings, elements, motion values, and
 *   sequences.
 *
 * When the attached element detaches, every animation started through the
 * scoped `animate` is stopped and `scope.animations` is cleared.
 *
 * Selector strings resolve against `scope.current`, so calling
 * `animate('li', …)` before the attachment fires throws, as in Motion. Element
 * and motion-value subjects work at any time. Trigger selector animations from
 * user events or `$effect` after mount.
 *
 * Inside a `<MotionConfig>`, `reducedMotion` and `skipAnimations` are both read
 * per call and passed to every animation started through the returned
 * `animate` (with `skipAnimations` they complete instantly), so toggling them
 * after mount affects subsequent animations. Both are also exposed live on
 * `scope`, so timelines rebuilt later (`tl.add(…)`) follow them.
 *
 * `animate` returns a mutable `Timeline` (Motion 14.7); see
 * https://motion.dev/docs/animate.
 *
 * @template T The parent element type. Defaults to `HTMLElement`.
 * @returns A `[scope, animate]` tuple.
 * @see https://motion.dev/docs/react-use-animate
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAnimate } from '@humanspeak/svelte-motion'
 *
 *   const [scope, animate] = useAnimate()
 *
 *   const run = () =>
 *     animate(
 *       [
 *         ['li', { opacity: 1, x: 0 }, { delay: stagger(0.1) }],
 *         ['button', { scale: 1.05 }, { at: '-0.2' }]
 *       ]
 *     )
 * </script>
 *
 * <ul {@attach scope}>
 *   <li>One</li>
 *   <li>Two</li>
 *   <li>Three</li>
 * </ul>
 * <button onclick={run}>Animate</button>
 * ```
 */
export const useAnimate = <T extends Element = HTMLElement>(): [
    AnimationScope<T>,
    SvelteMotionAnimate
] => {
    const scope = ((node: T) => {
        scope.current = node
        return () => {
            for (const animation of scope.animations) {
                animation.stop()
            }
            scope.animations.length = 0
            scope.current = undefined
        }
    }) as AnimationScope<T>
    scope.current = undefined
    scope.animations = []

    // Capture the config OBJECT at init: `getContext` must run during
    // component initialisation, but MotionConfig exposes property getters, so
    // reading `.skipAnimations` later yields the CURRENT value. That is what
    // keeps this reactive without a re-render — upstream gets the same effect
    // from `useMemo(..., [skipAnimations])`
    // (framer-motion animation/hooks/use-animate.ts:20-23).
    //
    // Guarded: `getContext` throws outside Svelte component initialisation,
    // and `useAnimate()` is documented and tested as callable from plain
    // module scope (see `animate.spec.ts`). Absent config = no override.
    let motionConfig: MotionConfigProps | undefined
    try {
        motionConfig = getMotionConfig()
    } catch {
        motionConfig = undefined
    }

    // Upstream use-animate.ts:23-24 writes these every render; getters keep
    // them current without one. Read by Timeline rebuilds (timeline index.ts:470-478).
    Object.defineProperties(scope, {
        reduceMotion: { get: () => resolveReduceMotion(motionConfig), enumerable: true },
        skipAnimations: { get: () => motionConfig?.skipAnimations, enumerable: true }
    })

    // Memoised on the resolved value so repeated calls under an unchanged
    // config reuse one scoped animate. Every instance is handed the SAME
    // `scope` object, so `scope.animations` tracking stays correct across
    // rebuilds.
    let cachedScoped: SvelteMotionAnimate | undefined
    let cachedSkip: boolean | undefined
    let cachedReduce: boolean | undefined
    let hasCached = false

    const resolveScopedAnimate = (): SvelteMotionAnimate => {
        const skipAnimations = motionConfig?.skipAnimations
        const reduceMotion = resolveReduceMotion(motionConfig)
        if (!hasCached || cachedSkip !== skipAnimations || cachedReduce !== reduceMotion) {
            hasCached = true
            cachedSkip = skipAnimations
            cachedReduce = reduceMotion
            // Upstream passes both keys even when `undefined`; createScopedAnimate ignores it.
            cachedScoped = createScopedAnimate({
                scope,
                reduceMotion,
                skipAnimations
            })
        }
        return cachedScoped!
    }

    const animate = ((...args: unknown[]) =>
        (resolveScopedAnimate() as unknown as (...a: unknown[]) => unknown)(
            ...args
        )) as SvelteMotionAnimate

    return [scope, animate]
}
