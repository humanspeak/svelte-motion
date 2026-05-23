<!--
  @component
  Reorder.Item — the draggable child half of the Reorder primitive pair.
  Wraps `MotionContainer` (default `li`) with `drag={axis}` +
  `dragSnapToOrigin` + `layout`, reports its measured position back to
  the parent `Reorder.Group`, and forwards the drag offset/velocity to
  the group's swap-decision logic on every move.

  Port of framer-motion's `Reorder.Item` (Reorder/Item.tsx) adapted for
  Svelte 5:

  - Instead of `style={{ x, y }}` MotionValue interpolation (a motion
    proxy feature we don't have yet — see backlog #317), we read the
    drag offset directly from the `DragInfo` payload on each move and
    feed it straight to `updateOrder`. For unconstrained items —
    which is every Reorder.Item — that's equivalent.
  - Layout measurement is `getBoundingClientRect()` deferred to the
    next animation frame. Re-runs whenever the parent's `values`
    array changes (i.e. after every reorder) so the order registry
    stays in sync with the post-layout positions.
  - `zIndex` flips to `1` while dragging and back to `unset` when the
    drag ends, so the active row floats over its neighbours.
-->
<script lang="ts" generics="V">
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type {
        DragInfo,
        HTMLElementProps,
        MotionOnDrag,
        MotionOnDragEnd,
        MotionOnDragStart
    } from '$lib/types'
    import { getContext, type Snippet } from 'svelte'
    import { ReorderContextKey, type ReorderContext } from './context.js'
    import { autoScrollIfNeeded, resetAutoScrollState } from './utils/auto-scroll.js'

    type Props = Omit<
        HTMLElementProps,
        'children' | 'ref' | 'onDragStart' | 'onDrag' | 'onDragEnd'
    > & {
        children: Snippet
        ref?: HTMLElement | null
        /** HTML tag to render. Defaults to `'li'` to match framer-motion. */
        as?: 'li' | 'div'
        /** The value this item represents in the parent group's `values`. */
        value: V
        /** Layout animation mode. `true` = position + size, `'position'` =
         *  position only. Same semantics as framer-motion. */
        layout?: true | 'position'
        /** Forwarded to the inner motion element. */
        onDragStart?: MotionOnDragStart
        onDrag?: MotionOnDrag
        onDragEnd?: MotionOnDragEnd
    }

    let {
        children,
        as = 'li',
        value,
        layout = true,
        style: styleProp,
        onDragStart: onDragStartProp,
        onDrag: onDragProp,
        onDragEnd: onDragEndProp,
        ref = $bindable<HTMLElement | null>(null),
        ...rest
    }: Props = $props()

    const context = getContext<ReorderContext<V>>(ReorderContextKey)
    if (!context) {
        throw new Error(
            'Reorder.Item must be a descendant of Reorder.Group. See https://motion.svelte.page/docs/reorder.'
        )
    }
    const { axis, registerItem, updateOrder } = context

    // Active drag float so the dragged row sits above neighbours during
    // the gesture without forcing a stacking-context on idle items.
    let isDragging = $state(false)

    const style = $derived(
        `z-index: ${isDragging ? 1 : 'auto'};${styleProp ? ` ${styleProp}` : ''}`
    )

    // Re-measure on mount and whenever the consumer's value identity
    // changes (which happens after a reorder rebuilds the items array).
    // Defer with rAF so we sample AFTER the layout animation system has
    // committed the new position.
    $effect(() => {
        void value
        if (!ref) return

        let rafId: number | null = requestAnimationFrame(() => {
            rafId = null
            if (!ref) return
            const rect = ref.getBoundingClientRect()
            registerItem(value, {
                x: { min: rect.left, max: rect.right },
                y: { min: rect.top, max: rect.bottom }
            })
        })
        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId)
        }
    })

    const handleDragStart = (event: PointerEvent, info: DragInfo) => {
        isDragging = true
        onDragStartProp?.(event, info)
    }

    const handleDrag = (event: PointerEvent, info: DragInfo) => {
        updateOrder(value, info.offset[axis], info.velocity[axis])
        autoScrollIfNeeded(context.groupRef, info.point[axis], axis, info.velocity[axis])
        onDragProp?.(event, info)
    }

    const handleDragEnd = (event: PointerEvent, info: DragInfo) => {
        isDragging = false
        resetAutoScrollState()
        onDragEndProp?.(event, info)
    }
</script>

<MotionContainer
    bind:ref
    tag={as}
    drag={axis}
    dragSnapToOrigin
    {layout}
    {style}
    onDragStart={handleDragStart}
    onDrag={handleDrag}
    onDragEnd={handleDragEnd}
    {...rest}
>
    {@render children()}
</MotionContainer>
