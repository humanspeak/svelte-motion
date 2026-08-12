import type { Box } from '$lib/utils/projection'
import { describe, expect, it } from 'vitest'
import type { ItemData } from './context'
import { applyOrderSwap, removeOrderEntry, upsertOrderEntry } from './order'

const box = (xMin: number, xMax: number, yMin: number, yMax: number): Box => ({
    x: { min: xMin, max: xMax },
    y: { min: yMin, max: yMax }
})

describe('upsertOrderEntry', () => {
    it('inserts entries in registration order', () => {
        const order: ItemData<string>[] = []
        upsertOrderEntry(order, 'b', box(100, 200, 0, 100))
        upsertOrderEntry(order, 'a', box(0, 100, 0, 100))
        upsertOrderEntry(order, 'c', box(0, 100, 100, 200))
        expect(order.map((entry) => entry.value)).toEqual(['b', 'a', 'c'])
    })

    it('updates an existing full box in place', () => {
        const order: ItemData<string>[] = []
        upsertOrderEntry(order, 'a', box(0, 100, 0, 100))
        upsertOrderEntry(order, 'b', box(100, 200, 0, 100))
        const moved = box(0, 100, 100, 200)
        upsertOrderEntry(order, 'a', moved)
        expect(order).toHaveLength(2)
        expect(order.map((entry) => entry.value)).toEqual(['a', 'b'])
        expect(order[0].layout).toEqual(moved)
    })
})

describe('removeOrderEntry', () => {
    it('removes the matching entry', () => {
        const order: ItemData<string>[] = []
        upsertOrderEntry(order, 'a', box(0, 100, 0, 100))
        upsertOrderEntry(order, 'b', box(100, 200, 0, 100))
        removeOrderEntry(order, 'a')
        expect(order.map((entry) => entry.value)).toEqual(['b'])
    })

    it('is a no-op for unknown values', () => {
        const order: ItemData<string>[] = []
        upsertOrderEntry(order, 'a', box(0, 100, 0, 100))
        removeOrderEntry(order, 'z')
        expect(order).toHaveLength(1)
    })
})

describe('applyOrderSwap', () => {
    const entry = <V>(value: V, index: number): ItemData<V> => ({
        value,
        layout: box(
            (index % 2) * 100,
            (index % 2) * 100 + 100,
            Math.floor(index / 2) * 100,
            Math.floor(index / 2) * 100 + 100
        )
    })

    it('maps an arbitrary measured reorder onto the measured values slots', () => {
        const order = [entry('a', 0), entry('b', 1), entry('c', 2), entry('d', 3)]
        const newOrder = [order[1], order[2], order[3], order[0]]
        expect(applyOrderSwap(['a', 'b', 'c', 'd'], order, newOrder)).toEqual(['b', 'c', 'd', 'a'])
    })

    it('preserves positions reserved for unmeasured values', () => {
        const order = [entry(2, 0), entry(3, 1), entry(4, 2)]
        const newOrder = [order[1], order[2], order[0]]
        expect(applyOrderSwap([1, 2, 3, 4, 5], order, newOrder)).toEqual([1, 3, 4, 2, 5])
    })

    it('returns an equal copy when nothing changed', () => {
        const order = [entry('a', 0), entry('b', 1)]
        const values = ['a', 'b']
        const result = applyOrderSwap(values, order, order)
        expect(result).toEqual(values)
        expect(result).not.toBe(values)
    })
})
