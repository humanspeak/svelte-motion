import { describe, expect, it } from 'vitest'
import { animate, hover, motion, MotionConfig } from './index.js'

describe('public API: index.ts', () => {
    it('exports motion object with lowercased HTML keys', () => {
        // spot-check some common elements
        expect(motion).toBeTruthy()
        expect(typeof motion.div).toBe('function')
        expect(typeof motion.button).toBe('function')
        expect(typeof motion.img).toBe('function')

        // ensure keys are lowercase (no accidental PascalCase)
        expect((motion as unknown as Record<string, unknown>).Img).toBeUndefined()
    })

    it('re-exports animate and hover from motion', () => {
        expect(typeof animate).toBe('function')
        expect(typeof hover).toBe('function')
    })

    it('exports MotionConfig component', () => {
        expect(typeof MotionConfig).toBe('function')
    })
})
