import type { MotionAnimate, MotionExit, MotionInitial, Variants } from '$lib/types'
import type { DOMKeyframesDefinition } from 'motion'

/**
 * Resolves a variant key to its keyframes definition.
 *
 * Looks up `key` in `variants`. When the entry is a function (dynamic
 * variant), it's invoked with `custom` to produce keyframes — matching
 * framer-motion's per-instance variant pattern.
 *
 * @param variants - The variants object containing named animation states.
 * @param key - The variant key to look up.
 * @param custom - Value forwarded to function-form variants. Pass-through
 *     `undefined` when no `custom` is in scope; the dynamic variant itself
 *     decides how to handle the absent input.
 * @returns The keyframes definition for the variant, or `undefined` if the
 *     key is missing.
 *
 * @example
 * ```ts
 * const variants = {
 *   visible: (i: number) => ({ x: i * 50 }),
 *   hidden:  { opacity: 0 }
 * }
 * resolveVariant(variants, 'visible', 3)  // { x: 150 }
 * resolveVariant(variants, 'hidden')      // { opacity: 0 }
 * resolveVariant(undefined, 'visible')    // undefined
 * ```
 */
export const resolveVariant = (
    variants: Variants | undefined,
    key: string | undefined,
    custom?: unknown
): DOMKeyframesDefinition | undefined => {
    if (!variants || !key) return undefined
    const entry = variants[key]
    if (typeof entry === 'function') return entry(custom)
    return entry
}

/**
 * Resolves the initial prop to keyframes, handling variant keys and `initial={false}`.
 *
 * When `initial` is a string, looks it up in the variants object (invoking
 * dynamic variants with `custom`). When `initial={false}`, returns `false` to
 * skip the initial animation. Otherwise returns the keyframes directly.
 *
 * @param initial - The initial prop value (keyframes, variant key, false, or undefined).
 * @param variants - The variants object for resolving string keys.
 * @param custom - Forwarded to function-form variants.
 * @returns Keyframes definition, `false` to skip animation, or undefined.
 *
 * @example
 * ```ts
 * const variants = { hidden: (i: number) => ({ x: -i * 100 }) }
 * resolveInitial('hidden', variants, 2)      // { x: -200 }
 * resolveInitial({ x: 0 }, variants)         // { x: 0 }
 * resolveInitial(false, variants)            // false
 * resolveInitial(undefined, variants)        // undefined
 * ```
 */
export const resolveInitial = (
    initial: MotionInitial,
    variants: Variants | undefined,
    custom?: unknown
): DOMKeyframesDefinition | false | undefined => {
    if (initial === false) return false
    if (initial === undefined) return undefined
    if (typeof initial === 'string') return resolveVariant(variants, initial, custom)
    return initial as DOMKeyframesDefinition
}

/**
 * Resolves the animate prop to keyframes, handling variant keys.
 *
 * When `animate` is a string, looks it up in the variants object (invoking
 * dynamic variants with `custom`). Otherwise returns the keyframes directly.
 *
 * @param animate - The animate prop value (keyframes, variant key, or undefined).
 * @param variants - The variants object for resolving string keys.
 * @param custom - Forwarded to function-form variants.
 * @returns Keyframes definition or undefined.
 */
export const resolveAnimate = (
    animate: MotionAnimate,
    variants: Variants | undefined,
    custom?: unknown
): DOMKeyframesDefinition | undefined => {
    if (animate === undefined) return undefined
    if (typeof animate === 'string') return resolveVariant(variants, animate, custom)
    return animate as DOMKeyframesDefinition
}

/**
 * Resolves the exit prop to keyframes, handling variant keys.
 *
 * When `exit` is a string, looks it up in the variants object (invoking
 * dynamic variants with `custom`). Otherwise returns the keyframes directly.
 * Used by AnimatePresence for exit animations.
 *
 * @param exit - The exit prop value (keyframes, variant key, or undefined).
 * @param variants - The variants object for resolving string keys.
 * @param custom - Forwarded to function-form variants.
 * @returns Keyframes definition or undefined.
 */
export const resolveExit = (
    exit: MotionExit,
    variants: Variants | undefined,
    custom?: unknown
): DOMKeyframesDefinition | undefined => {
    if (exit === undefined) return undefined
    if (typeof exit === 'string') return resolveVariant(variants, exit, custom)
    return exit as DOMKeyframesDefinition
}
