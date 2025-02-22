import { describe, expect, it } from 'vitest'
import { isEmpty } from './objects.js'

describe('isEmpty', () => {
    it('should return true for undefined', () => {
        expect(isEmpty(undefined)).toBe(true)
    })

    it('should return true for empty object', () => {
        expect(isEmpty({})).toBe(true)
    })

    it('should return false for object with properties', () => {
        expect(isEmpty({ opacity: 0 })).toBe(false)
        expect(isEmpty({ scale: 1, x: 100 })).toBe(false)
    })

    it('should handle animation keyframes', () => {
        expect(isEmpty({ opacity: [0, 1], scale: [0.8, 1] })).toBe(false)
    })
})
