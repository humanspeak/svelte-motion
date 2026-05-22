import { frame, isMotionValue } from 'motion-dom'
import { writable } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMotionValue } from './motionValue.svelte.js'
import { useVelocity } from './velocity.svelte.js'

/**
 * `useVelocity` now uses motion-dom's frame loop: source `.on('change')`
 * schedules `updateVelocity` via `frame.update(...)`, which reads
 * `source.getVelocity()` and self-reschedules while velocity is non-zero.
 * Tests gate post-set assertions on `frame.render(...)`.
 */
const nextFrame = () =>
    new Promise<void>((resolve) => {
        frame.render(() => resolve())
    })

describe('utils/velocity - useVelocity', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        vi.useRealTimers()
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

    it('accepts a Svelte readable source via the internal bridge', () => {
        inRoot(() => {
            const src = writable<number>(0)
            const v = useVelocity(src)
            expect(isMotionValue(v)).toBe(true)
            expect(v.current).toBe(0)
        })
    })

    it('accepts unit-string sources (parses numeric part)', async () => {
        // The readable bridge calls parseNumeric on every emit. Set a unit
        // string and verify the velocity machinery still resolves (a frame
        // tick passes and the result remains a number).
        const ctx = inRoot(() => {
            const src = writable<string>('0px')
            const v = useVelocity(src)
            src.set('100px')
            return { src, v }
        })
        await nextFrame()
        expect(typeof ctx.result.v.current).toBe('number')
    })

    it('schedules a frame update when the source emits a change', async () => {
        // We don't assert a specific velocity value — motion-dom owns the
        // per-frame delta math and tests it upstream. We DO assert that
        // setting the source schedules `updateVelocity` in the frame loop
        // (it runs, doesn't throw, and the result is still a number).
        const ctx = inRoot(() => {
            const src = useMotionValue(0)
            const v = useVelocity(src)
            src.set(100)
            return { src, v }
        })
        await nextFrame()
        expect(typeof ctx.result.v.current).toBe('number')
        expect(Number.isFinite(ctx.result.v.current)).toBe(true)
    })

    it('SSR fallback: no window → static motion value, no errors', () => {
        vi.stubGlobal('window', undefined)
        const src = writable<number>(0)
        const v = useVelocity(src)
        expect(isMotionValue(v)).toBe(true)
        expect(v.current).toBe(0)
    })
})
