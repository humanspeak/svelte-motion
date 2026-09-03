import {
    attrEffect as attrEffectCore,
    createEffect as createEffectCore,
    propEffect as propEffectCore,
    styleEffect as styleEffectCore,
    svgEffect as svgEffectCore,
    type AddEffectValue,
    type EffectOptions,
    type EffectRead,
    type EffectTest,
    type ElementOrSelector,
    type MotionValue
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

type ElementEffect = (subject: ElementOrSelector, values: EffectValues) => VoidFunction

/**
 * An effect built with {@link createEffect}: binds motion values to a subject
 * and returns an unbind function.
 *
 * Identical to motion's `Effect` at runtime, re-typed so the `values` map
 * accepts this library's augmented motion values as well as raw motion-dom
 * ones. Without this widening, `effect(subject, { x: motionValue(0) })` fails
 * to compile even though it is the documented usage.
 *
 * `get` returns whatever was bound, typed as the base `MotionValue`; the
 * Svelte-only members of an augmented value are not re-advertised on the way
 * back out.
 */
export interface Effect<Subject extends object = object> extends EffectOptions<Subject> {
    (subject: Subject, values: EffectValues): VoidFunction
    /** The motion value currently bound to `key` on `subject`, if any. */
    get(subject: Subject, key: string): MotionValue | undefined
}

/**
 * An {@link Effect} that also carries `test` and `read`, making it eligible
 * for `animate.addEffect()` so `animate()` can drive the subjects it claims.
 */
export interface AnimateEffect<Subject extends object = object> extends Effect<Subject> {
    test: EffectTest<Subject>
    read: EffectRead<Subject>
}

/**
 * Build an effect that teaches `animate()` how to drive a non-DOM subject
 * (Motion 13.2). Identical to motion's `createEffect` at runtime — this is a
 * type-level cast, not a wrapper, so `createEffect === motion's createEffect`.
 *
 * The re-type widens the returned effect's `values` map to accept this
 * library's augmented motion values, matching the element effects above.
 * Pass `test` and `read` to get an {@link AnimateEffect} that can be
 * registered with `animate.addEffect()`.
 *
 * @param addValue Binds one key to the subject's shared `MotionValueState`.
 * @param options `test` / `read` to claim subjects for `animate()`, and
 * `step` to choose the frameloop phase writes land in (default `frame.render`;
 * use `frame.preRender` when your own render loop runs in `frame.render`).
 * @returns The effect, callable directly or registered with `animate.addEffect`.
 * @example
 * ```ts
 * import { animate, createEffect, motionValue } from '@humanspeak/svelte-motion'
 *
 * type Dial = { angle: number }
 *
 * const dialEffect = createEffect<Dial>(
 *     (dial, state, key, value) =>
 *         state.set(key, value, () => {
 *             ;(dial as Record<string, number>)[key] = state.latest[key] as number
 *         }, undefined, false),
 *     {
 *         test: (s): s is Dial => typeof s === 'object' && s !== null && 'angle' in s,
 *         read: (dial, key) => (dial as Record<string, number>)[key]
 *     }
 * )
 *
 * // Register once, at module scope — the registry is global.
 * animate.addEffect(dialEffect)
 *
 * // …or bind values yourself, with no cast required.
 * const angle = motionValue(0)
 * const unbind = dialEffect({ angle: 0 }, { angle })
 * ```
 */
export const createEffect = createEffectCore as {
    <Subject extends object>(
        addValue: AddEffectValue<Subject>,
        options: EffectOptions<Subject> & {
            test: EffectTest<Subject>
            read: EffectRead<Subject>
        }
    ): AnimateEffect<Subject>
    <Subject extends object>(
        addValue: AddEffectValue<Subject>,
        options?: EffectOptions<Subject>
    ): Effect<Subject>
} & typeof createEffectCore

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
export const styleEffect: ElementEffect = styleEffectCore as ElementEffect

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
export const attrEffect: ElementEffect = attrEffectCore as ElementEffect

/**
 * Bind motion values to object properties. Identical to motion's
 * `propEffect` at runtime, re-typed to accept augmented values while keeping
 * upstream's `.get(subject, key)` accessor (Motion 13.2).
 *
 * @param subject The target object.
 * @param values Map of property names to motion values.
 * @returns Unbind function.
 * @example
 * ```ts
 * propEffect(audioNode, { volume })
 * ```
 */
export const propEffect = propEffectCore as typeof propEffectCore &
    ((subject: object, values: EffectValues) => VoidFunction)

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
export const svgEffect: ElementEffect = svgEffectCore as ElementEffect
