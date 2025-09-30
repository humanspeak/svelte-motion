import { describe, expect, it } from 'vitest'
import { getInitialKeyframes } from './initial'

describe('getInitialKeyframes', () => {
    it('should return keyframes when initial is an object', () => {
        const keyframes = { opacity: 0, scale: 0.5 }
        expect(getInitialKeyframes(keyframes)).toEqual(keyframes)
    })

    it('should return undefined when initial is false', () => {
        expect(getInitialKeyframes(false)).toBeUndefined()
    })

    it('should return undefined when initial is undefined', () => {
        expect(getInitialKeyframes(undefined)).toBeUndefined()
    })

    it('should return empty object when initial is empty object', () => {
        expect(getInitialKeyframes({})).toEqual({})
    })

    it('should handle complex keyframes', () => {
        const keyframes = {
            opacity: [0, 0.5, 1],
            scale: 0.8,
            x: -50,
            rotate: 180
        }
        expect(getInitialKeyframes(keyframes)).toEqual(keyframes)
    })
})
