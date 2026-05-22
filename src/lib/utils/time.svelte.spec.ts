import { isMotionValue } from 'motion-dom'
import { flushSync } from 'svelte'
import { get } from 'svelte/store'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTime } from './time.svelte.js'

/**
 * `useTime` now returns an augmented motion-dom `MotionValue<number>` driven
 * by a RAF loop. These tests cover the public surface (identity, RAF tick,
 * SSR safety) and the shared-timeline lifecycle: callers passing the same
 * `id` observe one shared RAF, each receives an independent motion value,
 * and the loop stops on last unmount.
 *
 * `$effect(() => () => destroy())` requires a reactive scope, so every test
 * runs inside `$effect.root` and uses the captured `cleanup` to drive the
 * scope teardown that fires the RAF cancel.
 */
describe('utils/time - useTime', () => {
    let cleanups: VoidFunction[]

    beforeEach(() => {
        vi.useFakeTimers()
        cleanups = []
    })

    afterEach(() => {
        for (const fn of cleanups) fn()
        vi.useRealTimers()
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

    it('ticks once per animation frame', () => {
        let rafCb: FrameRequestCallback | null = null
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
            rafCb = cb
            return 1 as unknown as number
        })
        vi.stubGlobal('cancelAnimationFrame', () => {})
        vi.spyOn(performance, 'now').mockReturnValue(0)

        inRoot(() => {
            const time = useTime()
            expect(time.current).toBe(0)
            // Simulate rAF tick via the captured callback.
            ;(rafCb as unknown as FrameRequestCallback | null)?.(100)
            expect(time.current).toBe(100)
            ;(rafCb as unknown as FrameRequestCallback | null)?.(500)
            expect(time.current).toBe(500)
        })
    })

    it('is SSR-safe (no window)', () => {
        vi.stubGlobal('window', undefined)
        const time = useTime()
        expect(time.current).toBe(0)
        expect(get(time)).toBe(0)
    })

    it('shared id consumers stay in lockstep on a single RAF loop', () => {
        let rafCb: FrameRequestCallback | null = null
        const rafSpy = vi
            .spyOn(
                globalThis as unknown as { requestAnimationFrame: typeof requestAnimationFrame },
                'requestAnimationFrame'
            )
            .mockImplementation((cb: FrameRequestCallback) => {
                rafCb = cb
                return 1 as unknown as number
            })
        vi.stubGlobal('cancelAnimationFrame', () => {})
        vi.spyOn(performance, 'now').mockReturnValue(0)

        inRoot(() => {
            const a = useTime('shared')
            const b = useTime('shared')
            // Different MV instances (independent destroy lifecycle)…
            expect(a).not.toBe(b)
            // …but they observe the same tick.
            ;(rafCb as unknown as FrameRequestCallback | null)?.(250)
            expect(a.current).toBe(b.current)
            expect(a.current).toBe(250)
            // Only one RAF loop: initial call + one re-schedule inside loop.
            expect(rafSpy).toHaveBeenCalledTimes(2)
        })

        rafSpy.mockRestore()
    })

    it('shared timeline RAF is cancelled when the last consumer unmounts', () => {
        const cancelSpy = vi.fn()
        vi.stubGlobal('requestAnimationFrame', () => 123 as unknown as number)
        vi.stubGlobal('cancelAnimationFrame', cancelSpy)

        const { stop: stopA } = inRoot(() => useTime('to-clean'))
        const { stop: stopB } = inRoot(() => useTime('to-clean'))
        // Drain microtasks so each root's $effect runs and registers its
        // cleanup — otherwise stop() races the effect and cleanup never fires.
        flushSync()
        stopA()
        expect(cancelSpy).not.toHaveBeenCalled() // still one consumer left
        stopB()
        expect(cancelSpy).toHaveBeenCalledWith(123)
    })

    it('cancels RAF for a unique (non-shared) timeline on unmount', () => {
        const cancelSpy = vi.fn()
        vi.stubGlobal('requestAnimationFrame', () => 321 as unknown as number)
        vi.stubGlobal('cancelAnimationFrame', cancelSpy)

        const { stop } = inRoot(() => useTime())
        flushSync()
        stop()
        expect(cancelSpy).toHaveBeenCalledWith(321)
    })

    it('is SSR-safe for shared id (no window)', () => {
        vi.stubGlobal('window', undefined)
        const t = useTime('any')
        expect(t.current).toBe(0)
    })
})
