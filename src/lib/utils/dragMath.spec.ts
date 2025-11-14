import { describe, expect, it } from 'vitest'
import { applyConstraints, mixNumber } from './dragMath'

describe('dragMath', () => {
    it('mixNumber preserves float precision', () => {
        const v = mixNumber(0, 1, 0.305)
        expect(v).toBeCloseTo(0.305, 6)
    })

    it('applyConstraints returns value when within range', () => {
        expect(applyConstraints(10.25, { min: -5.5, max: 20.75 })).toBeCloseTo(10.25, 6)
    })

    it('applyConstraints clamps below min when no elastic', () => {
        expect(applyConstraints(-6.1, { min: -5.5, max: 20.75 })).toBeCloseTo(-5.5, 6)
    })

    it('applyConstraints clamps above max when no elastic', () => {
        expect(applyConstraints(21.2, { min: -5.5, max: 20.75 })).toBeCloseTo(20.75, 6)
    })

    it('applyConstraints mixes towards min when below and elastic provided', () => {
        const v = applyConstraints(-10, { min: -5, max: 5 }, 0.5)
        // mix(-5, -10, 0.5) = -7.5
        expect(v).toBeCloseTo(-7.5, 6)
    })

    it('applyConstraints mixes towards max when above and elastic provided', () => {
        const v = applyConstraints(12, { min: -5, max: 5 }, 0.25)
        // mix(5, 12, 0.25) = 6.75
        expect(v).toBeCloseTo(6.75, 6)
    })
})
