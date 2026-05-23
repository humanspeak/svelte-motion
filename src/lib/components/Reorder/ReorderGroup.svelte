<!--
  @component
  Reorder.Group — the parent half of the Reorder primitive pair. Renders a
  motion element (`ul` by default) that contains draggable
  `Reorder.Item` children, owns the measured-position registry, and
  fires `onReorder(next)` with a freshly-permuted copy of `values` when
  one child's drag offset crosses a neighbour's centre.

  Direct port of framer-motion's `Reorder.Group` (Reorder/Group.tsx).
  Behaviour matches one-to-one — velocity-direction swap, value-swap
  pattern preserving unmeasured items (virtualised lists), and the
  `overflowAnchor: none` workaround.
-->
<script lang="ts" generics="V">
    import MotionContainer from '$lib/html/_MotionContainer.svelte'
    import type { HTMLElementProps } from '$lib/types'
    import { setContext, type Snippet } from 'svelte'
    import { ReorderContextKey, type ItemData, type ReorderContext } from './context.js'
    import { checkReorder } from './utils/check-reorder.js'

    type Props = Omit<HTMLElementProps, 'children' | 'ref'> & {
        children: Snippet
        ref?: HTMLElement | null
        /** HTML tag to render. Defaults to `'ul'` to match framer-motion. */
        as?: 'ul' | 'ol' | 'div'
        /** Axis to reorder along — also pins the item drag axis. */
        axis?: 'x' | 'y'
        /** Latest values state. Pass the same array you render with. */
        values: V[]
        /** Fires with the next ordering. Wire to `(next) => (items = next)`. */
        onReorder: (next: V[]) => void
    }

    let {
        children,
        as = 'ul',
        axis = 'y',
        values,
        onReorder,
        style: styleProp,
        ref = $bindable<HTMLElement | null>(null),
        ...rest
    }: Props = $props()

    // Holds the live order, sorted by measured layout.min on the active axis.
    // Each Reorder.Item pushes/updates its own entry via `registerItem`.
    // Mutated in place rather than $state-reassigned because the order
    // matters across drag ticks and Svelte tracking is irrelevant here —
    // we only ever read this inside drag callbacks.
    const order: ItemData<V>[] = []

    // After we hand a new `values` array up to the consumer, gate further
    // updateOrder calls until React's-equivalent next-tick (here: Svelte's
    // next effect run) so a single drag-frame can't double-swap.
    let isReordering = $state(false)

    setContext<ReorderContext<V>>(ReorderContextKey, {
        axis,
        get groupRef() {
            return ref
        },
        registerItem: (value, layout) => {
            const idx = order.findIndex((entry) => entry.value === value)
            if (idx !== -1) {
                order[idx].layout = layout[axis]
            } else {
                order.push({ value, layout: layout[axis] })
            }
            order.sort((a, b) => a.layout.min - b.layout.min)
        },
        updateOrder: (value, offset, velocity) => {
            if (isReordering) return

            const next = checkReorder(order, value, offset, velocity)
            if (next === order) return

            isReordering = true

            // Value-swap pattern (matches framer-motion). Only swap the
            // pair that changed positions in `next`, preserving any
            // unmeasured entries in `values` (the canonical
            // virtualised-list scenario). Walk `next` left-to-right; the
            // first index where order/next disagree IS the swap.
            const newValues = [...values]
            for (let i = 0; i < next.length; i++) {
                if (order[i].value !== next[i].value) {
                    const a = values.indexOf(order[i].value)
                    const b = values.indexOf(next[i].value)
                    if (a !== -1 && b !== -1) {
                        ;[newValues[a], newValues[b]] = [newValues[b], newValues[a]]
                    }
                    break
                }
            }
            onReorder(newValues)
        }
    })

    // Clear the reorder lock after Svelte flushes a new `values` array —
    // mirrors framer-motion's post-render `useEffect(() => { isReordering = false })`.
    $effect(() => {
        void values
        isReordering = false
    })

    // Disable browser scroll anchoring so item layout shifts during drag
    // don't get nudged by the scroll-anchor heuristic. Merge with any
    // user-supplied inline style.
    const style = $derived(
        styleProp ? `overflow-anchor: none; ${styleProp}` : 'overflow-anchor: none;'
    )
</script>

<MotionContainer bind:ref tag={as} {style} {...rest}>
    {@render children()}
</MotionContainer>
