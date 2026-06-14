import { inertia } from 'motion-dom'
import { describe, expect, it } from 'vitest'
import { createDragInertiaGenerator, createDragInertiaOptions } from './dragInertia'

describe('drag inertia', () => {
    it('uses upstream Motion inertia when no drag defaults are supplied', () => {
        const options = createDragInertiaOptions({ value: 10, velocity: 500 })

        expect(options.type).toBe(inertia)
        expect(options.keyframes).toEqual([10, 10])
        expect(options.velocity).toBe(500)
        expect(options.power).toBeUndefined()
        expect(options.timeConstant).toBeUndefined()
        expect(options.bounceStiffness).toBeUndefined()
        expect(options.bounceDamping).toBeUndefined()
        expect(options.restDelta).toBeUndefined()
        expect(options.restSpeed).toBeUndefined()
    })

    it('passes upstream inertia options through without unit conversion', () => {
        const modifyTarget = (target: number) => Math.round(target / 50) * 50
        const options = createDragInertiaOptions({
            value: 5,
            velocity: 300,
            power: 0.4,
            timeConstant: 1200,
            bounceStiffness: 250,
            bounceDamping: 18,
            restDelta: 0.25,
            restSpeed: 3,
            min: -10,
            max: 120,
            modifyTarget
        })

        expect(options.power).toBe(0.4)
        expect(options.timeConstant).toBe(1200)
        expect(options.bounceStiffness).toBe(250)
        expect(options.bounceDamping).toBe(18)
        expect(options.restDelta).toBe(0.25)
        expect(options.restSpeed).toBe(3)
        expect(options.min).toBe(-10)
        expect(options.max).toBe(120)
        expect(options.modifyTarget).toBe(modifyTarget)
    })

    it('samples identically to motion-dom inertia for constrained bounce', () => {
        const base = {
            value: 20,
            velocity: 1200,
            power: 0.8,
            timeConstant: 750,
            bounceStiffness: 500,
            bounceDamping: 10,
            restDelta: 1,
            restSpeed: 10,
            min: -50,
            max: 100
        }
        const wrapped = createDragInertiaGenerator(base)
        const upstream = inertia({
            ...createDragInertiaOptions(base),
            keyframes: [base.value, base.value]
        })

        for (const t of [0, 16, 80, 160, 320, 640, 1200]) {
            expect(wrapped.next(t).value).toBeCloseTo(upstream.next(t).value, 8)
        }
    })
})
