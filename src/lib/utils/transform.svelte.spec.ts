import { frame, isMotionValue } from 'motion-dom'
import { get, readable, writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMotionValue } from './motionValue.svelte.js'
import { useTransform } from './transform.svelte.js'

/**
 * `useTransform` delegates to motion-dom's `mapValue` and `transformValue`
 * primitives. The result motion value updates on the next render frame after
 * any source emits, so tests await `nextFrame()` between `.set()` and read.
 * This mirrors motion-dom's own upstream `transform-value.test.ts`.
 */
const nextFrame = () =>
    new Promise<void>((resolve) => {
        frame.render(() => resolve())
    })

describe('utils/transform - useTransform', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        vi.useRealTimers()
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

    it('mapping form: seeds initial value synchronously and updates next frame', async () => {
        const out = inRoot(() => {
            const src = useMotionValue(0)
            const result = useTransform(src, [0, 100], [0, 1])
            expect(result.current).toBe(0)
            src.set(50)
            return { src, result }
        })
        await nextFrame()
        expect(out.result.current).toBeCloseTo(0.5)
        out.src.set(200)
        await nextFrame()
        expect(out.result.current).toBe(1)
    })

    it('mapping form: maps without clamp', async () => {
        const ctx = inRoot(() => {
            const src = useMotionValue(0)
            const result = useTransform(src, [0, 100], [0, 1], { clamp: false })
            src.set(200)
            return { src, result }
        })
        await nextFrame()
        expect(ctx.result.current).toBe(2)
    })

    it('mapping form: supports easing array per segment', async () => {
        const easeIn = (t: number) => t * t
        const ctx = inRoot(() => {
            const src = useMotionValue(0)
            const result = useTransform(src, [0, 100, 200], [0, 1, 2], { ease: [easeIn, easeIn] })
            src.set(50)
            return { src, result }
        })
        await nextFrame()
        expect(ctx.result.current).toBeCloseTo(easeIn(0.5))
        ctx.src.set(150)
        await nextFrame()
        expect(ctx.result.current).toBeCloseTo(1 + easeIn(0.5))
    })

    it('mapping form: handles descending input ranges', async () => {
        const ctx = inRoot(() => {
            const src = useMotionValue(100)
            const result = useTransform(src, [100, 0], [0, 1])
            expect(result.current).toBe(0)
            src.set(50)
            return { src, result }
        })
        await nextFrame()
        expect(ctx.result.current).toBeCloseTo(0.5)
        ctx.src.set(0)
        await nextFrame()
        expect(ctx.result.current).toBe(1)
    })

    it('mapping form: invokes mixer with correct t', async () => {
        const mixer = (a: string, b: string) => (t: number) => (t < 0.5 ? a : b)
        const ctx = inRoot(() => {
            const src = useMotionValue(0)
            const result = useTransform<string>(src, [0, 1], ['red', 'blue'], { mixer })
            return { src, result }
        })
        ctx.src.set(0.25)
        await nextFrame()
        expect(ctx.result.current).toBe('red')
        ctx.src.set(0.75)
        await nextFrame()
        expect(ctx.result.current).toBe('blue')
    })

    it('mapping form: accepts a Svelte readable source via the bridge', async () => {
        const ctx = inRoot(() => {
            const src = writable<number>(0)
            const result = useTransform(src, [0, 100], [0, 1])
            expect(get(result)).toBe(0)
            src.set(50)
            return { src, result }
        })
        await nextFrame()
        expect(ctx.result.current).toBeCloseTo(0.5)
        ctx.src.set(200)
        await nextFrame()
        expect(ctx.result.current).toBe(1)
    })

    it('compute form: auto-tracks MotionValue reads inside the function', async () => {
        const ctx = inRoot(() => {
            const a = useMotionValue(2)
            const b = useMotionValue(3)
            const result = useTransform(() => a.get() + b.get())
            expect(result.current).toBe(5)
            a.set(4)
            return { a, b, result }
        })
        await nextFrame()
        expect(ctx.result.current).toBe(7)
        ctx.b.set(10)
        await nextFrame()
        expect(ctx.result.current).toBe(14)
    })

    it('compute form: with no MotionValue reads, returns a static value', () => {
        inRoot(() => {
            const out = useTransform(() => 42)
            expect(out.current).toBe(42)
            expect(get(out)).toBe(42)
        })
    })

    it('single-transformer form: maps a MotionValue through a function', async () => {
        const ctx = inRoot(() => {
            const x = useMotionValue(10)
            const doubled = useTransform(x, (latest: number) => latest * 2)
            expect(doubled.current).toBe(20)
            x.set(7)
            return { x, doubled }
        })
        await nextFrame()
        expect(ctx.doubled.current).toBe(14)
    })

    it('multi-transformer form: combines an array of MotionValues', async () => {
        const ctx = inRoot(() => {
            const x = useMotionValue(2)
            const y = useMotionValue(3)
            const product = useTransform([x, y], ([a, b]: number[]) => a * b)
            expect(product.current).toBe(6)
            x.set(4)
            return { x, y, product }
        })
        await nextFrame()
        expect(ctx.product.current).toBe(12)
    })

    it('multi-output mapping form: returns an object of motion values', async () => {
        const ctx = inRoot(() => {
            const x = useMotionValue(0)
            const { opacity, scale } = useTransform(x, [0, 100], {
                opacity: [0, 1],
                scale: [0.5, 1]
            })
            expect(isMotionValue(opacity)).toBe(true)
            expect(isMotionValue(scale)).toBe(true)
            expect(opacity.current).toBe(0)
            expect(scale.current).toBe(0.5)
            x.set(50)
            return { x, opacity, scale }
        })
        await nextFrame()
        expect(ctx.opacity.current).toBeCloseTo(0.5)
        expect(ctx.scale.current).toBeCloseTo(0.75)
    })

    it('handles equal segment endpoints without NaN', () => {
        inRoot(() => {
            const src = useMotionValue(0)
            const out = useTransform(src, [0, 0, 1], [0, 1, 2])
            src.set(0)
            expect(Number.isNaN(out.current as unknown as number)).toBe(false)
        })
    })

    it('readable source: SSR-style readable() constructs without throwing', () => {
        inRoot(() => {
            const src = readable(0)
            const out = useTransform(src, [0, 1], [0, 1])
            expect(out.current).toBe(0)
        })
    })

    it('fills single ease across segments', async () => {
        const easeIn = (t: number) => t * t
        const ctx = inRoot(() => {
            const src = useMotionValue(0)
            const result = useTransform(src, [0, 50, 100], [0, 1, 2], { ease: easeIn })
            src.set(25)
            return { src, result }
        })
        await nextFrame()
        expect(ctx.result.current).toBeCloseTo(easeIn(0.5))
        ctx.src.set(75)
        await nextFrame()
        expect(ctx.result.current).toBeCloseTo(1 + easeIn(0.5))
    })

    it('composes with useMotionValue: chained transforms re-emit', async () => {
        const ctx = inRoot(() => {
            const src = useMotionValue(0)
            const stepA = useTransform(src, [0, 100], [0, 1])
            const stepB = useTransform(stepA, [0, 1], [0, 200])
            expect(stepB.current).toBe(0)
            src.set(50)
            return { src, stepA, stepB }
        })
        await nextFrame()
        await nextFrame()
        expect(ctx.stepB.current).toBeCloseTo(100)
    })
})
