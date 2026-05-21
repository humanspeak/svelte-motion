import { isMotionValue } from 'motion-dom'
import { get, readable, writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useMotionValue } from './motionValue.svelte.js'
import { clampBidirectional, useTransform } from './transform.svelte.js'

/**
 * `useTransform` now returns an augmented `MotionValue` instead of a derived
 * Svelte store. These tests cover the mapping- and function-form surfaces
 * that consumers relied on, plus the new motion-dom identity (`isMotionValue`
 * passes, `.current` reads, composition with `useMotionValue`).
 */
describe('utils/transform - useTransform', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        cleanups = []
    })

    afterEach(() => {
        for (const fn of cleanups) fn()
    })

    const inRoot = <T>(fn: () => T): T => {
        let result: T
        const stop = $effect.root(() => {
            result = fn()
        })
        cleanups.push(stop)
        return result!
    }

    it('returns a real MotionValue (isMotionValue passes)', () => {
        inRoot(() => {
            const src = useMotionValue(0)
            const out = useTransform(src, [0, 100], [0, 1])
            expect(isMotionValue(out)).toBe(true)
        })
    })

    it('maps ranges with default clamp', () => {
        inRoot(() => {
            const src = writable(0)
            const out = useTransform(src, [0, 100], [0, 1])
            expect(get(out)).toBe(0)
            src.set(50)
            expect(get(out)).toBeCloseTo(0.5)
            src.set(200)
            expect(get(out)).toBe(1)
        })
    })

    it('exposes mapped value via .current', () => {
        inRoot(() => {
            const src = useMotionValue(0)
            const out = useTransform(src, [0, 100], [0, 1])
            expect(out.current).toBe(0)
            src.set(50)
            expect(out.current).toBeCloseTo(0.5)
        })
    })

    it('maps ranges without clamp', () => {
        inRoot(() => {
            const src = writable(0)
            const out = useTransform(src, [0, 100], [0, 1], { clamp: false })
            src.set(200)
            expect(get(out)).toBe(2)
        })
    })

    it('supports easing array per segment', () => {
        inRoot(() => {
            const easeIn = (t: number) => t * t
            const src = writable(0)
            const out = useTransform(src, [0, 100, 200], [0, 1, 2], { ease: [easeIn, easeIn] })
            src.set(50)
            expect(get(out)).toBeCloseTo(easeIn(0.5))
            src.set(150)
            expect(get(out)).toBeCloseTo(1 + easeIn(0.5))
        })
    })

    it('handles descending input ranges correctly', () => {
        inRoot(() => {
            const src = writable(100)
            const out = useTransform(src, [100, 0], [0, 1])
            expect(get(out)).toBe(0)
            src.set(50)
            expect(get(out)).toBeCloseTo(0.5)
            src.set(0)
            expect(get(out)).toBe(1)
        })
    })

    it('invokes mixer with correct t and returns mixer result', () => {
        inRoot(() => {
            const src = writable(0)
            const recorded: number[] = []
            const mixer = (a: unknown, b: unknown) => (t: number) => {
                recorded.push(t)
                return t < 0.5 ? a : b
            }
            const out = useTransform(src, [0, 1], ['red', 'blue'], { mixer })

            const steps = [0, 0.25, 0.5, 0.75, 1]
            for (const v of steps) {
                src.set(v)
                const result = get(out)
                const lastT = recorded.at(-1)!
                expect(lastT).toBeCloseTo(v)
                expect(result).toBe(v < 0.5 ? 'red' : 'blue')
            }
        })
    })

    it('function form computes from deps', () => {
        inRoot(() => {
            const a = writable(2)
            const b = writable(3)
            const out = useTransform(() => get(a) + get(b), [a, b])
            expect(get(out)).toBe(5)
            a.set(4)
            expect(get(out)).toBe(7)
        })
    })

    it('handles equal segment endpoints without NaN', () => {
        inRoot(() => {
            const src = writable(0)
            const out = useTransform(src, [0, 0, 1], [0, 1, 2])
            src.set(0)
            expect(Number.isNaN(get(out) as unknown as number)).toBe(false)
        })
    })

    it('throws when input/output lengths differ', () => {
        inRoot(() => {
            const src = readable(0)
            expect(() => useTransform(src, [0, 1], [0])).toThrowError()
        })
    })

    it('clampBidirectional clamps correctly for normal and reversed bounds', () => {
        expect(clampBidirectional(5, 0, 10)).toBe(5)
        expect(clampBidirectional(-1, 0, 10)).toBe(0)
        expect(clampBidirectional(11, 0, 10)).toBe(10)
        expect(clampBidirectional(5, 10, 0)).toBe(5)
        expect(clampBidirectional(-1, 10, 0)).toBe(0)
        expect(clampBidirectional(11, 10, 0)).toBe(10)
    })

    it('fills single ease across segments', () => {
        inRoot(() => {
            const easeIn = (t: number) => t * t
            const src = writable(0)
            const out = useTransform(src, [0, 50, 100], [0, 1, 2], { ease: easeIn })
            src.set(25)
            expect(get(out)).toBeCloseTo(easeIn(0.5))
            src.set(75)
            expect(get(out)).toBeCloseTo(1 + easeIn(0.5))
        })
    })

    it('function form without deps returns a static MotionValue', () => {
        inRoot(() => {
            const out = useTransform(() => 42, [])
            expect(get(out)).toBe(42)
            expect(out.current).toBe(42)
        })
    })

    it('handles single-length input/output by returning the sole output', () => {
        inRoot(() => {
            const src = writable(0)
            const out1 = useTransform(src, [0], [456])
            expect(get(out1)).toBe(456)
        })
    })

    it('composes with useMotionValue: chained transforms re-emit', () => {
        inRoot(() => {
            const src = useMotionValue(0)
            const stepA = useTransform(src, [0, 100], [0, 1])
            const stepB = useTransform(stepA, [0, 1], [0, 200])
            expect(get(stepB)).toBe(0)
            src.set(50)
            expect(get(stepB)).toBeCloseTo(100)
        })
    })
})
