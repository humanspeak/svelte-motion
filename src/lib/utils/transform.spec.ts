import { get, readable, writable } from 'svelte/store'
import { describe, expect, it } from 'vitest'
import { clampBidirectional, useTransform } from './transform.js'

describe('utils/transform', () => {
    it('maps ranges with default clamp', () => {
        const src = writable(0)
        const out = useTransform(src, [0, 100], [0, 1])
        expect(get(out)).toBe(0)
        src.set(50)
        expect(get(out)).toBeCloseTo(0.5)
        src.set(200)
        expect(get(out)).toBe(1) // clamped
    })

    it('maps ranges without clamp', () => {
        const src = writable(0)
        const out = useTransform(src, [0, 100], [0, 1], { clamp: false })
        src.set(200)
        expect(get(out)).toBe(2)
    })

    it('supports easing array per segment', () => {
        const easeIn = (t: number) => t * t
        const src = writable(0)
        const out = useTransform(src, [0, 100, 200], [0, 1, 2], { ease: [easeIn, easeIn] })
        src.set(50)
        expect(get(out)).toBeCloseTo(easeIn(0.5))
        src.set(150)
        expect(get(out)).toBeCloseTo(1 + easeIn(0.5))
    })

    it('handles descending input ranges correctly', () => {
        const src = writable(100)
        const out = useTransform(src, [100, 0], [0, 1])
        expect(get(out)).toBe(0)
        src.set(50)
        expect(get(out)).toBeCloseTo(0.5)
        src.set(0)
        expect(get(out)).toBe(1)
    })

    it('invokes mixer with correct t and returns mixer result', () => {
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

    it('function form computes from deps', () => {
        const a = writable(2)
        const b = writable(3)
        const out = useTransform(() => get(a) + get(b), [a, b])
        expect(get(out)).toBe(5)
        a.set(4)
        expect(get(out)).toBe(7)
    })

    it('handles equal segment endpoints without NaN', () => {
        const src = writable(0)
        const out = useTransform(src, [0, 0, 1], [0, 1, 2])
        src.set(0)
        expect(Number.isNaN(get(out) as unknown as number)).toBe(false)
    })

    it('throws when input/output lengths differ', () => {
        const src = readable(0)
        expect(() => useTransform(src, [0, 1], [0])).toThrowError()
    })

    it('clampBidirectional clamps correctly for normal and reversed bounds', () => {
        expect(clampBidirectional(5, 0, 10)).toBe(5)
        expect(clampBidirectional(-1, 0, 10)).toBe(0)
        expect(clampBidirectional(11, 0, 10)).toBe(10)
        // Reversed
        expect(clampBidirectional(5, 10, 0)).toBe(5)
        expect(clampBidirectional(-1, 10, 0)).toBe(0)
        expect(clampBidirectional(11, 10, 0)).toBe(10)
    })

    it('fills single ease across segments', () => {
        const easeIn = (t: number) => t * t
        const src = writable(0)
        const out = useTransform(src, [0, 50, 100], [0, 1, 2], { ease: easeIn })
        src.set(25)
        // seg 0 midpoint eased
        expect(get(out)).toBeCloseTo(easeIn(0.5))
        src.set(75)
        // seg 1 midpoint eased around base=1
        expect(get(out)).toBeCloseTo(1 + easeIn(0.5))
    })

    it('function form without deps returns readable with initial compute', () => {
        const out = useTransform(() => 42, [])
        expect(get(out)).toBe(42)
    })

    it('handles single-length input/output by returning the sole output', () => {
        const src = writable(0)
        const out1 = useTransform(src, [0], [456])
        expect(get(out1)).toBe(456)
    })
})
