import type { Readable } from 'svelte/store'

/**
 * Subscribes to a Svelte store and fires a callback on every *change*,
 * skipping the initial synchronous emission that Svelte stores produce
 * on subscribe.
 *
 * Returns an unsubscribe function. Use inside `$effect` or `onDestroy`
 * for automatic cleanup.
 *
 * @example
 * ```svelte
 * <script>
 *   import { useMotionValueEvent, useSpring } from '@humanspeak/svelte-motion'
 *   import { onDestroy } from 'svelte'
 *
 *   const x = useSpring(0)
 *   const unsub = useMotionValueEvent(x, 'change', (latest) => {
 *     console.log('x changed to', latest)
 *   })
 *   onDestroy(unsub)
 * </script>
 * ```
 *
 * @param store A readable Svelte store to observe.
 * @param event The event type — currently only `'change'` is supported.
 * @param callback Invoked with the latest value on each change after the initial emission.
 * @returns An unsubscribe function.
 */
export const useMotionValueEvent = <T>(
    store: Readable<T>,
    event: 'change',
    callback: (latest: T) => void
): (() => void) => {
    let initialized = false
    const unsub = store.subscribe((value) => {
        if (!initialized) {
            initialized = true
            return
        }
        callback(value)
    })
    return unsub
}
