import { DEV } from 'esm-env'
import {
    isMotionValue,
    type MotionValue as MotionDomMotionValue,
    type MotionValueEventCallbacks
} from 'motion-dom'
import type { Readable } from 'svelte/store'
import type { AugmentedMotionValue } from './augmentMotionValue.svelte.js'

/**
 * Subscribes to one of a motion value's events. Mirrors framer-motion's
 * `useMotionValueEvent`
 * (`packages/framer-motion/src/utils/use-motion-value-event.ts @ v14.14.0`),
 * which subscribes with `value.on(event, callback)`.
 *
 * Events:
 * - `'change'`: the value changed; the callback receives the latest value.
 *   It never fires on subscribe, only on later changes.
 * - `'animationStart'`: an animation started on the value.
 * - `'animationComplete'`: an animation on the value finished.
 * - `'animationCancel'`: a running animation was stopped or replaced before
 *   it finished.
 * - `'destroy'`: the value was destroyed.
 *
 * A Svelte readable store is also accepted, for `'change'` only.
 *
 * Unlike the React hook, this returns an unsubscribe function that the caller
 * registers: `return` it from an `$effect`, or pass it to `onDestroy`, as with
 * `useAnimationFrame`.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useMotionValueEvent, useSpring } from '@humanspeak/svelte-motion'
 *
 *   const x = useSpring(0)
 *
 *   $effect(() => useMotionValueEvent(x, 'animationComplete', () => {
 *     console.log('x settled at', x.get())
 *   }))
 * </script>
 * ```
 *
 * @template V The motion value's value type.
 * @template EventName The event to observe.
 * @param value A motion value: any hook's return value, or motion-dom's `motionValue()`.
 * @param event One of `'change'`, `'animationStart'`, `'animationComplete'`,
 *   `'animationCancel'` or `'destroy'`.
 * @param callback Receives the latest value for `'change'`, and no arguments otherwise.
 * @returns An unsubscribe function.
 * @see https://motion.dev/docs/react-use-motion-value-event
 */
export function useMotionValueEvent<V, EventName extends keyof MotionValueEventCallbacks<V>>(
    value: MotionDomMotionValue<V> | AugmentedMotionValue<V>,
    event: EventName,
    callback: MotionValueEventCallbacks<V>[EventName]
): VoidFunction
/**
 * Subscribes to a Svelte readable store's changes, skipping the synchronous
 * emission a store makes on subscribe.
 *
 * @template T The store's value type.
 * @param store A readable Svelte store.
 * @param event `'change'`, the only event a readable store emits.
 * @param callback Receives the latest value on each change after subscribing.
 * @returns An unsubscribe function.
 */
export function useMotionValueEvent<T>(
    store: Readable<T>,
    event: 'change',
    callback: (latest: T) => void
): VoidFunction
export function useMotionValueEvent(
    source: MotionDomMotionValue<unknown> | AugmentedMotionValue<unknown> | Readable<unknown>,
    event: keyof MotionValueEventCallbacks<unknown>,
    callback: (latest?: unknown) => void
): VoidFunction {
    // Upstream: use-motion-value-event.ts:20-23 @ v14.14.0 subscribes with
    // value.on(event, callback); 'change' does not emit on subscribe.
    // An augmented value is also a Readable, so check for a MotionValue first.
    if (isMotionValue(source)) {
        return source.on(event, callback)
    }
    if (event !== 'change') {
        if (DEV) {
            console.warn(
                `useMotionValueEvent: a Svelte readable store only emits 'change'; '${event}' needs a MotionValue.`
            )
        }
        return () => {}
    }
    // Readable stores emit synchronously on subscribe; skip that emission so
    // the callback, like MotionValue.on('change'), fires only on changes.
    let initialized = false
    return (source as Readable<unknown>).subscribe((value) => {
        if (!initialized) {
            initialized = true
            return
        }
        callback(value)
    })
}
