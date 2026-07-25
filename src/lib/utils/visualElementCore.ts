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

import {
    Feature,
    HTMLVisualElement,
    SVGVisualElement,
    createAnimationState,
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

        if (!this.node.animationState || isPresent === prevIsPresent) return

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
                this.node.animationState.reset()
                void this.node.animationState.animateChanges()
            } else {
                void this.node.animationState.setActive('exit', false)
            }

            this.isExitComplete = false
            return
        }

        const exitAnimation = this.node.animationState.setActive('exit', !isPresent)

        if (onExitComplete && !isPresent) {
            void exitAnimation.then(() => {
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
        if (register) this.unmount = register(this.id)
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
