import type { Box } from '$lib/utils/projection'
import type { ItemData } from './context'

/**
 * Record or refresh an item's complete measured slot in registration
 * order. Mutates `order` in place.
 */
export const upsertOrderEntry = <V>(order: ItemData<V>[], value: V, layout: Box): void => {
    const index = order.findIndex((entry) => entry.value === value)
    if (index !== -1) {
        order[index].layout = layout
    } else {
        order.push({ value, layout })
    }
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
 * Translate an arbitrary measured reorder onto the corresponding
 * measured slots in the full `values` array.
 *
 * Only measured items appear in `order`; unmeasured values retain their
 * positions, which preserves virtualized or conditionally mounted rows.
 */
export const applyOrderSwap = <V>(
    values: V[],
    order: ItemData<V>[],
    newOrder: ItemData<V>[]
): V[] => {
    const newValues = [...values]
    const measuredIndexes = order.map(({ value }) => values.indexOf(value))
    newOrder.forEach(({ value }, index) => {
        const measuredIndex = measuredIndexes[index]
        if (measuredIndex !== -1) newValues[measuredIndex] = value
    })
    return newValues
}
