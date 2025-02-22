import { describe, expect, it } from 'vitest'
import { isNotEmpty } from './objects.js'

describe('isNotEmpty', () => {
    it('should return false for undefined', () => {
        expect(isNotEmpty(undefined)).toBe(false)
    })

    it('should return false for empty object', () => {
        expect(isNotEmpty({})).toBe(false)
    })

    it('should return true for object with properties', () => {
        expect(isNotEmpty({ opacity: 0 })).toBe(true)
        expect(isNotEmpty({ scale: 1, x: 100 })).toBe(true)
    })

    it('should handle animation keyframes', () => {
        expect(isNotEmpty({ opacity: [0, 1], scale: [0.8, 1] })).toBe(true)
    })
})
