import { arc } from '$lib/utils/arc'
import { createDelta, motionValue, type MotionValue, type VisualElement } from 'motion-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Minimal VisualElement stand-in: just the surface upstream `arc()` and the
 * wrapper read (`getValue`, `latestValues`).
 */
const fakeVisualElement = (current: Record<string, unknown> = {}, latestOnly = false) => {
    const values = new Map<string, MotionValue<unknown>>()
    if (!latestOnly) {
        for (const [key, value] of Object.entries(current)) {
            values.set(key, motionValue<unknown>(value))
        }
    }
    const ve = {
        latestValues: { ...current },
        getValue: (key: string, defaultValue?: unknown) => {
            if (!values.has(key) && defaultValue !== undefined) {
                values.set(key, motionValue<unknown>(defaultValue))
            }
            return values.get(key)
        }
    }
    return ve as unknown as VisualElement
}

const run = (
    target: Record<string, unknown>,
    current: Record<string, unknown> = {},
    options?: Parameters<typeof arc>[0],
    latestOnly = false
) => {
    const path = arc(options)
    const animations: never[] = []
    const ve = fakeVisualElement(current, latestOnly)
    path.animateVisualElement(ve, target as never, { duration: 0.1 }, 0, animations)
    return { target, animations, ve, path }
}

describe('arc() wrapper — numeric-endpoint guard', () => {
    let warn: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    })
    afterEach(() => {
        warn.mockRestore()
    })

    it('delegates numeric endpoints to upstream (claims x/y, pushes an animation)', () => {
        const { target, animations } = run({ x: 200, y: 0 }, { x: 0, y: 0 })
        // Upstream deletes x/y from the target once it owns them.
        expect('x' in target).toBe(false)
        expect('y' in target).toBe(false)
        expect(animations.length).toBe(1)
        expect(warn).not.toHaveBeenCalled()
    })

    it('accepts keyframe arrays with a leading wildcard null', () => {
        const { target } = run({ x: [null, 100, 200] }, { x: 0 })
        expect('x' in target).toBe(false)
        expect(warn).not.toHaveBeenCalled()
    })

    it.each<[string, Record<string, unknown>, Record<string, unknown>, boolean]>([
        ['px string target', { x: '100px' }, { x: 0 }, false],
        ['percent target', { x: '50%' }, { x: 0 }, false],
        ['css variable target', { y: 'var(--y)' }, { y: 0 }, false],
        ['string inside keyframe array', { x: [0, '50px', 100] }, { x: 0 }, false],
        ['px string current value', { x: 100 }, { x: '0px' }, false],
        ['px string in latestValues only', { x: 100 }, { x: '0px' }, true],
        ['non-finite number', { x: Number.POSITIVE_INFINITY }, { x: 0 }, false]
    ])('leaves x/y unclaimed and warns for %s', (_label, target, current, latestOnly) => {
        const { target: after, animations } = run({ ...target }, current, undefined, latestOnly)
        // Not claimed: animateTarget's keyframe loop animates them straight.
        for (const key of Object.keys(target)) expect(key in after).toBe(true)
        expect(animations.length).toBe(0)
        expect(warn).toHaveBeenCalledTimes(1)
        expect(String(warn.mock.calls[0][0])).toMatch(/arc\(\) requires numeric x\/y/)
    })

    it('warns once per arc() instance, not once per animation', () => {
        const path = arc()
        const ve = fakeVisualElement({ x: 0 })
        path.animateVisualElement(ve, { x: '10px' }, undefined, 0, [])
        path.animateVisualElement(ve, { x: '20px' }, undefined, 0, [])
        expect(warn).toHaveBeenCalledTimes(1)
    })

    it('is a no-op when neither x nor y is in the target', () => {
        const { target, animations } = run({ opacity: 1 }, {})
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
