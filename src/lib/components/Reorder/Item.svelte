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
    import { getReorderContext } from './context'
    import type { ReorderItemProps } from './types'

    let {
        children,
        style,
        value,
        as = 'li',
        onDrag,
        onDragEnd,
        onkeydown,
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
    const itemDrag = $derived(reorderAxis === 'xy' ? true : reorderAxis)

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

    const handleDrag = (event: PointerEvent, info: DragInfo) => {
        // The bound style MotionValue is dual-written by the drag
        // gesture, so it reads as the live offset from the item's slot.
        const offset = { x: point.x.get() as number, y: point.y.get() as number }
        context.updateOrder(value, offset, info.velocity)

        const scrollAxis = selectAutoScrollAxis(reorderAxis, info.velocity)
        // Auto-scroll compares viewport geometry, so use the matching client coordinate.
        const pointerPosition = scrollAxis === 'x' ? event.clientX : event.clientY
        autoScrollIfNeeded(
            context.getGroupElement(),
            pointerPosition,
            scrollAxis,
            info.velocity[scrollAxis]
        )
        onDrag?.(event, info)
    }

    const handleDragEnd = (event: PointerEvent, info: DragInfo) => {
        // Runs a frame after release, so after the release's click
        context.clearReordered()
        resetAutoScrollState()
        onDragEnd?.(event, info)
    }

    $effect(() => {
        return () => context.unregisterItem(value)
    })

    // Typed here: `HTMLElementProps` only declares an `unknown` index signature.
    const userKeyDown = $derived(onkeydown as KeyboardEventHandler<HTMLElement> | null | undefined)
    const userBlur = $derived(onblur as FocusEventHandler<HTMLElement> | null | undefined)

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
        // Fire-and-forget like upstream: the animation settles on its own.
        void visualElementStore.get(element)?.animationState?.setActive('whileDrag', !!from)
    }

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
    consumer's `tabindex={-1}` removes the Tab stop; everything after the
    spread is enforced by Reorder and wraps or overrides consumer props.
-->
<MotionContainer
    bind:ref
    tag={as}
    drag={itemDrag}
    tabindex={0}
    {...rest}
    onkeydown={handleKeyDown}
    onblur={handleBlur}
    dragSnapToOrigin
    style={itemStyle}
    {layout}
    onDrag={handleDrag}
    onDragEnd={handleDragEnd}
    onLayoutMeasure={(box: LayoutMeasurePayload) => context.registerItem(value, box)}
    {motionValueChild}
>
    {@render childSnippet?.()}
</MotionContainer>
