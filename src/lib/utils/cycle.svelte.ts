import { wrap } from 'motion'

/** Function returned by {@link useCycle} for advancing or jumping the index. */
export type Cycle = (next?: number) => void

/**
 * State returned by {@link useCycle}: an object with a reactive `.current`
 * getter and a `cycle` function. Both reads and writes flow through the
 * same object, so consumers don't need to destructure (which would
 * snapshot `.current` and lose reactivity under runes).
 */
export type CycleState<T> = {
    readonly current: T
    cycle: Cycle
}

/**
 * Function that returns the current items list, used by the reactive
 * overload of {@link useCycle}. The function is re-invoked on every read
 * so changes to the underlying reactive source propagate automatically.
 */
export type CycleItemsGetter<T> = () => readonly T[]

/**
 * Cycles through a series of values. Mirrors framer-motion's `useCycle`.
 *
 * Two call forms:
 *
 * - **Varargs** — `useCycle(...items)` — items are captured once and stay
 *   fixed for the cycle's lifetime. Matches React framer-motion's signature.
 * - **Reactive getter** — `useCycle(() => items)` — items are read on every
 *   access, so passing a `$state`/`$derived` source lets the cycle pick up
 *   list changes without recreating it.
 *
 * In both forms:
 *
 * - `state.current` is reactive — read it in templates / `$derived` / `$effect`
 *   and it tracks both index changes and (in the getter form) item changes.
 * - `state.cycle()` advances to the next item (wrapping at the end).
 * - `state.cycle(i)` jumps to index `i`. The index is stored as-given; `.current`
 *   then clamps on read so out-of-range indexes resolve to the last valid item
 *   instead of `undefined`. This is a defensive divergence from React
 *   framer-motion (which returns `items[i]`, possibly undefined) — needed so
 *   the reactive-getter form stays safe when items shrink underneath the cycle.
 * - Calls that resolve to the current index are no-ops, matching React
 *   `useState`'s `Object.is` bail-out.
 *
 * Diverges from React's `[value, cycle]` tuple return because destructuring
 * a `$state`-backed value under Svelte 5 runes snapshots it and loses
 * reactivity. Out-of-range read semantics are the other intentional
 * divergence — see above. Otherwise 1:1 with React.
 *
 * Ambiguity: `useCycle(fn)` with a single function value is treated as the
 * reactive overload, not as a single-item cycle. To cycle through one
 * function value, use `useCycle(() => [fn])` or just call it directly —
 * a single-item cycle is a no-op anyway.
 *
 * @see https://motion.dev/docs/react-use-cycle
 *
 * @example Static varargs
 * ```svelte
 * <script lang="ts">
 *   import { motion, useCycle } from '@humanspeak/svelte-motion'
 *
 *   const x = useCycle(0, 50, 100)
 * </script>
 *
 * <motion.div animate={{ x: x.current }} onclick={() => x.cycle()} />
 * ```
 *
 * @example Reactive items
 * ```svelte
 * <script lang="ts">
 *   let { labels }: { labels: string[] } = $props()
 *   const variant = useCycle(() => labels)
 * </script>
 *
 * <motion.div animate={variant.current} onclick={() => variant.cycle()} />
 * ```
 */
export function useCycle<T>(itemsGetter: CycleItemsGetter<T>): CycleState<T>
export function useCycle<T>(...items: T[]): CycleState<T>
export function useCycle<T>(...args: [CycleItemsGetter<T>] | T[]): CycleState<T> {
    const getItems: CycleItemsGetter<T> =
        args.length === 1 && typeof args[0] === 'function'
            ? (args[0] as CycleItemsGetter<T>)
            : () => args as T[]

    if (getItems().length === 0) {
        throw new Error('useCycle requires at least one item')
    }

    let index = $state(0)

    return {
        get current() {
            const items = getItems()
            // Clamp on read so items shrinking under us doesn't return
            // undefined when index is still valid in the new range.
            const safeIndex = index >= items.length ? items.length - 1 : index
            return items[safeIndex] as T
        },
        cycle: (next?: number) => {
            const items = getItems()
            if (items.length === 0) return
            const target = typeof next === 'number' ? next : wrap(0, items.length, index + 1)
            if (target === index) return
            index = target
        }
    }
}
