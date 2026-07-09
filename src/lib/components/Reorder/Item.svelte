<script lang="ts" generics="V">
    /**
     * A draggable entry inside a `Reorder.Group`. Port of
     * framer-motion's `Reorder.Item` (`Reorder/Item.tsx`).
     *
     * Renders a motion element that drag-locks to the group's axis,
     * snaps back to its (possibly new) slot on release, and reports
     * its live drag offset to the group each frame so the order can
     * update mid-gesture. While dragging, the item floats above its
     * siblings via a transform-driven `zIndex`.
     *
     * @prop as - Element to render. Defaults to `'li'`.
     * @prop value - The entry in the group's `values` this item represents.
     * @prop layout - Layout animation mode. Defaults to `true`; pass `'position'` to skip size projection.
     */
    import { isMotionValue } from 'motion-dom'
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { DragInfo, LayoutMeasurePayload } from '$lib/types'
    import { useMotionValue } from '$lib/utils/motionValue.svelte'
    import { isMotionValueChild } from '$lib/utils/motionValueChild'
    import { parseStyleString } from '$lib/utils/style'
    import { useTransform } from '$lib/utils/transform.svelte'
    import { autoScrollIfNeeded, resetAutoScrollState } from './autoScroll'
    import { getReorderContext } from './context'
    import type { ReorderItemProps } from './types'

    let {
        children,
        style,
        value,
        as = 'li',
        onDrag,
        onDragEnd,
        layout = true,
        ref = $bindable(),
        ...rest
    }: ReorderItemProps<V> = $props()

    const context = getReorderContext<V>()
    if (!context) {
        throw new Error('Reorder.Item must be a child of Reorder.Group')
    }

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
        const { axis } = context
        // The bound style MotionValue is dual-written by the drag
        // gesture, so it reads as the live offset from the item's slot.
        context.updateOrder(value, point[axis].get() as number, info.velocity[axis])
        autoScrollIfNeeded(context.getGroupElement(), info.point[axis], axis, info.velocity[axis])
        onDrag?.(event, info)
    }

    const handleDragEnd = (event: PointerEvent, info: DragInfo) => {
        resetAutoScrollState()
        onDragEnd?.(event, info)
    }

    $effect(() => {
        return () => context.unregisterItem(value)
    })

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
    Prop order mirrors upstream Item.tsx: `drag` before the spread so a
    consumer's `drag` prop can unlock both axes; everything after the
    spread is enforced by Reorder and wraps or overrides consumer props.
-->
<MotionContainer
    bind:ref
    tag={as}
    drag={context.axis}
    {...rest}
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
