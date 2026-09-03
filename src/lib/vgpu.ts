import { vgpuEffect as vgpuEffectCore } from 'motion/vgpu'
import type { EffectValues } from './utils/effects.js'

export type { VGPUEffectValues } from 'motion/vgpu'

/**
 * Motion 13.2's vgpu adapter, re-typed to accept this library's augmented
 * motion values. Identical to `motion/vgpu`'s `vgpuEffect` at runtime.
 *
 * Targets vgpu shared uniforms, `Effect`/`Draw`/`Compute` bindings such as
 * `"params.time"`, scene nodes, cameras, lights, materials and orbit controls.
 * Register it once with `animate.addEffect(vgpuEffect)` so `animate()` can
 * target these subjects directly, or bind values manually with `vgpuEffect`.
 * Writes land in `frame.preRender`, ahead of render loops scheduled with
 * `frame.render`. `vgpu` itself is the consumer's dependency and is pre-1.0.
 * Rotation shorthands are in degrees, like DOM `rotate`.
 *
 * @example
 * ```ts
 * import { animate } from '@humanspeak/svelte-motion'
 * import { vgpuEffect } from '@humanspeak/svelte-motion/vgpu'
 *
 * animate.addEffect(vgpuEffect)
 * animate(cube, { rotateY: 360 }, { duration: 2 })
 * ```
 */
export const vgpuEffect = vgpuEffectCore as typeof vgpuEffectCore &
    ((subject: object, values: EffectValues) => VoidFunction)
