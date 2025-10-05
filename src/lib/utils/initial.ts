import type { MotionInitial } from '$lib/types'
import type { DOMKeyframesDefinition } from 'motion'

/**
 * Extracts keyframes from the initial prop, handling the `initial={false}` case.
 *
 * When `initial={false}`, the element should skip its initial animation and
 * render directly at its animated state. This function returns `undefined` for
 * `initial={false}`, and the keyframes object otherwise.
 *
 * @param initial - The initial prop value
 * @returns Keyframes to apply, or undefined
 *
 * @example
 * ```typescript
 * getInitialKeyframes({ opacity: 0 })  // { opacity: 0 }
 * getInitialKeyframes(false)            // undefined
 * getInitialKeyframes(undefined)        // undefined
 * ```
 */
export const getInitialKeyframes = (initial: MotionInitial): DOMKeyframesDefinition | undefined => {
    return initial === false ? undefined : (initial as DOMKeyframesDefinition | undefined)
}
