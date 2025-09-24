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
 * Exit animation properties for a motion component when unmounted.
 * @example
 * ```svelte
 * <motion.div exit={{ opacity: 0, scale: 0 }} />
 * ```
 */
export type MotionExit =
    | (Record<string, unknown> & { transition?: AnimationOptions })
    | DOMKeyframesDefinition
    | undefined

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
 * Animation properties for hover interactions.
 * @example
 * ```svelte
 * <motion.div whileHover={{ scale: 1.05 }} />
 * ```
 */
export type MotionWhileHover =
    | (Record<string, unknown> & { transition?: AnimationOptions })
    | DOMKeyframesDefinition
    | undefined

/**
 * Animation transition configuration for hover interactions.
 * Overrides the global transition when provided.
 */

/**
 * Animation lifecycle callbacks for motion components.
 */
export type MotionAnimationStart =
    | ((_definition: DOMKeyframesDefinition | undefined) => void)
    | undefined
export type MotionAnimationComplete =
    | ((_definition: DOMKeyframesDefinition | undefined) => void)
    | undefined

/** Hover lifecycle callbacks */
export type MotionOnHoverStart = (() => void) | undefined
export type MotionOnHoverEnd = (() => void) | undefined

/** Tap lifecycle callbacks */
export type MotionOnTapStart = (() => void) | undefined
export type MotionOnTap = (() => void) | undefined
export type MotionOnTapCancel = (() => void) | undefined

/**
 * Base motion props shared by all motion components.
 */
export type MotionProps = {
    /** Initial state of the animation */
    initial?: MotionInitial
    /** Target state of the animation */
    animate?: MotionAnimate
    /** Exit animation state when component is removed */
    exit?: MotionExit
    /** Animation configuration */
    transition?: MotionTransition
    /** Tap/click interaction animation */
    whileTap?: MotionWhileTap
    /** Hover interaction animation */
    whileHover?: MotionWhileHover
    /** Called right before a main animate transition starts */
    onAnimationStart?: MotionAnimationStart
    /** Called after a main animate transition completes */
    onAnimationComplete?: MotionAnimationComplete
    /** Called when a true hover gesture starts (not emulated by touch) */
    onHoverStart?: MotionOnHoverStart
    /** Called when a true hover gesture ends */
    onHoverEnd?: MotionOnHoverEnd
    /** Called when a tap gesture starts (pointerdown recognized) */
    onTapStart?: MotionOnTapStart
    /** Called when a tap gesture ends successfully (pointerup) */
    onTap?: MotionOnTap
    /** Called when a tap gesture is cancelled (pointercancel) */
    onTapCancel?: MotionOnTapCancel
    /** Inline styles */
    style?: string
    /** CSS classes */
    class?: string
    /** Enable FLIP layout animations; "position" limits to translation only */
    layout?: boolean | 'position'
    /** Ref to the element */
    ref?: HTMLElement | null
}

/**
 * Configuration properties for motion/animation components.
 * These props control how animations behave and transition between states.
 *
 * @example
 * ```svelte
 * <motion.div
 *   transition={{ duration: 0.3, ease: "easeInOut" }}
 * >
 *   Content
 * </motion.div>
 * ```
 *
 * @property {MotionTransition} [transition] - Defines how the animation transitions between states.
 *   Can include properties like:
 *   - duration: Length of the animation in seconds
 *   - ease: Easing function to use (e.g., "linear", "easeIn", "easeOut")
 *   - delay: Time to wait before starting the animation
 *   - repeat: Number of times to repeat the animation
 */
export type MotionConfigProps = {
    /** Animation configuration */
    transition?: MotionTransition
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
