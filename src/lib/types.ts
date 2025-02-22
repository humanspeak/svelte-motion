import type { AnimationOptions, DOMKeyframesDefinition } from 'motion'
import type { Snippet } from 'svelte'

/**
 * Initial animation properties for a motion component.
 * @example
 * ```svelte
 * <motion.div initial={{ opacity: 0, scale: 0 }} />
 * ```
 */
export type MotionInitial = DOMKeyframesDefinition | undefined

/**
 * Target animation properties for a motion component.
 * @example
 * ```svelte
 * <motion.div animate={{ opacity: 1, scale: 1 }} />
 * ```
 */
export type MotionAnimate = DOMKeyframesDefinition | undefined

/**
 * Animation transition configuration.
 * @example
 * ```svelte
 * <motion.div
 *   transition={{
 *     duration: 0.4,
 *     scale: {
 *       type: 'spring',
 *       visualDuration: 0.4,
 *       bounce: 0.5
 *     }
 *   }}
 * />
 * ```
 */
export type MotionTransition = AnimationOptions | undefined

/**
 * Animation properties for tap/click interactions.
 * @example
 * ```svelte
 * <motion.button whileTap={{ scale: 0.95 }} />
 * ```
 */
export type MotionWhileTap = DOMKeyframesDefinition | undefined

/**
 * Base motion props shared by all motion components.
 */
export type MotionProps = {
    /** Initial state of the animation */
    initial?: MotionInitial
    /** Target state of the animation */
    animate?: MotionAnimate
    /** Animation configuration */
    transition?: MotionTransition
    /** Tap/click interaction animation */
    whileTap?: MotionWhileTap
    /** Inline styles */
    style?: string
    /** CSS classes */
    class?: string
}

/**
 * Props for regular HTML elements that can have children
 * @example
 * ```svelte
 * <motion.div initial={{ opacity: 0 }}>
 *   Content goes here
 * </motion.div>
 * ```
 */
export type HTMLElementProps = MotionProps & {
    /** Child content rendered inside the element */
    children?: Snippet
    /** Additional HTML attributes */
    [key: string]: unknown
}

/**
 * Props for void HTML elements that cannot have children
 * @example
 * ```svelte
 * <motion.img src="image.jpg" initial={{ scale: 0 }} animate={{ scale: 1 }} />
 * ```
 */
export type HTMLVoidElementProps = MotionProps & {
    /** Additional HTML attributes */
    [key: string]: unknown
} & {
    /** Void elements cannot have children */
    children?: never
}
