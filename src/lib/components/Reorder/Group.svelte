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
     * @prop axis - Axis to reorder along. Detected from item layout when omitted.
     * @prop values - The current order of item values.
     * @prop onReorder - Receives the new order after a swap.
     */
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { Box } from '$lib/utils/projection'
    import { isMotionValueChild } from '$lib/utils/motionValueChild'
    import { checkReorder } from './checkReorder'
    import { setReorderContext, type ItemData } from './context'
    import { detectAxis } from './detectAxis'
    import { applyOrderSwap } from './order'
    import type { ReorderAxis, ReorderGroupProps } from './types'

    let {
        children,
        as = 'ul',
        axis: axisOverride,
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
     * Complete measured slots keyed by value, retained until item teardown.
     * This registry is deliberately non-reactive: layout measurement mutates
     * it from effects, while registration/unregistration explicitly refreshes
     * axis detection. A SvelteMap would make those writes self-triggering.
     */
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- measurement registry has explicit invalidation
    const itemLayouts = new Map<V, Box>()
    let detectedAxis = $state<ReorderAxis>('y')
    const axis = $derived(axisOverride ?? detectedAxis)

    const getMeasuredOrder = (): ItemData<V>[] =>
        values.flatMap((value) => {
            const layout = itemLayouts.get(value)
            return layout ? [{ value, layout }] : []
        })

    const updateDetectedAxis = (): void => {
        if (axisOverride === undefined) {
            detectedAxis = detectAxis(getMeasuredOrder().map(({ layout }) => layout))
        }
    }

    /**
     * Swap-in-flight guard: set when `onReorder` fires and released on
     * the next frame, after an accepted synchronous values update has
     * patched the keyed children. Releasing independently of `values`
     * also lets controlled consumers reject a proposed reorder without
     * permanently disabling the gesture.
     */
    let isReordering = false
    let reorderingFrame: number | null = null

    setReorderContext<V>({
        get axis() {
            return axis
        },
        registerItem: (value, layout) => {
            itemLayouts.set(value, layout)
            updateDetectedAxis()
        },
        unregisterItem: (value) => {
            itemLayouts.delete(value)
            updateDetectedAxis()
        },
        updateOrder: (value, offset, velocity) => {
            if (isReordering) return

            const order = getMeasuredOrder()
            const direction =
                ref?.ownerDocument.defaultView?.getComputedStyle(ref).direction === 'rtl'
                    ? 'rtl'
                    : 'ltr'
            const newOrder = checkReorder(order, value, offset, velocity, axis, direction)

            if (order !== newOrder) {
                isReordering = true
                onReorder(applyOrderSwap(values, order, newOrder))
                reorderingFrame = requestAnimationFrame(() => {
                    isReordering = false
                    reorderingFrame = null
                })
            }
        },
        getGroupElement: () => ref ?? null
    })

    $effect(() => {
        const valuesSet = new Set(values)
        itemLayouts.forEach((_, value) => {
            if (!valuesSet.has(value)) itemLayouts.delete(value)
        })
        updateDetectedAxis()
    })

    $effect(() => () => {
        if (reorderingFrame !== null) cancelAnimationFrame(reorderingFrame)
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

<MotionContainer
    bind:ref
    tag={as}
    {...rest}
    style={groupStyle}
    data-reorder-axis={axis}
    {motionValueChild}
>
    {@render childSnippet?.()}
</MotionContainer>
