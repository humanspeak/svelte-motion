import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scheduleRefRetry } from './refRetry.js'

describe('utils/refRetry:scheduleRefRetry', () => {
    beforeEach(() => {
        // The global setup installs fake timers; these tests opt in per case.
        vi.useRealTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    it('runs attempt 0 on a microtask, before a setTimeout(0) resolves', async () => {
        const order: string[] = []
        const timeout = new Promise<void>((resolve) =>
            setTimeout(() => {
                order.push('timeout')
                resolve()
            }, 0)
        )
        scheduleRefRetry(() => order.push('retry'), 0)
        expect(order).toEqual([])

        await timeout
        expect(order).toEqual(['retry', 'timeout'])
    })

    it('waits for requestAnimationFrame on attempt >= 1', async () => {
        const frames: FrameRequestCallback[] = []
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn((cb: FrameRequestCallback) => {
                frames.push(cb)
                return frames.length
            })
        )
        vi.stubGlobal('cancelAnimationFrame', vi.fn())

        const callback = vi.fn()
        scheduleRefRetry(callback, 1)

        for (let i = 0; i < 4; i++) await Promise.resolve()
        expect(callback).not.toHaveBeenCalled()
        expect(frames).toHaveLength(1)

        frames[0](0)
        expect(callback).toHaveBeenCalledOnce()
    })

    it('cancel before run prevents an attempt-0 microtask call', async () => {
        const callback = vi.fn()
        const cancel = scheduleRefRetry(callback, 0)
        cancel()

        for (let i = 0; i < 4; i++) await Promise.resolve()
        expect(callback).not.toHaveBeenCalled()
    })

    it('cancel before run prevents an animation-frame call and cancels the frame', () => {
        const frames: FrameRequestCallback[] = []
        vi.stubGlobal(
            'requestAnimationFrame',
            vi.fn((cb: FrameRequestCallback) => {
                frames.push(cb)
                return 42
            })
        )
        const cancelMock = vi.fn()
        vi.stubGlobal('cancelAnimationFrame', cancelMock)

        const callback = vi.fn()
        const cancel = scheduleRefRetry(callback, 3)
        cancel()
        expect(cancelMock).toHaveBeenCalledWith(42)

        // Even if the frame fires anyway, the cancelled flag suppresses the call.
        frames[0](0)
        expect(callback).not.toHaveBeenCalled()
    })

    it('falls back to setTimeout when requestAnimationFrame is undefined', () => {
        vi.useFakeTimers()
        vi.stubGlobal('requestAnimationFrame', undefined)

        const callback = vi.fn()
        scheduleRefRetry(callback, 1)

        vi.advanceTimersByTime(15)
        expect(callback).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1)
        expect(callback).toHaveBeenCalledOnce()
    })

    it('cancel prevents the setTimeout fallback call', () => {
        vi.useFakeTimers()
        vi.stubGlobal('requestAnimationFrame', undefined)

        const callback = vi.fn()
        const cancel = scheduleRefRetry(callback, 2)
        cancel()

        vi.advanceTimersByTime(100)
        expect(callback).not.toHaveBeenCalled()
    })

    it('calling cancel after the callback ran is a no-op', async () => {
        const callback = vi.fn()
        const cancel = scheduleRefRetry(callback, 0)
        await Promise.resolve()
        expect(callback).toHaveBeenCalledOnce()
        expect(() => cancel()).not.toThrow()
        expect(callback).toHaveBeenCalledOnce()
    })
})
