/**
 * Pins Motion 14.12.0's spring velocity change: springs set with `visualDuration`
 * (and `bounce`) now inherit the velocity of the animation they interrupt, while
 * springs set with `duration` still start from rest so they end exactly on time.
 *
 * Upstream commits: `1287885cd`, `6dbbe7c1e`, `3459c563e`.
 * Ported from upstream tests (v14.12.0):
 * - `packages/motion-dom/src/animation/generators/__tests__/spring.test.ts`
 * - `packages/framer-motion/src/animation/animate/__tests__/spring-velocity.test.ts`
 */
import { motionValue } from 'motion'
import { calcGeneratorDuration, maxGeneratorDuration } from 'motion-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animate, frame, spring } from '../index.js'

const visualDurationOptions = [
    { visualDuration: 0.5, bounce: 0.2 },
    { visualDuration: 0.5, bounce: 0 },
    { visualDuration: 0.5, bounce: -0.5 }
]

const nextFrame = () => new Promise<void>((resolve) => frame.postRender(() => resolve()))

/**
 * The fake clock the frameloop reads. `performance.now` is stubbed to it in
 * `beforeEach`, so every awaited frame lands exactly one 60 fps frame later.
 *
 * motion-dom's frameloop captured `vitest.setup.ts`'s rAF mock (a 0 ms
 * `setTimeout`) at module load, so the `beforeEach` rAF swap below never
 * reaches it. On the real clock, back-to-back frames land about 1 ms apart,
 * and animation time is rounded to whole milliseconds, so frames often sample
 * the same value (and a velocity of 0). The frameloop reads the global
 * `performance.now()` on every batch, so stepping a stubbed clock gives
 * upstream's exact 1000 / 60 ms frames.
 */
let clock = 0

/**
 * Advances the fake clock by one frame per step and waits for that frame.
 *
 * @param count - Number of frames to wait for.
 */
const frames = async (count: number) => {
    for (let i = 0; i < count; i++) {
        clock += 1000 / 60
        await nextFrame()
    }
}

/**
 * Steps frames until `animation` resolves, capped at 600 frames (10 s).
 *
 * @param animation - The playback controls to wait for.
 * @returns Whether the animation finished within the cap.
 */
const finish = async (animation: { then: (onResolve: () => void) => unknown }) => {
    let finished = false
    animation.then(() => (finished = true))
    for (let i = 0; i < 600 && !finished; i++) await frames(1)
    return finished
}

describe('spring velocity (Motion 14.12.0)', () => {
    beforeEach(() => {
        vi.useRealTimers()
        ;(globalThis as never as { requestAnimationFrame: unknown }).requestAnimationFrame = (
            callback: FrameRequestCallback
        ) => setTimeout(() => callback(performance.now()), 16) as unknown as number
        ;(globalThis as never as { cancelAnimationFrame: unknown }).cancelAnimationFrame = (
            id: number
        ) => clearTimeout(id)
        clock = performance.now()
        vi.spyOn(performance, 'now').mockImplementation(() => clock)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('generator', () => {
        it.each(visualDurationOptions)(
            'a visualDuration spring moves ahead of the same spring without velocity %o',
            (spec) => {
                const options = { ...spec, keyframes: [0, 100] }
                const withVelocity = spring({ ...options, velocity: 1000 })
                const withoutVelocity = spring(options)
                expect(withVelocity.next(50).value).toBeGreaterThan(withoutVelocity.next(50).value)
            }
        )

        describe.each(visualDurationOptions)('visualDuration spring %o', (options) => {
            it('starts with the inherited velocity', () => {
                const generator = spring({ ...options, keyframes: [0, 100], velocity: 1000 })
                expect(generator.velocity!(0)).toBeCloseTo(1000, 6)
            })

            it('resolves the same physics with or without velocity', () => {
                // A spring is linear: with velocity = without velocity + velocity only.
                const withVelocity = spring({ ...options, keyframes: [0, 100], velocity: 5000 })
                const withoutVelocity = spring({ ...options, keyframes: [0, 100] })
                const onlyVelocity = spring({ ...options, keyframes: [0, 0], velocity: 5000 })
                for (const t of [16, 50, 100, 200, 400]) {
                    expect(withVelocity.next(t).value).toBeCloseTo(
                        withoutVelocity.next(t).value + onlyVelocity.next(t).value,
                        6
                    )
                }
            })

            it('settles at its target with inherited velocity', () => {
                const generator = spring({ ...options, keyframes: [0, 100], velocity: -3000 })
                const duration = calcGeneratorDuration(generator)
                expect(duration).toBeLessThan(maxGeneratorDuration)
                const lastFrame = generator.next(duration - 10).value
                expect(Math.abs(lastFrame - 100)).toBeLessThan(1)
                expect(generator.next(duration).value).toBe(100)
            })
        })

        it('a duration spring ignores velocity', () => {
            const settings = { keyframes: [500, 10], bounce: 0.2, duration: 800 }
            const withVelocity = spring({ ...settings, velocity: 1000 })
            const withoutVelocity = spring(settings)
            expect(withVelocity.next(0).value).toBe(withoutVelocity.next(0).value)
            expect(withVelocity.next(100).value).toBe(withoutVelocity.next(100).value)
        })

        it('a duration spring keeps its exact duration with velocity', () => {
            const generator = spring({
                keyframes: [0, 100],
                duration: 800,
                bounce: 0.3,
                velocity: 2000
            })
            expect(generator.calculatedDuration).toBe(800)
            expect(generator.next(799).done).toBe(false)
            expect(generator.next(800).done).toBe(true)
        })
    })

    describe('animate()', () => {
        it.each([{ stiffness: 200, damping: 20 }, ...visualDurationOptions])(
            'an interrupted spring inherits velocity %o',
            async (options) => {
                const transition = { type: 'spring' as const, ...options }
                const x = motionValue(0)

                animate(x, 1000, transition)
                await frames(6)

                const before = x.get()
                expect(x.getVelocity()).toBeGreaterThan(0)

                // Reverse mid-flight: momentum keeps it moving toward the old target first.
                const animation = animate(x, 0, transition)
                await frames(1)

                expect(x.get()).toBeGreaterThan(before)
                expect(x.getVelocity()).toBeGreaterThan(0)

                expect(await finish(animation)).toBe(true)
                expect(x.get()).toBe(0)
            }
        )

        it('duration springs start from rest to keep their duration', async () => {
            const transition = { type: 'spring' as const, duration: 0.8 }
            const x = motionValue(0)

            animate(x, 1000, transition)
            await frames(6)
            const before = x.get()

            animate(x, 0, transition)
            await frames(1)
            expect(x.get()).toBeLessThan(before)
        })
    })
})
