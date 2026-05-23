/**
 * Mirrors `motion-utils`'s `Axis` shape — a 1-D layout extent. Inlined so
 * the Reorder folder doesn't pull a new direct dep just for two
 * type aliases (motion-utils is reachable transitively via motion-dom
 * but only as a runtime dep, not a type dep).
 */
export interface ReorderAxis {
    min: number
    max: number
}

/** Mirrors `motion-utils`'s `Box` shape — a 2-D layout extent. */
export interface ReorderBox {
    x: ReorderAxis
    y: ReorderAxis
}

/**
 * Per-Reorder.Group state contributed by every Reorder.Item via the
 * context. Mirrors framer-motion's `ItemData<V>`.
 */
export interface ItemData<T> {
    value: T
    layout: ReorderAxis
}

/**
 * Context shape Reorder.Group provides to its descendant Reorder.Items.
 * Matches framer-motion's `ReorderContextProps` so the porting story is
 * one-to-one. `groupRef` is a getter so Items can read the latest live
 * element across the parent's lifecycle.
 */
export interface ReorderContext<T> {
    axis: 'x' | 'y'
    registerItem: (value: T, layout: ReorderBox) => void
    updateOrder: (value: T, offset: number, velocity: number) => void
    readonly groupRef: Element | null
}

export const ReorderContextKey = Symbol('svelte-motion:reorder')
