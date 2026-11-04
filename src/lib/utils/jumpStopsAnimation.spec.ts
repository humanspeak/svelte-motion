import { JSAnimation, NativeAnimationExtended, motionValue, time } from 'motion-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * `MotionValue.jump()` while an animation is running (#4027).
 *
 * Ported from upstream's `describe("MotionValue.jump")` in
 * `packages/motion-dom/src/value/__tests__/motion-value.test.ts` at `v14.9.1`
 * (e8a4e8088, db88ba821). Our key-change rewind and `set()` controls both go
 * through `jump()`, so a stopped animation must never override the jumped value
 * or complete inside `jump()`.
 */
describe('MotionValue.jump', () => {
    afterEach(() => {
        // supportsWaapi() checks for an own property, so delete rather than
        // set to undefined
        delete (Element.prototype as unknown as { animate?: unknown }).animate
        vi.restoreAllMocks()
    })

    /**
     * Stopping a running WAAPI animation writes the value it's showing back
     * into the motion value. That must not override the value jumped to.
     */
    it('ends at the jumped value when stopping a running animation', () => {
        Element.prototype.animate = vi.fn().mockImplementation(() => ({
            cancel: vi.fn(),
            onfinish: null,
            playbackRate: 1,
            currentTime: 300,
            startTime: time.now() - 300,
            playState: 'running',
            effect: { getComputedTiming: () => ({ duration: 300 }) }
        }))

        const element = document.createElement('div')
        const value = motionValue(0)
        const onChange = vi.fn()

        void value.start(
            () =>
                new NativeAnimationExtended({
                    element,
                    name: 'opacity',
                    keyframes: [0, 1],
                    motionValue: value,
                    duration: 300,
                    ease: 'linear'
                } as unknown as ConstructorParameters<typeof NativeAnimationExtended>[0])
        )

        expect(value.isAnimating()).toBe(true)

        value.on('change', onChange)
        value.jump(0)

        expect(value.isAnimating()).toBe(false)
        expect(value.get()).toBe(0)
        expect(onChange).toHaveBeenLastCalledWith(0)
        expect(value.getVelocity()).toBe(0)
    })

    /**
     * An overdue JS animation (past its end but not yet ticked, as on a busy
     * main thread) must not tick to catch up and complete when `jump()` stops
     * it. Unit-level port of upstream's "an overdue animation stopped by the
     * remount doesn't complete" (db88ba821).
     */
    it('does not complete an overdue JS animation that it stops', async () => {
        // The shared setup fakes timers; a real clock and a real busy main
        // thread are what make the animation overdue without a frame ticking
        vi.useRealTimers()

        const value = motionValue(1)
        const onComplete = vi.fn()

        void value.start(
            () =>
                new JSAnimation({
                    keyframes: [1, 0],
                    duration: 300,
                    ease: 'linear',
                    motionValue: value,
                    onComplete
                })
        )

        expect(value.isAnimating()).toBe(true)

        // Let a couple of frames tick so the animation has a resolved start
        const nextFrame = () => new Promise<void>((resolve) => setTimeout(resolve, 20))
        await nextFrame()
        await nextFrame()

        // Hold up the main thread past the animation's end
        const start = performance.now()
        while (performance.now() - start < 400) {
            // busy-wait
        }
        // Let the frame-synchronous clock re-read the current time
        await Promise.resolve()

        value.jump(1)

        expect(onComplete).not.toHaveBeenCalled()
        expect(value.isAnimating()).toBe(false)
        expect(value.get()).toBe(1)
    })
})
