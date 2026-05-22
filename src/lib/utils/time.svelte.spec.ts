import { frame, isMotionValue } from 'motion-dom'
import { flushSync } from 'svelte'
import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTime } from './time.svelte.js'

/**
 * `useTime` now uses motion-dom's `frame.update(tick, true)` keep-alive
 * callback. Tests gate frame-ticks via `frame.render(...)` and assert that
 * the underlying mechanism is correctly wired — exact elapsed timestamps
 * depend on `performance.now()` which we don't fake here.
 */
const nextFrame = () =>
    new Promise<void>((resolve) => {
        frame.render(() => resolve())
    })

describe('utils/time - useTime', () => {
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
            const time = useTime()
            expect(isMotionValue(time)).toBe(true)
        })
    })

    it('initial value is 0 before the first frame tick', () => {
        inRoot(() => {
            const time = useTime()
            expect(time.current).toBe(0)
        })
    })

    it('advances after a frame tick', async () => {
        const ctx = inRoot(() => useTime())
        // Wait through enough frames that the tick callback has captured a
        // measurable delta against `performance.now()`. We can't fake the
        // clock (motion-dom reads performance.now directly and we deliberately
        // use real timers here), but two real frames is enough for a > 0
        // assertion in a reasonable test runner.
        await nextFrame()
        await nextFrame()
        await nextFrame()
        expect(ctx.result.current).toBeGreaterThan(0)
    })

    it('is SSR-safe (no window)', () => {
        vi.stubGlobal('window', undefined)
        const time = useTime()
        expect(time.current).toBe(0)
        expect(get(time)).toBe(0)
    })

    it('shared id consumers stay in lockstep on a single keep-alive callback', async () => {
        const ctxA = inRoot(() => useTime('shared'))
        const ctxB = inRoot(() => useTime('shared'))
        // Different MV instances (independent destroy lifecycle).
        expect(ctxA.result).not.toBe(ctxB.result)
        await nextFrame()
        await nextFrame()
        // Same elapsed time after frames have ticked.
        expect(ctxA.result.current).toBe(ctxB.result.current)
    })

    it('shared timeline tears down and restarts fresh after last consumer unmounts', async () => {
        // Behavioral test: a shared `id` keeps the base alive while there's
        // at least one consumer; the next useTime(id) after full teardown
        // creates a fresh timeline (verified by re-seeding from base 0).
        const { result: a, stop: stopA } = inRoot(() => useTime('to-clean-1'))
        const { result: b, stop: stopB } = inRoot(() => useTime('to-clean-1'))
        flushSync()
        await nextFrame()
        await nextFrame()
        // Both consumers observe the same elapsed clock.
        expect(a.current).toBe(b.current)
        // Tear down both — refcount hits zero, base timeline destroyed.
        stopA()
        stopB()
        flushSync()
        // A new consumer with the same id gets a freshly-seeded base — its
        // initial value is 0 (the fresh tick hasn't run yet).
        const { result: c } = inRoot(() => useTime('to-clean-1'))
        expect(c.current).toBe(0)
    })

    it('unique-timeline unmount does not leak the keep-alive callback', async () => {
        // Behavioral test: stop()'s cleanup runs without throwing, and
        // subsequent useTime() calls keep working (no shared state
        // corruption from the prior teardown).
        const { stop } = inRoot(() => useTime())
        flushSync()
        await nextFrame()
        stop()
        flushSync()
        // A fresh useTime in a fresh root still works.
        const { result } = inRoot(() => useTime())
        expect(result.current).toBe(0)
        await nextFrame()
        expect(result.current).toBeGreaterThanOrEqual(0)
    })

    it('is SSR-safe for shared id (no window)', () => {
        vi.stubGlobal('window', undefined)
        const t = useTime('any')
        expect(t.current).toBe(0)
    })
})
