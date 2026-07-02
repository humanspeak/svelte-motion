import type { Axis } from '$lib/utils/projection'
import type { ItemData } from './context'

const compareMin = <V>(a: ItemData<V>, b: ItemData<V>): number => a.layout.min - b.layout.min

/**
 * Record or refresh an item's measured slot in the group's working
 * order, keeping the array sorted by slot start. Mutates `order` in
 * place — the group owns a single persistent array (unlike upstream
 * React, which rebuilds it every render; see `Group.tsx` `registerItem`).
 */
export const upsertOrderEntry = <V>(order: ItemData<V>[], value: V, layout: Axis): void => {
    const index = order.findIndex((entry) => entry.value === value)
    if (index !== -1) {
        order[index].layout = layout
    } else {
        order.push({ value, layout })
    }
    order.sort(compareMin)
}

/**
 * Drop an item's entry from the working order when it unmounts.
 * Svelte-specific counterpart to the rebuild-per-render behaviour that
 * makes this implicit upstream.
 */
export const removeOrderEntry = <V>(order: ItemData<V>[], value: V): void => {
    const index = order.findIndex((entry) => entry.value === value)
    if (index !== -1) {
        order.splice(index, 1)
    }
}

/**
 * Translate a swap detected between `order` and `newOrder` (the
 * `checkReorder` result) onto the full `values` array.
 *
 * Only the measured items appear in `order`, so applying the single
 * swapped pair — rather than mapping `newOrder` back to values —
 * preserves unmeasured entries, e.g. offscreen rows in a virtualized
 * list. Direct port of the swap loop in framer-motion `Group.tsx`.
 */
export const applyOrderSwap = <V>(
    values: V[],
    order: ItemData<V>[],
    newOrder: ItemData<V>[]
): V[] => {
    const newValues = [...values]
    for (let i = 0; i < newOrder.length; i++) {
        if (order[i].value !== newOrder[i].value) {
            const a = values.indexOf(order[i].value)
            const b = values.indexOf(newOrder[i].value)
            if (a !== -1 && b !== -1) {
                ;[newValues[a], newValues[b]] = [newValues[b], newValues[a]]
            }
            break
        }
    }
    return newValues
}
