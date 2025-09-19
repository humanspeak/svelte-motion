import { get, readable, writable } from 'svelte/store'
import { describe, expect, it } from 'vitest'
import { useTransform } from './transform.js'

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

    it('supports mixer for non-numeric values', () => {
        const src = writable(0)
        const mix = (a: unknown, b: unknown) => (t: number) => (t < 0.5 ? a : b)
        const out = useTransform(src, [0, 1], ['red', 'blue'], { mixer: mix })
        expect(get(out)).toBe('red')
        src.set(1)
        expect(get(out)).toBe('blue')
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
})
