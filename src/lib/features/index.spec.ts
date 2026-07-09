import { describe, expect, it } from 'vitest'
import { domAnimation } from './domAnimation'
import { domMin } from './domMin'
import { isLazyFeatureBundle, normalizeLazyFeatureBundle } from './index'

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
