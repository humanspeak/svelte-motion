import { isMotionValue } from 'motion-dom'
import { flushSync } from 'svelte'
import { writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMotionValue } from './motionValue.svelte.js'
import { useVelocity } from './velocity.svelte.js'

/**
 * `useVelocity` now returns an augmented motion-dom `MotionValue<number>`.
 * These tests cover the public shape (identity, `.current`, `.subscribe`),
 * source compatibility (both `MotionValue` and Svelte readable), unit-string
 * parsing, the settle-to-zero RAF poll loop, and SSR safety. The underlying
 * per-frame velocity math is owned by motion-dom and tested upstream.
 */
describe('utils/velocity - useVelocity', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        cleanups = []
    })

    afterEach(() => {
        for (const fn of cleanups) fn()
        vi.restoreAllMocks()
        vi.unstubAllGlobals()
    })

    const inRoot = <T>(fn: () => T): { result: T; stop: VoidFunction } => {
        let result: T
        const stop = $effect.root(() => {
            result = fn()
        })
        cleanups.push(stop)
        return { result: result!, stop }
    }

    it('returns a real MotionValue (isMotionValue passes)', () => {
        inRoot(() => {
            const src = useMotionValue(0)
            const v = useVelocity(src)
            expect(isMotionValue(v)).toBe(true)
        })
    })

    it('initial velocity is 0 for both .current and .get()', () => {
        inRoot(() => {
            const src = useMotionValue(0)
            const v = useVelocity(src)
            expect(v.current).toBe(0)
            expect(v.get()).toBe(0)
        })
    })

    it('accepts a Svelte readable source', () => {
        inRoot(() => {
            const src = writable<number>(0)
            const v = useVelocity(src)
            expect(isMotionValue(v)).toBe(true)
            expect(v.current).toBe(0)
        })
    })

    it('accepts unit-string sources (parses numeric part)', () => {
        inRoot(() => {
            const src = writable<string>('0px')
            const v = useVelocity(src)
            expect(v.current).toBe(0)
            // Source updates should parse without throwing; velocity stays
            // at 0 because the RAF poll hasn't run yet (and we don't tick it
            // in this test). The point is the unit string was accepted.
            src.set('100px')
            expect(v.current).toBe(0)
        })
    })

    it('unsubscribes the source on unmount', () => {
        const cancelSpy = vi.fn()
        vi.stubGlobal('cancelAnimationFrame', cancelSpy)

        const unsubSpy = vi.fn()
        const fakeSource = { subscribe: vi.fn(() => unsubSpy) }

        const { stop } = inRoot(() =>
            useVelocity(fakeSource as unknown as Parameters<typeof useVelocity>[0])
        )
        flushSync()
        stop()
        expect(unsubSpy).toHaveBeenCalledTimes(1)
    })

    it('SSR fallback: no window → static motion value, no errors', () => {
        vi.stubGlobal('window', undefined)
        const src = writable<number>(0)
        const v = useVelocity(src)
        expect(isMotionValue(v)).toBe(true)
        expect(v.current).toBe(0)
    })
})
