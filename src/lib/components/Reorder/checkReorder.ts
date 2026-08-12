import type { DragPoint } from '$lib/types'
import { mixNumber } from 'motion-dom'
import type { ItemData } from './context'
import type { ReorderAxis } from './types'

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
 * Decide whether a live drag should move the dragged item within a
 * one-dimensional list or wrapped two-dimensional layout.
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
    offset: DragPoint,
    velocity: DragPoint,
    axis: ReorderAxis,
    direction: 'ltr' | 'rtl' = 'ltr'
): ItemData<V>[] => {
    const index = order.findIndex((item) => item.value === value)

    if (index === -1) return order

    if (axis === 'xy') {
        const { layout } = order[index]
        const center = {
            x: mixNumber(layout.x.min, layout.x.max, 0.5) + offset.x,
            y: mixNumber(layout.y.min, layout.y.max, 0.5) + offset.y
        }
        const lines = getLines(order)
        const sourceLine = lines.find((line) => line.items.includes(order[index]))

        if (!sourceLine) return order

        const targetLine = lines.reduce((closest, line) =>
            distanceToLine(center.y, line) < distanceToLine(center.y, closest) ? line : closest
        )

        if (targetLine !== sourceLine) {
            return moveToLine(order, index, center.x, targetLine, direction)
        }

        const currentDistance = distanceToBox(center, layout)
        let target = -1
        let targetDistance = currentDistance

        order.forEach((item, targetIndex) => {
            if (targetIndex === index) return
            const distance = distanceToBox(center, item.layout)
            if (distance < targetDistance) {
                target = targetIndex
                targetDistance = distance
            }
        })

        return target === -1 ? order : moveItem(order, index, index + Math.sign(target - index))
    }

    if (!velocity[axis]) return order

    const horizontalDirection = axis === 'x' && direction === 'rtl' ? -1 : 1
    const nextOffset = (velocity[axis] > 0 ? 1 : -1) * horizontalDirection
    const nextItem = order[index + nextOffset]

    if (!nextItem) return order

    const item = order[index]
    const itemLayout = item.layout[axis]
    const nextLayout = nextItem.layout[axis]
    const nextItemCenter = mixNumber(nextLayout.min, nextLayout.max, 0.5)

    const movingTowardPositiveCoordinates = velocity[axis] > 0

    if (
        (movingTowardPositiveCoordinates && itemLayout.max + offset[axis] > nextItemCenter) ||
        (!movingTowardPositiveCoordinates && itemLayout.min + offset[axis] < nextItemCenter)
    ) {
        return moveItem(order, index, index + nextOffset)
    }

    return order
}

interface Line<V> {
    items: ItemData<V>[]
    min: number
    max: number
}

const getLines = <V>(order: ItemData<V>[]): Line<V>[] => {
    const lines: Line<V>[] = []

    order.forEach((item) => {
        const { min, max } = item.layout.y
        const line = lines[lines.length - 1]

        if (!line || min >= line.max || max <= line.min) {
            lines.push({ items: [item], min, max })
        } else {
            line.items.push(item)
            line.min = Math.min(line.min, min)
            line.max = Math.max(line.max, max)
        }
    })

    return lines
}

const distanceToLine = <V>(y: number, line: Line<V>): number =>
    y < line.min ? line.min - y : y > line.max ? y - line.max : 0

const moveToLine = <V>(
    order: ItemData<V>[],
    index: number,
    x: number,
    line: Line<V>,
    direction: 'ltr' | 'rtl'
): ItemData<V>[] => {
    const remaining = order.filter((_, itemIndex) => itemIndex !== index)
    const before = line.items.find((item) => {
        const center = mixNumber(item.layout.x.min, item.layout.x.max, 0.5)
        return direction === 'ltr' ? x < center : x > center
    })
    const targetIndex = before
        ? remaining.indexOf(before)
        : remaining.indexOf(line.items[line.items.length - 1]) + 1
    const nextOrder = [...remaining]
    nextOrder.splice(targetIndex, 0, order[index])

    return nextOrder.every((item, itemIndex) => item === order[itemIndex]) ? order : nextOrder
}

const distanceToBox = (point: DragPoint, box: ItemData<unknown>['layout']): number => {
    const x = Math.max(box.x.min - point.x, 0, point.x - box.x.max)
    const y = Math.max(box.y.min - point.y, 0, point.y - box.y.max)
    return x * x + y * y
}
