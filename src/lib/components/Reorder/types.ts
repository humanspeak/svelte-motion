import type { HTMLElementProps } from '$lib/types'
import type { MotionKind } from '$lib/utils/motionKind'
import type { Snippet } from 'svelte'
import type { MouseEventHandler, PointerEventHandler, SvelteHTMLElements } from 'svelte/elements'

/** Element tags a Reorder component can render as, via the `as` prop. */
export type ReorderElementTag = keyof SvelteHTMLElements

/** Axes supported by `Reorder.Group`, including wrapped two-dimensional layouts. */
export type ReorderAxis = 'x' | 'y' | 'xy'

/**
 * Props for `Reorder.Group`. Mirrors framer-motion's `Reorder.Group`
 * (`Reorder/Group.tsx`): all motion props are accepted and forwarded
 * to the underlying motion element.
 */
export type ReorderGroupProps<V> = HTMLElementProps & {
    /** The HTML element to render. @default 'ul' */
    as?: ReorderElementTag
    /**
     * The axis to reorder along. When omitted, the group detects the
     * axis from its measured item layout. Use `'xy'` for wrapped grids.
     */
    axis?: ReorderAxis
    /**
     * The current order of values. Each `Reorder.Item` inside the
     * group must appear here via its `value` prop.
     */
    values: V[]
    /**
     * A callback to fire with the new value order. Assign the result back
     * to the state driving `values`.
     *
     * The second argument is the value of the item that moved. Its old and
     * new positions are `values.indexOf(moved)` and `newOrder.indexOf(moved)`.
     * This fires for each step of a drag, not once when it ends, so these
     * describe that step's move.
     */
    onReorder: (newOrder: V[], moved: V) => void
    /**
     * Capture-phase `pointerdown` listener on the group element. Runs after
     * the group resets its post-drag click guard.
     */
    onpointerdowncapture?: PointerEventHandler<HTMLElement> | null
    /**
     * Capture-phase `click` listener on the group element. Runs after the
     * group swallows the click that follows a reorder.
     */
    onclickcapture?: MouseEventHandler<HTMLElement> | null
    /** @internal Set by the `m` entry's `Reorder.Group`. */
    __motionKind?: MotionKind
}

/**
 * Props for `Reorder.Item`. Mirrors framer-motion's `Reorder.Item`
 * (`Reorder/Item.tsx`): renders a draggable motion element whose
 * `layout` defaults to `true`.
 */
export type ReorderItemProps<V> = HTMLElementProps & {
    /** The HTML element to render. @default 'li' */
    as?: ReorderElementTag
    /** The entry in the group's `values` array this item represents. */
    value: V
    /**
     * Layout animation mode for the item — `'position'` disables size
     * projection while slots shuffle.
     * @default true
     */
    layout?: true | 'position'
}

/**
 * Props for `Reorder.Board`. Mirrors framer-motion's `Reorder.Board`
 * (`Reorder/Board.tsx` `Props`, Motion 14.10).
 */
export type ReorderBoardProps<V> = {
    /**
     * Whether `value` can move between two groups, from the group whose
     * values are `from` to the group whose values are `to`. It's called
     * before either group's `onReorder`. Return `false` to leave the item
     * where it is: a dragged item stays in its group until it's dragged
     * over another.
     *
     * While a dragged item is over a group it refuses, it's called every
     * frame, so keep it fast and free of side effects.
     *
     * ```svelte
     * <Reorder.Board canMove={(card, from, to) => to.length < 5}>
     * ```
     */
    canMove?: (value: V, from: V[], to: V[]) => boolean
    /** The groups, and anything around them. */
    children?: Snippet
}
