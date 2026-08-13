import type { ItemData } from './context'

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
