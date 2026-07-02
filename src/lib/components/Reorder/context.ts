import type { Axis, Box } from '$lib/utils/projection'
import { getContext, setContext } from 'svelte'

/**
 * A measured entry in a `Reorder.Group`'s working order.
 *
 * `layout` is the item's slot on the group's reorder axis (the `x` or
 * `y` half of the measured {@link Box}), captured with motion-applied
 * transforms stripped — i.e. where the item *lives*, not where a live
 * drag has visually carried it.
 *
 * Mirrors framer-motion `Reorder/types.ts` `ItemData<T>`.
 */
export interface ItemData<V> {
    value: V
    layout: Axis
}

/**
 * Contract between `Reorder.Group` (provider) and `Reorder.Item`
 * (consumer). Mirrors framer-motion's `ReorderContextProps<T>`
 * (`context/ReorderContext.ts`), with two Svelte-specific adaptations:
 *
 * - `axis` is a getter-backed property so items observe prop changes
 *   without re-creating the context (Svelte context is set once).
 * - `unregisterItem` exists because our order registry persists across
 *   renders — React rebuilds `order` from scratch every render, so
 *   unmounted items vanish for free; here they must deregister.
 */
export interface ReorderContextProps<V> {
    /** The group's reorder axis. Items drag-lock to this by default. */
    readonly axis: 'x' | 'y'
    /**
     * Record (or refresh) an item's measured layout slot. Called from
     * the item's `onLayoutMeasure`, so entries stay current as
     * siblings FLIP into new slots.
     */
    registerItem: (value: V, layout: Box) => void
    /** Remove an item's entry when it unmounts. */
    unregisterItem: (value: V) => void
    /**
     * Ask the group to re-evaluate the order for a live drag. `offset`
     * is the dragged item's current axis offset from its slot and
     * `velocity` its axis velocity; the group runs `checkReorder` and
     * fires `onReorder` when a swap is due.
     */
    updateOrder: (value: V, offset: number, velocity: number) => void
    /** The group's rendered element, for edge auto-scrolling. */
    getGroupElement: () => HTMLElement | null
}

const REORDER_CONTEXT_KEY = Symbol('reorder-group')

/**
 * Publish a group's reorder contract for descendant `Reorder.Item`s.
 * Called once by `Reorder.Group` during component init.
 */
export const setReorderContext = <V>(context: ReorderContextProps<V>): void => {
    setContext<ReorderContextProps<V>>(REORDER_CONTEXT_KEY, context)
}

/**
 * Read the nearest `Reorder.Group` contract, or `undefined` when not
 * inside one — `Reorder.Item` treats that as a usage error.
 */
export const getReorderContext = <V>(): ReorderContextProps<V> | undefined => {
    return getContext<ReorderContextProps<V> | undefined>(REORDER_CONTEXT_KEY)
}
