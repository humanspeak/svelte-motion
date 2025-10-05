import type { MotionAnimate, MotionExit, MotionInitial, Variants } from '$lib/types'
import type { DOMKeyframesDefinition } from 'motion'

/**
 * Resolves a variant key to its keyframes definition.
 *
 * Looks up a variant name in the variants object and returns the corresponding
 * keyframes. Returns `undefined` if the variants object or key is not provided.
 *
 * @param variants - The variants object containing named animation states.
 * @param key - The variant key to look up.
 * @returns The keyframes definition for the variant, or undefined if not found.
 *
 * @example
 * ```typescript
 * const variants = {
 *   visible: { opacity: 1 },
 *   hidden: { opacity: 0 }
 * }
 * resolveVariant(variants, 'visible')  // { opacity: 1 }
 * resolveVariant(variants, 'foo')      // undefined
 * resolveVariant(undefined, 'visible') // undefined
 * ```
 */
export const resolveVariant = (
    variants: Variants | undefined,
    key: string | undefined
): DOMKeyframesDefinition | undefined => {
    if (!variants || !key) return undefined
    return variants[key]
}

/**
 * Resolves the initial prop to keyframes, handling variant keys and `initial={false}`.
 *
 * When `initial` is a string, looks it up in the variants object. When `initial={false}`,
 * returns `false` to skip initial animation. Otherwise returns the keyframes directly.
 *
 * @param initial - The initial prop value (keyframes, variant key, false, or undefined).
 * @param variants - The variants object for resolving string keys.
 * @returns Keyframes definition, `false` to skip animation, or undefined.
 *
 * @example
 * ```typescript
 * const variants = { hidden: { opacity: 0 } }
 * resolveInitial('hidden', variants)     // { opacity: 0 }
 * resolveInitial({ x: 0 }, variants)     // { x: 0 }
 * resolveInitial(false, variants)        // false
 * resolveInitial(undefined, variants)    // undefined
 * ```
 */
export const resolveInitial = (
    initial: MotionInitial,
    variants: Variants | undefined
): DOMKeyframesDefinition | false | undefined => {
    if (initial === false) return false
    if (initial === undefined) return undefined
    if (typeof initial === 'string') return resolveVariant(variants, initial)
    return initial as DOMKeyframesDefinition
}

/**
 * Resolves the animate prop to keyframes, handling variant keys.
 *
 * When `animate` is a string, looks it up in the variants object.
 * Otherwise returns the keyframes directly.
 *
 * @param animate - The animate prop value (keyframes, variant key, or undefined).
 * @param variants - The variants object for resolving string keys.
 * @returns Keyframes definition or undefined.
 *
 * @example
 * ```typescript
 * const variants = { visible: { opacity: 1 } }
 * resolveAnimate('visible', variants)       // { opacity: 1 }
 * resolveAnimate({ scale: 1.2 }, variants)  // { scale: 1.2 }
 * resolveAnimate(undefined, variants)       // undefined
 * ```
 */
export const resolveAnimate = (
    animate: MotionAnimate,
    variants: Variants | undefined
): DOMKeyframesDefinition | undefined => {
    if (animate === undefined) return undefined
    if (typeof animate === 'string') return resolveVariant(variants, animate)
    return animate as DOMKeyframesDefinition
}

/**
 * Resolves the exit prop to keyframes, handling variant keys.
 *
 * When `exit` is a string, looks it up in the variants object.
 * Otherwise returns the keyframes directly. Used by AnimatePresence for exit animations.
 *
 * @param exit - The exit prop value (keyframes, variant key, or undefined).
 * @param variants - The variants object for resolving string keys.
 * @returns Keyframes definition or undefined.
 *
 * @example
 * ```typescript
 * const variants = { hidden: { opacity: 0 } }
 * resolveExit('hidden', variants)          // { opacity: 0 }
 * resolveExit({ y: -100 }, variants)       // { y: -100 }
 * resolveExit(undefined, variants)         // undefined
 * ```
 */
export const resolveExit = (
    exit: MotionExit,
    variants: Variants | undefined
): DOMKeyframesDefinition | undefined => {
    if (exit === undefined) return undefined
    if (typeof exit === 'string') return resolveVariant(variants, exit)
    return exit as DOMKeyframesDefinition
}
