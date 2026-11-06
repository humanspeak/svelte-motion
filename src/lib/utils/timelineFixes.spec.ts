/**
 * Regression pins for timeline fixes that arrive with Motion 14.10.1. We call
 * motion's `animate`/`createScopedAnimate` directly, so these fixes come free
 * with the dependency bump; the tests make sure a later bump can't lose them.
 *
 * - `e257e1b0e`: `animate()` recognises a sequence made only of nested
 *   `{ sequence, at }` objects. Upstream test:
 *   `packages/framer-motion/src/animation/animate/__tests__/animate.test.tsx`
 *   "animates a sequence made only of nested sequences".
 * - `a90c0532f`: a timeline re-registers with its `useAnimate` scope each time
 *   it gets a new `finished`, so a replayed timeline is stopped on unmount.
 *   Upstream test:
 *   `packages/framer-motion/src/animation/hooks/__tests__/use-animate.test.tsx`
 *   "Stops an animation played again after finishing on unmount".
 * - `4cf2f4a01`: timeline `call()` callbacks no longer fire extra times when a
 *   frame lands on a repeat boundary. Upstream test:
 *   `packages/framer-motion/src/animation/timeline/__tests__/repeat-frames.test.ts`
 *   "a frame on a repeat boundary doesn't fire callbacks extra".
 */
import { motionValue } from 'motion'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MotionGlobalConfig, animate, processFrame } from '../index.js'
import { useAnimate } from './animate.svelte.js'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('Motion 14.10.1 timeline fixes', () => {
    beforeEach(() => {
        vi.useRealTimers()
        ;(globalThis as never as { requestAnimationFrame: unknown }).requestAnimationFrame = (
            callback: FrameRequestCallback
        ) => setTimeout(() => callback(performance.now()), 16) as unknown as number
        ;(globalThis as never as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (
            id: number
        ) => clearTimeout(id)
    })

    it('animates a sequence made only of nested sequences', async () => {
        const a = motionValue(0)
        const b = motionValue(0)
        const animation = animate(
            [
                { sequence: [[a, 100, { duration: 0.05 }]] },
                { sequence: [[b, 100, { duration: 0.05 }]], at: 0.1 }
            ],
            { autoplay: false }
        )

        // `Timeline` is a type-only export of motion, so check its shape.
        expect(typeof animation.add).toBe('function')
        expect(animation.duration).toBeCloseTo(0.15)
        animation.play()
        await animation
        expect(a.get()).toBe(100)
        expect(b.get()).toBe(100)

        const [, scopedAnimate] = useAnimate()
        const c = motionValue(0)
        const d = motionValue(0)
        await scopedAnimate([
            { sequence: [[c, 100, { duration: 0.05 }]] },
            { sequence: [[d, 100, { duration: 0.05 }]], at: 0.1 }
        ])
        expect(c.get()).toBe(100)
        expect(d.get()).toBe(100)
    })

    it('useAnimate stops a timeline played again after finishing when the scope detaches', async () => {
        const x = motionValue(0)
        const [scope, scopedAnimate] = useAnimate()
        const detach = scope(document.createElement('div'))

        const tl = scopedAnimate(x, 100, { duration: 0.05 })
        await tl
        expect(x.get()).toBe(100)

        tl.time = 0
        tl.play()
        await sleep(20)

        detach()
        const stopped = x.get()
        await sleep(150)
        expect(x.get()).toBe(stopped)
        expect(x.get()).toBeLessThan(100)
    })
})

describe('Motion 14.10.1 timeline repeats with frames at chosen times', () => {
    let start = 0
    const nextStart = () => (start += 10000)

    /**
     * Create a timeline at `start` ms, then process a frame at each of `times`.
     * Ported from upstream's `repeat-frames.test.ts` `run()` helper, building
     * the timeline through our `animate()` instead of `new Timeline(...)`.
     */
    async function run(
        options: object,
        times: number[],
        setup: (tl: ReturnType<typeof animate>) => void,
        startAt = 0
    ) {
        processFrame(startAt)
        const v = motionValue(0)
        const tl = animate([[v, 100, { duration: 0.1 }]], {
            defaultTransition: { ease: 'linear' },
            ...options
        })
        setup(tl)
        // The timeline builds in a microtask
        await Promise.resolve()
        times.forEach((t) => processFrame(startAt + t))
        // Not tl itself, which is thenable
        return { tl }
    }

    beforeEach(() => {
        // requestAnimationFrame never fires, so only processFrame() runs frames
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0)
        MotionGlobalConfig.useManualTiming = true
    })

    afterEach(() => {
        MotionGlobalConfig.useManualTiming = false
        vi.restoreAllMocks()
    })

    it("a frame on a repeat boundary doesn't fire timeline callbacks extra", async () => {
        const callback = vi.fn()
        await run(
            { repeat: 2 },
            [0, 30, 100, 120, 200, 220, 300, 320],
            (tl) => {
                tl.call(callback, 0.05)
            },
            nextStart()
        )

        expect(callback.mock.calls).toEqual([[1], [1], [1]])
    })
})
