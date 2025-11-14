import { describe, expect, it } from 'vitest'
import { deriveBoundaryPhysics } from './dragParams'

describe('deriveBoundaryPhysics', () => {
    it('uses 200/40 when elastic > 0 and no overrides', () => {
        const p = deriveBoundaryPhysics(0.5)
        expect(p.bounceStiffness).toBe(200)
        expect(p.bounceDamping).toBe(40)
        expect(p.timeConstantMs).toBe(750)
        expect(p.restDelta).toBe(1)
        expect(p.restSpeed).toBe(10)
    })

    it('overdamps when elastic is 0/false', () => {
        const p = deriveBoundaryPhysics(0)
        expect(p.bounceStiffness).toBe(1_000_000)
        expect(p.bounceDamping).toBe(10_000_000)
    })

    it('applies transition overrides', () => {
        const p = deriveBoundaryPhysics(0.5, {
            bounceStiffness: 500,
            bounceDamping: 25,
            timeConstant: 1.2,
            restDelta: 2,
            restSpeed: 5
        })
        expect(p.bounceStiffness).toBe(500)
        expect(p.bounceDamping).toBe(25)
        expect(p.timeConstantMs).toBeCloseTo(1200, 5)
        expect(p.restDelta).toBe(2)
        expect(p.restSpeed).toBe(5)
    })
})
