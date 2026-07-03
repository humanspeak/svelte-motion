import {
    attrEffect as attrEffectCore,
    propEffect as propEffectCore,
    styleEffect as styleEffectCore,
    svgEffect as svgEffectCore,
    type ElementOrSelector
} from 'motion-dom'
import type { AnyMotionValue } from './transform.svelte.js'

/**
 * Values accepted by the element effects: any motion value this library
 * produces — raw motion-dom values AND the Svelte-augmented values the
 * hooks/factories return. Runtime-identical; the alias exists because
 * upstream's `Record<string, MotionValue>` signature rejects the
 * augmented TYPE (TypeScript's private-field nominal typing), even
 * though the values are the same instances.
 */
export type EffectValues = Record<string, AnyMotionValue<string> | AnyMotionValue<number>>

type Effect = (subject: ElementOrSelector, values: EffectValues) => VoidFunction

/**
 * Bind motion values directly to elements' inline styles — no motion
 * component required. Identical to motion's `styleEffect` at runtime,
 * re-typed to accept this library's augmented values.
 *
 * @param subject Element(s) or a CSS selector.
 * @param values Map of style names to motion values.
 * @returns Unbind function.
 * @example
 * ```ts
 * import { motionValue, styleEffect } from '@humanspeak/svelte-motion'
 *
 * const opacity = motionValue(1)
 * const stop = styleEffect(element, { opacity })
 * ```
 */
export const styleEffect: Effect = styleEffectCore as Effect

/**
 * Bind motion values to element attributes. Identical to motion's
 * `attrEffect` at runtime, re-typed to accept augmented values.
 *
 * @param subject Element(s) or a CSS selector.
 * @param values Map of attribute names to motion values.
 * @returns Unbind function.
 * @example
 * ```ts
 * attrEffect(circle, { r: radius })
 * ```
 */
export const attrEffect: Effect = attrEffectCore as Effect

/**
 * Bind motion values to object properties. Identical to motion's
 * `propEffect` at runtime, re-typed to accept augmented values.
 *
 * @param subject The target object.
 * @param values Map of property names to motion values.
 * @returns Unbind function.
 * @example
 * ```ts
 * propEffect(audioNode, { volume })
 * ```
 */
export const propEffect = propEffectCore as (subject: object, values: EffectValues) => VoidFunction

/**
 * Bind motion values to SVG attributes (with SVG-specific handling).
 * Identical to motion's `svgEffect` at runtime, re-typed to accept
 * augmented values.
 *
 * @param subject SVG element(s) or a CSS selector.
 * @param values Map of attribute names to motion values.
 * @returns Unbind function.
 * @example
 * ```ts
 * svgEffect(path, { pathLength: progress })
 * ```
 */
export const svgEffect: Effect = svgEffectCore as Effect
