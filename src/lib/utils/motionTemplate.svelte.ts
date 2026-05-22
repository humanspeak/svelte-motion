import { motionValue } from 'motion-dom'
import { type Readable } from 'svelte/store'
import {
    augmentMotionValue,
    sampleSource,
    type AugmentedMotionValue
} from './augmentMotionValue.svelte.js'

/**
 * Input to {@link useMotionTemplate}'s interpolation slots: a motion-dom
 * `MotionValue` (via `useMotionValue`, `useSpring`, `useTransform`, etc.) or
 * a Svelte readable. Both expose `.subscribe(run)` with matching semantics,
 * so the hook consumes them interchangeably.
 */
export type MotionTemplateInput = AugmentedMotionValue<number | string> | Readable<number | string>

/**
 * Computes the composed template string from the static parts and the
 * latest interpolated values. Used both for the initial seed and on every
 * input emit.
 */
const composeTemplate = (
    strings: TemplateStringsArray,
    values: ReadonlyArray<number | string>
): string => {
    let result = ''
    for (let i = 0; i < strings.length; i++) {
        result += strings[i] ?? ''
        if (i < values.length) result += String(values[i])
    }
    return result
}

/**
 * Tagged template literal that builds an augmented `MotionValue<string>`
 * from interpolated motion values (or Svelte readables). Each interpolation
 * slot subscribes to its input; whenever any input emits, the template is
 * recomposed and written to the result.
 *
 * Returned value is a real motion-dom `MotionValue` augmented with a
 * `$state`-backed `.current` getter and a Svelte readable `.subscribe`
 * shim — it composes with the rest of the Tier 2 surface and reads
 * reactively in Svelte 5 scopes.
 *
 * Lifecycle: must be called during component initialization. All input
 * subscriptions and the underlying motion value are torn down when the
 * surrounding `$effect` scope unmounts.
 *
 * SSR-safe: returns a static motion value composed from the initial input
 * snapshots, with no subscriptions and no `$effect`.
 *
 * @param strings Static template string parts (supplied by the tagged-template syntax).
 * @param values Interpolated motion values or Svelte readables.
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
    const seedSnapshots = values.map((v) => sampleSource(v))
    const initial = composeTemplate(strings, seedSnapshots)
    const result = motionValue<string>(initial)

    // SSR / no inputs: return a static augmented motion value. With no
    // inputs the template never changes; with no window we skip the
    // subscription wiring (and the $effect that would otherwise need a
    // reactive scope).
    if (values.length === 0 || typeof window === 'undefined') {
        return augmentMotionValue(result)
    }

    const latest = [...seedSnapshots] as Array<number | string>
    const initialEmitsRemaining = { count: values.length }
    const unsubs: VoidFunction[] = []

    for (let i = 0; i < values.length; i++) {
        const idx = i
        const unsub = values[idx].subscribe((v) => {
            latest[idx] = v
            // Skip each input's synchronous initial subscribe emit — the
            // result is already seeded from sampleSource(). Subsequent
            // emits recompute and propagate.
            if (initialEmitsRemaining.count > 0) {
                initialEmitsRemaining.count--
                return
            }
            result.set(composeTemplate(strings, latest))
        })
        unsubs.push(unsub)
    }

    $effect(() => () => {
        for (const off of unsubs) off()
        result.destroy()
    })

    return augmentMotionValue(result)
}
