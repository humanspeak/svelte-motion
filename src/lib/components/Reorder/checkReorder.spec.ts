import type { Box } from '$lib/utils/projection'
import { describe, expect, it } from 'vitest'
import { checkReorder, keyTarget, moveItem } from './checkReorder'
import type { ItemData } from './context'

const box = (xMin: number, xMax: number, yMin: number, yMax: number): Box => ({
    x: { min: xMin, max: xMax },
    y: { min: yMin, max: yMax }
})

const item = <V>(value: V, layout: Box): ItemData<V> => ({ value, layout })

const verticalOrder = () => [
    item('a', box(0, 100, 0, 100)),
    item('b', box(0, 100, 100, 200)),
    item('c', box(0, 100, 200, 300))
]

const horizontalOrder = () => [
    item('a', box(0, 100, 0, 100)),
    item('b', box(100, 200, 0, 100)),
    item('c', box(200, 300, 0, 100))
]

const rtlHorizontalOrder = () => [
    item('a', box(200, 300, 0, 100)),
    item('b', box(100, 200, 0, 100)),
    item('c', box(0, 100, 0, 100))
]

const gridOrder = () => [
    item('a', box(0, 100, 0, 100)),
    item('b', box(100, 200, 0, 100)),
    item('c', box(0, 100, 100, 200)),
    item('d', box(100, 200, 100, 200))
]

describe('moveItem', () => {
    it('moves an item forward without mutating the input', () => {
        const source = ['a', 'b', 'c']
        expect(moveItem(source, 0, 1)).toEqual(['b', 'a', 'c'])
        expect(source).toEqual(['a', 'b', 'c'])
    })

    it('moves an item backward', () => {
        expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    })

    it('supports negative target indices', () => {
        expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['b', 'c', 'a'])
    })

    it('returns an unchanged copy for an out-of-range source index', () => {
        expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
    })
})

describe('checkReorder', () => {
    it('returns the same array when the relevant velocity is zero', () => {
        const order = verticalOrder()
        expect(checkReorder(order, 'a', { x: 0, y: 500 }, { x: 1, y: 0 }, 'y')).toBe(order)
    })

    it('returns the same array for an unknown value', () => {
        const order = verticalOrder()
        expect(checkReorder(order, 'z', { x: 0, y: 500 }, { x: 0, y: 1 }, 'y')).toBe(order)
    })

    it('keeps vertical midpoint swaps unchanged', () => {
        const order = verticalOrder()
        const next = checkReorder(order, 'a', { x: 0, y: 51 }, { x: 0, y: 1 }, 'y')
        expect(next).not.toBe(order)
        expect(next.map((entry) => entry.value)).toEqual(['b', 'a', 'c'])
        expect(checkReorder(order, 'a', { x: 0, y: 49 }, { x: 0, y: 1 }, 'y')).toBe(order)
    })

    it('keeps horizontal midpoint swaps unchanged', () => {
        const order = horizontalOrder()
        const next = checkReorder(order, 'c', { x: -51, y: 0 }, { x: -1, y: 0 }, 'x')
        expect(next.map((entry) => entry.value)).toEqual(['a', 'c', 'b'])
        expect(checkReorder(order, 'c', { x: -49, y: 0 }, { x: -1, y: 0 }, 'x')).toBe(order)
    })

    it('ignores boundary items with no neighbour in the travel direction', () => {
        const order = verticalOrder()
        expect(checkReorder(order, 'c', { x: 0, y: 500 }, { x: 0, y: 1 }, 'y')).toBe(order)
        expect(checkReorder(order, 'a', { x: 0, y: -500 }, { x: 0, y: -1 }, 'y')).toBe(order)
    })

    it('moves within a row toward the closest neighboring box', () => {
        const order = gridOrder()
        const next = checkReorder(order, 'a', { x: 110, y: 0 }, { x: 1, y: 0 }, 'xy')
        expect(next.map((entry) => entry.value)).toEqual(['b', 'a', 'c', 'd'])
    })

    it('inserts at the closest horizontal slot when crossing into another row', () => {
        const order = gridOrder()
        const afterLast = checkReorder(order, 'a', { x: 150, y: 150 }, { x: 1, y: 1 }, 'xy')
        expect(afterLast.map((entry) => entry.value)).toEqual(['b', 'c', 'd', 'a'])

        const beforeFirst = checkReorder(order, 'b', { x: -150, y: 150 }, { x: -1, y: 1 }, 'xy')
        expect(beforeFirst.map((entry) => entry.value)).toEqual(['a', 'b', 'c', 'd'])
        expect(beforeFirst).toBe(order)
    })

    it('follows real right-to-left geometry for a horizontal list', () => {
        const order = rtlHorizontalOrder()
        const next = checkReorder(order, 'a', { x: -51, y: 0 }, { x: -1, y: 0 }, 'x', 'rtl')
        expect(next.map((entry) => entry.value)).toEqual(['b', 'a', 'c'])
        expect(checkReorder(order, 'a', { x: -49, y: 0 }, { x: -1, y: 0 }, 'x', 'rtl')).toBe(order)
    })

    it('reverses cross-row insertion in RTL for xy', () => {
        const order = gridOrder()
        const next = checkReorder(order, 'a', { x: -150, y: 150 }, { x: -1, y: 1 }, 'xy', 'rtl')
        expect(next.map((entry) => entry.value)).toEqual(['b', 'c', 'd', 'a'])
    })

    it('returns the same array for an unchanged xy position', () => {
        const order = gridOrder()
        expect(checkReorder(order, 'a', { x: 0, y: 0 }, { x: 0, y: 0 }, 'xy')).toBe(order)
    })
})

/**
 * Port of Motion 14.10.1 `Reorder/utils/__tests__/check-reorder.test.ts`
 * (`keyTarget`). `key` is the key's index in Up, Left, Down, Right, Home, End.
 */
describe('keyTarget', () => {
    it('moves by the row drawn above or below, not the next in order', () => {
        /*
         * flex-wrap: wrap-reverse draws the first row at the bottom:
         * c
         * a b
         */
        const at = (x: number, y: number) => box(x, x + 100, y, y + 100)
        const reversed = [item('a', at(0, 100)), item('b', at(100, 100)), item('c', at(0, 0))]
        const move = (value: string, key: number) => {
            const index = reversed.findIndex((entry) => entry.value === value)
            const target = keyTarget(reversed, index, key, 'xy', false)
            return (target < 0 ? reversed : moveItem(reversed, index, target))
                .map((entry) => entry.value)
                .join('')
        }

        // Up from a goes to c's row, Down from c to a's
        expect(move('a', 0)).toBe('bca')
        expect(move('c', 2)).toBe('cab')
        // Nothing below a or above c
        expect(move('a', 2)).toBe('abc')
        expect(move('c', 0)).toBe('abc')
    })

    // Svelte port additions: the single-axis and RTL steps.

    it('steps one place along the order, or -1 past either end', () => {
        const order = verticalOrder()
        expect(keyTarget(order, 0, 2, 'y', false)).toBe(1)
        expect(keyTarget(order, 1, 0, 'y', false)).toBe(0)
        expect(keyTarget(order, 0, 0, 'y', false)).toBe(-1)
        expect(keyTarget(order, 2, 2, 'y', false)).toBe(-1)
        expect(keyTarget(order, -1, 2, 'y', false)).toBe(-1)
    })

    it('swaps Left and Right, but not Up and Down, in RTL', () => {
        const order = horizontalOrder()
        expect(keyTarget(order, 1, 3, 'x', false)).toBe(2)
        expect(keyTarget(order, 1, 3, 'x', true)).toBe(0)
        expect(keyTarget(order, 1, 1, 'x', true)).toBe(2)
        expect(keyTarget(verticalOrder(), 1, 2, 'y', true)).toBe(2)
    })

    it('goes to the item nearest across in the next row of a grid', () => {
        const order = gridOrder()
        expect(keyTarget(order, 1, 2, 'xy', false)).toBe(3)
        expect(keyTarget(order, 2, 0, 'xy', false)).toBe(0)
        expect(keyTarget(order, 0, 3, 'xy', false)).toBe(1)
    })

    // Motion 14.10: key 4 is Home and key 5 is End.

    it('Home and End go to either end', () => {
        const order = [...verticalOrder(), item('d', box(0, 100, 300, 400))]
        expect(keyTarget(order, 1, 4, 'y', false)).toBe(0)
        expect(keyTarget(order, 1, 5, 'y', false)).toBe(3)
        // Along the order on a grid too, not by row
        const grid = gridOrder()
        expect(keyTarget(grid, 1, 4, 'xy', false)).toBe(0)
        expect(keyTarget(grid, 1, 5, 'xy', false)).toBe(3)
    })

    it('Home on the first item and End on the last are -1', () => {
        const order = [...verticalOrder(), item('d', box(0, 100, 300, 400))]
        expect(keyTarget(order, 0, 4, 'y', false)).toBe(-1)
        expect(keyTarget(order, 3, 5, 'y', false)).toBe(-1)
    })
})
