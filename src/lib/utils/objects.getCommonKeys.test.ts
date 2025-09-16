import { describe, expect, it } from 'vitest'
import { getCommonKeys } from './objects.js'

describe('getCommonKeys', () => {
    it('should return empty array for objects with no common keys', () => {
        const obj1 = { a: 1, b: 2 }
        const obj2 = { c: 3, d: 4 } as Record<string, number>
        expect(getCommonKeys(obj1, obj2 as unknown as typeof obj1)).toEqual([])
    })

    it('should return array of common keys', () => {
        const obj1 = { scale: 1, opacity: 1, x: 0 }
        const obj2 = { scale: 0.9, opacity: 0.5, x: 10 }
        expect(getCommonKeys(obj1, obj2).sort()).toEqual(['opacity', 'scale', 'x'].sort())
    })

    it('should handle empty objects', () => {
        expect(getCommonKeys({}, {})).toEqual([])
    })

    it('should handle animation properties (loose typing)', () => {
        const initial = { scale: 1, opacity: 1 }
        const animate = { scale: [0.8, 1], opacity: [0, 1] } as unknown as typeof initial
        expect(getCommonKeys(initial, animate as typeof initial).sort()).toEqual(
            ['opacity', 'scale'].sort()
        )
    })
})
