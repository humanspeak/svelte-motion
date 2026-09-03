import { threeEffect as threeEffectCore } from 'motion/three'
import type { EffectValues } from './utils/effects.js'

export type { ThreeEffectValues, ThreeUniform, ThreeUniforms } from 'motion/three'

/**
 * Motion 13.2's Three.js adapter, re-typed to accept this library's augmented
 * motion values. Identical to `motion/three`'s `threeEffect` at runtime.
 *
 * Claims `Object3D`s, materials and uniforms objects (`{ key: { value } }`).
 * Register it once with `animate.addEffect(threeEffect)` so `animate(mesh,
 * { x: 2, rotateY: 180 })` works, or bind values manually with
 * `threeEffect(mesh, { x, rotateY })`. Writes land in `frame.preRender`,
 * ahead of render loops scheduled with `frame.render`. `three` itself is the
 * consumer's dependency — this module never imports it.
 * Rotation shorthands are in degrees, like DOM `rotate`.
 *
 * @example
 * ```ts
 * import { animate } from '@humanspeak/svelte-motion'
 * import { threeEffect } from '@humanspeak/svelte-motion/three'
 *
 * animate.addEffect(threeEffect)
 * animate(mesh, { rotateY: 360 }, { duration: 2 })
 * ```
 */
export const threeEffect = threeEffectCore as typeof threeEffectCore &
    ((subject: object, values: EffectValues) => VoidFunction)
