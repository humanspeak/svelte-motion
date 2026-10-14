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
        onpointerdowncapture,
        onclickcapture,
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
     * Swap-in-flight guard: set when `onReorder` fires, cleared when
     * `values` changes. A consumer that rejects a proposal won't be asked
     * again until `values` changes — Motion 13.4.5 semantics.
     */
    let isReordering = false

    /**
     * Set when a drag reorders the list; makes the group swallow the click
     * that follows the release (see `handleClickCapture`).
     */
    let hasReordered = false

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
                hasReordered = true
                onReorder(applyOrderSwap(values, order, newOrder))
            }
        },
        getGroupElement: () => ref ?? null,
        clearReordered: () => {
            hasReordered = false
        }
    })

    $effect(() => {
        const valuesSet = new Set(values)
        itemLayouts.forEach((_, value) => {
            if (!valuesSet.has(value)) itemLayouts.delete(value)
        })
        updateDetectedAxis()
    })

    /**
     * Only clear the guard once the new order has been rendered. Releasing on
     * a timer re-enables onReorder while a pending (async/deferred) order is
     * still unapplied, proposing the same swap twice
     * (Motion 13.4.5 `Reorder/Group.tsx`). Kept separate from the pruning
     * effect so an `axis` change doesn't clear the guard.
     */
    $effect(() => {
        // Track identity and contents so in-place $state mutations count too.
        values.forEach(() => {})
        isReordering = false
    })

    /**
     * A release that ends a reordering drag isn't a click. Browsers only
     * click an element holding both the press and release targets, so
     * whether it was clicked depended on which nodes Svelte's keyed each
     * moved, and so on drag direction (#2682): Chrome drops the click if the
     * dragged item's node moved, and clicks the item and group if a sibling's
     * node moved instead. Swallow it here, above every item, either way. The
     * flag is cleared when the drag ends, a frame after the release's click,
     * or on the next press. Clicks with no pointer press behind them
     * (detail 0, e.g. keyboard) are left alone.
     * (Motion 14.1.1 `Reorder/Group.tsx`.)
     */
    const handlePointerDownCapture = (event: PointerEvent) => {
        hasReordered = false
        if (typeof onpointerdowncapture === 'function') {
            ;(onpointerdowncapture as (event: PointerEvent) => void)(event)
        }
    }

    const handleClickCapture = (event: MouseEvent) => {
        if (hasReordered && event.detail) {
            hasReordered = false
            event.stopPropagation()
            event.preventDefault()
        }
        if (typeof onclickcapture === 'function') {
            ;(onclickcapture as (event: MouseEvent) => void)(event)
        }
    }

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
    onpointerdowncapture={handlePointerDownCapture}
    onclickcapture={handleClickCapture}
    style={groupStyle}
    data-reorder-axis={axis}
    {motionValueChild}
>
    {@render childSnippet?.()}
</MotionContainer>
