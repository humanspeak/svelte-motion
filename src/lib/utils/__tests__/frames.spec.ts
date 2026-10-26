import { MotionGlobalConfig, animate } from 'motion'
import { cancelFrame, frame, frameData, motionValue } from 'motion-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { stepFrames, withManualFrames } from './frames.js'

describe('utils/__tests__/frames', () => {
    afterEach(() => {
        MotionGlobalConfig.useManualTiming = false
    })

    it('stepFrames processes a frame per frameDuration and lands on the end time', async () => {
        const start = frameData.timestamp
        const seen: number[] = []
        const cb = () => {
            seen.push(frameData.timestamp)
        }
        frame.update(cb, true)

        await stepFrames(100, 25)
        cancelFrame(cb)

        expect(seen).toHaveLength(4)
        expect(seen[seen.length - 1]).toBe(start + 100)
    })

    it('stepFrames lets promises settle between frames', async () => {
        let secondRan = false
        frame.update(() => {
            void Promise.resolve().then(() => {
                frame.update(() => {
                    secondRan = true
                })
            })
        })

        await stepFrames(50, 1000 / 60)

        expect(secondRan).toBe(true)
    })

    describe('with a manual clock from the start', () => {
        withManualFrames()

        it('stepFrames drives a JS animation to completion', async () => {
            const value = motionValue(0)
            animate(value, 100, { duration: 0.2, ease: 'linear' })

            await stepFrames(100)
            expect(Math.abs(value.get() - 50)).toBeLessThanOrEqual(1)

            await stepFrames(150)
            expect(value.get()).toBe(100)
        })
    })

    describe('withManualFrames block', () => {
        withManualFrames()

        it('withManualFrames turns manual timing on inside the block', () => {
            expect(MotionGlobalConfig.useManualTiming).toBe(true)
        })
    })

    it('withManualFrames turns manual timing off after the block', () => {
        expect(MotionGlobalConfig.useManualTiming).toBe(false)
    })
})
