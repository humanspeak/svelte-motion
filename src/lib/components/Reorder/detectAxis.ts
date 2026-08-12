import type { Axis, Box } from '$lib/utils/projection'
import type { ReorderAxis } from './types'

const isSeparated = (a: Axis, b: Axis): boolean => a.max <= b.min || b.max <= a.min

/**
 * Infer a reorder axis from measured item boxes.
 *
 * Returns `'y'` until the measurements prove a horizontal or wrapped
 * layout. Boxes that only touch at an edge count as separated.
 *
 * @param layouts - Item boxes in the consumer's value order.
 * @returns The detected one- or two-dimensional reorder axis.
 */
export const detectAxis = (layouts: Box[]): ReorderAxis => {
    let x = false
    let y = false

    for (let i = 0; i < layouts.length; i++) {
        for (let j = i + 1; j < layouts.length; j++) {
            x ||= isSeparated(layouts[i].x, layouts[j].x)
            y ||= isSeparated(layouts[i].y, layouts[j].y)

            if (x && y) return 'xy'
        }
    }

    return x ? 'x' : 'y'
}
