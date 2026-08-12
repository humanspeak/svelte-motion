import type { Box } from '$lib/utils/projection'
import { describe, expect, it } from 'vitest'
import { checkReorder, moveItem } from './checkReorder'
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

    it('reverses horizontal insertion in RTL for x', () => {
        const order = horizontalOrder()
        const ltr = checkReorder(order, 'a', { x: 51, y: 0 }, { x: 1, y: 0 }, 'x', 'ltr')
        const rtl = checkReorder(order, 'a', { x: -51, y: 0 }, { x: -1, y: 0 }, 'x', 'rtl')
        expect(ltr.map((entry) => entry.value)).toEqual(['b', 'a', 'c'])
        expect(rtl.map((entry) => entry.value)).toEqual(['b', 'a', 'c'])
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
