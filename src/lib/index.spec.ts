import { describe, expect, it } from 'vitest'
import {
    animate,
    AnimatePresence,
    createDragControls,
    hover,
    motion,
    MotionConfig,
    stringifyStyleObject,
    useAnimationFrame,
    useSpring,
    useTime,
    useTransform
} from './index.js'

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

    it('exports AnimatePresence component', () => {
        expect(typeof AnimatePresence).toBe('function')
    })

    it('exports createDragControls factory', () => {
        expect(typeof createDragControls).toBe('function')
        const controls = createDragControls()
        expect(controls).toBeTruthy()
        expect(typeof controls.start).toBe('function')
        expect(typeof controls.cancel).toBe('function')
        expect(typeof controls.stop).toBe('function')
        expect(typeof controls.subscribe).toBe('function')
    })

    it('exports utility helpers', () => {
        expect(typeof useAnimationFrame).toBe('function')
        expect(typeof useSpring).toBe('function')
        expect(typeof stringifyStyleObject).toBe('function')
        expect(typeof useTime).toBe('function')
        expect(typeof useTransform).toBe('function')
    })
})
