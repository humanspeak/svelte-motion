import { describe, expect, it } from 'vitest'
import { checkReorder, moveItem } from './checkReorder'
import type { ItemData } from './context'

const item = <V>(value: V, min: number, max: number): ItemData<V> => ({
    value,
    layout: { min, max }
})

/** Three 100px slots stacked at 0, 100 and 200. */
const makeOrder = () => [item('a', 0, 100), item('b', 100, 200), item('c', 200, 300)]

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
    it('returns the same array when velocity is zero', () => {
        const order = makeOrder()
        expect(checkReorder(order, 'a', 500, 0)).toBe(order)
    })

    it('returns the same array for an unknown value', () => {
        const order = makeOrder()
        expect(checkReorder(order, 'z', 500, 1)).toBe(order)
    })

    it('swaps forward once the leading edge passes the next item center', () => {
        const order = makeOrder()
        // Item a: max=100. Item b center=150. Offset 51 → 151 > 150.
        const next = checkReorder(order, 'a', 51, 1)
        expect(next).not.toBe(order)
        expect(next.map((entry) => entry.value)).toEqual(['b', 'a', 'c'])
    })

    it('does not swap forward before the next item center', () => {
        const order = makeOrder()
        // 100 + 49 = 149 < 150 → no swap.
        expect(checkReorder(order, 'a', 49, 1)).toBe(order)
    })

    it('swaps backward once the leading edge passes the previous item center', () => {
        const order = makeOrder()
        // Item c: min=200. Item b center=150. Offset -51 → 149 < 150.
        const next = checkReorder(order, 'c', -51, -1)
        expect(next.map((entry) => entry.value)).toEqual(['a', 'c', 'b'])
    })

    it('does not swap backward before the previous item center', () => {
        const order = makeOrder()
        expect(checkReorder(order, 'c', -49, -1)).toBe(order)
    })

    it('ignores boundary items with no neighbour in the travel direction', () => {
        const order = makeOrder()
        expect(checkReorder(order, 'c', 500, 1)).toBe(order)
        expect(checkReorder(order, 'a', -500, -1)).toBe(order)
    })

    it('requires velocity direction and offset direction to agree', () => {
        const order = makeOrder()
        // Positive velocity looks forward even with a negative offset.
        expect(checkReorder(order, 'c', -500, 1)).toBe(order)
    })
})
