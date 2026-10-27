import type { DragPoint } from '$lib/types'
import type { Box } from '$lib/utils/projection'
import { getContext, setContext } from 'svelte'
import type { ReorderAxis } from './types'

/**
 * A measured entry in a `Reorder.Group`'s working order.
 *
 * `layout` is the item's complete measured slot, captured with
 * motion-applied transforms stripped — i.e. where the item *lives*,
 * not where a live drag has visually carried it.
 *
 * Mirrors framer-motion `Reorder/types.ts` `ItemData<T>`.
 */
export interface ItemData<V> {
    value: V
    layout: Box
}

/**
 * Contract between `Reorder.Group` (provider) and `Reorder.Item`
 * (consumer). Mirrors framer-motion's `ReorderContextProps<T>`
 * (`context/ReorderContext.ts`), with two Svelte-specific adaptations:
 *
 * - `axis` is a getter-backed property that items bridge through a local
 *   `$derived`, so post-measure detection propagates without re-creating the
 *   context (Svelte context is set once).
 * - `unregisterItem` exists because our order registry persists across
 *   renders — React rebuilds `order` from scratch every render, so
 *   unmounted items vanish for free; here they must deregister.
 * - `clearReordered` replaces upstream's shared `hasReordered` ref
 *   (Motion 14.1.1, #2682): the group keeps the flag private and items
 *   only ever clear it.
 * - `onKeyDown` returns whether it committed a new order, so the item knows
 *   a keyed-each move (and the focus loss it can cause) is coming.
 * - `trackOrder` exists because Svelte doesn't restore focus after a
 *   keyed-each move the way React does: the item refocuses itself once
 *   `values` changes.
 */
export interface ReorderContextProps<V> {
    /** The group's reorder axis. Items drag-lock to this by default. */
    readonly axis: ReorderAxis
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
     * and `velocity` contain both axes so wrapped layouts can choose a
     * row and insertion slot.
     */
    updateOrder: (value: V, offset: DragPoint, velocity: DragPoint) => void
    /** The group's rendered element, for edge auto-scrolling. */
    getGroupElement: () => HTMLElement | null
    /** Ends the reorder-click guard; called from Reorder.Item's onDragEnd, a frame after the release's click. */
    clearReordered: () => void
    /**
     * Handle a key on an item: Space grabs and drops, arrows along `axis`
     * move the grabbed item one place (Left and Right swap in RTL) and
     * Escape restores the order in `from`, the values when it was grabbed.
     * Mirrors Motion 14.6.0 `Reorder/Group.tsx` `onKeyDown`.
     *
     * @param event - The item's keydown event.
     * @param item - The item's value.
     * @param from - The values when the item was grabbed, or `undefined` when it isn't.
     * @param grab - Sets (with `from`) or clears (without) the item's grab.
     * @returns Whether a new order was committed through `onReorder`.
     */
    onKeyDown: (
        event: KeyboardEvent & { currentTarget: EventTarget & HTMLElement },
        item: V,
        from: V[] | undefined,
        grab: (element: HTMLElement, from?: V[]) => void
    ) => boolean
    /**
     * Read `values` (identity and contents) inside a reactive scope, so an
     * item can refocus itself after the list it belongs to is re-rendered.
     */
    trackOrder: () => void
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
