import type {
    MotionAnimate,
    MotionExit,
    MotionInitial,
    MotionWhileDrag,
    MotionWhileFocus,
    MotionWhileHover,
    MotionWhileInView,
    MotionWhileTap,
    Variants
} from '$lib/types'
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
    // Guard against built-in / inherited keys like 'toString' or
    // 'constructor' — without this, `whileHover="toString"` would
    // resolve to `Function.prototype.toString` and leak a function into
    // the merge path.
    if (!Object.prototype.hasOwnProperty.call(variants, key)) return undefined
    const entry = variants[key]
    if (typeof entry === 'function') return entry(custom)
    return entry
}

/**
 * Resolves a single variant key or an ordered list of keys to merged
 * keyframes. Matches framer-motion's `VariantLabels = string | string[]`
 * surface: later keys in the list override earlier ones on key
 * collisions (`Object.assign` semantics).
 *
 * Missing keys are skipped. An empty list, an empty string, or an
 * undefined argument all resolve to `undefined`.
 *
 * @param variants - The variants object containing named animation states.
 * @param keys - A single variant key or an array of variant keys.
 * @param custom - Forwarded to function-form variants (per-entry).
 * @returns Merged keyframes definition, or `undefined` when nothing resolved.
 *
 * @example
 * ```ts
 * const variants = {
 *   hover:  { scale: 1.1 },
 *   active: { scale: 1.2, color: 'red' }
 * }
 * resolveVariantList(variants, 'hover')             // { scale: 1.1 }
 * resolveVariantList(variants, ['hover', 'active']) // { scale: 1.2, color: 'red' }
 * resolveVariantList(variants, ['hover', 'missing']) // { scale: 1.1 }
 * resolveVariantList(variants, [])                   // undefined
 * ```
 */
export const resolveVariantList = (
    variants: Variants | undefined,
    keys: string | string[] | undefined,
    custom?: unknown
): DOMKeyframesDefinition | undefined => {
    if (keys === undefined) return undefined
    if (typeof keys === 'string') return resolveVariant(variants, keys, custom)
    if (keys.length === 0) return undefined

    let merged: Record<string, unknown> | undefined
    for (const key of keys) {
        const entry = resolveVariant(variants, key, custom)
        // Defensive: only merge plain keyframe objects. A function-form
        // variant could return something else (array, class instance,
        // string) under a misuse, and spreading those would corrupt the
        // merged result. Reject arrays explicitly and require the
        // prototype to be `Object.prototype` (or `null` for objects
        // created via `Object.create(null)`).
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
        const proto = Object.getPrototypeOf(entry)
        if (proto !== Object.prototype && proto !== null) continue
        const obj = entry as Record<string, unknown>
        merged = merged ? { ...merged, ...obj } : { ...obj }
    }
    return merged as DOMKeyframesDefinition | undefined
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
    if (typeof initial === 'string' || Array.isArray(initial))
        return resolveVariantList(variants, initial, custom)
    return initial as DOMKeyframesDefinition
}

/**
 * Resolves the animate prop to keyframes, handling variant keys.
 *
 * When `animate` is a string (or array of strings), looks it up in the
 * variants object (invoking dynamic variants with `custom`). Otherwise
 * returns the keyframes directly.
 *
 * @param animate - The animate prop value (keyframes, variant key, array
 *     of variant keys, or undefined).
 * @param variants - The variants object for resolving string keys.
 * @param custom - Forwarded to function-form variants.
 * @returns Keyframes definition or undefined.
 *
 * @example
 * ```ts
 * const variants = { visible: { opacity: 1 }, shifted: { x: 100 } }
 * resolveAnimate('visible', variants)              // { opacity: 1 }
 * resolveAnimate(['visible', 'shifted'], variants) // { opacity: 1, x: 100 }
 * resolveAnimate({ scale: 1.2 }, variants)         // { scale: 1.2 }  (pass-through)
 * resolveAnimate(undefined, variants)              // undefined
 * ```
 */
export const resolveAnimate = (
    animate: MotionAnimate,
    variants: Variants | undefined,
    custom?: unknown
): DOMKeyframesDefinition | undefined => {
    if (animate === undefined) return undefined
    if (typeof animate === 'string' || Array.isArray(animate))
        return resolveVariantList(variants, animate, custom)
    return animate as DOMKeyframesDefinition
}

/**
 * Resolves the exit prop to keyframes, handling variant keys.
 *
 * When `exit` is a string (or array of strings), looks it up in the
 * variants object (invoking dynamic variants with `custom`). Otherwise
 * returns the keyframes directly. Used by AnimatePresence for exit
 * animations.
 *
 * @param exit - The exit prop value (keyframes, variant key, array of
 *     variant keys, or undefined).
 * @param variants - The variants object for resolving string keys.
 * @param custom - Forwarded to function-form variants.
 * @returns Keyframes definition or undefined.
 *
 * @example
 * ```ts
 * const variants = { hidden: { opacity: 0 }, small: { scale: 0.8 } }
 * resolveExit('hidden', variants)              // { opacity: 0 }
 * resolveExit(['hidden', 'small'], variants)   // { opacity: 0, scale: 0.8 }
 * resolveExit({ y: -20 }, variants)            // { y: -20 }
 * resolveExit(undefined, variants)             // undefined
 * ```
 */
export const resolveExit = (
    exit: MotionExit,
    variants: Variants | undefined,
    custom?: unknown
): DOMKeyframesDefinition | undefined => {
    if (exit === undefined) return undefined
    if (typeof exit === 'string' || Array.isArray(exit))
        return resolveVariantList(variants, exit, custom)
    return exit as DOMKeyframesDefinition
}

/**
 * Resolves a `whileX` prop (hover, tap, focus, drag, in-view) to
 * keyframes. Mirrors `resolveAnimate` — pass-through for inline
 * keyframes, look up variant keys via `resolveVariantList` (single
 * string or array of strings, merged left-to-right).
 *
 * Used by `_MotionContainer.svelte` to feed the gesture attach helpers
 * a consistent keyframes object regardless of whether the consumer
 * wrote inline keyframes or a variant reference.
 *
 * @param value - The whileX prop value.
 * @param variants - The variants object for resolving string keys.
 * @param custom - Forwarded to function-form variants.
 * @returns Keyframes definition or `undefined` when nothing applies.
 *
 * @example
 * ```ts
 * const variants = { hover: { scale: 1.1 }, active: { color: 'red' } }
 * resolveWhile('hover', variants)            // { scale: 1.1 }
 * resolveWhile(['hover', 'active'], variants) // { scale: 1.1, color: 'red' }
 * resolveWhile({ scale: 1.2 }, variants)     // { scale: 1.2 }  (pass-through)
 * resolveWhile(undefined, variants)          // undefined
 * ```
 */
export const resolveWhile = (
    value:
        | MotionWhileTap
        | MotionWhileHover
        | MotionWhileFocus
        | MotionWhileDrag
        | MotionWhileInView,
    variants: Variants | undefined,
    custom?: unknown
): DOMKeyframesDefinition | undefined => {
    if (value === undefined) return undefined
    if (typeof value === 'string' || Array.isArray(value))
        return resolveVariantList(variants, value, custom)
    return value as DOMKeyframesDefinition
}

/**
 * Collapse each keyframe value to the value the element comes to REST at
 * — the last element of a keyframe array, or the value itself otherwise.
 *
 * Used when deriving the post-animation inline style baseline: an
 * `animate={{ x: [0, 100, 50] }}` settles at `50`, so the resting inline
 * transform must reflect `50`, not the first keyframe. Mirrors
 * framer-motion, whose `buildTransform` reads the motion value as a
 * scalar that has already settled at the final keyframe
 * (`motion-dom/.../build-transform.ts`).
 *
 * @param keyframes - Resolved animate keyframes (scalars and/or arrays),
 *     or `undefined`.
 * @returns A new object with each value collapsed to its resting scalar,
 *     or `undefined` when given `undefined`. Keys whose value is an empty
 *     array are omitted (no resting value).
 *
 * @example
 * ```ts
 * resolveRestingValues({ x: [0, 100, 50], scaleX: 1 }) // { x: 50, scaleX: 1 }
 * resolveRestingValues({ opacity: 0.5 })               // { opacity: 0.5 }
 * resolveRestingValues({ x: [], y: 5 })                // { y: 5 } (empty array dropped)
 * resolveRestingValues(undefined)                      // undefined
 * ```
 */
export const resolveRestingValues = (
    keyframes: DOMKeyframesDefinition | undefined
): DOMKeyframesDefinition | undefined => {
    if (keyframes === undefined) return undefined
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(keyframes)) {
        if (Array.isArray(value)) {
            // An empty array has no resting value — omit the key rather than
            // emitting `value[-1]` (undefined).
            if (value.length > 0) out[key] = value[value.length - 1]
        } else {
            out[key] = value
        }
    }
    return out as DOMKeyframesDefinition
}
