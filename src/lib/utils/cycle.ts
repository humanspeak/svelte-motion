import { wrap } from 'motion'
import { writable, type Readable } from 'svelte/store'

export type Cycle = (next?: number) => void
export type CycleState<T> = [Readable<T>, Cycle]

/**
 * Cycles through a series of values. Mirrors Framer Motion's `useCycle`.
 *
 * Returns a tuple `[value, cycle]`:
 *
 * - `value` is a Svelte readable store of the current item; subscribe with
 *   `$value` in templates.
 * - `cycle()` advances to the next item, wrapping back to index `0` when it
 *   passes the end.
 * - `cycle(i)` jumps to the item at index `i`. The index is taken as-is to
 *   match `framer-motion` &mdash; out-of-range values yield `items[i]`, which
 *   may be `undefined`.
 *
 * Calls that resolve to the current index are no-ops and do not notify
 * subscribers, matching React `useState`'s `Object.is` bail-out semantics.
 *
 * @param items - Items to cycle through. Must include at least one item.
 * @returns A `[Readable<T>, Cycle]` tuple.
 * @see https://motion.dev/docs/react-use-cycle
 *
 * @example
 * ```svelte
 * <script>
 *   import { motion, useCycle } from '@humanspeak/svelte-motion'
 *
 *   const [x, cycleX] = useCycle(0, 50, 100)
 * </script>
 *
 * <motion.div animate={{ x: $x }} onclick={() => cycleX()} />
 * ```
 */
export const useCycle = <T>(...items: T[]): CycleState<T> => {
    if (items.length === 0) {
        throw new Error('useCycle requires at least one item')
    }

    let index = 0
    const store = writable<T>(items[0])

    const cycle: Cycle = (next?: number) => {
        const target = typeof next === 'number' ? next : wrap(0, items.length, index + 1)
        if (target === index) return
        index = target
        store.set(items[target])
    }

    return [{ subscribe: store.subscribe }, cycle]
}
