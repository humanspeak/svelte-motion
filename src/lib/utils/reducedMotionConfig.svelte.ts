import { getMotionConfig } from '$lib/components/motionConfig.context.js'
import { createBooleanSnapshot } from '$lib/utils/booleanSnapshot.svelte.js'
import { useReducedMotion, type ReducedMotionState } from '$lib/utils/reducedMotion.svelte.js'

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
 * Returns a copy of `keyframes` with transform-related keys
 * (`x`, `y`, `scale`, `rotate`, `skew`, `translate*`, etc.) removed
 * when `reduced` is `true`. Returns `keyframes` unchanged otherwise.
 *
 * The `transition` key is preserved so per-key transitions still flow
 * through to the animation engine; only the visual *targets* are
 * stripped, not the timing config.
 *
 * @template T Keyframes record (or `undefined`).
 * @param keyframes Source keyframes record — may be `undefined`, in
 *   which case the same `undefined` is returned regardless of
 *   `reduced`.
 * @param reduced When `true`, strip transform keys; when `false`,
 *   return `keyframes` unchanged (by reference).
 * @returns The original `keyframes` when `reduced` is `false` (same
 *   reference); otherwise a new record with transform keys filtered
 *   out and other keys preserved.
 *
 * @example
 * ```ts
 * filterReducedMotionKeyframes(
 *   { x: 100, scale: 1.2, opacity: 0.5 },
 *   true
 * )
 * // → { opacity: 0.5 }
 *
 * filterReducedMotionKeyframes(
 *   { x: 100, opacity: 0.5, transition: { duration: 0.3 } },
 *   true
 * )
 * // → { opacity: 0.5, transition: { duration: 0.3 } }
 * ```
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
 * - `.subscribe(run)` callbacks are driven by both the OS path
 *   (sync via `osReduced.subscribe`) and a `$effect` tracking the
 *   `motionConfig.reducedMotion` prop. Legacy store consumers see policy
 *   changes too — a fix vs. the prior `derived()`-based impl, which only
 *   re-fired on OS changes.
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

    const [state, set] = createBooleanSnapshot(resolve())

    // Sync path: `osReduced.subscribe` fires the run callback on every OS
    // preference change (and once synchronously on subscribe). The
    // snapshot's same-value dedupe absorbs that initial duplicate emit.
    const osUnsub = osReduced.subscribe(() => set(resolve()))

    // Async path: `<MotionConfig reducedMotion>` is exposed via a
    // property getter over the config component's prop, so reading it
    // inside `$effect` tracks reassignments and fires the same `set` —
    // closing the gap the legacy `derived()`-based impl had. Returning
    // `osUnsub` installs it as the effect's cleanup, so the OS
    // subscription is released on unmount.
    $effect(() => {
        // Void the read so the lint unused-expression rule doesn't fire
        // on a deliberate dependency touch.
        void motionConfig?.reducedMotion
        set(resolve())
        return osUnsub
    })

    return state
}
