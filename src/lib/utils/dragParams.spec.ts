import { describe, expect, it } from 'vitest'
import { deriveBoundaryPhysics } from './dragParams'

describe('deriveBoundaryPhysics', () => {
    it('uses Framer drag defaults when elastic is enabled', () => {
        const p = deriveBoundaryPhysics(0.5)
        expect(p.power).toBe(0.8)
        expect(p.bounceStiffness).toBe(200)
        expect(p.bounceDamping).toBe(40)
        expect(p.timeConstant).toBe(750)
        expect(p.restDelta).toBe(1)
        expect(p.restSpeed).toBe(10)
    })

    it('overdamps the boundary spring when elastic is 0', () => {
        const p = deriveBoundaryPhysics(0)
        expect(p.bounceStiffness).toBe(1_000_000)
        expect(p.bounceDamping).toBe(10_000_000)
    })

    it('applies transition overrides', () => {
        const p = deriveBoundaryPhysics(0.5, {
            power: 0.4,
            bounceStiffness: 500,
            bounceDamping: 25,
            timeConstant: 1200,
            restDelta: 2,
            restSpeed: 5
        })
        expect(p.power).toBe(0.4)
        expect(p.bounceStiffness).toBe(500)
        expect(p.bounceDamping).toBe(25)
        expect(p.timeConstant).toBe(1200)
        expect(p.restDelta).toBe(2)
        expect(p.restSpeed).toBe(5)
    })
})
