import { describe, expect, it } from 'vitest'
import type { ItemData } from '../context.js'
import { checkReorder } from './check-reorder.js'

/**
 * Pure unit tests for the swap-decision logic that powers Reorder.Group.
 * Mirrors framer-motion's own __tests__/check-reorder.test.ts so the
 * behaviour stays one-to-one through future motion-dom upgrades.
 */
const item = <T>(value: T, min: number, max: number): ItemData<T> => ({
    value,
    layout: { min, max }
})

describe('Reorder/check-reorder', () => {
    it('returns the input order untouched when velocity is zero', () => {
        const order = [item('a', 0, 50), item('b', 60, 110)]
        expect(checkReorder(order, 'a', 100, 0)).toBe(order)
    })

    it('returns the input order untouched when the value is not registered', () => {
        const order = [item('a', 0, 50)]
        expect(checkReorder(order, 'z', 100, 100)).toBe(order)
    })

    it('returns the input order when dragging beyond the last item with no neighbour', () => {
        const order = [item('a', 0, 50), item('b', 60, 110)]
        expect(checkReorder(order, 'b', 100, 100)).toBe(order)
    })

    it('swaps when forward drag offset crosses the next neighbour centre', () => {
        // Item `a` spans 0–50; neighbour `b` spans 60–110, centre 85.
        // Drag offset of 40 puts a's max at 50 + 40 = 90 > 85 → swap.
        const order = [item('a', 0, 50), item('b', 60, 110)]
        const next = checkReorder(order, 'a', 40, 200)
        expect(next).not.toBe(order)
        expect(next.map((entry) => entry.value)).toEqual(['b', 'a'])
    })

    it('does NOT swap when forward drag offset stops short of neighbour centre', () => {
        const order = [item('a', 0, 50), item('b', 60, 110)]
        expect(checkReorder(order, 'a', 30, 200)).toBe(order)
    })

    it('swaps when backward drag offset crosses the prior neighbour centre', () => {
        // Item `b` spans 60–110; neighbour `a` spans 0–50, centre 25.
        // Drag offset of -40 puts b's min at 60 + (-40) = 20 < 25 → swap.
        const order = [item('a', 0, 50), item('b', 60, 110)]
        const next = checkReorder(order, 'b', -40, -200)
        expect(next).not.toBe(order)
        expect(next.map((entry) => entry.value)).toEqual(['b', 'a'])
    })

    it('does NOT swap when backward drag offset stops short of neighbour centre', () => {
        const order = [item('a', 0, 50), item('b', 60, 110)]
        expect(checkReorder(order, 'b', -30, -200)).toBe(order)
    })

    it('only swaps the immediate neighbour in a single call (multi-step drags handled by repeated calls)', () => {
        const order = [item('a', 0, 50), item('b', 60, 110), item('c', 120, 170)]
        // Forward drag of 80 on `a` — crosses both b's centre (85) and c's
        // centre (145). Single pass only swaps with the next neighbour.
        const next = checkReorder(order, 'a', 80, 200)
        expect(next.map((entry) => entry.value)).toEqual(['b', 'a', 'c'])
    })

    it('preserves layout extents when swapping (only positions change)', () => {
        const order = [item('a', 0, 50), item('b', 60, 110)]
        const next = checkReorder(order, 'a', 40, 200)
        expect(next[0]).toEqual({ value: 'b', layout: { min: 60, max: 110 } })
        expect(next[1]).toEqual({ value: 'a', layout: { min: 0, max: 50 } })
    })
})
