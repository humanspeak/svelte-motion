import { describe, expect, it } from 'vitest'
import {
    animate,
    AnimatePresence,
    anticipate,
    backIn,
    backInOut,
    backOut,
    circIn,
    circInOut,
    circOut,
    clamp,
    createDragControls,
    cubicBezier,
    delay,
    distance,
    distance2D,
    easeIn,
    easeInOut,
    easeOut,
    hover,
    interpolate,
    inView,
    mix,
    motion,
    MotionConfig,
    pipe,
    press,
    progress,
    resize,
    scroll,
    stagger,
    stringifyStyleObject,
    transform,
    useAnimationFrame,
    useSpring,
    useTime,
    useTransform,
    wrap
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

    it('re-exports core motion functions', () => {
        expect(typeof transform).toBe('function')
        expect(typeof stagger).toBe('function')
        expect(typeof inView).toBe('function')
        expect(typeof scroll).toBe('function')
        expect(typeof press).toBe('function')
        expect(typeof resize).toBe('function')
        expect(typeof delay).toBe('function')
    })

    it('re-exports easing functions', () => {
        expect(typeof anticipate).toBe('function')
        expect(typeof backIn).toBe('function')
        expect(typeof backInOut).toBe('function')
        expect(typeof backOut).toBe('function')
        expect(typeof circIn).toBe('function')
        expect(typeof circInOut).toBe('function')
        expect(typeof circOut).toBe('function')
        expect(typeof easeIn).toBe('function')
        expect(typeof easeInOut).toBe('function')
        expect(typeof easeOut).toBe('function')
        expect(typeof cubicBezier).toBe('function')
    })

    it('re-exports utility functions', () => {
        expect(typeof interpolate).toBe('function')
        expect(typeof mix).toBe('function')
        expect(typeof clamp).toBe('function')
        expect(typeof wrap).toBe('function')
        expect(typeof pipe).toBe('function')
        expect(typeof distance).toBe('function')
        expect(typeof distance2D).toBe('function')
        expect(typeof progress).toBe('function')
    })

    it('transform creates a range mapper', () => {
        const mapper = transform([0, 100], [0, 1])
        expect(typeof mapper).toBe('function')
        expect(mapper(0)).toBe(0)
        expect(mapper(50)).toBeCloseTo(0.5)
        expect(mapper(100)).toBe(1)
    })

    it('transform clamps out-of-range inputs to the output range', () => {
        // transform clamps (does not extrapolate) when input falls outside the input range
        const mapper = transform([0, 100], [0, 1])

        // Below input range: -10 maps to 0 (clamped to output minimum)
        expect(mapper(-10)).toBe(0)

        // Above input range: 150 maps to 1 (clamped to output maximum)
        expect(mapper(150)).toBe(1)

        // Verify clamping holds for more extreme out-of-range values
        expect(mapper(-50)).toBe(0)
        expect(mapper(200)).toBe(1)
    })
})
