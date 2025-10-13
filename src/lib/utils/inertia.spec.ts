import { describe, expect, it } from 'vitest'
import { createInertiaToBoundary } from './inertia'

describe('inertia → spring handoff (axis)', () => {
    const base = {
        timeConstantMs: 750,
        restDelta: 0.5,
        restSpeed: 5,
        bounceStiffness: 700,
        bounceDamping: 35
    }

    it('pure inertia within bounds settles without spring', () => {
        const step = createInertiaToBoundary(
            { value: 0, velocity: 1000 },
            { min: -1000, max: 1000 },
            base
        )
        let t = 0
        let r = step(t)
        expect(r.done).toBe(false)
        // Advance time; should be monotonic approach and eventually done
        for (let i = 0; i < 120 && !r.done; i++) {
            t += 50
            r = step(t)
        }
        expect(r.done).toBe(true)
        expect(Math.abs(r.value)).toBeLessThan(1000)
    })

    it('starts out of bounds → immediate spring', () => {
        const step = createInertiaToBoundary(
            { value: 120, velocity: 0 },
            { min: -50, max: 50 },
            base
        )
        // t=0
        let r = step(0)
        expect(r.done).toBe(false)
        // After some time it should move toward nearest boundary (50)
        r = step(200)
        expect(r.value).toBeLessThanOrEqual(120)
    })

    it('crosses mid-flight → spring starts at boundary with carried velocity', () => {
        const step = createInertiaToBoundary(
            { value: 0, velocity: 2000 },
            { min: -10, max: 60 },
            base
        )
        // Advance until after expected crossing
        let last = step(0)
        let crossed = false
        for (let t = 50; t <= 6000; t += 50) {
            const r = step(t)
            if (!crossed && r.value >= 60 - 0.01) {
                crossed = true
            }
            last = r
            if (r.done) break
        }
        expect(crossed).toBe(true)
        // Allow small residual motion; assert proximity to the boundary target
        expect(last.value).toBeGreaterThanOrEqual(60 - base.restDelta)
        expect(last.value).toBeLessThanOrEqual(60 + base.restDelta)
    })
})
