import { getMotionConfig } from '$lib/components/motionConfig.context.js'
import { useReducedMotion, type ReducedMotionState } from '$lib/utils/reducedMotion.svelte.js'
import { SvelteSet } from 'svelte/reactivity'

/**
 * CSS / motion property keys that move or rotate an element via `transform`.
 * When reduced motion is active these keys are stripped from animate keyframes
 * so the element stays in place while non-transform properties (opacity, color,
 * etc.) continue to animate.
 */
const TRANSFORM_KEYS = new Set([
    'x',
    'y',
    'z',
    'translate',
    'translateX',
    'translateY',
    'translateZ',
    'scale',
    'scaleX',
    'scaleY',
    'scaleZ',
    'rotate',
    'rotateX',
    'rotateY',
    'rotateZ',
    'skew',
    'skewX',
    'skewY',
    'transform',
    'transformPerspective',
    'perspective'
])

/**
 * Returns a copy of `keyframes` with transform-related keys removed when
 * `reduced` is `true`. Returns `keyframes` unchanged otherwise.
 *
 * The `transition` key is preserved so per-key transitions still flow
 * through to the animation engine.
 */
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

/**
 * Returns a `{ current, subscribe }` object reflecting the resolved
 * reduced-motion policy for the current component subtree.
 *
 * Resolution combines the nearest `<MotionConfig reducedMotion>` ancestor
 * with the OS-level `prefers-reduced-motion` setting:
 *
 * - `'always'` → always `true`
 * - `'never'` (or no `<MotionConfig>` ancestor) → always `false`
 * - `'user'` → mirrors the OS preference, defaulting to `false` in SSR
 *
 * Both reactive read paths fire on **both** sources changing:
 *
 * - `.current` re-evaluates inside any reactive scope that reads it
 *   (templates, `$derived`, `$effect`) when either the OS preference *or*
 *   a parent `<MotionConfig reducedMotion={...}>` policy reassigns.
 * - `.subscribe(run)` callbacks are driven by a `$effect` that tracks both
 *   sources, so legacy store consumers see policy changes too — a fix vs.
 *   the prior `derived()`-based impl, which only re-fired on OS changes.
 *
 * @returns A `ReducedMotionState` reflecting the merged policy + OS setting.
 * @see https://motion.dev/docs/react-reduced-motion
 *
 * @example
 * ```svelte
 * <script>
 *   import { useReducedMotionConfig } from '@humanspeak/svelte-motion'
 *   const reduced = useReducedMotionConfig()
 * </script>
 *
 * {#if !reduced.current}
 *   <motion.div animate={{ x: 100 }} />
 * {/if}
 * ```
 */
export const useReducedMotionConfig = (): ReducedMotionState => {
    const motionConfig = getMotionConfig()
    const osReduced = useReducedMotion()

    const resolve = (): boolean => {
        const policy = motionConfig?.reducedMotion ?? 'never'
        if (policy === 'always') return true
        if (policy === 'never') return false
        return osReduced.current
    }

    const subscribers = new SvelteSet<(value: boolean) => void>()
    let lastEmitted = resolve()

    const dispatch = (value: boolean) => {
        if (value === lastEmitted) return
        lastEmitted = value
        for (const sub of subscribers) sub(value)
    }

    // Synchronous path for OS-preference changes. `osReduced.subscribe`
    // emits synchronously the same tick the OS preference flips, matching
    // the prior `derived()`-based behavior. Skip the synchronous initial
    // emit — `lastEmitted` was already seeded by the `resolve()` call above,
    // and subscribers receive the initial value through `subscribe()` below.
    let osInitialized = false
    const osUnsub = osReduced.subscribe(() => {
        if (!osInitialized) {
            osInitialized = true
            return
        }
        dispatch(resolve())
    })

    // Async path for `<MotionConfig reducedMotion>` policy changes. The
    // config component exposes `reducedMotion` via a property getter over
    // its Svelte prop, so reading it inside `$effect` tracks reassignments
    // and fires the same `dispatch` — closing the gap the legacy
    // `derived()` impl had.
    $effect(() => {
        // Read the policy as a tracked dependency; void it so the lint
        // unused-expression rule doesn't fire on a deliberate touch.
        void motionConfig?.reducedMotion
        dispatch(resolve())
    })

    // Tear down the OS subscription when the surrounding scope unmounts.
    $effect(() => osUnsub)

    return {
        get current() {
            return resolve()
        },
        subscribe(run) {
            subscribers.add(run)
            run(lastEmitted)
            return () => {
                subscribers.delete(run)
            }
        }
    }
}
