import type { AnimationOptions, DOMKeyframesDefinition } from 'motion'
import type { Snippet } from 'svelte'

/**
 * Variants define named animation states that can be referenced by string keys.
 *
 * @example
 * ```svelte
 * <script>
 *   const variants = {
 *     open: { opacity: 1, scale: 1 },
 *     closed: { opacity: 0, scale: 0.8 }
 *   }
 * </script>
 *
 * <motion.div variants={variants} animate="open" />
 * ```
 */
export type Variants = Record<string, DOMKeyframesDefinition | undefined>

/**
 * Initial animation properties for a motion component.
 *
 * - Can be an object with animation properties
 * - Can be a string key referencing a variant
 * - Set to `false` to skip the initial animation and render directly at the animated state
 *
 * @example
 * ```svelte
 * <!-- Animate from initial to animate state -->
 * <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
 *
 * <!-- Skip initial animation, render at animate state -->
 * <motion.div initial={false} animate={{ opacity: 1 }} />
 *
 * <!-- Use variant key -->
 * <motion.div variants={myVariants} initial="hidden" animate="visible" />
 * ```
 */
export type MotionInitial = DOMKeyframesDefinition | string | false | undefined

/**
 * Target animation properties for a motion component.
 *
 * - Can be an object with animation properties
 * - Can be a string key referencing a variant
 *
 * @example
 * ```svelte
 * <motion.div animate={{ opacity: 1, scale: 1 }} />
 *
 * <!-- With variants -->
 * <motion.div variants={myVariants} animate="visible" />
 * ```
 */
export type MotionAnimate = DOMKeyframesDefinition | string | undefined

/**
 * Exit animation properties for a motion component when unmounted.
 *
 * - Can be an object with animation properties
 * - Can be a string key referencing a variant
 *
 * @example
 * ```svelte
 * <motion.div exit={{ opacity: 0, scale: 0 }} />
 *
 * <!-- With variants -->
 * <motion.div variants={myVariants} exit="hidden" />
 * ```
 */
export type MotionExit =
    | (Record<string, unknown> & { transition?: AnimationOptions })
    | DOMKeyframesDefinition
    | string
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
 * Animation properties for focus interactions.
 * @example
 * ```svelte
 * <motion.button whileFocus={{ scale: 1.05 }} />
 * ```
 */
export type MotionWhileFocus =
    | (Record<string, unknown> & { transition?: AnimationOptions })
    | DOMKeyframesDefinition
    | undefined

/**
 * Animation properties for drag interactions.
 * When a drag gesture starts, the element animates to this state; when it ends,
 * it animates back to its baseline (from animate/initial), restoring only the changed keys.
 */
export type MotionWhileDrag =
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

/** Focus lifecycle callbacks */
export type MotionOnFocusStart = (() => void) | undefined
export type MotionOnFocusEnd = (() => void) | undefined

/** Tap lifecycle callbacks */
export type MotionOnTapStart = (() => void) | undefined
export type MotionOnTap = (() => void) | undefined
export type MotionOnTapCancel = (() => void) | undefined

/** Drag specific types */
export type DragPoint = { x: number; y: number }
export type DragInfo = {
    point: DragPoint
    delta: DragPoint
    offset: DragPoint
    velocity: DragPoint
}
export type MotionOnDirectionLock = ((axis: 'x' | 'y') => void) | undefined
export type MotionOnDragTransitionEnd = (() => void) | undefined

export type DragAxis = boolean | 'x' | 'y'
export type DragConstraints =
    | {
          top?: number
          left?: number
          right?: number
          bottom?: number
      }
    | HTMLElement
export type DragTransition = {
    bounceStiffness?: number
    bounceDamping?: number
    power?: number
    timeConstant?: number
    restDelta?: number
    restSpeed?: number
    min?: number
    max?: number
}
export type DragControls = {
    /** Imperatively start a drag from any pointer event. */
    start: (
        event: PointerEvent,
        options?: { snapToCursor?: boolean; distanceThreshold?: number }
    ) => void
    /** Cancel an active drag without momentum. */
    cancel: () => void
    /** Stop current drag and any momentum animation. */
    stop: () => void
    /** Subscribe the controls to a target element. */
    subscribe: (el: HTMLElement) => void
}

/**
 * Base motion props shared by all motion components.
 */
export type MotionProps = {
    /** Variants define named animation states */
    variants?: Variants
    /** Initial state of the animation (object or variant key) */
    initial?: MotionInitial
    /** Target state of the animation (object or variant key) */
    animate?: MotionAnimate
    /** Exit animation state when component is removed (object or variant key) */
    exit?: MotionExit
    /** Animation configuration */
    transition?: MotionTransition
    /** Tap/click interaction animation */
    whileTap?: MotionWhileTap
    /** Hover interaction animation */
    whileHover?: MotionWhileHover
    /** Focus interaction animation */
    whileFocus?: MotionWhileFocus
    /** Called right before a main animate transition starts */
    onAnimationStart?: MotionAnimationStart
    /** Called after a main animate transition completes */
    onAnimationComplete?: MotionAnimationComplete
    /** Called when a true hover gesture starts (not emulated by touch) */
    onHoverStart?: MotionOnHoverStart
    /** Called when a true hover gesture ends */
    onHoverEnd?: MotionOnHoverEnd
    /** Called when element receives keyboard focus */
    onFocusStart?: MotionOnFocusStart
    /** Called when element loses keyboard focus */
    onFocusEnd?: MotionOnFocusEnd
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
