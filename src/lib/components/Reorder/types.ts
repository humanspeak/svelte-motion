import type { HTMLElementProps } from '$lib/types'
import type { SvelteHTMLElements } from 'svelte/elements'

/** Element tags a Reorder component can render as, via the `as` prop. */
export type ReorderElementTag = keyof SvelteHTMLElements

/**
 * Props for `Reorder.Group`. Mirrors framer-motion's `Reorder.Group`
 * (`Reorder/Group.tsx`): all motion props are accepted and forwarded
 * to the underlying motion element.
 */
export type ReorderGroupProps<V> = HTMLElementProps & {
    /** The HTML element to render. @default 'ul' */
    as?: ReorderElementTag
    /**
     * The axis to reorder along. Items drag-lock to this axis by
     * default; pass `drag` on an item to free both axes.
     * @default 'y'
     */
    axis?: 'x' | 'y'
    /**
     * The current order of values. Each `Reorder.Item` inside the
     * group must appear here via its `value` prop.
     */
    values: V[]
    /**
     * Fires with the new value order when a drag carries an item past
     * a sibling. Assign the result back to the state driving `values`.
     */
    onReorder: (newOrder: V[]) => void
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
