import { type MotionValue as MotionDomMotionValue } from 'motion-dom'
import { type AugmentedMotionValue } from './augmentMotionValue.svelte.js'
import { motionValue } from './vanillaValues.svelte.js'

/**
 * The shape returned by {@link useMotionValue}: a real motion-dom
 * `MotionValue<T>` (so it composes with `animate()`, `useTransform`,
 * `useSpring`, etc. and passes `isMotionValue`) plus a Svelte 5 reactive
 * `.current` getter and a Svelte readable store `.subscribe` shim.
 *
 * @template T The value type — typically `number` or `string`.
 * @see {@link AugmentedMotionValue}
 */
export type MotionValue<T = number> = AugmentedMotionValue<T>

/**
 * Re-export of motion-dom's raw `MotionValue` type for cases where the
 * un-augmented shape is needed (e.g. typing follow sources, function
 * dependencies). Most call sites should prefer {@link MotionValue}.
 */
export type RawMotionValue<T = number> = MotionDomMotionValue<T>

/**
 * Creates a tracked, mutable value backed by motion-dom's `MotionValue`.
 *
 * Use `.set(v)` to write the value imperatively, `.get()` to sample it
 * imperatively, and `.current` to read it inside Svelte 5 reactive scopes
 * (templates, `$derived`, `$effect`). The same value also implements the
 * Svelte readable store contract via `.subscribe(run)`, so legacy `$mv`
 * template syntax and `svelte/store`'s `get()` keep working.
 *
 * Returned object is a real motion-dom `MotionValue` — it composes with
 * `useTransform`, `useSpring`, `useVelocity`, the `animate()` driver, and
 * passes `isMotionValue`. Unlike `useSpring`, writes are immediate — there
 * is no follow source and no animation.
 *
 * Lifecycle: must be called during component initialization. Cleanup is
 * registered via `$effect`; motion-dom's internal listeners and animation
 * subscriptions are released when the surrounding component / effect tears
 * down. Call `.destroy()` to clean up early.
 *
 * SSR-safe: motion-dom's `motionValue` runs without DOM access; on the
 * server reads return the initial value and writes still work, with no
 * timers or listeners attached.
 *
 * @template T The value type — typically `number` or `string`.
 * @param initial The starting value.
 * @returns A `MotionValue<T>` augmented with `.current` and `.subscribe`.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useMotionValue, useTransform } from '@humanspeak/svelte-motion'
 *
 *   const x = useMotionValue(0)
 *   const opacity = useTransform(x, [0, 200], [0, 1])
 * </script>
 *
 * <input type="range" min="0" max="200" oninput={(e) => x.set(+e.currentTarget.value)} />
 * <div style="opacity: {opacity.current}">x = {x.current}</div>
 * ```
 *
 * @see https://motion.dev/docs/react-motion-value
 */
export const useMotionValue = <T = number>(initial: T): MotionValue<T> => {
    // Lifecycle variant of the vanilla factory: same construction path,
    // plus auto-destroy bound to the surrounding component.
    const value = motionValue<T>(initial)
    $effect(() => () => value.destroy())
    return value
}
