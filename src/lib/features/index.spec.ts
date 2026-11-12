import { PinchGestureFeature } from '$lib/utils/pinchFeature'
import { describe, expect, it } from 'vitest'
import { domAnimation } from './domAnimation'
import { domMax } from './domMax'
import { domMin } from './domMin'
import { isLazyFeatureBundle, normalizeLazyFeatureBundle } from './index'
import { pinchFeatures } from './pinchFeatures'

describe('LazyMotion feature helpers', () => {
    it('detects async lazy feature bundles', () => {
        const loadFeatures = () => Promise.resolve(domAnimation)

        expect(isLazyFeatureBundle(loadFeatures)).toBe(true)
        expect(isLazyFeatureBundle(domMin)).toBe(false)
    })

    it('returns direct feature bundles unchanged', () => {
        expect(normalizeLazyFeatureBundle(domAnimation)).toBe(domAnimation)
    })

    it('unwraps default-exported feature bundles', () => {
        expect(normalizeLazyFeatureBundle({ default: domAnimation })).toBe(domAnimation)
    })
})

describe('pinchFeatures', () => {
    it('carries the pinch gesture feature', () => {
        expect(pinchFeatures.pinch?.Feature).toBe(PinchGestureFeature)
    })

    it('combines with domMax', () => {
        const combined = { ...domMax, ...pinchFeatures }

        expect(combined.drag).toBe(true)
        expect(combined.layout).toBe(true)
        expect(combined.gestures).toBe(true)
        expect(combined.animations).toBe(true)
        expect(combined.pinch).toBe(pinchFeatures.pinch)
    })

    it('is not part of domMax', () => {
        expect('pinch' in domMax).toBe(false)
    })
})
