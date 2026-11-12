import { getFeatureDefinitions, motionValue } from 'motion-dom'
import { describe, expect, it } from 'vitest'
import {
    isPinchFeatureEnabled,
    loadPinchFeature,
    PinchGestureFeature,
    resolvePinchTouchAction
} from './pinchFeature'

describe('resolvePinchTouchAction', () => {
    it('defaults to none without a style', () => {
        expect(resolvePinchTouchAction(undefined)).toBe('none')
    })

    it('defaults to none when a string style sets no touch-action', () => {
        expect(resolvePinchTouchAction('color: red')).toBe('none')
    })

    it("keeps a string style's touch-action", () => {
        expect(resolvePinchTouchAction('touch-action: pan-y; color: red')).toBe('pan-y')
    })

    it("keeps an object style's touchAction", () => {
        expect(resolvePinchTouchAction({ touchAction: 'pan-y' })).toBe('pan-y')
    })

    it("keeps an object style's touch-action", () => {
        expect(resolvePinchTouchAction({ 'touch-action': 'pan-x' })).toBe('pan-x')
    })

    it('defaults to none when an object style sets no touch-action', () => {
        expect(resolvePinchTouchAction({ scale: motionValue(1) })).toBe('none')
    })
})

describe('isPinchFeatureEnabled', () => {
    it('is enabled by pinch or pinch options', () => {
        expect(isPinchFeatureEnabled({ pinch: true })).toBe(true)
        expect(isPinchFeatureEnabled({ pinch: {} })).toBe(true)
    })

    it('is disabled without pinch or with pinch={false}', () => {
        expect(isPinchFeatureEnabled({})).toBe(false)
        expect(isPinchFeatureEnabled({ pinch: false })).toBe(false)
    })
})

describe('loadPinchFeature', () => {
    it('registers the definition and keeps the other entries', () => {
        const before = getFeatureDefinitions()
        const definition = {
            Feature: PinchGestureFeature as never,
            isEnabled: isPinchFeatureEnabled
        }

        loadPinchFeature(definition)

        const after = getFeatureDefinitions()
        expect(after.pinch).toBe(definition)
        for (const key of Object.keys(before) as (keyof typeof before)[]) {
            if (key === 'pinch') continue
            expect(after[key]).toBe(before[key])
        }
    })

    it('is harmless to call twice', () => {
        const definition = {
            Feature: PinchGestureFeature as never,
            isEnabled: isPinchFeatureEnabled
        }

        loadPinchFeature(definition)
        const once = getFeatureDefinitions()
        loadPinchFeature(definition)
        const twice = getFeatureDefinitions()

        expect(twice.pinch).toBe(definition)
        expect(twice).toEqual(once)
    })
})
