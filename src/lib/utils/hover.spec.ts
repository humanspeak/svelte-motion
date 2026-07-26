import { describe, expect, it } from 'vitest'
import { readTransformChannels } from './hover.js'

describe('utils/hover readTransformChannels', () => {
    const withTransform = (transform: string): HTMLElement => {
        const el = document.createElement('div')
        Object.defineProperty(window, 'getComputedStyle', {
            value: () => ({ transform }),
            configurable: true
        })
        return el
    }

    it('returns identity values for an untransformed element', () => {
        expect(readTransformChannels(withTransform('none'))).toEqual({
            scale: 1,
            x: 0,
            y: 0,
            rotate: 0
        })
        expect(readTransformChannels(withTransform(''))).toEqual({
            scale: 1,
            x: 0,
            y: 0,
            rotate: 0
        })
    })

    it('reads translate-only from matrix e/f', () => {
        // matrix(1, 0, 0, 1, 30, -20) — pure translate.
        const channels = readTransformChannels(withTransform('matrix(1, 0, 0, 1, 30, -20)'))
        expect(channels).not.toBeNull()
        expect(channels?.x).toBeCloseTo(30, 5)
        expect(channels?.y).toBeCloseTo(-20, 5)
        expect(channels?.scale).toBeCloseTo(1, 5)
        expect(channels?.rotate).toBeCloseTo(0, 5)
    })

    it('decomposes a combined rotate + uniform scale', () => {
        // rotate(90deg) scale(2) → matrix(0, 2, -2, 0, 0, 0):
        //   a = 2*cos(90) = 0, b = 2*sin(90) = 2, c = -2*sin(90) = -2, d = 0.
        const channels = readTransformChannels(withTransform('matrix(0, 2, -2, 0, 0, 0)'))
        expect(channels).not.toBeNull()
        expect(channels?.scale).toBeCloseTo(2, 5)
        expect(channels?.rotate).toBeCloseTo(90, 5)
        expect(channels?.x).toBeCloseTo(0, 5)
        expect(channels?.y).toBeCloseTo(0, 5)
    })

    it('reports a negative rotation with the browser sign convention', () => {
        // rotate(-30deg): a = cos(-30) ≈ 0.866, b = sin(-30) = -0.5.
        const channels = readTransformChannels(
            withTransform('matrix(0.866, -0.5, 0.5, 0.866, 0, 0)')
        )
        expect(channels?.rotate).toBeCloseTo(-30, 2)
    })

    it('returns null for a 3D matrix (out of scope)', () => {
        expect(
            readTransformChannels(
                withTransform('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)')
            )
        ).toBeNull()
    })
})
