/**
 * motion-dom `VisualElement` foundation (#449).
 *
 * Upstream Framer Motion routes every animation — enter, `animate` re-runs,
 * gestures, layout, drag, exit — through ONE `VisualElement` per component,
 * with `createAnimationState` arbitrating priority between variant types. This
 * module owns the pieces motion-dom deliberately does not ship (a visual-state
 * builder and the feature registry contents), so `_MotionContainer.svelte` can
 * create exactly one VisualElement per motion element.
 *
 * Ported from:
 * - `framer-motion/src/motion/utils/use-visual-state.ts` (`makeLatestValues`)
 * - `framer-motion/src/render/html/utils/create-render-state.ts`
 * - `framer-motion/src/render/svg/utils/create-render-state.ts`
 * - `framer-motion/src/motion/features/animation/index.ts` (`AnimationFeature`)
 * - `framer-motion/src/motion/features/definitions.ts:5-24` (enable-prop list)
 *
 * @remarks
 * As of plan 001 this foundation is INERT: nothing here starts an animation or
 * renders. Plans 002–005 move each existing writer onto it.
 */

import type { DragControls } from '$lib/types'
import {
    Feature,
    HTMLVisualElement,
    PanSession,
    SVGVisualElement,
    VisualElementDragControls,
    addPointerEvent,
    createAnimationState,
    frame,
    getFeatureDefinitions,
    isAnimationControls,
    isControllingVariants,
    isVariantNode,
    resolveMotionValue,
    resolveVariant,
    resolveVariantFromProps,
    scrapeHTMLMotionValuesFromProps,
    scrapeSVGMotionValuesFromProps,
    setFeatureDefinitions,
    type AnyResolvedKeyframe,
    type HTMLRenderState,
    type MotionNodeOptions,
    type PanHandler,
    type PanInfo,
    type PresenceContextProps,
    type ReducedMotionConfig,
    type ResolvedValues,
    type SVGRenderState,
    type ScrapeMotionValuesFromProps,
    type VisualElement
} from 'motion-dom'

/**
 * Variant labels inherited from the nearest motion ancestor.
 *
 * Mirrors the subset of upstream's `MotionContext` that `makeLatestValues`
 * consumes (`framer-motion/src/context/MotionContext/index.ts`).
 */
export interface MotionVariantContext {
    /** Parent's `initial` variant label(s). */
    initial?: unknown
    /** Parent's `animate` variant label(s). */
    animate?: unknown
}

/**
 * Props for the animation feature's enable check.
 *
 * Port of `framer-motion/src/motion/features/definitions.ts:5-24` — the
 * `animation` entry only.
 */
const ANIMATION_FEATURE_PROPS = [
    'animate',
    'variants',
    'whileHover',
    'whileTap',
    'exit',
    'whileInView',
    'whileFocus',
    'whileDrag'
] as const

/**
 * The animation feature: gives a VisualElement its `animationState`.
 *
 * Port of `framer-motion/src/motion/features/animation/index.ts`. The upstream
 * `mount()` subscribes `props.animate` when it is an `AnimationControls`
 * instance; svelte-motion's `animationControls` object shape differs from
 * upstream's, so the subscription is guarded to a no-op for now.
 */
export class AnimationFeature extends Feature<unknown> {
    private unmountControls?: () => void

    /**
     * @param node VisualElement this feature is attached to.
     */
    constructor(node: VisualElement) {
        super(node)
        // We dynamically generate the AnimationState manager as it contains a
        // reference to the underlying animation library (upstream comment).
        node.animationState ||= createAnimationState(node)
    }

    private updateAnimationControlsSubscription(): void {
        const { animate } = this.node.getProps() as { animate?: unknown }
        // plan 002: svelte-motion's AnimationControlsDefinition is not
        // upstream's AnimationControls, so `subscribe` is absent and this is a
        // no-op guard. The container also excludes controls objects from the
        // `animate` prop it hands the VisualElement.
        if (isAnimationControls(animate) && typeof animate.subscribe === 'function') {
            this.unmountControls = animate.subscribe(this.node)
        }
    }

    /**
     * Subscribe any provided animation controls to this VisualElement.
     *
     * @returns Nothing.
     */
    mount(): void {
        this.updateAnimationControlsSubscription()
    }

    /**
     * Re-subscribe when the `animate` prop identity changes.
     *
     * @returns Nothing.
     */
    update(): void {
        const { animate } = this.node.getProps() as { animate?: unknown }
        const { animate: prevAnimate } = (this.node.prevProps ?? {}) as { animate?: unknown }
        if (animate !== prevAnimate) {
            this.updateAnimationControlsSubscription()
        }
    }

    /**
     * Reset the animation state and drop any controls subscription.
     *
     * @returns Nothing.
     */
    unmount(): void {
        this.node.animationState?.reset()
        this.unmountControls?.()
    }
}

/**
 * Whether the animation feature applies to a set of motion props.
 *
 * @param props Motion node props.
 * @returns `true` when any animation-driving prop is present.
 */
export const isAnimationFeatureEnabled = (props: MotionNodeOptions): boolean =>
    ANIMATION_FEATURE_PROPS.some((name) => !!props[name as keyof MotionNodeOptions])

/** Monotonic id per exit-feature instance, mirroring upstream's module counter. */
let exitFeatureId = 0

/**
 * The exit feature: turns presence changes into `setActive('exit', …)`.
 *
 * Port of `framer-motion/src/motion/features/animation/exit.ts`. Exit is the
 * HIGHEST priority entry in `variantPriorityOrder`, so routing it through the
 * animationState gives it the same protected-keys semantics as every other
 * variant type instead of a bespoke sequence.
 *
 * Three behaviours, all upstream's:
 * - `mount()` reports completion for the previous occupant of this id and
 *   registers with the presence context (`exit.ts:74-84`).
 * - leaving (`isPresent` false) → `setActive('exit', true)`, and
 *   `onExitComplete(id)` once that promise resolves (`exit.ts:64-72`).
 * - re-entering after a COMPLETED exit → jump values to the resolved `initial`,
 *   `animationState.reset()`, `animateChanges()`; re-entering mid-exit just
 *   deactivates exit (`exit.ts:19-62`).
 */
export class ExitAnimationFeature extends Feature<unknown> {
    private id: number = exitFeatureId++
    private isExitComplete = false
    private exitAnimation?: Promise<unknown>

    /**
     * React to a presence flip.
     *
     * @returns Nothing.
     */
    update(): void {
        const presenceContext = this.node.presenceContext
        if (!presenceContext) return

        const { isPresent, onExitComplete } = presenceContext
        const { isPresent: prevIsPresent } = this.node.prevPresenceContext ?? {}

        if (!this.node.animationState) return
        // A descendant mounted during an active exit starts absent. Its first
        // update must still start an exit after registration; later updates
        // must not restart the same promise.
        if (isPresent === prevIsPresent && (isPresent || this.exitAnimation)) return

        if (isPresent && prevIsPresent === false) {
            // Re-entering. If the exit already finished the element sits at the
            // exit target, so rewind to `initial` before replaying the enter —
            // otherwise the enter animates from the exited position.
            if (this.isExitComplete) {
                const { initial, custom } = this.node.getProps() as {
                    initial?: unknown
                    custom?: unknown
                }
                if (
                    typeof initial === 'string' ||
                    (typeof initial === 'object' && initial !== null && !Array.isArray(initial))
                ) {
                    const resolved = resolveVariant(this.node, initial as never, custom)
                    if (resolved) {
                        const target = { ...resolved } as Record<string, unknown>
                        delete target.transition
                        delete target.transitionEnd
                        for (const key of Object.keys(target)) {
                            const value = target[key] as string | number | undefined | null
                            if (value === undefined || value === null) continue
                            this.node.getValue(key)?.jump(value)
                        }
                    }
                }
                // Match upstream: a retained child re-entering after exit is
                // no longer an initial child, even when initial was false.
                this.node.blockInitialAnimation = false
                this.node.animationState.reset()
                void this.node.animationState.animateChanges()
            } else {
                void this.node.animationState.setActive('exit', false)
            }

            this.isExitComplete = false
            this.exitAnimation = undefined
            return
        }

        const exitAnimation = (this.exitAnimation = this.node.animationState.setActive(
            'exit',
            !isPresent
        ))

        if (onExitComplete && !isPresent) {
            void exitAnimation.then(() => {
                // Match motion a47d6f25f: stopped exits can settle after re-entry.
                // Only the current promise may complete this presence cycle.
                if (this.exitAnimation !== exitAnimation) return
                this.isExitComplete = true
                onExitComplete(this.id)
            })
        }
    }

    /**
     * Register with the presence context.
     *
     * @returns Nothing.
     */
    mount(): void {
        const { register, onExitComplete } = this.node.presenceContext ?? {}
        if (onExitComplete) onExitComplete(this.id)
        // framer-motion motion/features/animation/exit.ts:81 @ v14.5.0 (#2503):
        // pass the node so popLayout can find the outermost motion element.
        if (register) this.unmount = register(this.id, this.node)
    }

    /**
     * Replaced by `register`'s unregister function in {@link mount}.
     *
     * @returns Nothing.
     */
    unmount(): void {}
}

/**
 * Whether the exit feature applies to a set of motion props.
 *
 * @param props Motion node props.
 * @returns `true` when an `exit` definition is present.
 */
export const isExitFeatureEnabled = (props: MotionNodeOptions): boolean => !!props.exit

/**
 * The drag feature: drives `drag` with motion-dom's `VisualElementDragControls`.
 *
 * Port of `framer-motion/src/gestures/drag/index.ts` (v14.5.0). Registered by
 * {@link registerMotionFeatures}; enabled by {@link isDragFeatureEnabled}.
 *
 * Two documented Svelte deviations (re-check both on each Motion bump):
 *
 * 1. The feature can be instantiated by a props-sync pass before the
 *    VisualElement has an instance, in which case `addListeners()` has no
 *    element to bind. Listener attachment is retried on the next `update()`.
 * 2. React re-measures on every commit via `MeasureLayout`, which re-fires the
 *    projection `'measure'` event the controller resolves ref constraints from.
 *    Here, a `dragConstraints` change re-fires `'measure'` explicitly.
 *
 * @example
 * ```ts
 * setFeatureDefinitions({
 *     drag: { isEnabled: isDragFeatureEnabled, Feature: DragGestureFeature }
 * })
 * ```
 */
export class DragGestureFeature extends Feature<HTMLElement> {
    controls: VisualElementDragControls
    private removeGroupControls: () => void = () => {}
    private removeListeners: (() => void) | null = null

    /**
     * @param node VisualElement this feature is attached to.
     */
    constructor(node: VisualElement<HTMLElement>) {
        super(node)
        this.controls = new VisualElementDragControls(node)
    }

    /**
     * Subscribe this feature's controller to the `dragControls` prop, if any.
     *
     * @returns Nothing.
     */
    private subscribeControls(): void {
        const { dragControls } = this.node.getProps() as { dragControls?: DragControls }
        if (dragControls) {
            this.removeGroupControls = dragControls.subscribe(this.controls)
        }
    }

    /**
     * Attach the controller's pointerdown listener once the element exists
     * (Svelte deviation 1).
     *
     * @returns Nothing.
     */
    private attachListeners(): void {
        if (this.removeListeners || !this.node.current) return
        this.removeListeners = this.controls.addListeners() ?? null
    }

    /**
     * Subscribe to `dragControls` and attach the pointerdown listener.
     *
     * @returns Nothing.
     */
    mount(): void {
        this.subscribeControls()
        this.attachListeners()
    }

    /**
     * Re-subscribe on a `dragControls` identity change, retry listener
     * attachment, and re-measure when `dragConstraints` changes.
     *
     * @returns Nothing.
     */
    update(): void {
        // Svelte deviation 1: retry when the instance wasn't ready at mount.
        this.attachListeners()
        const { dragControls } = this.node.getProps() as { dragControls?: unknown }
        const { dragControls: prev } = (this.node.prevProps ?? {}) as { dragControls?: unknown }
        if (dragControls !== prev) {
            this.removeGroupControls()
            this.removeGroupControls = () => {}
            this.subscribeControls()
        }
        // Svelte deviation 2: React re-measures (and so re-fires the projection
        // 'measure' event the controller resolves ref constraints from) on
        // every commit via MeasureLayout. A `dragConstraints` ref bound after
        // mount would otherwise never be measured or observed here.
        const { dragConstraints } = this.node.getProps()
        const { dragConstraints: prevConstraints } = (this.node.prevProps ?? {}) as {
            dragConstraints?: unknown
        }
        const projection = this.node.projection as
            | {
                  layout?: { layoutBox: unknown }
                  notifyListeners: (name: string, ...args: unknown[]) => void
              }
            | undefined
        if (dragConstraints !== prevConstraints && projection?.layout) {
            projection.notifyListeners('measure', projection.layout.layoutBox)
        }
    }

    /**
     * Detach listeners; end the pan session unless a drag is live.
     *
     * @returns Nothing.
     */
    unmount(): void {
        this.removeGroupControls()
        this.removeListeners?.()
        this.removeListeners = null
        if (!this.controls.isDragging) this.controls.endPanSession()
    }
}

/**
 * Whether the drag feature applies (upstream `definitions.ts`: `drag`, `dragControls`).
 *
 * @param props Motion node props.
 * @returns `true` when `drag` or `dragControls` is set.
 */
export const isDragFeatureEnabled = (props: MotionNodeOptions): boolean =>
    !!(props.drag || (props as { dragControls?: unknown }).dragControls)

/** A public pan callback (`onPan`, `onPanStart`, `onPanSessionStart`, `onPanEnd`). */
type PanEventHandler = (event: PointerEvent, info: PanInfo) => void

/** `PanSession`'s `transformPagePoint` option type. */
type PanTransformPagePoint = NonNullable<
    ConstructorParameters<typeof PanSession>[2]
>['transformPagePoint']

/** The pan callbacks `PanGestureFeature` reads off the VisualElement props. */
interface PanGestureProps {
    onPanSessionStart?: PanEventHandler
    onPanStart?: PanEventHandler
    onPan?: PanEventHandler
    onPanEnd?: PanEventHandler
}

/**
 * Defer a pan callback to Motion's `update` step.
 *
 * Port of `framer-motion/src/gestures/pan/index.ts:12-17` (v14.5.0).
 * `PanSession` only ever delivers pointer events, but types its handlers with
 * `Event`, hence the narrowing cast.
 *
 * @param handler The user's callback, if any.
 * @returns A session handler that schedules `handler` with `frame.update`.
 */
const asyncPanHandler =
    (handler?: PanEventHandler): PanHandler =>
    (event, info) => {
        if (handler) {
            frame.update(() => handler(event as PointerEvent, info), false, true)
        }
    }

/**
 * Resolve the window a VisualElement's element lives in.
 *
 * Port of `framer-motion/src/utils/get-context-window.ts` (v14.5.0).
 *
 * @param node The VisualElement.
 * @returns The element's `defaultView`, or `null` before mount.
 *
 * @example
 * ```ts
 * getContextWindow(visualElement) // → the element's window once mounted
 * ```
 */
export const getContextWindow = ({
    current
}: VisualElement<Element>): (Window & typeof globalThis) | null =>
    current ? current.ownerDocument.defaultView : null

/**
 * The pan feature: reports `onPanSessionStart`/`onPanStart`/`onPan`/`onPanEnd`
 * from motion-dom's `PanSession`.
 *
 * Port of `framer-motion/src/gestures/pan/index.ts` (v14.5.0). Registered by
 * {@link registerMotionFeatures}; enabled by {@link isPanFeatureEnabled}. Like
 * upstream it runs alongside the drag feature when both are enabled.
 *
 * One documented Svelte deviation (re-check on each Motion bump): the feature
 * can be instantiated by a props-sync pass before the VisualElement has an
 * instance, so the pointerdown listener is attached on the first `mount()` or
 * `update()` that sees `node.current` (same as {@link DragGestureFeature}).
 *
 * @example
 * ```ts
 * setFeatureDefinitions({
 *     pan: { isEnabled: isPanFeatureEnabled, Feature: PanGestureFeature }
 * })
 * ```
 */
export class PanGestureFeature extends Feature<Element> {
    private session?: PanSession
    private removePointerDownListener: (() => void) | null = null

    /**
     * Start a pan session for a pointerdown on the element.
     *
     * @param pointerDownEvent The originating pointerdown.
     * @returns Nothing.
     */
    onPointerDown(pointerDownEvent: PointerEvent): void {
        this.session = new PanSession(pointerDownEvent, this.createPanHandlers(), {
            // motion-dom types the getter's return as `any`.
            transformPagePoint: this.node.getTransformPagePoint() as PanTransformPagePoint,
            contextWindow: getContextWindow(this.node)
        })
    }

    /**
     * Build the session handlers from the node's current props.
     *
     * Start/move callbacks run on `frame.update`; `onPanEnd` on
     * `frame.postRender` (upstream `pan/index.ts:35-50`).
     *
     * @returns The `PanSession` handler set.
     */
    createPanHandlers(): {
        onSessionStart: PanHandler
        onStart: PanHandler
        onMove: PanHandler
        onEnd: PanHandler
    } {
        const { onPanSessionStart, onPanStart, onPan, onPanEnd } =
            this.node.getProps() as PanGestureProps

        return {
            onSessionStart: asyncPanHandler(onPanSessionStart),
            onStart: asyncPanHandler(onPanStart),
            onMove: asyncPanHandler(onPan),
            onEnd: (event, info) => {
                delete this.session
                if (onPanEnd) {
                    frame.postRender(() => onPanEnd(event as PointerEvent, info))
                }
            }
        }
    }

    /**
     * Attach the pointerdown listener once the element exists (Svelte deviation).
     *
     * @returns Nothing.
     */
    private attachListener(): void {
        if (this.removePointerDownListener || !this.node.current) return
        this.removePointerDownListener = addPointerEvent(
            this.node.current,
            'pointerdown',
            (event: PointerEvent) => this.onPointerDown(event)
        )
    }

    /**
     * Attach the pointerdown listener.
     *
     * @returns Nothing.
     */
    mount(): void {
        this.attachListener()
    }

    /**
     * Retry listener attachment and hot-swap the live session's handlers.
     *
     * @returns Nothing.
     */
    update(): void {
        this.attachListener()
        this.session && this.session.updateHandlers(this.createPanHandlers())
    }

    /**
     * Detach the listener and end any live session.
     *
     * @returns Nothing.
     */
    unmount(): void {
        this.removePointerDownListener?.()
        this.removePointerDownListener = null
        this.session && this.session.end()
    }
}

/**
 * Whether the pan feature applies (upstream `definitions.ts:21`: `onPan`,
 * `onPanStart`, `onPanSessionStart`, `onPanEnd`).
 *
 * @param props Motion node props.
 * @returns `true` when any pan callback is set.
 */
export const isPanFeatureEnabled = (props: MotionNodeOptions): boolean => {
    const { onPan, onPanStart, onPanSessionStart, onPanEnd } = props as PanGestureProps
    return !!(onPan || onPanStart || onPanSessionStart || onPanEnd)
}

let featuresRegistered = false

/**
 * Register svelte-motion's motion-dom feature definitions.
 *
 * motion-dom ships the feature *registry* but zero feature implementations —
 * the consumer registers them. `setFeatureDefinitions` REPLACES the registry
 * wholesale, so this merges into whatever is already registered and is
 * idempotent: `LazyMotion` may mount many components, and the registry is
 * global, so it must never be clobbered per component.
 *
 * @returns Nothing.
 *
 * @example
 * ```ts
 * registerMotionFeatures()
 * ```
 */
export const registerMotionFeatures = (): void => {
    if (featuresRegistered) return
    featuresRegistered = true
    setFeatureDefinitions({
        ...getFeatureDefinitions(),
        animation: {
            isEnabled: isAnimationFeatureEnabled,
            Feature: AnimationFeature as never
        },
        exit: {
            isEnabled: isExitFeatureEnabled,
            Feature: ExitAnimationFeature as never
        },
        drag: {
            isEnabled: isDragFeatureEnabled,
            Feature: DragGestureFeature as never
        },
        pan: {
            isEnabled: isPanFeatureEnabled,
            Feature: PanGestureFeature as never
        }
    })
}

/**
 * Build the mutable render-state buffer a VisualElement renders through.
 *
 * Port of `framer-motion/src/render/html/utils/create-render-state.ts` and
 * `framer-motion/src/render/svg/utils/create-render-state.ts`.
 *
 * @param isSVG Whether the element is an SVG element (adds the `attrs` buffer).
 * @returns A fresh render state.
 *
 * @example
 * ```ts
 * const renderState = createRenderState(false)
 * ```
 */
export function createRenderState(isSVG: true): SVGRenderState
export function createRenderState(isSVG: false): HTMLRenderState
export function createRenderState(isSVG: boolean): HTMLRenderState | SVGRenderState
export function createRenderState(isSVG: boolean): HTMLRenderState | SVGRenderState {
    const html: HTMLRenderState = {
        style: {},
        transform: {},
        transformOrigin: {},
        vars: {}
    }
    return isSVG ? { ...html, attrs: {} } : html
}

/**
 * Resolve the values a VisualElement should start life holding.
 *
 * Port of `framer-motion/src/motion/utils/use-visual-state.ts:60-132`
 * (`makeLatestValues`): scrape MotionValues off the props, inherit variant
 * labels from the parent when this node is a non-controlling variant node,
 * pick `initial` unless the initial animation is blocked (then `animate`),
 * resolve it through `resolveVariantFromProps`, copy target keys (keyframe
 * arrays collapse to index 0, or to the LAST keyframe when the initial
 * animation is blocked), then apply `transitionEnd`.
 *
 * @param props Motion node props.
 * @param context Variant labels inherited from the nearest motion ancestor.
 * @param presenceContext Presence context, or `null` when not inside presence.
 * @param scrapeMotionValues Renderer-specific MotionValue scraper.
 * @returns The resolved starting values.
 *
 * @example
 * ```ts
 * const latestValues = makeLatestValues(
 *     { initial: { opacity: 0 } },
 *     {},
 *     null,
 *     scrapeHTMLMotionValuesFromProps
 * )
 * // → { opacity: 0 }
 * ```
 */
export const makeLatestValues = (
    props: MotionNodeOptions,
    context: MotionVariantContext,
    presenceContext: PresenceContextProps | null,
    scrapeMotionValues: ScrapeMotionValuesFromProps
): ResolvedValues => {
    const values: ResolvedValues = {}

    const motionValues = scrapeMotionValues(props, {})
    for (const key of Object.keys(motionValues)) {
        values[key] = resolveMotionValue(motionValues[key])
    }

    let { initial, animate } = props as { initial?: unknown; animate?: unknown }
    const controllingVariants = isControllingVariants(props)
    const variantNode = isVariantNode(props)

    if (
        context &&
        variantNode &&
        !controllingVariants &&
        (props as { inherit?: boolean }).inherit !== false
    ) {
        if (initial === undefined) initial = context.initial
        if (animate === undefined) animate = context.animate
    }

    let isInitialAnimationBlocked = presenceContext ? presenceContext.initial === false : false
    isInitialAnimationBlocked = isInitialAnimationBlocked || initial === false

    const variantToSet = isInitialAnimationBlocked ? animate : initial

    if (variantToSet && typeof variantToSet !== 'boolean' && !isAnimationControls(variantToSet)) {
        const list = Array.isArray(variantToSet) ? variantToSet : [variantToSet]
        for (let i = 0; i < list.length; i++) {
            const resolved = resolveVariantFromProps(props, list[i] as never)
            if (!resolved) continue

            const { transitionEnd } = resolved
            const target: Record<string, unknown> = { ...resolved }
            delete target.transitionEnd
            delete target.transition
            for (const key of Object.keys(target)) {
                let valueTarget = target[key]

                if (Array.isArray(valueTarget)) {
                    /**
                     * Take final keyframe if the initial animation is blocked
                     * because we want to initialise at the end of that blocked
                     * animation (upstream comment).
                     */
                    const index = isInitialAnimationBlocked ? valueTarget.length - 1 : 0
                    valueTarget = valueTarget[index]
                }

                if (valueTarget !== null) {
                    values[key] = valueTarget as AnyResolvedKeyframe
                }
            }
            for (const key of Object.keys(transitionEnd ?? {})) {
                values[key] = (transitionEnd as Record<string, AnyResolvedKeyframe>)[key]
            }
        }
    }

    return values
}

/** Options for {@link createMotionVisualElement}. */
export interface CreateMotionVisualElementOptions {
    /** Motion node props (the upstream `MotionProps` subset motion-dom reads). */
    props: MotionNodeOptions
    /** Parent VisualElement from the motion tree context, if any. */
    parent?: VisualElement | null
    /** Presence context, or `null` when not inside `AnimatePresence`. */
    presenceContext?: PresenceContextProps | null
    /** Reduced-motion policy from `MotionConfig`. */
    reducedMotionConfig?: ReducedMotionConfig
    /** Skip animations entirely (static rendering). */
    skipAnimations?: boolean
    /** Whether the rendered element is an SVG element. */
    isSVG?: boolean
    /** Block the initial animation (presence re-entry). */
    blockInitialAnimation?: boolean
    /** Variant labels inherited from the nearest motion ancestor. */
    context?: MotionVariantContext
    /**
     * Seed `latestValues` from the props via {@link makeLatestValues}
     * (default `true`, matching upstream).
     *
     * Pass `false` while the VisualElement is not yet the renderer: the
     * projection node holds `latestValues` BY REFERENCE
     * (`new HTMLProjectionNode(visualElement.latestValues, …)`) and treats the
     * transform keys in it as transforms currently applied to the element. A
     * node seeded with an `initial`/`animate` target it has not actually
     * rendered therefore reports a wrong box out of `measure()`/scale
     * correction. plan 002 turns seeding on together with rendering.
     */
    seedLatestValues?: boolean
}

/**
 * Create the single motion-dom VisualElement backing one motion component.
 *
 * There must be exactly ONE VisualElement per DOM element: motion-dom's
 * `visualElementStore` is a `WeakMap<instance, VisualElement>` populated inside
 * `VisualElement.mount()`, so two VisualElements on the same element would
 * overwrite each other and double-render.
 *
 * @param options Creation options; see {@link CreateMotionVisualElementOptions}.
 * @returns A new `HTMLVisualElement` or `SVGVisualElement` (projection allowed).
 *
 * @example
 * ```ts
 * const ve = createMotionVisualElement({ props: { animate: { opacity: 1 } } })
 * ve.mount(element)
 * ```
 */
export const createMotionVisualElement = (
    options: CreateMotionVisualElementOptions
): VisualElement => {
    registerMotionFeatures()

    const {
        props,
        parent = null,
        presenceContext = null,
        reducedMotionConfig,
        skipAnimations,
        isSVG = false,
        blockInitialAnimation,
        context = {},
        seedLatestValues = true
    } = options

    const scrape = isSVG ? scrapeSVGMotionValuesFromProps : scrapeHTMLMotionValuesFromProps
    const latestValues = seedLatestValues
        ? makeLatestValues(props, context, presenceContext, scrape)
        : {}
    const shared = {
        parent: parent ?? undefined,
        props,
        presenceContext,
        reducedMotionConfig,
        skipAnimations,
        blockInitialAnimation
    }

    if (isSVG) {
        return new SVGVisualElement(
            {
                ...shared,
                visualState: {
                    latestValues,
                    renderState: createRenderState(true)
                }
            },
            { allowProjection: true }
        )
    }

    return new HTMLVisualElement(
        {
            ...shared,
            visualState: {
                latestValues,
                renderState: createRenderState(false)
            }
        },
        { allowProjection: true }
    )
}
