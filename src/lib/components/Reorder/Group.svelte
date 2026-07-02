<script lang="ts" generics="V">
    /**
     * Drag-to-reorder list container. Port of framer-motion's
     * `Reorder.Group` (`Reorder/Group.tsx`).
     *
     * Owns the measured working order of its `Reorder.Item` children
     * and, when a live drag carries an item past a sibling's center,
     * fires `onReorder` with the swapped `values` copy. The consumer
     * assigns that back to state; the resulting keyed-each DOM move is
     * FLIP-animated by the items' `layout` prop.
     *
     * @prop as - Element to render. Defaults to `'ul'`.
     * @prop axis - Axis to reorder along. Defaults to `'y'`.
     * @prop values - The current order of item values.
     * @prop onReorder - Receives the new order after a swap.
     */
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import { isMotionValueChild } from '$lib/utils/motionValueChild'
    import { checkReorder } from './checkReorder'
    import { setReorderContext, type ItemData } from './context'
    import { applyOrderSwap, removeOrderEntry, upsertOrderEntry } from './order'
    import type { ReorderGroupProps } from './types'

    let {
        children,
        as = 'ul',
        axis = 'y',
        values,
        onReorder,
        style,
        ref = $bindable(),
        ...rest
    }: ReorderGroupProps<V> = $props()

    // svelte-ignore state_referenced_locally
    if (!values) {
        throw new Error('Reorder.Group must be provided a values prop')
    }

    const motionValueChild = $derived(isMotionValueChild(children) ? children : undefined)
    const childSnippet = $derived(typeof children === 'function' ? children : undefined)

    /**
     * Measured slots, sorted by axis start. A single persistent array
     * (upstream rebuilds per React render); `registerItem` upserts and
     * `unregisterItem` removes, so it tracks the mounted items.
     */
    const order: ItemData<V>[] = []

    /**
     * Swap-in-flight guard: set when `onReorder` fires, released one
     * frame after the new `values` reach us, by which point the
     * MutationObserver-driven re-measure has refreshed `order`. Blocks
     * `checkReorder` from running against stale slots mid-swap.
     */
    let isReordering = false

    setReorderContext<V>({
        get axis() {
            return axis
        },
        registerItem: (value, layout) => {
            upsertOrderEntry(order, value, layout[axis])
        },
        unregisterItem: (value) => {
            removeOrderEntry(order, value)
        },
        updateOrder: (value, offset, velocity) => {
            if (isReordering) return

            const newOrder = checkReorder(order, value, offset, velocity)

            if (order !== newOrder) {
                isReordering = true
                onReorder(applyOrderSwap(values, order, newOrder))
            }
        },
        getGroupElement: () => ref ?? null
    })

    $effect(() => {
        void values
        const frame = requestAnimationFrame(() => {
            isReordering = false
        })
        return () => cancelAnimationFrame(frame)
    })

    /**
     * Browser scroll anchoring reacts to items moving and adjusts the
     * scroll position, which corrupts drag position math mid-gesture —
     * disable it on the container (upstream `Group.tsx` `groupStyle`).
     */
    const groupStyle = $derived(
        typeof style === 'string'
            ? `overflow-anchor: none; ${style}`
            : { overflowAnchor: 'none', ...(style ?? {}) }
    )
</script>

<MotionContainer bind:ref tag={as} {...rest} style={groupStyle} {motionValueChild}>
    {@render childSnippet?.()}
</MotionContainer>
