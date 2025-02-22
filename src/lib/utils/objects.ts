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
    for (const _ in obj) return false
    return true
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

/**
 * Returns an array of keys that exist in both objects.
 * Useful for finding properties that need to be reset after animations.
 *
 * @param obj1 - First object to compare
 * @param obj2 - Second object to compare
 * @returns Array of keys that exist in both objects
 *
 * @example
 * ```ts
 * const initial = { scale: 1, opacity: 1 }
 * const whileTap = { scale: 0.9, color: 'red' }
 * getCommonKeys(initial, whileTap) // ['scale']
 * ```
 */
export function getCommonKeys<T extends Record<string, unknown>>(obj1: T, obj2: T): (keyof T)[] {
    return Object.keys(obj1).filter((key) => key in obj2) as (keyof T)[]
}
