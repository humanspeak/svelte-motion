import type { MotionAnimate, MotionExit, MotionInitial, Variants } from '$lib/types'
import type { DOMKeyframesDefinition } from 'motion'

/**
 * Retrieve a keyframe definition by name from a variants collection.
 *
 * @param variants - Optional map of variant names to keyframe definitions
 * @param key - The variant name to resolve
 * @returns The corresponding `DOMKeyframesDefinition` if found, or `undefined` otherwise
 */
export function resolveVariant(
    variants: Variants | undefined,
    key: string | undefined
): DOMKeyframesDefinition | undefined {
    if (!variants || !key) return undefined
    return variants[key]
}

/**
 * Determine the initial animation target from a MotionInitial value.
 *
 * Resolves `initial` to an animation keyframes definition when possible.
 *
 * @param initial - The initial motion state; may be `false`, `undefined`, a string key, or a keyframes definition.
 * @param variants - Optional map of named variant keyframes used to resolve string `initial` values.
 * @returns `false` if `initial` is exactly `false`; `undefined` if `initial` is `undefined`; otherwise the resolved `DOMKeyframesDefinition` (if `initial` is a string the result is looked up in `variants`, otherwise `initial` is returned as a keyframes definition)
 */
export function resolveInitial(
    initial: MotionInitial,
    variants: Variants | undefined
): DOMKeyframesDefinition | false | undefined {
    if (initial === false) return false
    if (initial === undefined) return undefined
    if (typeof initial === 'string') return resolveVariant(variants, initial)
    return initial as DOMKeyframesDefinition
}

/**
 * Resolve an animate target into a keyframes definition, resolving string keys via the provided variants.
 *
 * @param animate - The animation target; if a string, it is treated as a key into `variants`, otherwise it is used as a keyframes definition.
 * @param variants - Optional map of variant keyframes used when `animate` is a string.
 * @returns The resolved `DOMKeyframesDefinition` when available, or `undefined` if `animate` is `undefined` or the key cannot be resolved.
 */
export function resolveAnimate(
    animate: MotionAnimate,
    variants: Variants | undefined
): DOMKeyframesDefinition | undefined {
    if (animate === undefined) return undefined
    if (typeof animate === 'string') return resolveVariant(variants, animate)
    return animate as DOMKeyframesDefinition
}

/**
 * Resolve an exit animation target to a DOM keyframes definition.
 *
 * @param exit - The exit animation target, either a variant key, a keyframes definition, or `undefined`
 * @param variants - Optional map of variant definitions used when `exit` is a variant key
 * @returns The resolved `DOMKeyframesDefinition`, or `undefined` if `exit` is `undefined` or the variant is not found
 */
export function resolveExit(
    exit: MotionExit,
    variants: Variants | undefined
): DOMKeyframesDefinition | undefined {
    if (exit === undefined) return undefined
    if (typeof exit === 'string') return resolveVariant(variants, exit)
    return exit as DOMKeyframesDefinition
}