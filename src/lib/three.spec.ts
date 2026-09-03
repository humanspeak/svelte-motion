import { threeEffect as threeEffectCore } from 'motion/three'
import { describe, expect, it } from 'vitest'
import { threeEffect } from './three.js'

describe('subpath: three', () => {
    it("is motion/three's threeEffect (pure re-type, no wrapper)", () => {
        expect(threeEffect).toBe(threeEffectCore)
    })
    it('claims Three.js-shaped subjects and nothing else', () => {
        expect(threeEffect.test({ isObject3D: true })).toBe(true)
        expect(threeEffect.test({ isMaterial: true })).toBe(true)
        expect(threeEffect.test({ progress: { value: 0 } })).toBe(true) // uniforms object
        expect(threeEffect.test({ x: 1 })).toBe(false)
    })
})
