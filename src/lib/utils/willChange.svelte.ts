import { acceleratedValues, motionValue, transformProps } from 'motion-dom'
import { augmentMotionValue, type AugmentedMotionValue } from './augmentMotionValue.svelte.js'

/**
 * A `MotionValue<string>` for the CSS `will-change` property that manages its
 * own value: it stays `'auto'` until a transform or otherwise GPU-accelerated
 * property animates, then flips to `'transform'`.
 *
 * Returned by {@link useWillChange}. Assign it to an element's
 * `style.willChange` (object-form `style`) so the hint is written to the DOM,
 * and the motion runtime calls {@link WillChangeMotionValue.add} for you as
 * animations start.
 *
 * @see https://motion.dev/docs/react-use-will-change
 */
export type WillChangeMotionValue = AugmentedMotionValue<string> & {
    /**
     * Notify the value that `name` is animating. If `name` is a transform
     * shortcut (`x`, `scale`, `rotate`, …) or an accelerated value
     * (e.g. `opacity`), `will-change` flips to `'transform'`. Other property
     * names are ignored. Idempotent once enabled.
     *
     * @param name The animating property/value key.
     */
    add: (name: string) => void
}

/**
 * Detect a {@link WillChangeMotionValue} — a MotionValue carrying the
 * auto-managing `add` method — so the runtime can opt into notifying it.
 *
 * @param value Any value to test.
 * @returns Whether `value` is a will-change MotionValue.
 */
export const isWillChangeMotionValue = (value: unknown): value is WillChangeMotionValue =>
    !!value && typeof (value as { add?: unknown }).add === 'function'

/**
 * Creates an auto-managed CSS `will-change` MotionValue.
 *
 * The returned value starts at `'auto'` and becomes `'transform'` once a
 * transform or accelerated property animates on the element it is attached to,
 * mirroring framer-motion's `useWillChange`. Promoting the element to its own
 * compositor layer only while it animates avoids the memory cost of a
 * permanent `will-change` hint.
 *
 * Assign the value to an element via object-form `style`; the motion runtime
 * notifies it as animations start, and the same MotionValue writes the hint to
 * the DOM.
 *
 * Lifecycle: call during component initialization. The underlying MotionValue
 * is destroyed via `$effect` cleanup when the surrounding component tears down.
 *
 * @returns A {@link WillChangeMotionValue} for `style.willChange`.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { motion, useWillChange } from '@humanspeak/svelte-motion'
 *
 *   const willChange = useWillChange()
 * </script>
 *
 * <motion.div style={{ willChange }} animate={{ x: 100 }} />
 * ```
 *
 * @see https://motion.dev/docs/react-use-will-change
 */
export const useWillChange = (): WillChangeMotionValue => {
    const value = motionValue<string>('auto')
    $effect(() => () => value.destroy())

    const willChange = augmentMotionValue(value) as WillChangeMotionValue
    let isEnabled = false

    willChange.add = (name: string) => {
        if (isEnabled) return
        if (transformProps.has(name) || acceleratedValues.has(name)) {
            isEnabled = true
            willChange.set('transform')
        }
    }

    return willChange
}
