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

    it('starts OOB with outward velocity → never moves further past the boundary', () => {
        // Regression: previously the spring carried the full release velocity
        // including the outward-pointing component, which caused the value
        // to keep moving further past the constraint for ~50–120 ms before
        // the restoring force dominated. Now any outward velocity component
        // is dropped at handoff so the spring engages from the release
        // position and motion is monotonically back toward the boundary.
        // Real-world setup: drag-card clamped at left:-200 by elastic 0.18,
        // released with leftward velocity.
        const step = createInertiaToBoundary(
            { value: -308, velocity: -800 }, // past left bound, still moving left
            { min: -200, max: 200 },
            base
        )
        const start = -308
        let maxOutwardExcess = 0
        for (let t = 0; t <= 200; t += 16) {
            const r = step(t)
            // value should never go LOWER than -308 (further past min)
            const excess = start - r.value
            if (excess > maxOutwardExcess) maxOutwardExcess = excess
        }
        // 1px sub-frame tolerance — but no 17px overshoot like before the fix.
        expect(maxOutwardExcess).toBeLessThanOrEqual(1)
    })

    it('starts OOB with inward velocity → carries the inward velocity into the spring', () => {
        // Symmetric case: when release velocity is *toward* the constraint,
        // it should be preserved so the snap-back is faster than a static
        // release. Without this we'd be over-correcting and dropping useful
        // motion.
        const step = createInertiaToBoundary(
            { value: -308, velocity: 600 }, // past left bound, but moving back right
            { min: -200, max: 200 },
            base
        )
        const slow = createInertiaToBoundary(
            { value: -308, velocity: 0 }, // same start, no velocity
            { min: -200, max: 200 },
            base
        )
        // Sample at 50 ms — the inward-velocity case should be closer to the boundary.
        const fast = step(50).value
        const lazy = slow(50).value
        expect(fast).toBeGreaterThan(lazy)
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
