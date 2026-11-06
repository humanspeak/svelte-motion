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
     * @prop onReorder - Receives the new order and the moved item's value after a swap.
     */
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { Box } from '$lib/utils/projection'
    import { isMotionValueChild } from '$lib/utils/motionValueChild'
    import { getReorderBoardContext } from './board'
    import { checkReorder, keyTarget, moveItem } from './checkReorder'
    import { setReorderContext, type ItemData, type ReorderContextProps } from './context'
    import { detectAxis } from './detectAxis'
    import { applyOrderSwap } from './order'
    import type { MouseEventHandler, PointerEventHandler } from 'svelte/elements'
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
        __motionKind: kind = 'motion',
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

    /**
     * Each item's element getter, for arrow keys to focus. Registered by the
     * items, pruned with `itemLayouts` when a value leaves `values`. Plain
     * `Map` like `itemLayouts`: the getters read the items' reactive `ref`,
     * which is what the tab-stop effect needs to track.
     */

    const elements = new Map<V, () => HTMLElement | null | undefined>()

    /** The item focused last, the group's tab stop while it's in `values`. */
    let active = $state<V>()
    const valuesSet = $derived(new Set(values))
    const tabStop = $derived(valuesSet.has(active as V) ? active : values[0])
    const isRendered = (value?: V): boolean => !!elements.get(value as V)?.()?.isConnected

    /** Only values in `values` can be the tab stop. */
    const activate = (value?: V): void => {
        if (valuesSet.has(value as V)) active = value
    }

    /**
     * If the tab stop isn't rendered (e.g. it's virtualized), the first
     * rendered item takes its place. Items check again when they unmount
     * (Motion 14.9.1 `Reorder/Group.tsx` `checkTabStop`).
     */
    const checkTabStop = (): void => {
        if (!isRendered(tabStop)) activate(values.find(isRendered))
    }

    const getMeasuredOrder = (): ItemData<V>[] =>
        values.flatMap((value) => {
            const layout = itemLayouts.get(value)
            return layout ? [{ value, layout }] : []
        })

    /**
     * Write the measured items' new order back into their slots in `values`,
     * leaving unmeasured values in place, and fire `onReorder` only if
     * something moved (Motion 14.6.0 `Reorder/Group.tsx` `commit`).
     *
     * @returns Whether `onReorder` was called.
     */
    const commit = (order: ItemData<V>[], newOrder: ItemData<V>[], moved: V): boolean => {
        const newValues = applyOrderSwap(values, order, newOrder)
        if (!newValues.some((value, index) => value !== values[index])) return false
        onReorder(newValues, moved)
        return true
    }

    const isRTL = (): boolean =>
        ref?.ownerDocument.defaultView?.getComputedStyle(ref).direction === 'rtl'

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

    const context: ReorderContextProps<V> = {
        get axis() {
            return axis
        },
        // The group's kind is fixed by its entry (`$lib/reorder` or `$lib/m`).
        get kind() {
            return kind
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
            const direction = isRTL() ? 'rtl' : 'ltr'
            const newOrder = checkReorder(order, value, offset, velocity, axis, direction)

            if (order !== newOrder) {
                isReordering = true
                hasReordered = true
                commit(order, newOrder, value)
            }
        },
        getGroupElement: () => ref ?? null,
        clearReordered: () => {
            hasReordered = false
        },
        isTabStop: (value) => value === tabStop || !valuesSet.has(value),
        setActive: activate,
        checkTabStop,
        elements,
        // Motion 14.10.1 `Reorder/Group.tsx` `onKeyDown`, line for line, except
        // that the grab snapshot is a copy (`values` may be mutated in place)
        // and it reports whether it committed a new order. In a Reorder.Board,
        // arrows across `axis`, or along it from either end, move a grabbed
        // item to the nearest group that way, and Escape returns it to the
        // group it was grabbed in.
        onKeyDown: (event, item, from, grab) => {
            const { key, currentTarget } = event
            if (
                event.defaultPrevented ||
                event.target !== currentTarget ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey
            ) {
                return false
            }
            const order = getMeasuredOrder()
            const keys = ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'Home', 'End']
            const keyIndex = keys.indexOf(key)
            const isX = keyIndex % 2
            let committed = false
            if (key === ' ') {
                if (!event.repeat) grab(currentTarget, from ? undefined : [...values])
            } else if (keyIndex < 0 && !(key === 'Escape' && from)) {
                return false
            } else if (board?.isMoving(currentTarget)) {
                // Until Svelte renders its move to another group, this item
                // and its group's values are out of date: moving it again,
                // or back, would leave it in both groups.
            } else if (key === 'Escape' && from) {
                // Drop it first: a move back to the group it was grabbed in
                // hands it on to the item that mounts there.
                grab(currentTarget)
                if (
                    !board?.restore(
                        context as ReorderContextProps<unknown>,
                        item,
                        currentTarget,
                        from
                    )
                ) {
                    // Values added since the grab keep their slots.
                    const kept = from.flatMap((value) =>
                        order.filter((data) => data.value === value)
                    )
                    committed = commit(
                        order,
                        order.map((data) => (from.includes(data.value) ? kept.shift()! : data)),
                        item
                    )
                }
            } else {
                // Home and End work on every axis; arrows across it are the page's.
                const isAlongAxis = keyIndex > 3 || axis === 'xy' || axis === (isX ? 'x' : 'y')
                // Focus only moves between rendered items.
                const list = from ? order : order.filter(({ value }) => isRendered(value))
                const index = list.findIndex(({ value }) => value === item)
                const target = isAlongAxis
                    ? keyTarget(list, index, keyIndex, axis, !!isX && isRTL())
                    : -1
                if (target > -1) {
                    if (from) committed = commit(order, moveItem(order, index, target), item)
                    else elements.get(list[target].value)?.()?.focus()
                } else if (
                    !(
                        from &&
                        keyIndex < 4 &&
                        board?.key(
                            context as ReorderContextProps<unknown>,
                            item,
                            keyIndex,
                            currentTarget,
                            from
                        )
                    ) &&
                    !isAlongAxis
                ) {
                    return false
                }
                // A board move doesn't commit through this group, so
                // `committed` stays false: the item that mounts in the other
                // group takes focus (`board.receive`).
            }
            event.preventDefault()
            return committed
        },
        // Track identity and contents so in-place $state mutations count too.
        trackOrder: () => values.forEach(() => {}),
        // For a `Reorder.Board` (Motion 14.10.1 `Reorder/Group.tsx`).
        get values() {
            return values
        },
        onReorder: (newOrder, moved) => onReorder(newOrder, moved),
        getOrder: getMeasuredOrder,
        markReordered: () => {
            hasReordered = true
        }
    }
    setReorderContext<V>(context)

    /**
     * Inside a `Reorder.Board`, register with it so its items can move
     * between groups (Motion 14.10.1 `Reorder/Group.tsx` `board?.add`).
     */
    const board = getReorderBoardContext()
    $effect(() => board?.add(context as ReorderContextProps<unknown>))

    $effect(() => {
        for (const map of [itemLayouts, elements]) {
            map.forEach((_, value) => {
                if (!valuesSet.has(value)) map.delete(value)
            })
        }
        updateDetectedAxis()
    })

    /**
     * Upstream runs `checkTabStop` after every render. Here it re-runs when
     * `values`, the active item or a tab-stop item's element changes (the
     * element getters read the items' `ref`).
     */
    $effect(checkTabStop)

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
    const handlePointerDownCapture: PointerEventHandler<HTMLElement> = (event) => {
        hasReordered = false
        onpointerdowncapture?.(event)
    }

    const handleClickCapture: MouseEventHandler<HTMLElement> = (event) => {
        if (hasReordered && event.detail) {
            hasReordered = false
            event.stopPropagation()
            event.preventDefault()
        }
        onclickcapture?.(event)
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

<!--
    `__motionKind` / `ignoreStrict`: the `m` entry's group renders an `m`
    component; the main one renders `motion` and, inside
    `<LazyMotion strict>`, warns once instead of throwing (Motion 14.7.1
    `Reorder/Group.tsx` `ignoreStrict`, #2094).
-->
<MotionContainer
    bind:ref
    tag={as}
    {...rest}
    __motionKind={kind}
    ignoreStrict={kind === 'motion'}
    onpointerdowncapture={handlePointerDownCapture}
    onclickcapture={handleClickCapture}
    style={groupStyle}
    data-reorder-axis={axis}
    {motionValueChild}
>
    {@render childSnippet?.()}
</MotionContainer>
