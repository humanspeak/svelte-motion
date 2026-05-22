import { frame, isMotionValue } from 'motion-dom'
import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMotionValue } from './motionValue.svelte.js'
import { useTransform } from './transform.svelte.js'

/**
 * `useMotionValue` now wraps motion-dom's `MotionValue` with the shared
 * Svelte 5 augmentation: a `$state`-tracked `.current` getter and a Svelte
 * readable store `.subscribe` shim. These tests cover the surface that
 * pre-runes consumers relied on (`get`, `set`, store-style `subscribe`,
 * `useTransform` composition) plus the new `.current` and `isMotionValue`
 * identity. Spring physics, animation, and `attachFollow` are owned by
 * motion-dom and tested upstream.
 *
 * `$effect(() => () => destroy())` requires a reactive scope, so each test
 * runs inside `$effect.root`.
 */
describe('utils/motionValue - useMotionValue', () => {
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
            const mv = useMotionValue(0)
            expect(isMotionValue(mv)).toBe(true)
        })
    })

    it('reads initial value via .get(), .current, and svelte get()', () => {
        inRoot(() => {
            const mv = useMotionValue(42)
            expect(mv.get()).toBe(42)
            expect(mv.current).toBe(42)
            expect(get(mv)).toBe(42)
        })
    })

    it('set() updates .get(), .current, and svelte get()', () => {
        inRoot(() => {
            const mv = useMotionValue(0)
            mv.set(99)
            expect(mv.get()).toBe(99)
            expect(mv.current).toBe(99)
            expect(get(mv)).toBe(99)
        })
    })

    it('.subscribe emits synchronously then on every change', () => {
        inRoot(() => {
            const mv = useMotionValue(0)
            const seen: number[] = []
            const off = mv.subscribe((v) => seen.push(v))
            mv.set(1)
            mv.set(2)
            expect(seen).toEqual([0, 1, 2])
            off()
        })
    })

    it('multiple subscribers each see the full sequence', () => {
        inRoot(() => {
            const mv = useMotionValue(0)
            const a: number[] = []
            const b: number[] = []
            const offA = mv.subscribe((v) => a.push(v))
            const offB = mv.subscribe((v) => b.push(v))
            mv.set(1)
            mv.set(2)
            expect(a).toEqual([0, 1, 2])
            expect(b).toEqual([0, 1, 2])
            offA()
            offB()
        })
    })

    it('supports non-numeric (string) values', () => {
        inRoot(() => {
            const mv = useMotionValue('hello')
            expect(mv.get()).toBe('hello')
            mv.set('world')
            expect(mv.get()).toBe('world')
            expect(get(mv)).toBe('world')
            expect(mv.current).toBe('world')
        })
    })

    it('composes with useTransform mapping form', async () => {
        const ctx = inRoot(() => {
            const mv = useMotionValue(0)
            const out = useTransform(mv, [0, 100], [0, 1])
            expect(get(out)).toBe(0)
            mv.set(50)
            return { mv, out }
        })
        // motion-dom's mapValue/transformValue propagates on the next render
        // frame. Drive one frame, then assert.
        await new Promise<void>((resolve) => frame.render(() => resolve()))
        expect(get(ctx.out)).toBeCloseTo(0.5)
        ctx.mv.set(100)
        await new Promise<void>((resolve) => frame.render(() => resolve()))
        expect(get(ctx.out)).toBe(1)
    })

    it('.on("change") fires on writes', () => {
        inRoot(() => {
            const mv = useMotionValue(0)
            const seen: number[] = []
            const off = mv.on('change', (v) => seen.push(v))
            mv.set(7)
            mv.set(8)
            expect(seen).toEqual([7, 8])
            off()
        })
    })
})
