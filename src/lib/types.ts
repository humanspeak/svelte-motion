import type { AnimationOptions, DOMKeyframesDefinition } from 'motion'
import type { Snippet } from 'svelte'

/**
 * A variant value: either a static keyframes object, or a factory function
 * that receives the consumer-provided `custom` value and returns keyframes.
 *
 * Dynamic (function-form) variants let a single variants object emit
 * per-instance keyframes — common for staggered lists where each child
 * needs its own offset or delay.
 *
 * @example
 * ```svelte
 * <motion.div
 *   custom={index}
 *   variants={{
 *     visible: (i) => ({ opacity: 1, x: i * 50 }),
 *     hidden:  { opacity: 0 }
 *   }}
 *   animate="visible"
 * />
 * ```
 */
export type Variant =
    | DOMKeyframesDefinition
    | ((custom: unknown) => DOMKeyframesDefinition)
    | undefined

/**
 * Variants define named animation states that can be referenced by string keys.
 *
 * Each entry can be a static keyframes object or a `(custom) => keyframes`
 * factory function (see {@link Variant}).
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
export type Variants = Record<string, Variant>

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
export type MotionInitial = DOMKeyframesDefinition | string | string[] | false | undefined

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
export type MotionAnimate = DOMKeyframesDefinition | string | string[] | undefined

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
    | string[]
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
 *
 * Accepts inline keyframes, a variant key, or an array of variant keys
 * (later entries override earlier ones on key collisions).
 *
 * @example
 * ```svelte
 * <motion.button whileTap={{ scale: 0.95 }} />
 *
 * <!-- Variant key -->
 * <motion.button variants={{ pressed: { scale: 0.95 } }} whileTap="pressed" />
 *
 * <!-- Array — later wins on conflicts -->
 * <motion.button whileTap={["pressed", "muted"]} />
 * ```
 */
export type MotionWhileTap =
    | (Record<string, unknown> & { transition?: AnimationOptions })
    | DOMKeyframesDefinition
    | string
    | string[]
    | undefined

/**
 * Animation properties for hover interactions.
 *
 * Accepts inline keyframes, a variant key, or an array of variant keys.
 *
 * @example
 * ```svelte
 * <motion.div whileHover={{ scale: 1.05 }} />
 *
 * <!-- Variant key -->
 * <motion.div variants={{ hover: { scale: 1.05 } }} whileHover="hover" />
 * ```
 */
export type MotionWhileHover =
    | (Record<string, unknown> & { transition?: AnimationOptions })
    | DOMKeyframesDefinition
    | string
    | string[]
    | undefined

/**
 * Animation properties for focus interactions.
 *
 * Accepts inline keyframes, a variant key, or an array of variant keys.
 *
 * @example
 * ```svelte
 * <motion.button whileFocus={{ scale: 1.05 }} />
 * <motion.button variants={{ active: { outline: '2px solid blue' } }} whileFocus="active" />
 * ```
 */
export type MotionWhileFocus =
    | (Record<string, unknown> & { transition?: AnimationOptions })
    | DOMKeyframesDefinition
    | string
    | string[]
    | undefined

/**
 * Animation properties for drag interactions.
 * When a drag gesture starts, the element animates to this state; when it ends,
 * it animates back to its baseline (from animate/initial), restoring only the changed keys.
 *
 * Accepts inline keyframes, a variant key, or an array of variant keys.
 */
export type MotionWhileDrag =
    | (Record<string, unknown> & { transition?: AnimationOptions })
    | DOMKeyframesDefinition
    | string
    | string[]
    | undefined

/**
 * Animation properties for in-view interactions.
 * When the element enters the viewport, it animates to this state; when it leaves,
 * it animates back to its baseline (from animate/initial), restoring only the changed keys.
 *
 * Accepts inline keyframes, a variant key, or an array of variant keys.
 *
 * @example
 * ```svelte
 * <motion.div whileInView={{ opacity: 1, y: 0 }} />
 * <motion.div variants={{ inView: { opacity: 1 } }} whileInView="inView" />
 * ```
 */
export type MotionWhileInView =
    | (Record<string, unknown> & { transition?: AnimationOptions })
    | DOMKeyframesDefinition
    | string
    | string[]
    | undefined

/**
 * IntersectionObserver configuration for `whileInView`. Mirrors framer-motion's
 * `viewport` prop. Same shape as `UseInViewOptions` minus `initial` (which is
 * only meaningful for the hook's pre-mount return value).
 *
 * @example
 * ```svelte
 * <motion.div
 *   whileInView={{ opacity: 1, y: 0 }}
 *   viewport={{ once: true, amount: 0.5 }}
 * />
 * ```
 */
export type MotionViewport = {
    /** When `true`, fire only once on first entry. Subsequent re-entries no-op. */
    once?: boolean
    /** Element to use as the IntersectionObserver root. Defaults to the viewport. */
    root?: Element | Document
    /** CSS margin string applied to the root bounding box (e.g. `"100px 0px"`). */
    margin?: string
    /** Fraction (0-1) or `"some"` / `"all"` of the target that must be visible. */
    amount?: 'some' | 'all' | number
}

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

/** InView lifecycle callbacks */
export type MotionOnInViewStart = (() => void) | undefined
export type MotionOnInViewEnd = (() => void) | undefined

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
export type MotionOnDragStart = ((event: PointerEvent, info: DragInfo) => void) | undefined
export type MotionOnDrag = ((event: PointerEvent, info: DragInfo) => void) | undefined
export type MotionOnDragEnd = ((event: PointerEvent, info: DragInfo) => void) | undefined
export type MotionOnDirectionLock = ((axis: 'x' | 'y') => void) | undefined
export type MotionOnDragTransitionEnd = (() => void) | undefined

/**
 * Pan-gesture callbacks. PanInfo is structurally identical to DragInfo
 * (`{ point, delta, offset, velocity }`), so we re-use the type rather
 * than ship a parallel alias.
 */
export type MotionOnPanSessionStart = ((event: PointerEvent, info: DragInfo) => void) | undefined
export type MotionOnPanStart = ((event: PointerEvent, info: DragInfo) => void) | undefined
export type MotionOnPan = ((event: PointerEvent, info: DragInfo) => void) | undefined
export type MotionOnPanEnd = ((event: PointerEvent, info: DragInfo) => void) | undefined

/**
 * Payload delivered to `onProjectionUpdate`. Re-declared structurally
 * here (rather than imported from `projection.ts`) so `types.ts`
 * stays dependency-free at the type layer. `delta.x/y.translate` is the
 * px shift the element's layout box moved between the pre-change
 * snapshot and the post-change measurement; `hasLayoutChanged` applies
 * the rounding threshold that filters sub-pixel jitter.
 */
export type ProjectionUpdatePayload = {
    layout: { x: { min: number; max: number }; y: { min: number; max: number } }
    snapshot: { x: { min: number; max: number }; y: { min: number; max: number } }
    delta: {
        x: { translate: number; scale: number; origin: number; originPoint: number }
        y: { translate: number; scale: number; origin: number; originPoint: number }
    }
    hasLayoutChanged: boolean
}

/**
 * Fires after each layout change to a `motion.*` element that has
 * `layout` enabled, with the FLIP delta between the pre- and
 * post-change layout boxes. Mirrors framer-motion's `onLayoutMeasure`
 * surface. Wired through the element's internal `ProjectionNode`.
 */
export type MotionOnProjectionUpdate = ((data: ProjectionUpdatePayload) => void) | undefined

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
    /**
     * Unique key for AnimatePresence tracking.
     * Required when inside an AnimatePresence component.
     * Used to track enter/exit state and determine whether to animate.
     *
     * @example
     * ```svelte
     * <AnimatePresence>
     *   {#if isVisible}
     *     <motion.div key="box" exit={{ opacity: 0 }} />
     *   {/if}
     * </AnimatePresence>
     * ```
     */
    key?: string
    /** Variants define named animation states */
    variants?: Variants
    /**
     * Value passed into function-form variants. Children without their own
     * `custom` prop inherit this from the nearest motion ancestor — matching
     * framer-motion's variant-tree custom propagation.
     */
    custom?: unknown
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
    /** Drag interaction animation */
    whileDrag?: MotionWhileDrag
    /** Pan interaction animation — applied while a pan gesture is active */
    whilePan?: MotionWhileDrag
    /** In-view interaction animation - animates when element enters viewport */
    whileInView?: MotionWhileInView
    /** IntersectionObserver options for `whileInView` (once / root / margin / amount) */
    viewport?: MotionViewport
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
    /** Called when element enters viewport */
    onInViewStart?: MotionOnInViewStart
    /** Called when element leaves viewport */
    onInViewEnd?: MotionOnInViewEnd
    /** Called when a tap gesture starts (pointerdown recognized) */
    onTapStart?: MotionOnTapStart
    /** Called when a tap gesture ends successfully (pointerup) */
    onTap?: MotionOnTap
    /** Called when a tap gesture is cancelled (pointercancel) */
    onTapCancel?: MotionOnTapCancel
    /** Called when a drag gesture starts */
    onDragStart?: MotionOnDragStart
    /** Called during a drag gesture */
    onDrag?: MotionOnDrag
    /** Called when a drag gesture ends */
    onDragEnd?: MotionOnDragEnd
    /** Called once when drag direction is locked to an axis */
    onDirectionLock?: MotionOnDirectionLock
    /** Called when the post-drag transition finishes on all axes */
    onDragTransitionEnd?: MotionOnDragTransitionEnd
    /** Pan gesture: fires once per pointerdown, before threshold */
    onPanSessionStart?: MotionOnPanSessionStart
    /** Pan gesture: fires the first frame after offset crosses threshold */
    onPanStart?: MotionOnPanStart
    /** Pan gesture: fires once per frame while panning */
    onPan?: MotionOnPan
    /** Pan gesture: fires on pointerup if onPanStart ever fired */
    onPanEnd?: MotionOnPanEnd
    /** Inline styles */
    style?: string
    /** CSS classes */
    class?: string
    /** Enable FLIP layout animations; "position" limits to translation only */
    layout?: boolean | 'position'
    /**
     * Fires after each `layout`-driven change with the FLIP delta from
     * the element's internal projection node. Mirrors framer-motion's
     * `onLayoutMeasure`. Requires `layout` to be enabled.
     */
    onProjectionUpdate?: MotionOnProjectionUpdate
    /** Shared layout animation identifier. Elements with matching layoutId animate between positions. */
    layoutId?: string
    /**
     * Mark this element as a scroll container so descendant `layout` animations
     * measure rects in this container's coordinate space. Without it, scrolling
     * mid-animation makes the FLIP transform fight the scroll and the layout
     * animation drifts.
     *
     * Apply on the same element as `overflow: scroll` / `overflow: auto`.
     *
     * @example
     * ```svelte
     * <motion.div layoutScroll style="overflow: auto">
     *   <motion.div layout />
     * </motion.div>
     * ```
     */
    layoutScroll?: boolean
    /** Ref to the element */
    ref?: HTMLElement | null
    /** Enable drag gestures. true for both axes, or lock to 'x'/'y'. */
    drag?: DragAxis
    /** Constrain dragging either to pixel bounds or an HTMLElement's bounding box. */
    dragConstraints?: DragConstraints
    /** Elasticity when overdragging beyond constraints (0 = none, 1 = full). */
    dragElastic?: number
    /** Continue with momentum/inertia after release (default true). */
    dragMomentum?: boolean
    /** Configure inertia/bounce physics for momentum. */
    dragTransition?: DragTransition
    /** Lock to the first detected axis of movement. */
    dragDirectionLock?: boolean
    /** Allow bubbling to parent drags. If false, uses a shared lock to prevent nesting. */
    dragPropagation?: boolean
    /** On release, animate back to origin (0). */
    dragSnapToOrigin?: boolean
    /** Enable the default drag listener; set false to use dragControls only. */
    dragListener?: boolean
    /** Pass controls to start drag imperatively from another element. */
    dragControls?: DragControls
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
/**
 * Reduced-motion policy for {@link MotionConfigProps.reducedMotion}.
 *
 * - `'never'` (default): Animations run as authored, regardless of OS preference.
 * - `'always'`: Transform animations (x, y, scale, rotate, skew, translate) are
 *   skipped. Other properties such as `opacity` and `color` still animate.
 * - `'user'`: Honors the OS-level `prefers-reduced-motion: reduce` setting —
 *   behaves like `'always'` when the user has opted in, otherwise `'never'`.
 *
 * @see https://motion.dev/docs/react-reduced-motion
 */
export type ReducedMotionConfig = 'user' | 'always' | 'never'

export type MotionConfigProps = {
    /** Animation configuration */
    transition?: MotionTransition
    /**
     * Reduced-motion policy applied to descendant motion elements.
     *
     * Defaults to `'never'`. See {@link ReducedMotionConfig}.
     */
    reducedMotion?: ReducedMotionConfig
}

/**
 * AnimatePresence mode controls how enter and exit animations are coordinated.
 *
 * - `sync` (default): Enter and exit animations happen simultaneously
 * - `wait`: Exit animations complete before enter animations start
 * - `popLayout`: Like sync, but exiting elements are removed from layout flow immediately
 *
 * @example
 * ```svelte
 * <AnimatePresence mode="wait">
 *   {#if isVisible}
 *     <motion.div key="box" exit={{ opacity: 0 }} />
 *   {/if}
 * </AnimatePresence>
 * ```
 */
export type AnimatePresenceMode = 'sync' | 'wait' | 'popLayout'

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
    /** Ref to the element */
    ref?: HTMLElement | null
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
    /** Ref to the element */
    ref?: HTMLElement | null
    /** Additional HTML attributes */
    [key: string]: unknown
} & {
    /** Void elements cannot have children */
    children?: never
}
