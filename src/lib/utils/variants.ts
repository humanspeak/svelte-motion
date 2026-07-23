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
        const proto: unknown = Object.getPrototypeOf(entry)
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
    return initial
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
    // The scalar-null wildcard widening on MotionAnimate (`x: null` = hold the
    // current value) is erased here: downstream keyframe plumbing types stay
    // upstream-shaped, and resolveWildcardKeyframes resolves the nulls against
    // the live value before the animation layer sees them.
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
 * Matches a relative keyframe string like `'+=50'` or `'-=1.5'`: a sign-equals
 * prefix followed by a number. Upstream framer-motion resolves these against the
 * value the channel currently holds at animation start (motion-dom
 * `render/utils/setters.ts`).
 */
const RELATIVE_KEYFRAME = /^([+-])=(-?\d*\.?\d+)$/

/** A wildcard keyframe (`null`/`undefined`) = "the current value". */
const isWildcardKeyframe = (value: unknown): boolean => value === null || value === undefined

/** A relative keyframe string (`'+=50'`) offsetting from the current value. */
const isRelativeKeyframe = (value: unknown): boolean =>
    typeof value === 'string' && RELATIVE_KEYFRAME.test(value)

/**
 * Resolve one keyframe element against a live value.
 *
 * Wildcards (`null`/`undefined`) become the live value; relative strings
 * (`'+=50'`) offset from it. Anything else — and any wildcard/relative when no
 * numeric live value is available — passes through unchanged.
 */
const resolveKeyframeElement = (value: unknown, live: number | undefined): unknown => {
    if (isWildcardKeyframe(value)) return live === undefined ? value : live
    if (typeof value === 'string') {
        const match = RELATIVE_KEYFRAME.exec(value)
        if (match && live !== undefined) {
            const delta = Number.parseFloat(match[2])
            return match[1] === '+' ? live + delta : live - delta
        }
    }
    return value
}

/**
 * Resolve wildcard (`null`/`undefined` = "current value") and relative
 * (`'+=50'`) keyframes against the element's LIVE value at animation start,
 * matching upstream framer-motion.
 *
 * Upstream resolves both in its keyframe pipeline before the animation layer
 * runs: `fillWildcards` (motion-dom) plus the DOM keyframe resolver read the
 * live value into a `null` keyframe, and relative strings resolve against the
 * current value in `resolveFinalValueInKeyframes` (`render/utils/setters.ts`).
 * Our WAAPI port otherwise hands the raw array/string to `animate()`, which
 * drops a `[0, null]` channel within a frame and ignores `'+=50'` entirely.
 *
 * `readLiveValue` is injected so this stays pure and unit-testable; the DOM
 * caller wires it to the element's decomposed transform matrix / computed style.
 * When it returns `undefined` (no numeric live value — a color, a `var(...)`,
 * a 3D matrix), the wildcard/relative passes through unchanged. This is the
 * documented numeric bound; wildcards inside gesture arrays (`whileHover`) are
 * likewise still unsupported (fidelity plan 001).
 *
 * @param keyframes - The animate payload (`channel -> scalar | array`), or
 *     `undefined`.
 * @param readLiveValue - Reads the element's current numeric value for a channel
 *     key, or `undefined` when none is available.
 * @returns A new payload with wildcards/relatives resolved, or `undefined` when
 *     given `undefined`. Channels without wildcards/relatives are copied
 *     verbatim and never trigger a live read.
 *
 * @example
 * ```ts
 * resolveWildcardKeyframes({ x: [0, null] }, () => 64)  // { x: [0, 0] } (fill-forward)
 * resolveWildcardKeyframes({ x: [null, 100] }, () => 64) // { x: [64, 100] } (live feeds [0])
 * resolveWildcardKeyframes({ x: '+=50' }, () => 64)    // { x: 114 }
 * resolveWildcardKeyframes({ x: [0, 100] }, () => 64)  // { x: [0, 100] } (untouched)
 * ```
 */
export const resolveWildcardKeyframes = (
    keyframes: DOMKeyframesDefinition | undefined,
    readLiveValue: (key: string) => number | undefined
): DOMKeyframesDefinition | undefined => {
    if (keyframes === undefined) return undefined
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(keyframes)) {
        if (Array.isArray(value)) {
            if (value.some((el) => isWildcardKeyframe(el) || isRelativeKeyframe(el))) {
                const live = readLiveValue(key)
                // Upstream semantics (motion-dom KeyframeResolver +
                // fillWildcards): the LIVE value feeds only keyframes[0]; every
                // later wildcard fills FORWARD from its resolved predecessor.
                // [0, null] -> [0, 0], [null, null, 100] -> [live, live, 100].
                // Relative strings still offset from the live value (setters.ts
                // resolveFinalValueInKeyframes semantics).
                const resolved: unknown[] = []
                for (let i = 0; i < value.length; i++) {
                    const el: unknown = value[i]
                    if (isWildcardKeyframe(el)) {
                        resolved.push(i === 0 ? (live === undefined ? el : live) : resolved[i - 1])
                    } else {
                        resolved.push(resolveKeyframeElement(el, live))
                    }
                }
                out[key] = resolved
            } else {
                out[key] = value
            }
        } else if (isWildcardKeyframe(value) || isRelativeKeyframe(value)) {
            out[key] = resolveKeyframeElement(value, readLiveValue(key))
        } else {
            out[key] = value
        }
    }
    return out as DOMKeyframesDefinition
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
 * The SETTLE side of upstream wildcard/relative handling: a trailing `null`
 * takes the previous concrete keyframe (upstream `fillWildcards` fills each
 * `null` from its predecessor), and an element/scalar that is still an
 * unresolved wildcard or relative string is omitted rather than written as a
 * garbage inline style. In the real animation path {@link resolveWildcardKeyframes}
 * has already resolved these against the live value at animation start (its
 * output feeds both the `animate()` call and this collapse), so this handling
 * is the pure, defensive fallback for a payload that reaches settle unresolved.
 *
 * @param keyframes - Resolved animate keyframes (scalars and/or arrays),
 *     or `undefined`.
 * @returns A new object with each value collapsed to its resting scalar,
 *     or `undefined` when given `undefined`. Keys whose value is an empty
 *     array, an all-wildcard array, or an unresolved wildcard/relative are
 *     omitted (no resting value).
 *
 * @example
 * ```ts
 * resolveRestingValues({ x: [0, 100, 50], scaleX: 1 }) // { x: 50, scaleX: 1 }
 * resolveRestingValues({ opacity: 0.5 })               // { opacity: 0.5 }
 * resolveRestingValues({ x: [0, null] })               // { x: 0 } (trailing null -> prev concrete)
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
            // Resting = last CONCRETE element. A trailing wildcard/relative
            // takes the previous concrete keyframe (upstream fillWildcards
            // settle semantics); an all-wildcard or empty array has no resting
            // value, so the key is omitted rather than emitting garbage.
            for (let i = value.length - 1; i >= 0; i -= 1) {
                const el: unknown = value[i]
                if (!isWildcardKeyframe(el) && !isRelativeKeyframe(el)) {
                    out[key] = el
                    break
                }
            }
        } else if (isRelativeKeyframe(value)) {
            // Unresolved relative scalar with no live value here: omit. The real
            // path resolves it upstream via resolveWildcardKeyframes.
            continue
        } else {
            out[key] = value
        }
    }
    return out as DOMKeyframesDefinition
}
