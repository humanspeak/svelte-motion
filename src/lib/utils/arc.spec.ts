import { arc } from '$lib/utils/arc'
import { createDelta, motionValue, type MotionValue, type VisualElement } from 'motion-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Minimal VisualElement stand-in: just the surface upstream `arc()` and the
 * wrapper read (`getValue`, `latestValues`).
 */
const fakeVisualElement = (current: Record<string, unknown> = {}) => {
    const values = new Map<string, MotionValue<unknown>>()
    for (const [key, value] of Object.entries(current)) {
        values.set(key, motionValue<unknown>(value))
    }
    return {
        latestValues: { ...current },
        getValue: (key: string) => values.get(key)
    } as unknown as VisualElement
}

const run = (
    target: Record<string, unknown>,
    current: Record<string, unknown> = {},
    visualElement: VisualElement = fakeVisualElement(current)
) => {
    const animations: never[] = []
    arc().animateVisualElement(visualElement, target as never, { duration: 0.1 }, 0, animations)
    return { target, animations }
}

describe('arc() wrapper — numeric-endpoint guard', () => {
    let warn: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })
    afterEach(() => {
        warn.mockRestore()
    })

    it.each<[string, Record<string, unknown>]>([
        ['plain numbers', { x: 200, y: 0 }],
        ['keyframe array with a leading wildcard null', { x: [null, 100, 200] }],
        // Upstream reads only the first and last entries; middle keyframes
        // are ignored entirely, so a middle string cannot produce NaN.
        ['string in a MIDDLE keyframe entry', { x: [0, '50px', 100] }]
    ])('delegates %s to upstream (claims x/y, pushes an animation)', (_label, target) => {
        const { target: after, animations } = run({ ...target }, { x: 0, y: 0 })
        // Upstream deletes x/y from the target once it owns them.
        for (const key of Object.keys(target)) expect(key in after).toBe(false)
        expect(animations.length).toBe(1)
        expect(warn).not.toHaveBeenCalled()
    })

    it.each<[string, Record<string, unknown>, Record<string, unknown>]>([
        ['px string target', { x: '100px' }, { x: 0 }],
        ['percent target', { x: '50%' }, { x: 0 }],
        ['css variable target', { y: 'var(--y)' }, { y: 0 }],
        ['string in the LAST keyframe entry', { x: [0, 50, '100px'] }, { x: 0 }],
        ['px string current value', { x: 100 }, { x: '0px' }],
        ['non-finite number', { x: Number.POSITIVE_INFINITY }, { x: 0 }]
    ])('leaves x/y unclaimed and warns for %s', (_label, target, current) => {
        const { target: after, animations } = run({ ...target }, current)
        // Not claimed: animateTarget's keyframe loop animates them straight.
        for (const key of Object.keys(target)) expect(key in after).toBe(true)
        expect(animations.length).toBe(0)
        expect(warn).toHaveBeenCalledTimes(1)
        expect(String(warn.mock.calls[0][0])).toMatch(/arc\(\) requires numeric x\/y/)
    })

    it('also guards a px string reachable only via latestValues', () => {
        // No MotionValue registered — upstream falls back to latestValues.
        const ve = {
            latestValues: { x: '0px' },
            getValue: () => undefined
        } as unknown as VisualElement
        const { target, animations } = run({ x: 100 }, {}, ve)
        expect('x' in target).toBe(true)
        expect(animations.length).toBe(0)
        expect(warn).toHaveBeenCalledTimes(1)
    })

    it('warns once per arc() instance, not once per animation', () => {
        const path = arc()
        const ve = fakeVisualElement({ x: 0 })
        path.animateVisualElement(ve, { x: '10px' }, undefined, 0, [])
        path.animateVisualElement(ve, { x: '20px' }, undefined, 0, [])
        expect(warn).toHaveBeenCalledTimes(1)
    })

    it('is a no-op when neither x nor y is in the target', () => {
        const { target, animations } = run({ opacity: 1 })
        expect('opacity' in target).toBe(true)
        expect(animations.length).toBe(0)
        expect(warn).not.toHaveBeenCalled()
    })

    it('forwards interpolateProjection to upstream (20px floor, then a sampler)', () => {
        const path = arc({ strength: 1 })
        const small = createDelta()
        small.x.translate = 5
        small.y.translate = 5
        expect(path.interpolateProjection(small)).toBeUndefined()

        const large = createDelta()
        large.x.translate = 200
        large.y.translate = 0
        const interpolate = path.interpolateProjection(large)
        expect(typeof interpolate).toBe('function')
        const mid = interpolate!(0.5)
        // From the displaced offset (200, 0) back toward (0, 0), bulging in y.
        expect(mid.x).toBeCloseTo(100)
        expect(Math.abs(mid.y)).toBeGreaterThan(30)
    })
})
