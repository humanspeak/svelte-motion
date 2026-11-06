<script lang="ts" generics="V">
    /**
     * A draggable entry inside a `Reorder.Group`. Port of
     * framer-motion's `Reorder.Item` (`Reorder/Item.tsx`).
     *
     * Renders a motion element that drag-locks to the group's axis,
     * snaps back to its (possibly new) slot on release, and reports
     * its live drag offset to the group each frame so the order can
     * update mid-gesture. While dragging, the item floats above its
     * siblings via a transform-driven `zIndex`. Keyboard reorderable
     * (Motion 14.6.0): Space grabs and drops, arrows move, Escape restores.
     * The group is one tab stop and arrows move focus between items
     * (Motion 14.9). Inside a `Reorder.Board` it drags on both axes and
     * can be dragged into another group (Motion 14.10).
     *
     * @prop as - Element to render. Defaults to `'li'`.
     * @prop value - The entry in the group's `values` this item represents.
     * @prop layout - Layout animation mode. Defaults to `true`; pass `'position'` to skip size projection.
     */
    import { isMotionValue, visualElementStore } from 'motion-dom'
    import { untrack } from 'svelte'
    import type { FocusEventHandler, KeyboardEventHandler } from 'svelte/elements'
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { DragInfo, LayoutMeasurePayload } from '$lib/types'
    import { useMotionValue } from '$lib/utils/motionValue.svelte'
    import { isMotionValueChild } from '$lib/utils/motionValueChild'
    import { parseStyleString } from '$lib/utils/style'
    import { useTransform } from '$lib/utils/transform.svelte'
    import { autoScrollIfNeeded, resetAutoScrollState, selectAutoScrollAxis } from './autoScroll'
    import { getReorderBoardContext } from './board'
    import { getReorderContext, type ReorderContextProps } from './context'
    import type { ReorderItemProps } from './types'

    let {
        children,
        style,
        value,
        as = 'li',
        onDragStart,
        onDrag,
        onDragEnd,
        onkeydown,
        onfocusin,
        onblur,
        layout = true,
        ref = $bindable(),
        ...rest
    }: ReorderItemProps<V> = $props()

    const context = getReorderContext<V>()
    if (!context) {
        throw new Error('Reorder.Item must be a child of Reorder.Group')
    }

    // Context is published once, so bridge its getter-backed axis into an
    // item-local reactive dependency. Automatic detection runs after layout
    // measurement; without this bridge the motion child can retain the safe
    // initial `y` constraint instead of re-wiring drag to the detected axis.
    const reorderAxis = $derived(context.axis)

    /**
     * The enclosing `Reorder.Board`, if any. Its groups are identified by
     * their context objects (Motion 14.10.1 `Item.tsx` `board`).
     */
    const board = getReorderBoardContext()
    const group = context as ReorderContextProps<unknown>

    /**
     * In a Reorder.Board, items can be dragged out of their group.
     */
    const itemDrag = $derived(reorderAxis === 'xy' || board ? true : reorderAxis)

    const motionValueChild = $derived(isMotionValueChild(children) ? children : undefined)
    const childSnippet = $derived(typeof children === 'function' ? children : undefined)

    /**
     * Reuse consumer-provided `x`/`y` MotionValues so external code can
     * observe or drive the drag offset (upstream `useDefaultMotionValue`).
     * Captured from the initial style — the values' identity must stay
     * stable for the lifetime of the gesture wiring.
     */
    // svelte-ignore state_referenced_locally
    const initialStyle = typeof style === 'string' ? parseStyleString(style) : (style ?? {})
    const x = isMotionValue(initialStyle.x) ? initialStyle.x : useMotionValue(0)
    const y = isMotionValue(initialStyle.y) ? initialStyle.y : useMotionValue(0)
    const point = { x, y }

    const zIndex = useTransform([x, y], ([latestX, latestY]) => (latestX || latestY ? 1 : 'unset'))

    /**
     * Set when this item continues a drag that a `Reorder.Board` moved here
     * from another group: the gesture's `onDragStart` already fired there,
     * so the restart here skips it once (Motion 14.10.1 `Item.tsx`
     * `isContinued`).
     */
    let isContinued = false

    const handleDragStart = (event: PointerEvent, info: DragInfo) => {
        if (isContinued) isContinued = false
        else onDragStart?.(event, info)
    }

    /**
     * After a `Reorder.Board` moves this item, its destroyed row keeps
     * receiving this gesture's moves until the new row takes it over. Then
     * `element` is detached (or gone): `board.drag` returns false for it and
     * `updateOrder` leaves an order without `value` as it is, so this
     * mustn't throw either way.
     */
    const handleDrag = (event: PointerEvent, info: DragInfo) => {
        // The bound style MotionValue is dual-written by the drag
        // gesture, so it reads as the live offset from the item's slot.
        const offset = { x: point.x.get() as number, y: point.y.get() as number }
        const moved = !!element && !!board?.drag(group, value, element, event)
        if (!moved) context.updateOrder(value, offset, info.velocity)

        /**
         * In a Reorder.Board, scroll on both axes, e.g. across columns as
         * well as down them. Across them, scroll what's around the columns:
         * an item dragged out of its column overflows it, so the column
         * could scroll across too (Motion 14.10.1 `Item.tsx` `onDrag`).
         */
        const scrollAxes: Array<'x' | 'y'> = board
            ? ['x', 'y']
            : [selectAutoScrollAxis(reorderAxis, info.velocity)]
        for (const scrollAxis of scrollAxes) {
            // Auto-scroll compares viewport geometry, so use the matching client coordinate.
            const pointerPosition = scrollAxis === 'x' ? event.clientX : event.clientY
            autoScrollIfNeeded(
                board && !reorderAxis.includes(scrollAxis)
                    ? board.column(group)
                    : context.getGroupElement(),
                pointerPosition,
                scrollAxis,
                info.velocity[scrollAxis]
            )
        }
        onDrag?.(event, info)
    }

    const handleDragEnd = (event: PointerEvent, info: DragInfo) => {
        // Runs a frame after release, so after the release's click
        context.clearReordered()
        resetAutoScrollState()
        board?.end(value)
        onDragEnd?.(event, info)
    }

    /**
     * This item's element, kept for the group to focus and forwarded to
     * the consumer's `ref` (upstream `Item.tsx` `element` + combined ref).
     * Separate from the `ref` prop: an unbound `$bindable` resets to the
     * parent's value whenever the parent's props are re-spread, which would
     * lose the element. The group reads it lazily, so its tab-stop check is
     * reactive to the element appearing.
     */
    let element = $state<HTMLElement | null | undefined>(undefined)
    const setElement = (node: HTMLElement | null | undefined) => {
        element = node
        ref = node
    }
    // svelte-ignore state_referenced_locally
    context.elements.set(value, () => element)

    $effect(() => {
        return () => {
            context.unregisterItem(value)
            // The tab stop may have been this item (Motion 14.9.1 `Item.tsx`).
            context.checkTabStop()
        }
    })

    // Typed here: `HTMLElementProps` only declares an `unknown` index signature.
    const userKeyDown = $derived(onkeydown as KeyboardEventHandler<HTMLElement> | null | undefined)
    const userBlur = $derived(onblur as FocusEventHandler<HTMLElement> | null | undefined)
    const userFocusIn = $derived(onfocusin as FocusEventHandler<HTMLElement> | null | undefined)

    /**
     * The item focused last, or holding focus, is the group's tab stop
     * (Motion 14.9.1 `Item.tsx` `onFocus`). React's `onFocus` bubbles, so
     * the Svelte equivalent is `focusin`: focus inside the item counts too.
     * A consumer's `onfocus` still runs first, as `focus` fires before
     * `focusin`.
     */
    const handleFocusIn: FocusEventHandler<HTMLElement> = (event) => {
        userFocusIn?.(event)
        context.setActive(value)
    }

    /** The values when this item was grabbed by keyboard, or `undefined`. */
    let grabbedFrom = $state<V[] | undefined>(undefined)

    /**
     * Set when a keyboard move committed a new order, cleared once the item
     * has refocused itself (or on the next keydown). Plain `let`: read and
     * written from handlers and an untracked effect body only.
     */
    let pendingRefocus = false

    const grab = (element: HTMLElement, from?: V[]) => {
        grabbedFrom = from
        if (!from) board?.end(value)
        // Fire-and-forget like upstream: the animation settles on its own.
        void visualElementStore.get(element)?.animationState?.setActive('whileDrag', !!from)
    }

    /**
     * If a `Reorder.Board` just moved this item here from another group,
     * carry on its drag (Motion 14.10.1 `Item.tsx`, a mount layout effect).
     * This item's own effects run after its `MotionContainer`'s, so by the
     * first one with an element, its VisualElement is mounted and its drag
     * listeners (and so its `elementDragControls` entry) are in place.
     */
    let isReceived = false
    $effect(() => {
        if (!board || !element || isReceived) return
        isReceived = true
        const node = element
        untrack(() => {
            if (board.receive(group, value, node, grab as never)) isContinued = true
        })
    })

    const handleKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
        // A consumer that rejected the previous proposal mustn't leave it stuck.
        pendingRefocus = false
        userKeyDown?.(event)
        const wasGrabbed = !!grabbedFrom
        const committed = context.onKeyDown(event, value, grabbedFrom, grab)
        if (wasGrabbed && committed) pendingRefocus = true
    }

    /**
     * Svelte deviation from upstream `Item.tsx`: React disables its events
     * while it commits and restores focus to the moved item, so upstream
     * never sees the blur a move causes. Svelte's keyed each moves nodes with
     * `insertBefore` and does neither, so after a keyboard move the item
     * refocuses itself here once `values` has changed and been rendered
     * (however late the consumer applies it), and ignores the move's blur.
     */
    $effect(() => {
        context.trackOrder()
        untrack(() => {
            if (!pendingRefocus) return
            pendingRefocus = false
            if (ref && ref.ownerDocument.activeElement !== ref) ref.focus({ preventScroll: true })
        })
    })

    const handleBlur: FocusEventHandler<HTMLElement> = (event) => {
        // A move-blur: the node moved and focus fell to <body>.
        if (pendingRefocus && event.relatedTarget === null) return
        userBlur?.(event)
        // Focus really left (Tab, a click elsewhere): drop, keeping the order.
        if (grabbedFrom) grab(event.currentTarget)
    }

    // `position: relative` (overridable) makes the floating `zIndex`
    // actually apply — z-index is ignored on statically positioned
    // elements, and an upward swap moves the dragged item EARLIER in
    // the DOM, where the displaced (later-in-DOM) sibling would
    // otherwise paint over it.
    const itemStyle = $derived({
        position: 'relative',
        ...(typeof style === 'string' ? parseStyleString(style) : (style ?? {})),
        x,
        y,
        zIndex
    })
</script>

<!--
    Prop order mirrors upstream Item.tsx: `drag` and `tabindex` before the
    spread so a consumer's `drag` prop can unlock both axes and a
    consumer's `tabindex` overrides the group's roving tab stop; everything
    after the spread is enforced by Reorder and wraps or overrides consumer
    props.
-->
<MotionContainer
    bind:ref={() => element, setElement}
    tag={as}
    drag={itemDrag}
    tabindex={context.isTabStop(value) ? 0 : -1}
    {...rest}
    onkeydown={handleKeyDown}
    onfocusin={handleFocusIn}
    onblur={handleBlur}
    dragSnapToOrigin
    style={itemStyle}
    {layout}
    onDragStart={handleDragStart}
    onDrag={handleDrag}
    onDragEnd={handleDragEnd}
    onLayoutMeasure={(box: LayoutMeasurePayload) => context.registerItem(value, box)}
    {motionValueChild}
    __motionKind={context.kind}
    ignoreStrict={context.kind === 'motion'}
>
    {@render childSnippet?.()}
</MotionContainer>
