import type { Box } from '$lib/utils/projection'
import { describe, expect, it } from 'vitest'
import { detectAxis } from './detectAxis'

const box = (xMin: number, xMax: number, yMin: number, yMax: number): Box => ({
    x: { min: xMin, max: xMax },
    y: { min: yMin, max: yMax }
})

describe('detectAxis', () => {
    it('defaults to y with zero or one measured item', () => {
        expect(detectAxis([])).toBe('y')
        expect(detectAxis([box(0, 100, 0, 100)])).toBe('y')
    })

    it('keeps the safe y default while boxes have no measurable size', () => {
        expect(detectAxis([box(0, 0, 0, 0), box(0, 0, 0, 0)])).toBe('y')
    })

    it('detects a vertical stack', () => {
        expect(detectAxis([box(0, 100, 0, 100), box(0, 100, 110, 210)])).toBe('y')
    })

    it('detects a horizontal row', () => {
        expect(detectAxis([box(0, 100, 0, 100), box(110, 210, 0, 100)])).toBe('x')
    })

    it('detects wrapped and multidimensional layouts', () => {
        expect(
            detectAxis([box(0, 100, 0, 100), box(110, 210, 0, 100), box(0, 100, 110, 210)])
        ).toBe('xy')
    })

    it('detects overlapping layouts as y until separation appears', () => {
        expect(detectAxis([box(0, 100, 0, 100), box(10, 90, 10, 90)])).toBe('y')
    })

    it('treats boundary-touching boxes as separated', () => {
        expect(detectAxis([box(0, 100, 0, 100), box(100, 200, 0, 100)])).toBe('x')
        expect(detectAxis([box(0, 100, 0, 100), box(0, 100, 100, 200)])).toBe('y')
        expect(
            detectAxis([box(0, 100, 0, 100), box(100, 200, 0, 100), box(0, 100, 100, 200)])
        ).toBe('xy')
    })
})
