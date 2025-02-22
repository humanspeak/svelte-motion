import { describe, expect, it } from 'vitest'
import { getCommonKeys } from './objects.js'

describe('getCommonKeys', () => {
    it('should return empty array for objects with no common keys', () => {
        const obj1 = { a: 1, b: 2 }
        const obj2 = { c: 3, d: 4 }
        expect(getCommonKeys(obj1, obj2)).toEqual([])
    })

    it('should return array of common keys', () => {
        const obj1 = { scale: 1, opacity: 1, x: 0 }
        const obj2 = { scale: 0.9, opacity: 0.5, color: 'red' }
        expect(getCommonKeys(obj1, obj2).sort()).toEqual(['opacity', 'scale'].sort())
    })

    it('should handle empty objects', () => {
        expect(getCommonKeys({}, {})).toEqual([])
    })

    it('should handle animation properties', () => {
        const initial = { scale: 1, opacity: 1 }
        const animate = { scale: [0.8, 1], opacity: [0, 1] }
        expect(getCommonKeys(initial, animate).sort()).toEqual(['opacity', 'scale'].sort())
    })
})
