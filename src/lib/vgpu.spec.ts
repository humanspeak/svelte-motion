import { vgpuEffect as vgpuEffectCore } from 'motion/vgpu'
import { describe, expect, it } from 'vitest'
import { vgpuEffect } from './vgpu.js'

describe('subpath: vgpu', () => {
    it("is motion/vgpu's vgpuEffect (pure re-type, no wrapper)", () => {
        expect(vgpuEffect).toBe(vgpuEffectCore)
    })
    it('exposes its subject claim test', () => {
        expect(typeof vgpuEffect.test).toBe('function')
    })
})
