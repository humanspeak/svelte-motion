import { mixNumber } from 'motion-dom'
import type { ItemData } from './context'

/**
 * Return a copy of `arr` with the element at `fromIndex` moved to
 * `toIndex`. Out-of-range `fromIndex` returns the copy unchanged;
 * negative indices count from the end.
 *
 * Inline port of `moveItem` from `motion-utils` (not a direct
 * dependency of this package — it's bundled away inside `motion-dom`).
 */
export const moveItem = <T>([...arr]: T[], fromIndex: number, toIndex: number): T[] => {
    const startIndex = fromIndex < 0 ? arr.length + fromIndex : fromIndex

    if (startIndex >= 0 && startIndex < arr.length) {
        const endIndex = toIndex < 0 ? arr.length + toIndex : toIndex
        const [item] = arr.splice(fromIndex, 1)
        arr.splice(endIndex, 0, item)
    }

    return arr
}

/**
 * Decide whether a live drag should swap the dragged item with its
 * neighbour in the travel direction.
 *
 * The dragged item's leading edge (`layout.max + offset` when moving
 * forward, `layout.min + offset` when moving backward) must cross the
 * neighbour's center before a swap fires — so a swap happens exactly
 * when the dragged item covers more than half of its neighbour.
 * Velocity supplies the direction; a stationary pointer (`velocity ===
 * 0`) never reorders.
 *
 * Returns the same `order` array reference when nothing changes, so
 * callers can detect a swap with an identity check.
 *
 * Direct port of framer-motion `Reorder/utils/check-reorder.ts`.
 */
export const checkReorder = <V>(
    order: ItemData<V>[],
    value: V,
    offset: number,
    velocity: number
): ItemData<V>[] => {
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
