import { getMotionConfig } from '$lib/components/motionConfig.context.js'
import { useReducedMotion } from '$lib/utils/reducedMotion.js'
import { derived, type Readable } from 'svelte/store'

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
 * The `transition` key is preserved so per-key transitions still flow through
 * to the animation engine.
 */
export function filterReducedMotionKeyframes<T extends Record<string, unknown> | undefined>(
    keyframes: T,
    reduced: boolean
): T {
    if (!reduced || !keyframes) return keyframes
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(keyframes)) {
        if (!TRANSFORM_KEYS.has(key)) out[key] = keyframes[key]
    }
    return out as T
}

/**
 * Returns a readable store that reflects the resolved reduced-motion policy
 * for the current component subtree.
 *
 * Resolution combines the nearest `<MotionConfig reducedMotion>` ancestor with
 * the OS-level `prefers-reduced-motion` setting:
 *
 * - `'always'` → always `true`
 * - `'never'` (or no `<MotionConfig>` ancestor) → always `false`
 * - `'user'` → mirrors the OS preference, defaulting to `false` in SSR
 *
 * Use this from inside motion-aware components to decide whether to skip
 * transform animations.
 *
 * @returns {Readable<boolean>} `true` when descendant motion should be reduced.
 * @see https://motion.dev/docs/react-reduced-motion
 *
 * @example
 * ```svelte
 * <script>
 *   import { useReducedMotionConfig } from '@humanspeak/svelte-motion'
 *   const reduced = useReducedMotionConfig()
 * </script>
 *
 * {#if !$reduced}
 *   <motion.div animate={{ x: 100 }} />
 * {/if}
 * ```
 */
export const useReducedMotionConfig = (): Readable<boolean> => {
    const motionConfig = getMotionConfig()
    // Read motionConfig?.reducedMotion *inside* the derived so dynamic
    // `<MotionConfig reducedMotion={...}>` updates surface to subscribers —
    // motionConfig uses property getters, so the value is always fresh.
    return derived(useReducedMotion(), ($osReduced) => {
        const policy = motionConfig?.reducedMotion ?? 'never'
        if (policy === 'always') return true
        if (policy === 'never') return false
        return $osReduced
    })
}
