import { frame, frameData, frameSteps } from 'motion-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAnimationFrame } from './animationFrame.js'

/**
 * jsdom has no `requestAnimationFrame` when motion-dom loads, so its frameloop
 * never self-schedules. Process one frame by hand, running every step in order.
 */
const runFrame = (timestamp: number, delta: number) => {
    frameData.timestamp = timestamp
    frameData.delta = delta
    frameData.isProcessing = true
    for (const step of Object.values(frameSteps)) step.process(frameData)
    frameData.isProcessing = false
}

describe('utils/animationFrame - useAnimationFrame', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
        vi.restoreAllMocks()
    })

    it('passes time since the first frame and the frame delta', () => {
        const callback = vi.fn()
        const cleanup = useAnimationFrame(callback)

        expect(callback).not.toHaveBeenCalled()

        runFrame(1000, 16)
        expect(callback).toHaveBeenCalledTimes(1)
        expect(callback).toHaveBeenLastCalledWith(0, 16)

        runFrame(1016, 16)
        expect(callback).toHaveBeenCalledTimes(2)
        expect(callback).toHaveBeenLastCalledWith(16, 16)

        runFrame(1050, 34)
        expect(callback).toHaveBeenCalledTimes(3)
        expect(callback).toHaveBeenLastCalledWith(50, 34)

        cleanup()
    })

    it("schedules on Motion's update step", () => {
        const order: string[] = []
        const updateSpy = vi.fn(() => order.push('update'))
        const renderSpy = vi.fn(() => order.push('render'))

        frame.update(updateSpy)
        const cleanup = useAnimationFrame(() => order.push('animationFrame'))
        frame.render(renderSpy)

        runFrame(2000, 16)

        expect(updateSpy).toHaveBeenCalledTimes(1)
        expect(renderSpy).toHaveBeenCalledTimes(1)
        expect(order).toEqual(['update', 'animationFrame', 'render'])

        cleanup()
    })

    it('stops after cleanup', () => {
        const callback = vi.fn()
        const cleanup = useAnimationFrame(callback)

        runFrame(3000, 16)
        expect(callback).toHaveBeenCalledTimes(1)

        cleanup()

        runFrame(3016, 16)
        runFrame(3032, 16)
        expect(callback).toHaveBeenCalledTimes(1)
    })

    it('cleanup inside the callback stops the loop', () => {
        let calls = 0
        let cleanup: () => void = () => {}
        const callback = vi.fn(() => {
            calls++
            if (calls === 2) cleanup()
        })
        cleanup = useAnimationFrame(callback)

        runFrame(4000, 16)
        runFrame(4016, 16)
        expect(callback).toHaveBeenCalledTimes(2)

        runFrame(4032, 16)
        expect(callback).toHaveBeenCalledTimes(2)
    })

    it('is SSR-safe (no window)', () => {
        vi.stubGlobal('window', undefined)

        const callback = vi.fn()

        // In SSR, this should not throw and should return a noop cleanup
        let cleanup: () => void = () => {}
        expect(() => {
            cleanup = useAnimationFrame(callback)
        }).not.toThrow()

        vi.unstubAllGlobals()

        // Nothing was scheduled on the frameloop
        runFrame(5000, 16)
        expect(callback).not.toHaveBeenCalled()

        // Cleanup should also not throw
        expect(() => cleanup()).not.toThrow()
    })
})
