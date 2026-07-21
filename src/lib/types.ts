import type { MotionValueChild } from '$lib/utils/motionValueChild'
import type { MotionStyle, MotionStyleValue, TransformTemplate } from '$lib/utils/style'
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
/**
 * Keyframes returned from a variant, with optional transition timing.
 *
 * Framer Motion allows `transition` to live directly on a variant target, so
 * Svelte Motion accepts the same shape for parity.
 *
 * @example
 * ```ts
 * const visible: VariantTarget = {
 *   opacity: 1,
 *   transition: { duration: 0.2 }
 * }
 * ```
 */
export type VariantTarget = DOMKeyframesDefinition & { transition?: AnimationOptions }

export type Variant = VariantTarget | ((custom: unknown) => VariantTarget) | undefined

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
/**
 * Definition accepted by legacy animation controls.
 *
 * Mirrors Motion's `AnimationDefinition`: a keyframes object, a variant
 * label, an ordered list of variant labels, or a resolver function that
 * receives `custom` data.
 *
 * @example
 * ```ts
 * controls.start('visible')
 * controls.start(['visible', 'active'])
 * controls.start({ opacity: 1, x: 0 })
 * controls.start((custom) => ({ x: custom * 100 }))
 * ```
 */
export type AnimationControlsDefinition =
    | DOMKeyframesDefinition
    | string
    | string[]
    | ((custom: unknown) => DOMKeyframesDefinition | string)

/**
 * Internal subscriber shape used by {@link AnimationControls}.
 *
 * Motion's upstream controls subscribe VisualElements. Svelte Motion
 * subscribes a lightweight adapter from each `motion.*` component.
 */
export type AnimationControlsSubscriber = {
    /** Start an animation on the subscribed component. */
    start: (
        definition: AnimationControlsDefinition,
        transitionOverride?: AnimationOptions
    ) => Promise<unknown>
    /** Synchronously set final values on the subscribed component. */
    set: (definition: AnimationControlsDefinition) => void
    /** Stop currently running animations on the subscribed component. */
    stop: () => void
}

/**
 * Legacy imperative controls returned by {@link useAnimationControls}.
 *
 * Pass the object to `animate={controls}` on one or more `motion.*`
 * components, then call `controls.start(...)`, `controls.set(...)`, or
 * `controls.stop()` from events or effects.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { motion, useAnimationControls } from '@humanspeak/svelte-motion'
 *
 *   const controls = useAnimationControls()
 * </script>
 *
 * <button onclick={() => controls.start('open')}>Open</button>
 * <motion.div animate={controls} variants={{ open: { opacity: 1 } }} />
 * ```
 */
export type AnimationControls = {
    /**
     * Subscribe a motion component adapter to these controls.
     *
     * @param subscriber Component adapter to animate.
     * @returns Unsubscribe callback.
     */
    subscribe: (subscriber: AnimationControlsSubscriber) => () => void
    /**
     * Start an animation on every subscribed component.
     *
     * @param definition Target keyframes, variant label(s), or resolver.
     * @param transitionOverride Optional transition that overrides the
     *   component/default transition for this run.
     * @returns Promise resolving when all subscribed animations complete.
     */
    start: (
        definition: AnimationControlsDefinition,
        transitionOverride?: AnimationOptions
    ) => Promise<unknown[]>
    /**
     * Synchronously set every subscribed component to the target's final
     * values.
     *
     * @param definition Target keyframes, variant label(s), or resolver.
     */
    set: (definition: AnimationControlsDefinition) => void
    /** Stop animations on every subscribed component. */
    stop: () => void
    /**
     * Mark controls as mounted and return cleanup.
     *
     * Called automatically by `useAnimationControls()`.
     *
     * @returns Cleanup that marks controls unmounted and stops subscribers.
     */
    mount: () => () => void
}

export type MotionAnimate =
    | DOMKeyframesDefinition
    | string
    | string[]
    | AnimationControls
    | undefined

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
 * snapshot and the post-change measurement; `hasLayoutChanged` is false
 * only when the delta is within a tight float epsilon (±0.01px
 * translate), so even a sub-pixel real move is reported as a change.
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
 * post-change layout boxes. Wired through the element's internal
 * `ProjectionNode`.
 */
export type MotionOnProjectionUpdate = ((data: ProjectionUpdatePayload) => void) | undefined

/**
 * Layout box delivered to `onLayoutMeasure` — the element's viewport
 * position with motion-applied transforms (drag offset, in-flight FLIP)
 * stripped, i.e. its layout slot. Structurally identical to the
 * `layout`/`snapshot` halves of {@link ProjectionUpdatePayload}.
 */
export type LayoutMeasurePayload = {
    x: { min: number; max: number }
    y: { min: number; max: number }
}

/**
 * Fires every time the element's projection node (re)measures its
 * layout box: once at mount to seed the baseline, then on every
 * observed layout change. Mirrors framer-motion's `onLayoutMeasure`.
 * `Reorder.Item` uses this to keep its slot registered with the group.
 */
export type MotionOnLayoutMeasure = ((box: LayoutMeasurePayload) => void) | undefined

export type DragAxis = boolean | 'x' | 'y'
export type DragConstraints =
    | {
          top?: number
          left?: number
          right?: number
          bottom?: number
      }
    | HTMLElement
/**
 * Controls how far a draggable element can stretch beyond its constraints
 * before release.
 *
 * @example
 * ```svelte
 * <motion.div drag dragElastic={0.2} />
 * <motion.div drag dragElastic={{ left: 0, right: 0.5 }} />
 * ```
 */
export type DragElastic =
    | boolean
    | number
    | {
          top?: number
          left?: number
          right?: number
          bottom?: number
      }
export type DragTransition = {
    bounceStiffness?: number
    bounceDamping?: number
    power?: number
    timeConstant?: number
    restDelta?: number
    restSpeed?: number
    modifyTarget?: (target: number) => number
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
     * Numbers are accepted (and normalized to strings internally), so keyed
     * each-blocks can pass numeric ids — including falsy-but-valid `0`.
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
    key?: string | number
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
    /**
     * Customize the CSS `transform` string generated from Motion transform
     * shortcuts.
     *
     * Receives the latest transform values with CSS units applied, plus the
     * generated transform string. Return the transform string that should be
     * written to the element.
     *
     * @example
     * ```svelte
     * <motion.div
     *   style={{ x: 10 }}
     *   transformTemplate={({ x }, generated) => `translateY(${x}) ${generated}`}
     * />
     * ```
     */
    transformTemplate?: TransformTemplate
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
    /** Inline styles as a CSS string or Motion-style object with live MotionValue entries. */
    style?: string | MotionStyle
    /**
     * Renders as the SVG `x` **attribute**, distinct from the CSS `x` transform.
     * Use on SVG elements where `x` would otherwise be claimed as a transform.
     *
     * @example
     * ```svelte
     * <motion.rect attrX={xValue} attrY={yValue} />
     * ```
     */
    attrX?: MotionStyleValue
    /**
     * Renders as the SVG `y` **attribute**, distinct from the CSS `y` transform.
     * Use on SVG elements where `y` would otherwise be claimed as a transform.
     *
     * @example
     * ```svelte
     * <motion.rect attrX={xValue} attrY={yValue} />
     * ```
     */
    attrY?: MotionStyleValue
    /**
     * Renders as the SVG `scale` **attribute**, distinct from the CSS `scale`
     * transform. Only meaningful on `<feDisplacementMap>`, where it drives the
     * displacement amount; on shape elements the attribute is inert.
     *
     * @example
     * ```svelte
     * <motion.fedisplacementmap in="SourceGraphic" in2="noise" attrScale={warp} />
     * ```
     */
    attrScale?: MotionStyleValue
    /** CSS classes */
    class?: string
    /** Enable FLIP layout animations; string values select the upstream projection animation type. */
    layout?: boolean | 'position' | 'size' | 'preserve-aspect'
    /**
     * Fires after each `layout`-driven change with the FLIP delta from
     * the element's internal projection node. Requires `layout` to be
     * enabled.
     */
    onProjectionUpdate?: MotionOnProjectionUpdate
    /**
     * Fires with the element's layout box on every projection
     * (re)measure — at mount and after each observed layout change.
     * Mirrors framer-motion's `onLayoutMeasure`.
     */
    onLayoutMeasure?: MotionOnLayoutMeasure
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
    /**
     * Gates `layout` measurement so FLIP only recomputes when this value
     * changes, instead of on every render that touches `class`, `style`,
     * `layoutId`, or `transition`. Use it as a performance optimization when a
     * frequently-rerendering `layout` element only changes box rarely — pass a
     * value (e.g. a counter or the sorted key) that changes exactly when the
     * layout should be re-measured.
     *
     * When `undefined` (the default), measurement runs on every layout-affecting
     * render, matching framer-motion. Mirrors framer-motion's `layoutDependency`.
     *
     * Enabling `drag` opts the element out of `layoutDependency` gating
     * entirely — a `layout` element with `drag` set re-measures like an ungated
     * one whether or not a drag is in progress, matching upstream
     * `MeasureLayout` (which keys off the `drag` prop, not active-gesture
     * state). The gate only suppresses render-driven re-measurement; real
     * layout changes detected by the observer system — element resize,
     * structural/child mutations, and `AnimatePresence` enter/exit — are still
     * measured so the element keeps animating genuine moves.
     *
     * @example
     * ```svelte
     * <!-- Re-measures only when `order` changes, not on every tick -->
     * <motion.div layout layoutDependency={order} />
     * ```
     */
    layoutDependency?: unknown
    /** Ref to the element */
    ref?: HTMLElement | null
    /** Enable drag gestures. true for both axes, or lock to 'x'/'y'. */
    drag?: DragAxis
    /** Constrain dragging either to pixel bounds or an HTMLElement's bounding box. */
    dragConstraints?: DragConstraints
    /** Elasticity when overdragging beyond constraints (0 = none, 1 = full). */
    dragElastic?: DragElastic
    /** Continue with momentum/inertia after release (default true). */
    dragMomentum?: boolean
    /** Configure inertia/bounce physics for momentum. */
    dragTransition?: DragTransition
    /** Lock to the first detected axis of movement. */
    dragDirectionLock?: boolean
    /** Allow bubbling to parent drags. If false, uses a shared lock to prevent nesting. */
    dragPropagation?: boolean
    /** On release, animate back to origin (0) on both axes, or only the specified axis. */
    dragSnapToOrigin?: boolean | 'x' | 'y'
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
    /**
     * Child content rendered inside the element.
     *
     * Svelte slot content arrives as a `Snippet`. For Motion parity, this
     * also accepts a `MotionValue<number | string>` via `children={value}`,
     * which renders as live text matching upstream MotionValue children.
     */
    children?: Snippet | MotionValueChild
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
