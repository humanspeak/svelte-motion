import { describe, expect, it } from 'vitest'
import type { ItemData } from './context'
import { applyOrderSwap, removeOrderEntry, upsertOrderEntry } from './order'

const axis = (min: number, max: number) => ({ min, max })

describe('upsertOrderEntry', () => {
    it('inserts new entries sorted by slot start', () => {
        const order: ItemData<string>[] = []
        upsertOrderEntry(order, 'b', axis(100, 200))
        upsertOrderEntry(order, 'a', axis(0, 100))
        upsertOrderEntry(order, 'c', axis(200, 300))
        expect(order.map((entry) => entry.value)).toEqual(['a', 'b', 'c'])
    })

    it('updates an existing entry in place and re-sorts', () => {
        const order: ItemData<string>[] = []
        upsertOrderEntry(order, 'a', axis(0, 100))
        upsertOrderEntry(order, 'b', axis(100, 200))
        // 'a' moves to the last slot after a reorder re-measure.
        upsertOrderEntry(order, 'a', axis(200, 300))
        expect(order).toHaveLength(2)
        expect(order.map((entry) => entry.value)).toEqual(['b', 'a'])
        expect(order[1].layout).toEqual(axis(200, 300))
    })
})

describe('removeOrderEntry', () => {
    it('removes the matching entry', () => {
        const order: ItemData<string>[] = []
        upsertOrderEntry(order, 'a', axis(0, 100))
        upsertOrderEntry(order, 'b', axis(100, 200))
        removeOrderEntry(order, 'a')
        expect(order.map((entry) => entry.value)).toEqual(['b'])
    })

    it('is a no-op for unknown values', () => {
        const order: ItemData<string>[] = []
        upsertOrderEntry(order, 'a', axis(0, 100))
        removeOrderEntry(order, 'z')
        expect(order).toHaveLength(1)
    })
})

describe('applyOrderSwap', () => {
    const entry = <V>(value: V, min: number): ItemData<V> => ({
        value,
        layout: axis(min, min + 100)
    })

    it('applies the swapped pair to the full values array', () => {
        const order = [entry('a', 0), entry('b', 100), entry('c', 200)]
        const newOrder = [entry('b', 100), entry('a', 0), entry('c', 200)]
        expect(applyOrderSwap(['a', 'b', 'c'], order, newOrder)).toEqual(['b', 'a', 'c'])
    })

    it('preserves unmeasured values (virtualized list support)', () => {
        // Values 1 and 5 were never measured — only 2, 3, 4 registered.
        const order = [entry(2, 0), entry(3, 100), entry(4, 200)]
        const newOrder = [entry(3, 100), entry(2, 0), entry(4, 200)]
        expect(applyOrderSwap([1, 2, 3, 4, 5], order, newOrder)).toEqual([1, 3, 2, 4, 5])
    })

    it('returns an equal copy when nothing swapped', () => {
        const order = [entry('a', 0), entry('b', 100)]
        const values = ['a', 'b']
        const result = applyOrderSwap(values, order, order)
        expect(result).toEqual(values)
        expect(result).not.toBe(values)
    })
})
