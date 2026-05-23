import { mixNumber } from 'motion-dom'
import type { ItemData } from '../context.js'

/**
 * Mirrors motion-utils's `moveItem` — pulls one element out of a copy of
 * the array and splices it in at the new index. Inlined to keep the
 * Reorder folder's dep surface to just `motion-dom`.
 */
const moveItem = <T>([...arr]: T[], fromIndex: number, toIndex: number): T[] => {
    const startIndex = fromIndex < 0 ? arr.length + fromIndex : fromIndex
    if (startIndex >= 0 && startIndex < arr.length) {
        const endIndex = toIndex < 0 ? arr.length + toIndex : toIndex
        const [item] = arr.splice(fromIndex, 1)
        arr.splice(endIndex, 0, item)
    }
    return arr
}

/**
 * Velocity-direction swap detection. If the dragged item is moving
 * toward its neighbour AND its leading edge has crossed the neighbour's
 * centre, swap the two entries in the order array. Direct port of
 * framer-motion's `checkReorder` (Reorder/utils/check-reorder.ts).
 *
 * Returns the same `order` array when no swap occurs, so callers can
 * use a cheap reference check (`order !== next`) to know whether to
 * propagate the change upstream.
 */
export const checkReorder = <T>(
    order: ItemData<T>[],
    value: T,
    offset: number,
    velocity: number
): ItemData<T>[] => {
    if (!velocity) return order

    const index = order.findIndex((item) => item.value === value)
    if (index === -1) return order

    const nextOffset = velocity > 0 ? 1 : -1
    const nextItem = order[index + nextOffset]
    if (!nextItem) return order

    const item = order[index]
    const nextLayout = nextItem.layout
    const nextItemCenter = mixNumber(nextLayout.min, nextLayout.max, 0.5)

    if (
        (nextOffset === 1 && item.layout.max + offset > nextItemCenter) ||
        (nextOffset === -1 && item.layout.min + offset < nextItemCenter)
    ) {
        return moveItem(order, index, index + nextOffset)
    }

    return order
}
