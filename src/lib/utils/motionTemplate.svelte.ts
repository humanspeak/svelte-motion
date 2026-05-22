import { isMotionValue, transformValue } from 'motion-dom'
import { type Readable } from 'svelte/store'
import {
    augmentMotionValue,
    sampleSource,
    type AugmentedMotionValue
} from './augmentMotionValue.svelte.js'

/**
 * Input to {@link useMotionTemplate}'s interpolation slots: a motion-dom
 * `MotionValue`, a Svelte readable, or a plain `number` / `string` literal.
 * Mirrors framer-motion's `useMotionTemplate` signature.
 */
export type MotionTemplateInput =
    | AugmentedMotionValue<number | string>
    | Readable<number | string>
    | number
    | string

/**
 * Tagged template literal that builds an augmented `MotionValue<string>`
 * from interpolated motion values, Svelte readables, and plain literals.
 *
 * Mirrors framer-motion 1:1: returns a real motion-dom `MotionValue<string>`
 * (via `transformValue`) that auto-tracks every `MotionValue.get()` called
 * during template composition. Whenever any tracked input emits, the
 * composer reruns and writes the new string into the result value.
 *
 * Svelte-readable slots are sampled via `svelte/store`'s `get()` inside the
 * composer so they re-emit when adjacent motion values trigger a recompute.
 * Plain `number` / `string` slots are stringified inline.
 *
 * The result is augmented with a `$state`-backed `.current` getter and a
 * Svelte readable `.subscribe` shim so it composes with the rest of the
 * Tier 2 surface and reads reactively in Svelte 5 scopes.
 *
 * Lifecycle: must be called during component initialization. motion-dom
 * cleans up the change-subscriptions when the result `MotionValue` is
 * destroyed; we wire that destroy to the surrounding `$effect`.
 *
 * SSR-safe: motion-dom's `transformValue` works without DOM access (no
 * timers, no listeners). On the server the result is a static augmented
 * motion value with no `$effect` registered.
 *
 * @param strings Static template string parts (supplied by the tagged-template syntax).
 * @param values Interpolated motion values, Svelte readables, or literals.
 * @returns An `AugmentedMotionValue<string>` with the composed template.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useSpring, useTransform, useMotionTemplate } from '@humanspeak/svelte-motion'
 *
 *   const x = useSpring(0)
 *   const blur = useTransform(x, [-100, 0, 100], [10, 0, 10])
 *   const filter = useMotionTemplate`blur(${blur}px)`
 * </script>
 *
 * <div style="filter: {filter.current}">Animated blur</div>
 * ```
 *
 * @see https://motion.dev/docs/react-use-motion-template
 */
export const useMotionTemplate = (
    strings: TemplateStringsArray,
    ...values: MotionTemplateInput[]
): AugmentedMotionValue<string> => {
    const numFragments = strings.length

    const buildValue = () => {
        let output = ''
        for (let i = 0; i < numFragments; i++) {
            output += strings[i] ?? ''
            if (i >= values.length) continue
            const value = values[i]
            // motion-dom's collectMotionValues session inside transformValue
            // auto-discovers MotionValue deps via `.get()`. Readables don't
            // participate — they're sampled inline via get(); they only
            // re-emit if some adjacent motion value triggers a recompute.
            if (isMotionValue(value)) {
                output += String(value.get())
            } else if (value && typeof value === 'object' && 'subscribe' in (value as object)) {
                output += String(sampleSource(value as Readable<number | string>))
            } else {
                output += String(value)
            }
        }
        return output
    }

    const result = transformValue<string>(buildValue)
    if (typeof window !== 'undefined') {
        $effect(() => () => result.destroy())
    }
    return augmentMotionValue(result)
}
