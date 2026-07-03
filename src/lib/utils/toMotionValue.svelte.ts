import { isMotionValue, motionValue as motionValueCore, type MotionValue } from 'motion-dom'
import type { Readable } from 'svelte/store'
import {
    augmentMotionValue,
    bridgeReadableToMotionValue,
    isAugmentedMotionValue,
    isSvelteReadable,
    type AugmentedMotionValue
} from './augmentMotionValue.svelte.js'

/**
 * Anything {@link toMotionValue} can turn into a `MotionValue`:
 * an existing `MotionValue`, a Svelte readable store, or a reactive
 * getter (the rune-native form — reads of `$state` / `$derived` inside
 * the getter are tracked).
 *
 * @template T The value type — typically `number` or `string`.
 */
export type MotionValueSource<T> = MotionValue<T> | Readable<T> | (() => T)

/**
 * Normalize any {@link MotionValueSource} into a motion-dom
 * `MotionValue`, reporting whether the caller owns its lifecycle.
 *
 * - A `MotionValue` passes through untouched (`dispose` is a no-op —
 *   the caller didn't create it, so it must not destroy it).
 * - A Svelte readable is bridged; `dispose` tears the bridge down.
 * - A getter is bridged through a Svelte effect root (see
 *   {@link toMotionValue}); `dispose` tears the root down.
 *
 * Used by the vanilla factories (`springValue`, `mapValue`) so their
 * sources can be any of the three kinds, with bridge lifecycles chained
 * onto the returned value's `.destroy()`.
 */
export const resolveMotionValueSource = <T>(
    source: MotionValueSource<T>
): { value: MotionValue<T>; dispose: VoidFunction } => {
    if (isMotionValue(source)) {
        return { value: source as MotionValue<T>, dispose: () => undefined }
    }

    if (isSvelteReadable<T>(source)) {
        return bridgeReadableToMotionValue<T>(source)
    }

    const getter = source as () => T
    const bridge = motionValueCore<T>(getter())
    // $effect.root gives the getter a reactive context outside any
    // component, so `$state` / `$derived` (and augmented `.current`)
    // reads inside it re-run the sync. Updates flush on Svelte's effect
    // schedule (microtask), matching template timing.
    const stopRoot = $effect.root(() => {
        $effect(() => {
            bridge.set(getter())
        })
    })
    return {
        value: bridge,
        dispose: () => {
            stopRoot()
            bridge.destroy()
        }
    }
}

/**
 * Convert any source into an augmented `MotionValue` — the bridge
 * between Svelte reactivity and motion-dom's vanilla APIs.
 *
 * The getter form is the rune-native entry point: reads of `$state`,
 * `$derived`, or another augmented value's `.current` inside the getter
 * are tracked, and the returned `MotionValue` follows them. That lets
 * plain Svelte state drive anything that takes a `MotionValue` —
 * `styleEffect`, `springValue`, `mapValue`, `animate()`, motion
 * component `style` props — without the component wrapper hooks.
 *
 * Passing an existing `MotionValue` returns the SAME value (augmented
 * in place if it wasn't already), so the function is safe to call on
 * "whatever the consumer handed you". Passing a Svelte readable store
 * returns a mirroring value.
 *
 * Lifecycle: for getter and readable sources the returned value owns a
 * bridge — call `.destroy()` when done, e.g. in your `$effect` cleanup
 * as in the example below. The getter form's effect root is UNOWNED by
 * any component, so a forgotten `.destroy()` leaves a permanently live
 * effect. For pass-through `MotionValue` sources, `.destroy()` behaves
 * as it did before.
 *
 * @template T The value type — typically `number` or `string`.
 * @param source A `MotionValue`, Svelte readable, or reactive getter.
 * @returns An {@link AugmentedMotionValue} tracking the source.
 * @example
 * ```svelte
 * <script lang="ts">
 *     import { styleEffect, toMotionValue } from '@humanspeak/svelte-motion'
 *
 *     let progress = $state(0)
 *     const opacity = toMotionValue(() => progress / 100)
 *
 *     $effect(() => {
 *         const stop = styleEffect(element, { opacity })
 *         return () => {
 *             stop()
 *             opacity.destroy()
 *         }
 *     })
 * </script>
 * ```
 * @example
 * ```ts
 * // Readable store → MotionValue
 * import { writable } from 'svelte/store'
 * const store = writable(0)
 * const value = toMotionValue(store)
 * ```
 */
export const toMotionValue = <T>(source: MotionValueSource<T>): AugmentedMotionValue<T> => {
    // Fresh bridges are never pre-augmented, so their dispose is never
    // dropped by the pass-through branch; a pass-through's dispose is a
    // no-op by construction.
    const { value, dispose } = resolveMotionValueSource(source)
    return isAugmentedMotionValue(value) ? value : augmentMotionValue(value, dispose)
}
