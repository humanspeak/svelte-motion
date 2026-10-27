import { MotionGlobalConfig } from 'motion'
import { frameData, processFrame } from 'motion-dom'
import { afterEach, beforeEach } from 'vitest'

/**
 * Run each test in the current `describe` block on Motion's manual clock.
 *
 * Use it for tests whose animations start before the first `stepFrames()`
 * call: those animations read their start time when they are created, so the
 * clock must already be manual by then. Frames from `requestAnimationFrame`
 * still fire but don't advance time. Turns `MotionGlobalConfig.useManualTiming`
 * on before each test and off after it.
 *
 * Ported from `motion-dom/src/frameloop/__tests__/utils.ts @ v14.6.0`. Lives
 * under `__tests__/` so it's excluded from the published bundle and can freely
 * import `vitest`.
 *
 * @returns Nothing; registers `beforeEach` / `afterEach` hooks on the
 *   enclosing `describe` block.
 * @example
 * ```ts
 * describe('my animation', () => {
 *     withManualFrames()
 *
 *     it('reaches the midpoint', async () => {
 *         const value = motionValue(0)
 *         animate(value, 100, { duration: 0.2, ease: 'linear' })
 *         await stepFrames(100)
 *         expect(value.get()).toBeCloseTo(50, 0)
 *     })
 * })
 * ```
 */
export const withManualFrames = (): void => {
    beforeEach(() => {
        MotionGlobalConfig.useManualTiming = true
    })
    afterEach(() => {
        MotionGlobalConfig.useManualTiming = false
    })
}

/**
 * Switch to Motion's manual clock, then advance it by `duration` ms,
 * processing a frame with `processFrame()` every `frameDuration` ms and
 * letting promises settle between frames. The last frame lands exactly on
 * `frameData.timestamp + duration`.
 *
 * This turns `MotionGlobalConfig.useManualTiming` on and leaves it on. A test
 * that calls `stepFrames` outside a `withManualFrames()` block must reset
 * `MotionGlobalConfig.useManualTiming = false` afterwards, or later tests run
 * on the manual clock with WAAPI disabled.
 *
 * Ported from `motion-dom/src/frameloop/__tests__/utils.ts @ v14.6.0`.
 *
 * @param duration - How far to advance the clock, in milliseconds.
 * @param frameDuration - Time between processed frames, in milliseconds.
 *   Defaults to one 60fps frame.
 * @returns A promise that resolves after the last frame has been processed
 *   and its microtasks have run.
 * @example
 * ```ts
 * afterEach(() => {
 *     MotionGlobalConfig.useManualTiming = false
 * })
 *
 * it('runs four frames', async () => {
 *     await stepFrames(100, 25)
 * })
 * ```
 */
export const stepFrames = async (duration: number, frameDuration = 1000 / 60): Promise<void> => {
    MotionGlobalConfig.useManualTiming = true
    const end = frameData.timestamp + duration
    let timestamp = frameData.timestamp
    while (timestamp < end) {
        processFrame((timestamp = Math.min(timestamp + frameDuration, end)))
        await Promise.resolve()
    }
}
