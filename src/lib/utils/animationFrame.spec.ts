import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { useAnimationFrame } from './animationFrame.js'

describe('utils/animationFrame - useAnimationFrame', () => {
    let rafCb: FrameRequestCallback | null = null
    let rafId = 0
    let rafMock: Mock
    let cancelMock: Mock

    beforeEach(() => {
        rafCb = null
        rafId = 0

        rafMock = vi.fn((cb: FrameRequestCallback) => {
            rafCb = cb
            return ++rafId
        })

        cancelMock = vi.fn()

        vi.stubGlobal('requestAnimationFrame', rafMock)
        vi.stubGlobal('cancelAnimationFrame', cancelMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('calls callback on each animation frame with timestamp', () => {
        const callback = vi.fn()
        const cleanup = useAnimationFrame(callback)

        // Should have requested first frame immediately
        expect(rafMock).toHaveBeenCalledTimes(1)
        expect(callback).not.toHaveBeenCalled()

        // Simulate first frame
        expect(rafCb).toBeTruthy()
        rafCb?.(100)
        expect(callback).toHaveBeenCalledTimes(1)
        expect(callback).toHaveBeenCalledWith(100)

        // Should have requested next frame
        expect(rafMock).toHaveBeenCalledTimes(2)

        // Simulate second frame
        rafCb?.(116.67)
        expect(callback).toHaveBeenCalledTimes(2)
        expect(callback).toHaveBeenCalledWith(116.67)

        // Simulate third frame
        rafCb?.(133.33)
        expect(callback).toHaveBeenCalledTimes(3)
        expect(callback).toHaveBeenCalledWith(133.33)

        cleanup()
    })

    it('cancels animation frame when cleanup is called', () => {
        const callback = vi.fn()
        const cleanup = useAnimationFrame(callback)

        // Should have scheduled frame
        expect(rafMock).toHaveBeenCalledTimes(1)
        const scheduledId = rafId

        // Cleanup should cancel the frame
        cleanup()
        expect(cancelMock).toHaveBeenCalledWith(scheduledId)
    })

    it('does not schedule new frames after cleanup', () => {
        const callback = vi.fn()
        const cleanup = useAnimationFrame(callback)

        // Simulate frame
        rafCb?.(100)
        expect(callback).toHaveBeenCalledTimes(1)

        // Call cleanup
        cleanup()

        // Clear the mock to track new calls
        rafMock.mockClear()

        // Try to call frame callback again
        rafCb?.(200)

        // Should still call the callback (since the function is already scheduled)
        // but should not schedule new frames
        expect(callback).toHaveBeenCalledTimes(2)
    })

    it('is SSR-safe (no window)', () => {
        vi.stubGlobal('window', undefined)

        const callback = vi.fn()

        // In SSR, this should not throw and should return a noop cleanup
        let cleanup: () => void
        expect(() => {
            cleanup = useAnimationFrame(callback)
        }).not.toThrow()

        // No frames should be requested in SSR
        expect(rafMock).not.toHaveBeenCalled()
        expect(callback).not.toHaveBeenCalled()

        // Cleanup should also not throw
        expect(() => {
            cleanup!()
        }).not.toThrow()

        vi.unstubAllGlobals()
    })

    it('allows callback to manipulate DOM elements', () => {
        const element: HTMLDivElement | null = document.createElement('div')

        const cleanup = useAnimationFrame((t) => {
            if (!element) return
            const rotate = Math.sin(t / 10000) * 200
            const y = (1 + Math.sin(t / 1000)) * -50
            element.style.transform = `translateY(${y}px) rotateX(${rotate}deg) rotateY(${rotate}deg)`
        })

        expect(element).toBeTruthy()
        expect(element.style.transform).toBe('')

        // Simulate frame
        rafCb?.(1000)

        // Transform should be set
        expect(element.style.transform).toMatch(
            /translateY\(.+px\) rotateX\(.+deg\) rotateY\(.+deg\)/
        )

        cleanup()
    })
})
