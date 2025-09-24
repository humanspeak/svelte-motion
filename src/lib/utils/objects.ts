import type { DOMKeyframesDefinition } from 'motion'

/**
 * Checks if an object is empty or undefined.
 *
 * @param obj - The object to check. Can be a regular object, animation keyframes, or undefined
 * @returns true if the object is undefined or has no own properties, false otherwise
 *
 * @example
 * ```ts
 * isEmpty({}) // true
 * isEmpty(undefined) // true
 * isEmpty({ opacity: 0 }) // false
 * ```
 */
export const isEmpty = (obj: Record<string, unknown> | DOMKeyframesDefinition | undefined) => {
    if (!obj) return true
    return Object.keys(obj as Record<string, unknown>).length === 0
}

/**
 * Checks if an object is not empty and defined.
 *
 * @param obj - The object to check. Can be a regular object, animation keyframes, or undefined
 * @returns true if the object has at least one own property, false if empty or undefined
 *
 * @example
 * ```ts
 * isNotEmpty({}) // false
 * isNotEmpty(undefined) // false
 * isNotEmpty({ scale: 1 }) // true
 * ```
 */
export const isNotEmpty = (obj: Record<string, unknown> | DOMKeyframesDefinition | undefined) => {
    return !isEmpty(obj)
}
