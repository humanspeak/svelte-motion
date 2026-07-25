<script lang="ts" module>
    // Module-level counter for deterministic key generation (avoids SSR hydration mismatch)
    let keyCounter = 0
</script>

<script lang="ts">
    import { getMotionConfig } from '$lib/components/motionConfig.context'
    import { getLazyMotionContext } from '$lib/components/lazyMotion.context'
    import { domMax } from '$lib/features/domMax'
    import {
        filterReducedMotionKeyframes,
        useReducedMotionConfig
    } from '$lib/utils/reducedMotionConfig.svelte'
    import type {
        MotionProps,
        AnimationControlsDefinition,
        AnimationControlsSubscriber,
        DragAxis,
        DragInfo,
        MotionOnPan,
        MotionOnPanEnd,
        MotionOnPanSessionStart,
        MotionOnPanStart
    } from '$lib/types'
    import { isNotEmpty } from '$lib/utils/objects'
    import { sleep } from '$lib/utils/testing'
    import { type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
    import {
        calcBoxDelta,
        cancelFrame,
        createDelta,
        frame,
        isDeltaZero,
        isMotionValue,
        styleEffect,
        svgEffect,
        animateVisualElement,
        transformProps,
        visualElementStore,
        type MotionNodeOptions,
        type PresenceContextProps,
        type MotionValue
    } from 'motion-dom'
    import { isPlaywrightEnv, pwLog } from '$lib/utils/log'
    import { onDestroy, untrack, type Snippet } from 'svelte'
    import { VOID_TAGS } from '$lib/utils/constants'
    import { mergeTransitions, animateWithLifecycle } from '$lib/utils/animation'
    import { isAnimationControls } from '$lib/utils/animationControls.svelte'
    import { attachWhileTap } from '$lib/utils/interaction'
    import {
        attachWhileHover,
        computeHoverBaseline,
        readTransformChannels,
        splitHoverDefinition
    } from '$lib/utils/hover'
    import { createGestureCoordinator } from '$lib/utils/gestureCoordinator'
    import { attachWhileFocus } from '$lib/utils/focus'
    import { attachWhileInView } from '$lib/utils/inView.svelte'
    import {
        measureRect,
        computeFlipTransforms,
        runFlipAnimation,
        finishFlipAnimations,
        setCompositorHints,
        observeLayoutChanges,
        selectLayoutDependencies,
        sizeCorrectionSeedEvent,
        sizeCorrectionEndEvent,
        type RectLike
    } from '$lib/utils/layout'
    import type { SvelteHTMLElements } from 'svelte/elements'
    import {
        applyMotionStyleEffect,
        collectMotionStyleValues,
        extractTransform,
        mergeInlineStyles,
        serializeMotionStyle
    } from '$lib/utils/style'
    import { isNativelyFocusable } from '$lib/utils/a11y'
    import {
        getAnimatePresenceContext,
        getPresenceChildContext,
        getPresenceDepth,
        setPresenceDepth
    } from '$lib/utils/presence'
    import { getInitialKeyframes } from '$lib/utils/initial'
    import { attachDrag, type AttachDragCleanup } from '$lib/utils/drag'
    import { attachPan, type AttachPanCleanup } from '$lib/utils/pan'
    import { boxFromRect, MotionDomProjectionAdapter } from '$lib/utils/motionDomProjection'
    import {
        getMotionDomProjectionParent,
        setMotionDomProjectionParent
    } from '$lib/components/motionDomProjection.context'
    import {
        getVisualElementParent,
        setVisualElementParent
    } from '$lib/components/visualElementTree.context'
    import { createMotionVisualElement } from '$lib/utils/visualElementCore'
    import {
        resolveInitial,
        resolveAnimate,
        resolveExit,
        resolveWhile,
        resolveVariantList,
        resolveRestingValues,
        resolveWildcardKeyframes
    } from '$lib/utils/variants'
    import {
        setVariantContext,
        getVariantContext,
        setInitialFalseContext,
        getInitialFalseContext,
        setCustomContext,
        getCustomContext
    } from '$lib/components/variantContext.context'
    import { writable } from 'svelte/store'
    import {
        transformSVGPathProperties,
        computeNormalizedSVGInitialAttrs,
        computeSSRSVGAttrValues,
        extractSVGMotionValueAttributes,
        isSVGTag,
        resolveSVGTagName,
        SVG_NAMESPACE
    } from '$lib/utils/svg'
    import {
        createOptimizedAppearData,
        createOptimizedAppearScript,
        finishOptimizedAppearAnimation,
        hasOptimizedAppearAnimation,
        markMotionMounted,
        optimizedAppearDataAttribute
    } from '$lib/utils/optimizedAppear'
    import { getLayoutIdRegistry } from '$lib/utils/layoutId'
    import {
        getLayoutScrollContainerRef,
        setLayoutScrollContainer
    } from '$lib/components/layoutScroll.context'
    import { getLayoutGroupContext, scopeLayoutId } from '$lib/components/layoutGroup.context'
    import {
        bindMotionValueChild,
        renderMotionValueChild,
        type MotionValueChild
    } from '$lib/utils/motionValueChild'

    type Props = MotionProps & {
        children?: Snippet
        motionValueChild?: MotionValueChild
        tag: keyof SvelteHTMLElements
        [key: string]: unknown
    }

    const componentHydrationId = $props.id()

    let {
        children,
        motionValueChild,
        tag = 'div',
        key: keyProp,
        variants: variantsProp,
        custom: customProp,
        initial: initialProp,
        animate: animateProp,
        exit: exitProp,
        transition: transitionProp,
        onAnimationStart: onAnimationStartProp,
        onAnimationComplete: onAnimationCompleteProp,
        transformTemplate: transformTemplateProp,
        style: styleProp,
        class: classProp,
        whileTap: whileTapProp,
        whileHover: whileHoverProp,
        whileFocus: whileFocusProp,
        whileInView: whileInViewProp,
        viewport: viewportProp,
        whileDrag: whileDragProp,
        whilePan: whilePanProp,
        onPanSessionStart: onPanSessionStartProp,
        onPanStart: onPanStartProp,
        onPan: onPanProp,
        onPanEnd: onPanEndProp,
        onHoverStart: onHoverStartProp,
        onHoverEnd: onHoverEndProp,
        onFocusStart: onFocusStartProp,
        onFocusEnd: onFocusEndProp,
        onInViewStart: onInViewStartProp,
        onInViewEnd: onInViewEndProp,
        onTapStart: onTapStartProp,
        onTap: onTapProp,
        onTapCancel: onTapCancelProp,
        onDragStart: onDragStartProp,
        onDrag: onDragProp,
        onDragEnd: onDragEndProp,
        onDirectionLock: onDirectionLockProp,
        onDragTransitionEnd: onDragTransitionEndProp,
        drag: dragProp,
        dragConstraints: dragConstraintsProp,
        dragElastic: dragElasticProp,
        dragMomentum: dragMomentumProp,
        dragTransition: dragTransitionProp,
        dragDirectionLock: dragDirectionLockProp,
        dragPropagation: dragPropagationProp,
        dragSnapToOrigin: dragSnapToOriginProp,
        dragListener: dragListenerProp,
        dragControls: dragControlsProp,
        layout: layoutProp,
        layoutId: layoutIdProp,
        layoutScroll: layoutScrollProp,
        layoutDependency: layoutDependencyProp,
        onProjectionUpdate: onProjectionUpdateProp,
        onLayoutMeasure: onLayoutMeasureProp,
        // trunk-ignore(eslint/no-useless-assignment): `ref` is write-only here — mirrored from the internal `element` node via the effect below
        ref = $bindable(),
        ...rest
    }: Props = $props()
    // The public `ref` bindable defaults to `undefined` so consumers can bind a
    // freshly-declared `$state()` (the idiomatic element ref, initially
    // `undefined`) without tripping Svelte's `props_invalid_value` (#417).
    //
    // Internally we keep a separate `element` ref that defaults to `null`. The
    // animate effects below rely on the exact reactive update timing of this
    // node going `null → element`; defaulting it to `undefined` instead subtly
    // reorders effect runs and breaks re-running animations on prop change. We
    // therefore decouple the internal node from the public bindable and mirror
    // one into the other.
    let element = $state<HTMLElement | null>(null)
    $effect(() => {
        ref = element
        // Reset on teardown so `bind:ref` consumers see `null` when the element
        // unmounts (matching native `bind:this`). The mirror effect is disposed
        // before `element` itself goes null, so without this the consumer would
        // otherwise keep a stale node reference after unmount.
        return () => {
            ref = null
        }
    })
    let isLoaded = $state<'mounting' | 'initial' | 'ready' | 'animated'>('mounting')
    // True once the enter/animate animation has COMPLETED. Until then the
    // WAAPI animation owns the transform; flipping the inline baseline to
    // the target mid-run causes a one-frame snap (the target shows through
    // for the frame the inline changes). We therefore only apply the target
    // as the inline style once settled — see the style derivation. (#377)
    let enterAnimationSettled = $state(false)
    let lastAnimateRestingValues = $state<Record<string, unknown> | undefined>(undefined)
    let lastAnimateRestingJson = $state<string | undefined>(undefined)
    // Raw animate-prop JSON the settle-resolved resting values were computed
    // FROM: lets the reactive baseline detect that its raw wildcard/relative
    // definition already has a resolved settle snapshot to prefer.
    let lastAnimateSourceJson = $state<string | undefined>(undefined)
    /** An unresolved wildcard (`null`) or relative (`'+=50'`) keyframe value. */
    const isUnresolvedKeyframeValue = (value: unknown): boolean =>
        value === null || value === undefined || (typeof value === 'string' && /^[+-]=/.test(value))
    let dataPath = $state<number>(-1)
    const motionConfig = $derived(getMotionConfig())
    const lazyMotion = getLazyMotionContext()
    const activeFeatures = $derived(lazyMotion?.getFeatures() ?? domMax)
    const hasGestureFeatures = $derived(!!activeFeatures.gestures)
    const hasDragFeatures = $derived(!!activeFeatures.drag)
    const hasLayoutFeatures = $derived(!!activeFeatures.layout)
    const reducedMotionState = useReducedMotionConfig()
    // `.current` is $state-backed inside reducedMotionState; tracking it via
    // $derived makes `reducedMotion` re-evaluate whenever the OS preference
    // or `<MotionConfig reducedMotion>` policy changes.
    const reducedMotion = $derived(reducedMotionState.current)

    // Get presence context to check if we're inside AnimatePresence
    const context = getAnimatePresenceContext()
    // Inside a <PresenceChild>, the wrapper drives the exit. Skip the
    // clone-based exit registration on this element so we don't double-fire
    // (custom exit, then clone of a node the wrapper already let go).
    // Enter-side coordination (shouldAnimateEnter, mode='wait' blocking)
    // remains active so the element still slots into the outer presence flow.
    const presenceChildContext = getPresenceChildContext()
    const inPresenceChild = !!presenceChildContext

    // Get layoutId registry (provided by AnimatePresence or a parent LayoutGroup)
    const layoutIdRegistry = getLayoutIdRegistry()

    // Scope layoutId by the surrounding <LayoutGroup>, so identical
    // layoutId values in two sibling groups don't cross-animate (#311).
    // Undefined when no group is in scope — descendants behave exactly
    // as before relative to the global registry.
    const layoutGroupId = getLayoutGroupContext()
    const scopedLayoutId = $derived(
        layoutIdProp ? scopeLayoutId(layoutGroupId, layoutIdProp) : undefined
    )

    // Capture the ancestor `layoutScroll` chain BEFORE we potentially shadow
    // the context with ourselves below — this element's own FLIP measurements
    // must resolve against the *ancestors*' scroll containers, not against
    // itself.
    //
    // We walk the full chain (not just the nearest) so a `layoutScroll`
    // outside another `layoutScroll` still contributes to descendant
    // measurements — matches framer-motion's `removeElementScroll` walking
    // `this.path`.
    const ancestorScrollContainerRef = getLayoutScrollContainerRef()
    if (layoutScrollProp) {
        // Publish [...ancestorChain, ownElement]. The chain is collected
        // lazily because element refs bind after mount.
        setLayoutScrollContainer(() => {
            const inherited = ancestorScrollContainerRef?.() ?? []
            return element ? [...inherited, element] : inherited
        })
    }
    const resolveLayoutScrollAncestors = (): HTMLElement[] => {
        const refs = ancestorScrollContainerRef?.() ?? []
        // Filter out unbound refs (HTMLElement | null | undefined → HTMLElement[]).
        return refs.filter((el): el is HTMLElement => Boolean(el))
    }

    const splitSerializedTransform = (style: string): { rest: string; transform: string } => {
        const rest: string[] = []
        let transform = ''

        for (const declaration of style.split(';')) {
            const trimmed = declaration.trim()
            if (!trimmed) continue

            const separator = trimmed.indexOf(':')
            if (separator === -1) {
                rest.push(trimmed)
                continue
            }

            const property = trimmed.slice(0, separator).trim()
            const value = trimmed.slice(separator + 1).trim()
            if (property === 'transform') {
                transform = value === 'none' ? '' : value
            } else {
                rest.push(trimmed)
            }
        }

        return { rest: rest.join('; '), transform }
    }

    const serializedStyleProp = $derived(serializeMotionStyle(styleProp, transformTemplateProp))
    // The user-authored transform, sourced from the `style` prop rather
    // than the live inline transform — the latter already carries any
    // transform-type `initial`/`animate` keyframe by the time the
    // projection adapter measures, which would be mistaken for the
    // user's base.
    const userBaseTransform = $derived(extractTransform(styleProp))
    const getStyleTransformValues = () => {
        if (!styleProp || typeof styleProp !== 'object' || Array.isArray(styleProp)) return {}

        const values: Record<string, string | number> = {}
        for (const [key, source] of Object.entries(styleProp)) {
            if (!transformProps.has(key)) continue
            const value = isMotionValue(source) ? source.get() : source
            if (typeof value === 'string' || typeof value === 'number') values[key] = value
        }
        return values
    }
    // Non-transform authored base values (currently `opacity`) captured ONCE
    // from the DOM at element creation while at rest, mirroring upstream
    // `VisualElement.baseTarget` (read once, never per gesture). Threaded into
    // `computeHoverBaseline` so hover-end restores the true rest value instead
    // of a mid-animation transient — reading live `getComputedStyle` at each
    // hover START would capture a partway value on rapid hover/unhover cycles.
    // Only keys NOT driven by `initial`/`animate` matter here: for driven keys
    // the baseline resolves from those records first, so a value captured mid
    // enter-animation is never consulted. Populated in the mount effect below.
    let baseStyleValues: Record<string, string | number> | null = null
    const captureBaseStyleValues = () => {
        if (baseStyleValues || !element) return
        const cs = getComputedStyle(element)
        const opacity = cs.getPropertyValue('opacity')
        baseStyleValues = opacity ? { opacity } : {}
    }
    const getBaseStyleValues = (): Record<string, unknown> => baseStyleValues ?? {}
    let liveGestureTransform = $state<string | null>(null)
    let liveGestureTransformValues: Record<string, string | number> | null = null
    const serializedStyleWithLiveGestureTransform = $derived.by(() => {
        if (!liveGestureTransform) return serializedStyleProp

        const { rest } = splitSerializedTransform(serializedStyleProp)
        return `${rest}${rest ? '; ' : ''}transform: ${liveGestureTransform}`
    })

    $effect(() => {
        if (!element || !liveGestureTransform) return
        if (element.style.transform === liveGestureTransform) return

        element.style.transform = liveGestureTransform
    })

    const resolvePresenceCustom = () => {
        const presenceCustom = context?.custom
        return presenceCustom !== undefined ? presenceCustom : effectiveCustom
    }
    /**
     * Adapt the `PresenceChild` context into motion-dom's `PresenceContextProps`
     * so `ExitAnimationFeature` can drive `setActive('exit', …)` (plan 004).
     *
     * A FRESH object every call, deliberately. `VisualElement.update()` stores
     * `prevPresenceContext = presenceContext` before assigning the new one, and
     * the exit feature fires only when `isPresent !== prevIsPresent`. Handing it
     * the same object with a live getter would make those two reads identical and
     * the feature would never see a flip.
     *
     * Only the `PresenceChild` path is wired: direct `AnimatePresence` children
     * exit through the CLONE path in `presence.ts`, which is a deliberate
     * architectural deviation this plan keeps (the clone is detached and has no
     * VisualElement, so it cannot fight the original's).
     *
     * @returns The presence context, or `null` outside a `PresenceChild`.
     */
    const buildPresenceContext = (): PresenceContextProps | null => {
        if (!presenceChildContext) return null
        return {
            id: componentHydrationId,
            // Read here so the calling effect tracks the wrapper's exit flip.
            isPresent: presenceChildContext.isPresent,
            // The wrapper owns the lifecycle; nothing extra to track per id.
            register: () => () => {},
            // Completion is how the wrapper learns it may stop rendering.
            onExitComplete: () => presenceChildContext.safeToRemove(),
            // `AnimatePresence initial={false}` suppresses the first enter.
            initial: presenceSkipEnter ? false : undefined,
            custom: resolvePresenceCustom()
        }
    }
    // ── The single motion-dom VisualElement for this component (#449) ────────
    //
    // Upstream Framer Motion gives every motion component exactly ONE
    // VisualElement and routes every animation through it. This is the
    // foundation for that migration (plan 001): the node is created, mounted,
    // updated and unmounted on the Svelte lifecycle, and the animation feature
    // is registered — but it is deliberately INERT. Nothing here starts an
    // animation or renders; the existing writers still own the DOM. Plans
    // 002–005 move each writer onto this node.
    //
    // `visualElementStore` is a `WeakMap<instance, VisualElement>` written in
    // `VisualElement.mount()`, so there must be exactly one VisualElement per
    // element — hence the projection adapter is handed this instance rather
    // than constructing its own.

    /**
     * Read the element's current numeric value for an animate channel, for
     * {@link resolveWildcardKeyframes}. Transform channels (`x`/`y`/`scale`/
     * `rotate`) come from the decomposed computed matrix via the shared
     * `readTransformChannels` reader; other channels (e.g. `opacity`) come from
     * computed style. Returns `undefined` when no numeric value is available (a
     * color, a `var(...)`, a 3D matrix, or a channel this reader does not own),
     * in which case the wildcard/relative passes through unchanged — the
     * documented numeric bound.
     */
    const readLiveChannelValue = (key: string): number | undefined => {
        if (!element) return undefined
        if (key === 'x' || key === 'y' || key === 'scale' || key === 'rotate') {
            const channels = readTransformChannels(element)
            return channels ? channels[key] : undefined
        }
        const computed = getComputedStyle(element)[key as keyof CSSStyleDeclaration] as
            | string
            | number
            | undefined
        const parsed = typeof computed === 'number' ? computed : Number.parseFloat(String(computed))
        return Number.isFinite(parsed) ? parsed : undefined
    }

    /** Memo so a given raw definition resolves its relatives exactly once. */
    let relativeResolvedSourceJson: string | undefined = undefined
    let relativeResolvedAnimate: Record<string, unknown> | undefined = undefined
    /**
     * Mutable mirror of `visualElement`, assigned right after it is created.
     *
     * `buildMotionNodeProps()` runs INSIDE the `visualElement` initializer, so
     * touching that `const` from here would hit its temporal dead zone and throw
     * (a ReferenceError that blanks the whole component).
     */
    let visualElementForRelatives: { latestValues: Record<string, unknown> } | null = null

    /**
     * Resolve `'+=N'` / `'-=N'` relative keyframes into concrete values before
     * the animationState sees them.
     *
     * Relative keyframes are a svelte-motion extension: motion-dom's
     * `fillWildcards` resolves `null` wildcards but has NO relative-value
     * concept, so a `'+=50'` handed to `animateChanges()` never resolves and the
     * channel silently holds. The former `executeAnimation` resolved them right
     * before animating; this does the same job at the point props are (re)built.
     *
     * Resolution is memoized on the RAW definition: a relative must resolve
     * against the value the animation starts FROM, exactly once. Re-resolving on
     * every props rebuild would offset from the post-animation value and keep
     * re-adding (the #453 regression this memo exists to prevent).
     *
     * @param definition The raw `animate` definition.
     * @returns The definition with relatives resolved, or it unchanged.
     */
    const resolveRelativeAnimate = (definition: unknown): unknown => {
        if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
            return definition
        }
        const raw = definition as Record<string, unknown>
        const isRelative = (v: unknown) => typeof v === 'string' && /^[+-]=/.test(v)
        const hasRelative = Object.values(raw).some((value) =>
            Array.isArray(value) ? value.some(isRelative) : isRelative(value)
        )
        if (!hasRelative) return definition

        const sourceJson = JSON.stringify(raw)
        if (relativeResolvedSourceJson === sourceJson && relativeResolvedAnimate) {
            return relativeResolvedAnimate
        }
        // Did we actually have a value to offset from? At VE-creation time there
        // is no node and no element yet, so nothing resolves — leave the raw
        // definition alone and let the post-mount props pass resolve it, rather
        // than memoizing an unresolved passthrough forever.
        let didResolve = false
        const resolved = resolveWildcardKeyframes(raw as DOMKeyframesDefinition, (key) => {
            // Prefer the VisualElement's own live value — it is the value the
            // animation will start from (the seeded `initial` on the first pass).
            const fromNode = visualElementForRelatives?.latestValues?.[key]
            const fromNodeNumber =
                typeof fromNode === 'number' ? fromNode : Number.parseFloat(String(fromNode))
            const live = Number.isFinite(fromNodeNumber)
                ? fromNodeNumber
                : readLiveChannelValue(key)
            if (live !== undefined) didResolve = true
            return live
        }) as Record<string, unknown> | undefined
        if (!resolved || !didResolve) return definition
        relativeResolvedSourceJson = sourceJson
        relativeResolvedAnimate = resolved
        return relativeResolvedAnimate
    }

    /**
     * Strip transform channels from a definition under a reducing policy.
     *
     * `filterReducedMotionKeyframes` used to be applied by the deleted
     * `executeAnimation`, so the animationState was seeing unfiltered targets and
     * animating transforms that the policy forbids (`initialKeyframes` keeps its
     * own filtering, which is why only the animate half regressed). Re-homed here
     * so the animationState never sees a transform channel it must not touch.
     *
     * Handles both shapes the animationState resolves: a target object, and a
     * variant MAP (a bare variant LABEL cannot be filtered, so the map behind it
     * is filtered instead). Lists of labels resolve through the same map.
     *
     * @param definition A target object, variant label, or list of labels.
     * @returns The definition with transform channels removed where applicable.
     */
    const filterReducedMotionDefinition = (definition: unknown): unknown => {
        if (!reducedMotion) return definition
        if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
            // A label (or list of labels) resolves via `variants`, filtered below.
            return definition
        }
        return filterReducedMotionKeyframes(definition as Record<string, unknown>, reducedMotion)
    }

    /** The `variants` map with transform channels stripped under a reducing policy. */
    const reducedMotionVariants = $derived.by(() => {
        if (!reducedMotion || !variantsProp) return variantsProp
        const out: Record<string, unknown> = {}
        for (const [name, variant] of Object.entries(variantsProp)) {
            // Function-form variants resolve per `custom` inside the
            // animationState, so wrap rather than filter eagerly.
            out[name] =
                typeof variant === 'function'
                    ? (...args: unknown[]) =>
                          filterReducedMotionKeyframes(
                              (variant as (...a: unknown[]) => Record<string, unknown>)(...args),
                              reducedMotion
                          )
                    : filterReducedMotionKeyframes(
                          variant as Record<string, unknown>,
                          reducedMotion
                      )
        }
        return out as typeof variantsProp
    })

    /**
     * The props motion-dom reads off this node.
     *
     * `style` is carried through because the projection adapter has always
     * written it onto its VisualElement: the scrape binds the style
     * MotionValues and mirrors them into `latestValues`, which is the object
     * the projection node does its transform math against. Dropping it changes
     * FLIP/projection behaviour. It is omitted at CREATION time only (see
     * below), matching the adapter's former `props: {}` construction.
     */
    const buildMotionNodeProps = (includeStyle = true): MotionNodeOptions =>
        ({
            ...(includeStyle ? { style: styleProp } : {}),
            // The EFFECTIVE values, not the raw props: `animationState` resolves
            // variants off `visualElement.props`, so it must see the same
            // presence/parent-resolved `initial`, the same inherited variant
            // label and the same `custom` the legacy writer used. (plan 002)
            // Filtered too: under a reducing policy the node must not even be
            // SEEDED with a transform channel, or `makeLatestValues` puts it in
            // `latestValues` and the VE renders it (the container's own
            // `initialKeyframes` was already filtered, which is why only the
            // animate half of the regression was visible).
            initial: filterReducedMotionDefinition(effectiveInitialProp),
            // The node's OWN animate only. Passing the INHERITED variant label
            // here would make `isControllingVariants(props)` true, which stops
            // motion-dom registering this node as a variant CHILD
            // (`addVariantChild` requires `isVariantNode && !isControllingVariants`)
            // — killing parent-driven propagation and `staggerChildren`.
            // `animateChanges` reads the inherited label itself, from
            // `getVariantContext(visualElement.parent)`.
            animate: animateControls
                ? undefined
                : filterReducedMotionDefinition(resolveRelativeAnimate(declarativeAnimateProp)),
            variants: reducedMotionVariants,
            custom: effectiveCustom,
            transition: mergeTransitions(motionConfig?.transition ?? {}, transitionProp ?? {}),
            whileHover: filterReducedMotionDefinition(whileHoverProp),
            whileTap: filterReducedMotionDefinition(whileTapProp),
            whileFocus: filterReducedMotionDefinition(whileFocusProp),
            whileInView: filterReducedMotionDefinition(whileInViewProp),
            whileDrag: filterReducedMotionDefinition(whileDragProp),
            // `buildHTMLStyles(state, latestValues, transformTemplate)` reads the
            // template off the props, so the VE composes templated transforms
            // natively — the job `applyMotionStyleEffect` used to do.
            transformTemplate: transformTemplateProp,
            exit: exitProp,
            layoutId: scopedLayoutId
        }) as MotionNodeOptions

    // Public `onProjectionUpdate` fan-out (#379). Emits the same payload the
    // retired legacy ProjectionNode did: page-space boxes measured with
    // motion-applied transforms stripped, delta oriented snapshot→layout
    // (i.e. how far the layout box MOVED), computed with motion-dom's
    // calcBoxDelta so the zero-delta epsilon (±0.01px translate) is
    // unchanged.
    const emitProjectionUpdate = (previous: RectLike, next: RectLike) => {
        if (!onProjectionUpdateProp) return
        const layout = boxFromRect(next)
        const snapshot = boxFromRect(previous)
        const delta = createDelta()
        calcBoxDelta(delta, snapshot, layout)
        onProjectionUpdateProp({
            layout,
            snapshot,
            delta,
            hasLayoutChanged: !isDeltaZero(delta)
        })
    }
    const hasRectChanged = (previous: RectLike, next: RectLike): boolean =>
        Math.abs(previous.left - next.left) > 0.5 ||
        Math.abs(previous.top - next.top) > 0.5 ||
        Math.abs(previous.width - next.width) > 0.5 ||
        Math.abs(previous.height - next.height) > 0.5
    const isViewportOffscreen = (rect: DOMRect): boolean =>
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= window.innerHeight ||
        rect.left >= window.innerWidth

    // Ancestor-transform-invariant layout measurement in scroll-invariant
    // PAGE space, sourced from the upstream motion-dom node (#437): viewport
    // box plus the document root's phase-cached scroll offset, ancestor
    // `layoutScroll` offsets folded in. A viewport scroll between the
    // 'snapshot' (pre-patch) and 'measure' (post-patch) phases cancels
    // exactly, so it can never masquerade as a layout delta.
    const measureLayoutRect = (phase: 'snapshot' | 'measure' = 'measure'): RectLike | null =>
        // Null without a window (SSR) — every caller lives inside a
        // client-only effect, so the null branch is never animated against.
        motionDomProjection?.measurePageRect(phase) ?? null

    // Get current presence depth (0 = direct child of AnimatePresence, undefined = not in AnimatePresence)
    const presenceDepth = getPresenceDepth()

    // Validate key prop only for direct children of AnimatePresence (depth 0)
    // This matches Framer Motion behavior where only immediate children need
    // keys. Null-check rather than falsiness: 0 and '' are valid keys.
    if (context && presenceDepth === 0 && keyProp == null) {
        throw new Error(
            'motion elements that are direct children of AnimatePresence must have a `key` prop. ' +
                'Example: <motion.div key="unique-id" />'
        )
    }

    // Increment depth for descendants so nested motion elements don't require keys
    if (presenceDepth !== undefined) {
        setPresenceDepth(presenceDepth + 1)
    }

    // Upstream AnimatePresence only holds direct motion children for exit.
    // Nested motion elements can animate on mount/update, but their own
    // conditional unmounts are immediate unless wrapped in another boundary.
    const shouldRegisterPresenceExit = !!context && presenceDepth === 0 && !inPresenceChild

    // Use the provided key for presence tracking, normalized to a string so
    // numeric keys (e.g. 0) address the same registry entries as their
    // string form. When not inside AnimatePresence, use a stable identifier
    // based on component instance.
    // trunk-ignore(eslint/no-useless-assignment): false positive — presenceKey is used throughout the component
    const presenceKey = keyProp != null ? String(keyProp) : `motion-${++keyCounter}`

    // Track previous key for key-change detection (simulates React's key-based remounting)
    // Plain variables (not $state) to avoid self-triggering the key-change $effect
    let keyTrackerPrev = keyProp
    let keyTrackerIsTransitioning = false
    let keyTransitionStopped = false

    // Compute merged transition without mutating props to avoid effect write loops
    const mergedTransition = $derived<AnimationOptions>(
        mergeTransitions(motionConfig?.transition ?? {}, transitionProp ?? {})
    )

    // Register onDestroy at component level (guaranteed to work in Svelte 5)
    // — getContext()/onDestroy() must run during component initialization.
    if (shouldRegisterPresenceExit) {
        onDestroy(() => {
            pwLog('[presence] onDestroy triggered', { key: presenceKey })
            context.unregisterChild(presenceKey)
        })
    }

    // Capture mid-animation computed styles via rAF so exit clones can start
    // from the correct visual state. Without this, interrupting an enter animation
    // causes the exit to snap (the element is disconnected before onDestroy, so
    // getAnimations()/commitStyles() can't work at clone time).
    // Skipped inside <PresenceChild>: the wrapper drives exit, no clone path.
    $effect(() => {
        if (!(element && shouldRegisterPresenceExit)) return
        let rafId: number
        const capture = () => {
            if (element && element.isConnected && element.getAnimations().length > 0) {
                const cs = getComputedStyle(element)
                context.updateChildAnimatedStyle(presenceKey, cs.opacity, cs.transform)
            }
            rafId = requestAnimationFrame(capture)
        }
        rafId = requestAnimationFrame(capture)
        return () => cancelAnimationFrame(rafId)
    })

    // Keep a live snapshot of the layoutId element's rect so the next element can FLIP from it.
    // We store the last-known-good rect and push it to the registry on cleanup,
    // because onDestroy fires after the element is removed from DOM (rect would be zeros).
    let layoutIdLastRect: DOMRect | null = null
    $effect(() => {
        if (!(element && layoutIdProp && layoutIdRegistry)) return

        // Capture rect on every frame while mounted. Re-express in the
        // nearest layoutScroll ancestor's coordinate space so the FLIP-from
        // rect stored at unmount stays correct even if the scroll container
        // moved between the snapshot and the next element's mount.
        let rafId: number
        const captureRect = () => {
            if (element) {
                layoutIdLastRect = measureRect(element, resolveLayoutScrollAncestors())
            }
            rafId = requestAnimationFrame(captureRect)
        }
        rafId = requestAnimationFrame(captureRect)

        // On cleanup (before DOM removal), push last-known rect to registry
        return () => {
            cancelAnimationFrame(rafId)
            if (layoutIdLastRect && scopedLayoutId) {
                layoutIdRegistry.snapshot(scopedLayoutId, layoutIdLastRect, mergedTransition ?? {})
            }
        }
    })

    // Reactively update registration when element/exit/transition props change
    $effect(() => {
        if (element && shouldRegisterPresenceExit && exitProp !== undefined) {
            const resolvePresenceExit = (custom: unknown) => {
                const resolved = resolveExit(
                    exitProp,
                    variantsProp,
                    custom !== undefined ? custom : effectiveCustom
                )
                if (!resolved) return undefined
                return filterReducedMotionKeyframes(
                    resolved as Record<string, unknown>,
                    reducedMotion
                ) as DOMKeyframesDefinition
            }
            const filteredExit = resolvePresenceExit(resolvePresenceCustom())
            context.registerChild(
                presenceKey,
                element,
                filteredExit,
                mergedTransition,
                resolvePresenceExit
            )
        }
    })

    // Update presence context with current state when element is ready and has size.
    // Skipped inside <PresenceChild> — the rect/style snapshot only feeds the clone path.
    $effect(() => {
        if (!(shouldRegisterPresenceExit && element && isLoaded === 'ready')) return

        let lastWidth = 0
        let lastHeight = 0
        let stopped = false

        const measureAndUpdate = () => {
            if (stopped || !element || !element.isConnected) return
            const rect = element.getBoundingClientRect()
            const style = getComputedStyle(element)
            if (
                Math.abs(rect.width - lastWidth) > 0.5 ||
                Math.abs(rect.height - lastHeight) > 0.5
            ) {
                lastWidth = rect.width
                lastHeight = rect.height
                context.updateChildState(presenceKey, rect, style)
            }
        }

        // Observe size changes
        const resizeObserver = new ResizeObserver(() => {
            pwLog('[motion][resize]', { key: presenceKey })
            measureAndUpdate()
        })
        try {
            resizeObserver.observe(element)
        } catch {
            // Ignore
        }

        // Initial measure once
        pwLog('[motion][initial-measure]', { key: presenceKey })
        measureAndUpdate()

        return () => {
            stopped = true
            try {
                resizeObserver.disconnect()
            } catch {
                // Ignore
            }
        }
    })

    const isPlaywright = isPlaywrightEnv()

    // Recognized HTML void elements that cannot contain children
    const isVoidTag = $derived(VOID_TAGS.has(tag as string))

    const motionValueChildInitialText = $derived(
        motionValueChild ? renderMotionValueChild(motionValueChild) : ''
    )
    let motionValueChildText = $state<string | undefined>(undefined)

    $effect(() => {
        if (!motionValueChild) {
            motionValueChildText = undefined
            return
        }

        motionValueChildText = renderMotionValueChild(motionValueChild)
        if (!element) return

        return bindMotionValueChild(motionValueChild, element, (text) => {
            motionValueChildText = text
        })
    })

    // Style MotionValues are driven by the VisualElement (#449 plan 002): its
    // `bindToMotionValue` subscribes each scraped value and schedules a render,
    // and `buildHTMLStyles` composes the transform (honouring
    // `props.transformTemplate`). That is the same job the former
    // `styleEffect` / `applyMotionStyleEffect` subscription did here, so
    // keeping both would make two writers race for the element's style.
    //
    // Retained only as the no-VisualElement fallback (SSR has no VE, but this
    // effect never runs there; a client render always has one).
    $effect(() => {
        if (!element || visualElement) return

        const styleValues = collectMotionStyleValues(styleProp)
        if (!styleValues) return

        if (transformTemplateProp) {
            return applyMotionStyleEffect(element, styleProp, transformTemplateProp)
        }

        return styleEffect(element, styleValues)
    })

    // Variant inheritance and resolution
    const parentVariantStore = getVariantContext()
    const animateControls = $derived(isAnimationControls(animateProp) ? animateProp : undefined)
    const declarativeAnimateProp = $derived(animateControls ? undefined : animateProp)

    // Get initial inherited variant synchronously
    let initialInheritedVariant: string | undefined = undefined
    if (parentVariantStore) {
        parentVariantStore.subscribe((v) => (initialInheritedVariant = v))()
    }

    // Create store with initial value so children can inherit immediately
    const initialVariantValue =
        typeof declarativeAnimateProp === 'string'
            ? declarativeAnimateProp
            : (variantsProp && initialInheritedVariant) || undefined
    const localVariantStore = writable<string | undefined>(initialVariantValue)

    let inheritedVariant = $state<string | undefined>(initialInheritedVariant)

    $effect(() => {
        if (!parentVariantStore) {
            inheritedVariant = undefined
            return
        }
        const unsubscribe = parentVariantStore.subscribe((v) => (inheritedVariant = v))
        return () => unsubscribe()
    })

    // Use the initial value first, then switch to reactive once mounted
    const effectiveAnimate = $derived(
        declarativeAnimateProp ??
            (variantsProp ? (inheritedVariant ?? initialInheritedVariant) : undefined)
    )

    // Propagate initial={false} to children BEFORE setting variant context
    // AnimatePresence initial={false} only applies on first render - check shouldAnimateEnter(key)
    const parentInitialFalse = getInitialFalseContext()
    const presenceSkipEnter = context ? !context.shouldAnimateEnter(presenceKey) : false
    const effectiveInitialProp = presenceSkipEnter
        ? false
        : initialProp !== undefined
          ? initialProp
          : parentInitialFalse && variantsProp
            ? false
            : undefined

    pwLog('[motion] mount', {
        presenceSkipEnter,
        effectiveInitialProp,
        initialProp,
        animateProp
    })

    if (initialProp === false) {
        setInitialFalseContext(true)
    }

    // Provide context immediately during initialization so children can inherit
    setVariantContext(localVariantStore)

    // Custom-value inheritance. Children with no `custom` prop adopt the
    // nearest motion ancestor's value. Reactive via a writable store so a
    // parent updating `custom` re-fires descendants' variant resolution.
    const parentCustomStore = getCustomContext()
    let inheritedCustom: unknown = undefined
    if (parentCustomStore) {
        parentCustomStore.subscribe((v) => (inheritedCustom = v))()
    }
    const initialCustomValue = customProp !== undefined ? customProp : inheritedCustom
    const localCustomStore = writable<unknown>(initialCustomValue)
    setCustomContext(localCustomStore)

    let parentInheritedCustom = $state<unknown>(inheritedCustom)
    $effect(() => {
        if (!parentCustomStore) {
            parentInheritedCustom = undefined
            return
        }
        const unsubscribe = parentCustomStore.subscribe((v) => (parentInheritedCustom = v))
        return () => unsubscribe()
    })
    const effectiveCustom = $derived(customProp !== undefined ? customProp : parentInheritedCustom)
    $effect(() => {
        localCustomStore.set(effectiveCustom)
    })

    // ── The single motion-dom VisualElement for this component (#449) ────────
    //
    // Declared HERE, after `effectiveInitialProp` / `effectiveAnimate` /
    // `effectiveCustom`, because `createAnimationState` resolves variants off
    // `visualElement.props` and must see the same resolved values the legacy
    // writer saw. `visualElementStore` is a `WeakMap<instance, VisualElement>`
    // written in `VisualElement.mount()`, so there is exactly one node per
    // element and the projection adapter is handed this instance.
    const visualElementParent = typeof window !== 'undefined' ? getVisualElementParent() : undefined
    // `untrack`: the node is created ONCE with the props of this render, the
    // way upstream's `useConstant(makeState)` does (use-visual-state.ts:135).
    // Later prop changes flow through the update effect below, not by
    // rebuilding the node.
    const visualElement =
        typeof window !== 'undefined'
            ? untrack(() =>
                  createMotionVisualElement({
                      // No `style` at creation: the adapter used to construct
                      // its node with `props: {}` and bind the style
                      // MotionValues on its first `updateOptions`, so seeding
                      // them into `latestValues` here would move that write
                      // earlier than it has ever happened.
                      props: buildMotionNodeProps(false),
                      parent: visualElementParent,
                      // `latestValues` is authoritative now: `animationState`
                      // drives it (animateChanges below) and the VE renders it,
                      // so the seed is the real starting state rather than a
                      // claim the DOM does not back. Landed atomically with the
                      // legacy-writer deletion — plan 002 Step 3.
                      seedLatestValues: true,
                      // plan 004: the PresenceChild adapter (null for direct
                      // AnimatePresence children, which use the clone path).
                      presenceContext: buildPresenceContext(),
                      // Inherited variant labels travel via `context`, NOT via
                      // props — upstream's exact split (`use-visual-state.ts`
                      // takes `props` and `MotionContext` separately).
                      //
                      // `props.animate` must stay undefined for an inheriting
                      // child so `isControllingVariants` is false and
                      // `addVariantChild` registers it for parent-driven
                      // propagation. But `makeLatestValues` then has nothing to
                      // seed from, so the child would first-paint unstyled. The
                      // context supplies the label for SEEDING only, which is how
                      // a stacked child renders correctly before its parent ever
                      // animates. (plan 002 Step 5)
                      context: { animate: effectiveAnimate },
                      reducedMotionConfig: motionConfig?.reducedMotion ?? 'never',
                      isSVG: isSVGTag(String(tag))
                  })
              )
            : null
    if (visualElement) {
        visualElementForRelatives = visualElement
        // `initial={false}` (own prop, inherited, or a presence re-entry that
        // must not replay) means "start AT the animate target".
        // `makeLatestValues` already seeded from `animate`'s LAST keyframe
        // because `props.initial === false`; this flag stops `animateChanges`
        // animating on the first pass.
        //
        // Upstream derives it from BOTH sources — the prop and
        // `presenceContext.initial === false` (use-visual-element.ts:64-76) — so
        // an `AnimatePresence initial={false}` wrapper suppresses the first enter
        // even when the element itself declares an `initial`. (plan 004 Step 3)
        visualElement.blockInitialAnimation =
            effectiveInitialProp === false || visualElement.presenceContext?.initial === false
        setVisualElementParent(visualElement)
    }

    const motionDomProjectionParent =
        typeof window !== 'undefined' ? getMotionDomProjectionParent() : null
    const motionDomProjection =
        typeof window !== 'undefined'
            ? new MotionDomProjectionAdapter({
                  parent: motionDomProjectionParent,
                  getBaseTransform: () => userBaseTransform,
                  visualElement: visualElement ?? undefined
              })
            : null
    if (motionDomProjection) {
        setMotionDomProjectionParent(motionDomProjection)
    }

    $effect(() => {
        if (!variantsProp) return localVariantStore.set(undefined)
        if (typeof declarativeAnimateProp === 'string')
            return localVariantStore.set(declarativeAnimateProp)
        if (typeof effectiveAnimate === 'string') return localVariantStore.set(effectiveAnimate)
        localVariantStore.set(undefined)
    })

    const resolvedInitial = $derived(
        resolveInitial(effectiveInitialProp, variantsProp, effectiveCustom)
    )
    const resolvedAnimate = $derived(
        resolveAnimate(effectiveAnimate, variantsProp, effectiveCustom)
    )
    // `resolvedExit` is gone: the exit target is resolved by the animationState
    // from `props.exit` now, and the clone path resolves its own via
    // `resolvePresenceExit`. (plan 004 Step 4)

    /**
     * The from-state a KEY CHANGE should rewind to.
     *
     * Deliberately resolved from the RAW reactive `initialProp`, not from
     * `effectiveInitialProp`. The latter is forced to `false` for the lifetime of
     * the component when `AnimatePresence initial={false}` suppressed the FIRST
     * enter (`presenceSkipEnter` is computed once at init), but upstream applies
     * that suppression only to the first render — a later key change is a fresh
     * mount and must animate. Using the effective value left the rewind empty and
     * the element stranded on its exit target. (plan 004 Step 4)
     */
    const keyChangeInitialKeyframes = $derived(
        filterReducedMotionKeyframes(
            getInitialKeyframes(
                resolveInitial(initialProp, variantsProp, effectiveCustom)
            ) as Record<string, unknown>,
            reducedMotion
        )
    )

    // Resolve `whileX` props against `variants` so each gesture's attach
    // helper receives a plain keyframes object regardless of whether the
    // consumer wrote inline keyframes, a variant key, or an array of
    // variant keys. Mirrors framer-motion's `whileHover` etc. surface
    // (#349).
    const resolvedWhileTap = $derived(resolveWhile(whileTapProp, variantsProp, effectiveCustom))
    const resolvedWhileHover = $derived(resolveWhile(whileHoverProp, variantsProp, effectiveCustom))
    const resolvedWhileFocus = $derived(resolveWhile(whileFocusProp, variantsProp, effectiveCustom))
    const resolvedWhileDrag = $derived(resolveWhile(whileDragProp, variantsProp, effectiveCustom))
    const resolvedWhilePan = $derived(resolveWhile(whilePanProp, variantsProp, effectiveCustom))
    const resolvedWhileInView = $derived(
        resolveWhile(whileInViewProp, variantsProp, effectiveCustom)
    )

    // Extract keyframes from resolved initial, handling initial={false}
    const initialKeyframes = $derived(
        filterReducedMotionKeyframes(
            getInitialKeyframes(resolvedInitial) as Record<string, unknown>,
            reducedMotion
        )
    )

    // Reduced-motion-filtered animate values used as the inline-style
    // baseline so an animated value (transforms included) persists after
    // the WAAPI animation completes (#377). Filtered exactly like
    // `initialKeyframes` so transforms are stripped under reduced motion.
    const animateKeyframes = $derived(
        filterReducedMotionKeyframes(
            resolvedAnimate as Record<string, unknown> | undefined,
            reducedMotion
        )
    )
    const optimizedAppearEntries = $derived(
        createOptimizedAppearData(
            initialKeyframes as Record<string, unknown> | undefined,
            animateKeyframes,
            mergedTransition
        )
    )
    // Upstream never WAAPI-accelerates `transform` while a `transformTemplate`
    // is present (motion-dom waapi.ts: `name !== "transform" || !transformTemplate`).
    // Our optimized-appear handoff is all-or-nothing per element, so when the
    // appear animation would include a transform under a template we suppress the
    // bootstrap entirely and let the main-thread enter animation run the templated
    // transform. That prevents an untemplated transform from painting before
    // hydration/handoff. Opacity-only appears are unaffected and stay accelerated. (#402)
    const optimizedAppearSuppressedByTransformTemplate = $derived(
        !!transformTemplateProp &&
            optimizedAppearEntries.some((entry) => entry.name === 'transform')
    )
    const optimizedAppearId = $derived(
        effectiveInitialProp !== false &&
            isNotEmpty(initialKeyframes) &&
            isNotEmpty(animateKeyframes) &&
            !optimizedAppearSuppressedByTransformTemplate
            ? `svelte-motion-${componentHydrationId}`
            : undefined
    )
    const optimizedAppearScript = $derived(
        createOptimizedAppearScript(optimizedAppearId, optimizedAppearEntries)
    )
    const renderedOptimizedAppearScript = $derived(
        optimizedAppearScript && (typeof window === 'undefined' || !window.MotionIsMounted)
            ? optimizedAppearScript
            : ''
    )
    const renderedAnimateBaseline = $derived.by(() => {
        const restingValues = resolveRestingValues(
            animateKeyframes as DOMKeyframesDefinition | undefined
        ) as unknown as Record<string, unknown> | undefined
        // Wildcard/relative definitions (animate={{ x: null }} / '+=50')
        // collapse to UNRESOLVED resting values here — the animation layer
        // resolved them against the live value, so the baseline must reuse the
        // settle-resolved snapshot (adversarial-review finding: recomputing
        // from the raw definition snapped x:null holds to 0). When no snapshot
        // exists yet, drop the unresolved channels rather than serializing
        // null/'+=50' into the inline transform.
        if (restingValues && Object.values(restingValues).some(isUnresolvedKeyframeValue)) {
            if (
                enterAnimationSettled &&
                lastAnimateRestingValues &&
                lastAnimateSourceJson === JSON.stringify(animateKeyframes)
            ) {
                return lastAnimateRestingValues
            }
            const stripped: Record<string, unknown> = {}
            for (const [key, value] of Object.entries(restingValues)) {
                if (!isUnresolvedKeyframeValue(value)) stripped[key] = value
            }
            return stripped
        }
        if (!transformTemplateProp || !restingValues) return restingValues

        const restingJson = JSON.stringify(restingValues)
        if (enterAnimationSettled && lastAnimateRestingJson === restingJson) return restingValues
        return lastAnimateRestingValues ?? restingValues
    })
    // A ~215-line block lived here: the SVG path-drawing MotionValue readers
    // (`readSVGPathDrawingState`, `cleanupSVGPathAttributeEffect`), the
    // stoppable-control promise plumbing (`getFinishedPromise`,
    // `getAnimationPromise`, `activeAnimationControls`,
    // `trackAnimationControlsControl`) and the whole templated-transform
    // subsystem (`templatedTransform*`, `splitTemplatedTransformPayload`,
    // `getTemplatedTransform*`).
    //
    // Every one of them was reachable ONLY from the three deleted legacy writers
    // (`executeAnimation`, `startAnimationControlsDefinition`,
    // `applyAnimationControlsTarget`). The VisualElement supersedes all three
    // concerns: it composes templated transforms natively via
    // `buildHTMLStyles(state, latestValues, props.transformTemplate)`, its
    // MotionValues are the stoppable handles, and `svgEffect` (still live below)
    // owns SVG attribute writes. `e2e/svg` and `e2e/utilities/transform-template`
    // both stay green. (plan 002 Step 7)

    const resolveAnimationControlsDefinition = (
        definition: AnimationControlsDefinition
    ): DOMKeyframesDefinition | undefined => {
        const resolvedDefinition =
            typeof definition === 'function' ? definition(effectiveCustom) : definition
        if (typeof resolvedDefinition === 'string' || Array.isArray(resolvedDefinition)) {
            return resolveVariantList(variantsProp, resolvedDefinition, effectiveCustom)
        }
        return resolvedDefinition
    }

    // `applyAnimationControlsTarget`, `snapshotFrozenControlsValues`,
    // `stopAnimationControlsAnimations` and `startAnimationControlsDefinition`
    // lived here (~340 lines). All four are gone: the controls subscriber below
    // drives the VisualElement through `animateVisualElement`, which resolves
    // labels/lists/function-form definitions itself, notifies
    // AnimationStart/Complete, and retargets the SAME MotionValues — so the
    // generation counters, the frozen-value snapshots and the settle bookkeeping
    // they existed to maintain are all inherent to the node now. (plan 002 Step 7)

    // `animateSVGPathAttributes` / `stripSVGPathKeyframes` / `isSVGPathElement`
    // lived here. They were used ONLY by the two deleted legacy writers
    // (`executeAnimation` and `startAnimationControlsDefinition`), so they are
    // unreferenced now. SVG path HANDLING itself is untouched per the Step 6
    // skip ruling: `svgEffect`, `transformSVGPathProperties`,
    // `readSVGPathDrawingState` and the mount-effect dash-attribute seeding all
    // remain, and `e2e/svg` stays green.

    let waitCallbackRegistered = $state(false)
    let waitUnsubscribe: (() => void) | null = null
    let waitHiddenDisplay: string | null = null
    let waitEnterReleased = $state(false)
    let waitLayoutParent: HTMLElement | null = null
    let waitLayoutParentWidth = ''
    let waitLayoutParentHeight = ''
    let waitLayoutViewportScrollX = 0
    let waitLayoutViewportScrollY = 0
    const presenceLayoutHoldAttribute = 'data-presence-layout-hold'
    const presenceLayoutReleaseEvent = 'svelte-motion:presence-layout-release'
    const waitEnterBlockedBeforeMount = $derived(
        context?.mode === 'wait' && !waitEnterReleased && context.isEnterBlocked(presenceKey)
    )
    // The three holds this string carries are RETAINED verbatim through the
    // plan-002 collapse — none of them is an animated-key concern:
    //   1. the `liveGestureTransform` splice (gestures stay legacy until 003),
    //   2. the wait-mode `display:none` holds,
    //   3. the `pathLength` mounting `visibility:hidden` hold.
    const inlineStyleBaseWithHolds = $derived(
        `${initialKeyframes && 'pathLength' in initialKeyframes && isLoaded === 'mounting' ? `${serializedStyleWithLiveGestureTransform};visibility:hidden` : serializedStyleWithLiveGestureTransform}${waitEnterBlockedBeforeMount || waitHiddenDisplay !== null ? ';display:none' : ''}`
    )

    /**
     * The declarative style slot for keys the animationState owns.
     *
     * Upstream's renderer builds its style attribute FROM `latestValues`
     * (`framer-motion/src/render/html/use-props.ts:21-32`), which is what keeps
     * React's declarative write and the VisualElement's per-frame imperative
     * write in agreement. This is the Svelte equivalent: whenever Svelte
     * rewrites the `style` attribute (a hold flips, the style prop changes, a
     * gesture transform splices in) it re-reads the CURRENT `latestValues`, so a
     * rewrite can never clobber the animated state back to a stale target.
     *
     * Deliberately a PLAIN FUNCTION, not a `$derived`: `latestValues` is a plain
     * mutable object, so reading it registers no Svelte dependency. A `$derived`
     * whose only deps are non-reactive would compute once and freeze at the
     * seeded `initial` forever, and every later style-attribute rewrite would
     * clobber the animated state back to that stale target. Called from inside
     * `renderedInlineStyle` instead, so it re-samples on each rewrite.
     */
    const readAnimationStateStyleSlot = (): Record<string, unknown> | undefined => {
        if (!visualElement) return undefined
        const values: Record<string, unknown> = { ...visualElement.latestValues }
        // Prefer each MotionValue's own current value over `latestValues`.
        //
        // `latestValues` is kept in sync by `bindToMotionValue`'s
        // `on("change")` subscription — but that subscription is NEVER INSTALLED
        // for accelerated channels: `bindToMotionValue` builds a NativeAnimation
        // and returns early for them (`VisualElement.mjs:262-281`). So after a
        // WAAPI-accelerated animation is interrupted, `MotionValue.stop()` writes
        // the sampled freeze value onto the MotionValue
        // (`NativeAnimationExtended.updateMotionValue`) while `latestValues` still
        // holds the from-state. Reading the MotionValues here keeps the
        // declarative rewrite consistent with the real store, so a benign
        // reactive change cannot snap a frozen channel back (measured: an
        // interrupted controls start froze translateX at 15.936px, then an
        // unrelated style poke rewrote it to 0).
        //
        // A no-op for non-accelerated keys, whose MotionValue and `latestValues`
        // agree by construction.
        visualElement.values.forEach((value, key) => {
            values[key] = value.get()
        })
        // A live gesture transform is spliced into the base string above and
        // must win: drop the transform channels so the merge cannot override it
        // with the resting composition. (Gestures move onto the VE in plan 003.)
        if (liveGestureTransform) {
            for (const key of Object.keys(values)) {
                if (transformProps.has(key)) delete values[key]
            }
        }
        if (isNotEmpty(values)) return values
        // First-paint fallback, for a node with its OWN `animate` only.
        // `initial={}` (or no `initial`) resolves to no seeded values, but this
        // library deliberately pins the `animate` target's resting values into the
        // very first paint so there is no flash of unstyled state — a documented
        // deviation from upstream, pinned by `_MotionContainer.ssr.spec.ts`
        // ("falls back to first animate keyframe").
        //
        // It MUST NOT apply to a node that INHERITS its animate from a variant
        // parent: such a child also starts with an empty `latestValues`, and
        // pinning the inherited target here would snap it declaratively to the
        // end state before the parent's propagated animation ever runs (measured:
        // the notifications stack jumped instead of animating).
        if (declarativeAnimateProp === undefined) return undefined
        return renderedAnimateBaseline
    }

    const renderedInlineStyle = $derived.by(() =>
        // One path now. The controls-specific slot machinery this used to carry
        // (settle targets, first-command holds, `animationControlsHasReceivedCommand`)
        // is gone with Step 7: controls drive the SAME VisualElement, so
        // `latestValues` is the single source of truth for every animated key
        // regardless of which writer set it. SSR has no VisualElement and falls
        // back to the initial/animate serialization, keeping the server-rendered
        // style byte-identical.
        visualElement
            ? mergeInlineStyles(
                  inlineStyleBaseWithHolds,
                  undefined,
                  readAnimationStateStyleSlot(),
                  transformTemplateProp
              )
            : mergeInlineStyles(
                  inlineStyleBaseWithHolds,
                  isLoaded === 'mounting' || isLoaded === 'initial' ? initialKeyframes : undefined,
                  isNotEmpty(initialKeyframes) && !effectiveAnimate
                      ? initialKeyframes
                      : renderedAnimateBaseline,
                  transformTemplateProp
              )
    )

    // SVG tag names are case-sensitive: our components pass `tag` all-lowercase, but
    // `fedisplacementmap` in the SVG namespace is an inert generic SVGElement, not an
    // SVGFEDisplacementMapElement. Canonicalize before rendering.
    const renderTag = $derived(isSVGTag(String(tag)) ? resolveSVGTagName(String(tag)) : tag)

    // MotionValue-bound SVG attributes (`cx`, `stroke-width`, `attrX`, …) must be
    // pulled out of `rest` before it reaches the raw spread below, or they
    // stringify as `[object Object]`. `svgEffect` drives them on the client;
    // `computeSSRSVGAttrValues` seeds the server payload so hydration doesn't flash.
    const svgAttrSplit = $derived(
        isSVGTag(String(tag))
            ? extractSVGMotionValueAttributes(rest as Record<string, unknown>)
            : null
    )
    const svgMotionValueAttrs = $derived(svgAttrSplit?.motionValueAttrs ?? {})
    const spreadAttrs = $derived<Record<string, unknown>>(
        svgAttrSplit
            ? {
                  ...svgAttrSplit.staticAttrs,
                  // `untrack`: this library's MotionValues are Svelte-augmented, so a
                  // tracked `.get()` here would make the whole attribute spread a
                  // dependency of every value change — re-rendering each frame of an
                  // animation and letting Svelte race `svgEffect` on attr-routed keys.
                  // The seed only needs to be correct at render time; `svgEffect` owns
                  // the DOM afterwards.
                  ...untrack(() => computeSSRSVGAttrValues(svgAttrSplit.motionValueAttrs))
              }
            : (rest as Record<string, unknown>)
    )

    $effect(() => {
        if (!element) return

        const values = svgMotionValueAttrs
        if (!isNotEmpty(values)) return

        // Keys stay verbatim: svgEffect applies its own `attr`-prefix conversion
        // and picks the style-vs-attribute channel per key.
        return svgEffect(element, values)
    })

    // Derived attributes to keep both branches in sync (focusability, data flags, style, class)
    const derivedAttrs = $derived<Record<string, unknown>>({
        ...spreadAttrs,
        // Gate on the *resolved* whileTap, not the raw prop. With
        // variant-label support a truthy-but-unresolved value (unknown
        // key, empty array) would otherwise add `tabindex=0` for an
        // element that never actually receives a tap gesture — an
        // unintended tab stop. (#349 CR feedback)
        ...(hasGestureFeatures &&
        isNotEmpty(resolvedWhileTap) &&
        !isNativelyFocusable(tag, rest) &&
        ((rest as Record<string, unknown>)?.tabindex ??
            (rest as Record<string, unknown>)?.tabIndex ??
            undefined) === undefined
            ? { tabindex: 0 }
            : {}),
        ...(isPlaywright
            ? {
                  'data-playwright': isPlaywright,
                  'data-is-loaded': isLoaded,
                  'data-path': dataPath
              }
            : {}),
        ...(renderedOptimizedAppearScript
            ? { [optimizedAppearDataAttribute]: optimizedAppearId }
            : {}),
        ...(layoutProp
            ? { 'data-layout': String(layoutProp), 'data-svelte-motion-layout': '' }
            : {}),
        ...(scopedLayoutId ? { 'data-layout-id': scopedLayoutId } : {}),
        ...(waitEnterBlockedBeforeMount || waitHiddenDisplay !== null
            ? { 'data-presence-wait-hidden': 'true' }
            : {}),
        // Apply normalized SVG path attributes synchronously on first render to avoid flash
        // Compute via svg utils (no dynamic import in SSR/derived expressions)
        ...(() => {
            if (!initialKeyframes) return {}
            const attrs = computeNormalizedSVGInitialAttrs(initialKeyframes)
            if (attrs) {
                return attrs
            }
            return {}
        })(),
        style: renderedInlineStyle,
        class: classProp
    })

    // Drag wiring
    //
    // We attach drag only when the element is in the 'ready' state to avoid fighting
    // with enter animations or initial keyframe application.
    //
    // Debug tips:
    // - If drags "do nothing", verify that `drag` prop is truthy and that CSS isn't
    //   overwriting transforms (check computed style for `transform`).
    // - If second drags "jump", ensure `attachDrag` syncs the internal `applied` origin
    //   after any non-zero duration settle animation.
    let teardownDrag: AttachDragCleanup | null = null
    $effect(() => {
        if (!(element && isLoaded === 'ready' && hasDragFeatures)) return
        // Only attach if drag enabled
        if (!dragProp) return
        // Clean up previous
        teardownDrag?.()

        const axis: DragAxis =
            dragProp === true || dragProp === 'x' || dragProp === 'y' ? dragProp : !!dragProp
        if (!axis) return

        // If constraints are provided via an element ref but it's not yet bound (null),
        // defer attaching drag until the ref exists to avoid an unconstrained first drag.
        if (dragConstraintsProp === null) return

        const controls = dragControlsProp
        const dragRuntimeOptions = untrack(() => ({
            whileDrag: resolvedWhileDrag,
            mergedTransition: mergedTransition ?? {},
            baselineSources: {
                initial: initialKeyframes ?? {},
                animate: (resolvedAnimate ?? {}) as Record<string, unknown>
            },
            // Bound `style` MotionValues (e.g. `style={{ y }}`) for the dragged
            // axes, so the gesture writes through to them and `y.get()` /
            // `animate(y, …)` stay in sync with the drag (#421). Read inside
            // `untrack` so the drag effect doesn't re-run (re-attaching the
            // gesture) every time `styleProp` changes — e.g. an object-style
            // `rotate` derived from a $state updates each frame mid-drag.
            boundMotionValues: (() => {
                // collectMotionStyleValues already filters to MotionValues only.
                const styleValues = collectMotionStyleValues(styleProp)
                if (!styleValues) return undefined
                const bound: { x?: MotionValue<number>; y?: MotionValue<number> } = {}
                if (styleValues.x) bound.x = styleValues.x as MotionValue<number>
                if (styleValues.y) bound.y = styleValues.y as MotionValue<number>
                return bound.x || bound.y ? bound : undefined
            })(),
            getBaseTransformValues: getStyleTransformValues
        }))
        const opts = {
            axis,
            constraints: dragConstraintsProp,
            elastic: dragElasticProp,
            momentum: dragMomentumProp,
            transition: dragTransitionProp,
            directionLock: !!dragDirectionLockProp,
            listener: dragListenerProp !== false,
            controls,
            whileDrag: dragRuntimeOptions.whileDrag,
            mergedTransition: dragRuntimeOptions.mergedTransition,
            callbacks: {
                onStart: onDragStartProp as (e: PointerEvent, info: DragInfo) => void,
                onMove: onDragProp as (e: PointerEvent, info: DragInfo) => void,
                onEnd: onDragEndProp as (e: PointerEvent, info: DragInfo) => void,
                onDirectionLock: onDirectionLockProp as (axis: 'x' | 'y') => void,
                onTransitionEnd: () => {
                    onDragTransitionEndProp?.()
                },
                onVisualUpdate: (transform: string, values: Record<string, string | number>) => {
                    liveGestureTransform = transform || null
                    // `values` is freshly allocated per composer frame, so no copy.
                    liveGestureTransformValues = values
                }
            },
            baselineSources: dragRuntimeOptions.baselineSources,
            getBaseTransformValues: dragRuntimeOptions.getBaseTransformValues,
            getBaseTransform: () => userBaseTransform,
            transformTemplate: transformTemplateProp,
            propagation: !!dragPropagationProp,
            snapToOrigin: dragSnapToOriginProp,
            boundMotionValues: dragRuntimeOptions.boundMotionValues
        }

        // Attach and hold teardown so we can re-attach if props change
        teardownDrag = attachDrag(element, opts)

        // If controls passed, subscribe element
        if (controls && controls.subscribe) {
            try {
                controls.subscribe(element)
            } catch {
                // ignore
            }
        }

        return () => {
            teardownDrag?.()
            teardownDrag = null
        }
    })

    /**
     * Pan-gesture wiring. Active whenever any of `onPanSessionStart`,
     * `onPanStart`, `onPan`, `onPanEnd`, or `whilePan` is set. Unlike
     * `drag`, Pan has no constraints / momentum / origin-snap — it's a
     * pure pointer offset+velocity reporter, useful for swipe-to-dismiss
     * sheets, custom carousels, and any "tell me what the gesture is
     * doing right now" interaction. Mirrors framer-motion's `PanGesture`
     * (packages/framer-motion/src/gestures/pan/index.ts).
     *
     * Split into TWO effects:
     *
     * 1. `attach` — keyed on `element`, `isLoaded === 'ready'`, presence
     *    of any pan handler/whilePan, and absence of `drag` (drag takes
     *    precedence — upstream framer-motion routes drag THROUGH the pan
     *    gesture internally, so co-attaching pan when drag is on would
     *    fight transforms). Creates / tears down the underlying
     *    `attachPan` lifetime once per element-bound interval.
     *
     * 2. `swap` — keyed on the user's handler/whilePan props. Calls
     *    `teardownPan.update(next)` to hot-swap the live handler set
     *    without destroying the in-flight `PanSession`. Without this
     *    split, every parent re-render that produces a fresh inline
     *    arrow handler would tear down the live gesture mid-pan —
     *    pointer listeners removed, no `onPanEnd` ever fires, whilePan
     *    keyframes leak.
     */
    let teardownPan: AttachPanCleanup | null = null
    let activeWhilePanKeyframes: Record<string, unknown> | null = null
    let whilePanBaseline: Record<string, unknown> | null = null

    /**
     * Boolean presence-check for "is any pan surface active?". Derived
     * so the attach effect below tracks the *boolean value*, not the
     * individual handler/whilePan reference identities. A consumer
     * passing `onPan={(e, i) => ...}` (inline arrow — fresh ref every
     * render) used to re-trigger the attach effect on every parent
     * render; with this derived in place, the attach effect only
     * re-runs when overall presence flips (none → some, some → none).
     * Per-ref changes flow through the hot-swap effect instead.
     */
    const hasAnyPanHandler = $derived(
        !!onPanProp ||
            !!onPanStartProp ||
            !!onPanEndProp ||
            !!onPanSessionStartProp ||
            !!resolvedWhilePan
    )

    const buildPanHandlers = (): {
        onSessionStart?: MotionOnPanSessionStart
        onStart: NonNullable<MotionOnPanStart>
        onMove?: MotionOnPan
        onEnd: NonNullable<MotionOnPanEnd>
    } => ({
        onSessionStart: onPanSessionStartProp,
        onStart: (event, info) => {
            if (resolvedWhilePan && element) {
                // Snapshot the values we'll revert to BEFORE applying — same
                // `computeHoverBaseline` path the other while-* gestures
                // (whileHover/whileFocus/drag) use. Covers animatable transform
                // shorthands (scale, rotate, x, y) AND restores non-animatable
                // inline writes (cursor, pointer-events) since the baseline
                // sniffs `animate` → `initial` → computed style → inline style.
                whilePanBaseline = computeHoverBaseline(element, {
                    initial: initialKeyframes ?? {},
                    animate: (resolvedAnimate ?? {}) as Record<string, unknown>,
                    whileHover: (resolvedWhilePan ?? {}) as Record<string, unknown>,
                    baseValues: getStyleTransformValues()
                })
                const { keyframes, transition } = splitHoverDefinition(
                    resolvedWhilePan as Record<string, unknown>
                )
                activeWhilePanKeyframes = keyframes
                animateWithLifecycle(
                    element,
                    keyframes as unknown as DOMKeyframesDefinition,
                    transition ?? mergedTransition ?? {}
                )
            }
            onPanStartProp?.(event, info)
        },
        onMove: onPanProp,
        onEnd: (event, info) => {
            if (activeWhilePanKeyframes && whilePanBaseline && element) {
                animateWithLifecycle(
                    element,
                    whilePanBaseline as unknown as DOMKeyframesDefinition,
                    mergedTransition ?? {}
                )
            }
            activeWhilePanKeyframes = null
            whilePanBaseline = null
            onPanEndProp?.(event, info)
        }
    })

    $effect(() => {
        if (isPlaywright) {
            pwLog('[motion] pan attach effect run', {
                hasAnyPanHandler,
                isLoaded
            })
        }
        if (!element || !hasGestureFeatures) return
        // Defer attachment until the element has settled out of the enter
        // animation phase — matches the gate every other gesture effect
        // in this file uses (drag, whileTap, whileHover, whileFocus,
        // whileInView). Without this, a pointerdown during the
        // initial / mounting phase would attach pan listeners against an
        // element whose enter animation hasn't committed its baseline.
        if (isLoaded !== 'ready') return
        // Drag takes precedence — upstream framer-motion's drag gesture is
        // implemented ON TOP of Pan, not alongside it. Co-attaching here
        // would create two competing pointer pipelines fighting for the
        // same transforms.
        if (dragProp) return
        if (!hasAnyPanHandler) return

        // `untrack` so the reactive reads inside `buildPanHandlers`
        // (onPan*Prop, resolvedWhilePan, initialKeyframes, resolvedAnimate,
        // mergedTransition) don't register as dependencies of this attach
        // effect. Otherwise every parent re-render that passes a fresh
        // inline arrow handler would re-run this effect and call
        // `teardownPan?.()`, killing the live PanSession mid-gesture.
        // Handler-ref changes flow exclusively through the hot-swap
        // effect below, which calls `teardownPan.update(next)` — that's
        // the path that keeps an in-flight gesture alive across re-renders.
        teardownPan = attachPan(
            element,
            untrack(() => buildPanHandlers())
        )

        return () => {
            // Synchronous revert of whilePan + lifecycle dispatch lives in
            // attachPan.teardown() — the cleanup chain there calls
            // session.dispatchTerminal(rawHandlers) BEFORE flipping isAlive,
            // so onPanEnd fires (which runs the revert above) before the
            // listeners go. dispatchTerminal is idempotent (PanSession's
            // terminalDispatched flag) so a host that tears down after a
            // natural release won't replay the lifecycle pair.
            teardownPan?.()
            teardownPan = null
            activeWhilePanKeyframes = null
            whilePanBaseline = null
        }
    })

    /**
     * Hot-swap effect — propagates handler / whilePan changes onto the
     * existing PanSession via `teardownPan.update(next)`. Tracked
     * separately from the attach effect so a fresh inline-arrow handler
     * reference does NOT trigger teardown + re-attach. Without this
     * split, every parent re-render mid-gesture would silently kill the
     * live pan session.
     */
    $effect(() => {
        // Track every prop the handler set depends on so this effect
        // re-runs when any of them change.
        void onPanSessionStartProp
        void onPanStartProp
        void onPanProp
        void onPanEndProp
        void resolvedWhilePan
        if (!teardownPan) return
        teardownPan.update(buildPanHandlers())
    })

    /**
     * Run the declarative enter/animate/variant pass through the VisualElement's
     * animationState.
     *
     * Replaces the former hand-rolled writer: instead of building a payload and
     * driving WAAPI directly, `animateChanges()` diffs `visualElement.props`
     * against its own `prevResolvedValues` and animates the owning MotionValues
     * (`motion-dom/render/utils/animation-state.mjs`). Keyframe arrays,
     * wildcards, `transitionEnd`, protected keys, variant priority and dedup are
     * all handled there, so the JSON bookkeeping this file used to carry is gone.
     */
    const runAnimateChanges = () => {
        const animationState = visualElement?.animationState
        if (!element || !animationState) {
            pwLog('[motion] runAnimateChanges bailing - no element or animationState')
            return
        }
        pwLog('[motion] runAnimateChanges via animationState')
        void animationState.animateChanges()
    }

    // Cleanup wait callback on component unmount to prevent memory leaks
    $effect(() => {
        return () => {
            if (element && waitHiddenDisplay !== null) {
                element.style.display = waitHiddenDisplay
                element.removeAttribute('data-presence-wait-hidden')
                waitHiddenDisplay = null
            }
            releaseWaitLayoutHold()
            waitUnsubscribe?.()
            waitUnsubscribe = null
        }
    })

    const getPresenceLayoutParent = (): HTMLElement | null => {
        let parent = element?.parentElement ?? null
        const layoutParent = element?.parentElement?.closest<HTMLElement>(
            '[data-svelte-motion-layout]'
        )
        if (layoutParent) return layoutParent

        while (parent && getComputedStyle(parent).display === 'contents') {
            parent = parent.parentElement
        }
        return parent
    }

    const holdWaitLayout = () => {
        if (!element || waitLayoutParent) return
        const parent = getPresenceLayoutParent()
        if (!parent) return

        const rect = parent.getBoundingClientRect()
        waitLayoutParent = parent
        waitLayoutParentWidth = parent.style.width
        waitLayoutParentHeight = parent.style.height
        waitLayoutViewportScrollX = typeof window !== 'undefined' ? window.scrollX : 0
        waitLayoutViewportScrollY = typeof window !== 'undefined' ? window.scrollY : 0
        parent.setAttribute(presenceLayoutHoldAttribute, 'true')
        parent.style.width = `${rect.width}px`
        parent.style.height = `${rect.height}px`
    }

    function releaseWaitLayoutHold() {
        if (!waitLayoutParent) return
        const parent = waitLayoutParent
        // Capture the hold parent's rect in the adapter's PAGE space. The
        // release handler diffs this against `measureLayoutRect()`, which
        // measures in page space — a viewport-relative capture on a scrolled
        // page would make the release FLIP carry a phantom delta of exactly
        // -scrollY (#437: the entering wait-mode label "flew in" from a full
        // scroll offset away). `pageRectOf` owns the conversion so window
        // scroll AND `layoutScroll` container offsets stay consistent with
        // the measurement side.
        const parentViewportRect = parent.getBoundingClientRect()
        const previousRect: RectLike = motionDomProjection?.pageRectOf(parent) ?? {
            left: parentViewportRect.left,
            top: parentViewportRect.top,
            width: parentViewportRect.width,
            height: parentViewportRect.height
        }
        parent.removeAttribute(presenceLayoutHoldAttribute)
        if (waitLayoutParentWidth) {
            parent.style.width = waitLayoutParentWidth
        } else {
            parent.style.removeProperty('width')
        }
        if (waitLayoutParentHeight) {
            parent.style.height = waitLayoutParentHeight
        } else {
            parent.style.removeProperty('height')
        }
        const viewportScrolledDuringHold =
            typeof window !== 'undefined' &&
            (window.scrollX !== waitLayoutViewportScrollX ||
                window.scrollY !== waitLayoutViewportScrollY)
        parent.dispatchEvent(
            new CustomEvent(presenceLayoutReleaseEvent, {
                detail: {
                    previousRect,
                    viewportScrolledDuringHold
                }
            })
        )
        waitLayoutParent = null
        waitLayoutParentWidth = ''
        waitLayoutParentHeight = ''
        waitLayoutViewportScrollX = 0
        waitLayoutViewportScrollY = 0
    }

    const revealWaitHiddenElement = () => {
        waitEnterReleased = true
        if (waitHiddenDisplay !== null && element) {
            if (waitHiddenDisplay) {
                element.style.display = waitHiddenDisplay
            } else {
                element.style.removeProperty('display')
            }
            element.removeAttribute('data-presence-wait-hidden')
            waitHiddenDisplay = null
        }
        releaseWaitLayoutHold()
    }

    // A post-mount "strip transforms the reducing policy forbids" pass used to
    // live here. It is GONE: `useReducedMotionConfig` already resolves
    // `'always'`/`'never'` SYNCHRONOUSLY from the MotionConfig context (only
    // `'user'` consults matchMedia), so `buildMotionNodeProps` filters `initial`
    // before the node is ever seeded and there is nothing left to strip. The pass
    // also ran only under a reducing policy and disturbed the node after its
    // enter had completed, which showed up as a double-fade flash under
    // `policy='always'` (guard-measured: opacity settled >0.99, then re-ran from
    // ~0.02). plan 002 Step 3h(a).

    /**
     * Sync the node's values to the resolved `animate` resting state.
     *
     * Accelerated channels (`opacity`, `transform`, `clipPath`, `filter`) run as
     * native WAAPI animations, and `bindToMotionValue` SHORT-CIRCUITS for them —
     * it builds a `NativeAnimation` and returns before installing the
     * `on("change")` subscription (`VisualElement.mjs:262-281`). So while such an
     * animation plays, and after it finishes, the MotionValue and `latestValues`
     * still hold the FROM state even though the element is visually at the
     * target.
     *
     * That matters at the optimized-appear handoff: the appear animation has
     * already played the fade, but `animateChanges()` would read `value.get()`
     * as the from-value and animate the identical range a second time — a
     * visible double-fade (guard-measured: a second `{opacity:[0,1]}` 1200ms
     * animation starting 2.4ms after the first one's `finished`, dropping the
     * element back to ~0.02). Jumping the values first means `animateChanges`
     * finds them already at target, protects those keys, and only drives the
     * channels the appear animation could not.
     *
     * @returns Nothing.
     */
    const syncValuesToAnimateTarget = (): void => {
        if (!visualElement) return
        const resting = resolveRestingValues(
            animateKeyframes as DOMKeyframesDefinition | undefined
        ) as Record<string, unknown> | undefined
        if (!resting) return
        for (const [key, value] of Object.entries(resting)) {
            if (value === undefined || value === null) continue
            const resolved = value as string | number
            // `jump`, not `set`: this is a catch-up to a state the element is
            // already in, so it must not leave velocity behind.
            visualElement.getValue(key)?.jump(resolved)
            visualElement.setStaticValue(key, resolved)
        }
    }

    /**
     * True once the mount/enter effect has run the first `animateChanges()`
     * pass. Until then the props effect must not fire one — the enter path owns
     * the initial ordering (phase transitions + the wait-mode gate).
     */
    let firstAnimatePassDone = false

    /**
     * Run the enter animation, respecting wait mode if inside AnimatePresence.
     * Returns true if animation was deferred (wait mode with blocked enters).
     */
    const runAnimation = (): boolean => {
        firstAnimatePassDone = true
        pwLog('[motion] runAnimation called', {
            hasElement: !!element,
            resolvedAnimate,
            mergedTransition,
            mode: context?.mode
        })

        // The animationState is the writer now, so the gate no longer needs a
        // resolved payload — `animateChanges()` decides for itself whether
        // anything changed. It DOES still need a mounted node.
        if (!element || !visualElement?.animationState) {
            pwLog('[motion] runAnimation bailing - no element or animationState')
            return false
        }

        // For mode='wait': check immediately if enters are blocked
        if (context?.mode === 'wait') {
            // Skip if we already have a wait callback registered
            if (waitCallbackRegistered) {
                pwLog('[motion] runAnimation: wait callback already registered, skipping')
                return true // Still deferred
            }

            const blocked = context.isEnterBlocked?.(presenceKey)
            pwLog('[motion] runAnimation: wait mode', { blocked })

            if (blocked) {
                pwLog('[motion] runAnimation: enters blocked, deferring')

                waitEnterReleased = false
                if (waitHiddenDisplay === null) {
                    waitHiddenDisplay =
                        element.style.display === 'none' ? '' : element.style.display
                    element.style.display = 'none'
                    element.setAttribute('data-presence-wait-hidden', 'true')
                    holdWaitLayout()
                }

                waitCallbackRegistered = true

                // Register callback to run animation when unblocked
                waitUnsubscribe = context.onEnterUnblocked(() => {
                    pwLog('[motion] runAnimation: enters unblocked, running')
                    waitUnsubscribe?.()
                    waitUnsubscribe = null
                    waitCallbackRegistered = false

                    // Reveal synchronously after the exiting placeholder has
                    // been removed. The parent is fixed-size until the next
                    // frame, so it measures the final entrant instead of an
                    // overlap between exiting and entering content.
                    revealWaitHiddenElement()

                    // No duration-0 initial snap needed any more: the deferred
                    // pass has not animated yet, so `latestValues` still holds the
                    // seeded `initial` and the VE has already rendered it — the
                    // element is at its from-state by construction.

                    // Use RAF to ensure DOM is settled, then run animation
                    requestAnimationFrame(() => {
                        runAnimateChanges()
                        // Now it's safe to mark as ready
                        requestAnimationFrame(() => {
                            // CLAUDE.md "AnimatePresence wait mode": the enter has
                            // to be marked handled BEFORE flipping `isLoaded`, or
                            // the ready-state effects re-run enter and the deferred
                            // animation ends in a visible pop. The JSON flags that
                            // did the marking are gone — dedup lives in
                            // `animateChanges` (`prevResolvedValues`), so a second
                            // pass is inherently a no-op — but the ORDER still
                            // matters for the reveal, so it is preserved.
                            pwLog('[motion] wait-unblocked: marking enter handled')
                            isLoaded = 'ready'
                        })
                    })
                })
                return true // Animation was deferred
            }

            if (waitHiddenDisplay !== null || waitEnterBlockedBeforeMount) {
                pwLog('[motion] runAnimation: wait mode no longer blocked, revealing')
                revealWaitHiddenElement()
            }
        }

        // Not blocked - run animation immediately
        pwLog('[motion] runAnimation: not blocked, executing')
        runAnimateChanges()
        return false
    }

    // The JSON dedup state (`lastRanVariantKey`, `lastRanResolvedJson`,
    // `mountedWithInitialFalse`, `initialAnimationTriggered`,
    // `objectAnimateRanOnMount`, `lastAnimatePropJson`) is deleted: dedup is
    // `animateChanges`'s job via `prevResolvedValues` (plan 002 Step 3).
    let motionDomProjectionUpdatePending = false
    // `currentAnimateKey` is gone: it existed only for the JSON variant-dedup
    // bookkeeping, which `animateChanges` now owns.

    $effect(() => {
        if (!motionDomProjection) return
        motionDomProjection.updateOptions({
            layout: layoutProp,
            layoutId: scopedLayoutId,
            layoutScroll: layoutScrollProp,
            transition: mergedTransition as never,
            style: styleProp
        })
    })

    // MOUNT effect — must track ONLY `element`.
    //
    // The `updateOptions` call is deliberately `untrack`ed. Read reactively it
    // makes `styleProp`/`transition`/`layout*` dependencies of the MOUNT effect,
    // so any of them changing tears the adapter down and mounts it again — and
    // `VisualElement.mount()` REWINDS every value to `initialValues` on a
    // remount (`VisualElement.mjs:180-191`, the Suspense-replay branch). A
    // reactive style change would therefore jump the element back to `initial`
    // mid-flight: measured on the controls page, an interrupted start frozen at
    // translateX(16.032px) snapped to 0 in one frame when an unrelated outline
    // colour changed, with the stack naming
    // `HTMLVisualElement.mount` <- `MotionDomProjectionAdapter.mount` <- this
    // effect. The effect above owns reactive option updates.
    $effect(() => {
        if (!motionDomProjection) return
        if (!element) return
        const mountTarget = element
        untrack(() => {
            motionDomProjection.updateOptions({
                layout: layoutProp,
                layoutId: scopedLayoutId,
                layoutScroll: layoutScrollProp,
                transition: mergedTransition as never,
                style: styleProp
            })
        })
        motionDomProjection.mount(mountTarget)
        return () => {
            motionDomProjection.unmount()
        }
    })

    // Mount the single VisualElement (#449) and instantiate its features.
    //
    // Declared AFTER the projection effect on purpose: `VisualElement.mount()`
    // also mounts the projection node, and the node must already carry its
    // `setOptions({ layout, layoutId, … })` when that happens — mounting the
    // VisualElement first registers an option-less projection node and changes
    // layout/FLIP behaviour. So the adapter does the actual `mount()` (with
    // options applied and the layout seeded) and this effect only covers the
    // no-adapter fallback, the feature instantiation, and teardown.
    $effect(() => {
        if (!visualElement || !element) return
        const mounted = element
        if (visualElement.current !== mounted) visualElement.mount(mounted)
        // motion-dom never calls this itself — the consumer does, after mount
        // (upstream use-visual-element.ts:147). It instantiates the enabled
        // features, giving the node its `animationState`.
        visualElement.updateFeatures()
        // Upstream use-visual-element.ts:148 — flush `latestValues` to the DOM so
        // the seeded starting state is actually applied before anything animates.
        // Safe now that `animationState` drives `latestValues`.
        visualElement.scheduleRenderMicrotask()
        // The FIRST `animateChanges()` is fired by the mount/enter effect below,
        // which owns the `isLoaded` phase transitions and the wait-mode gate
        // (upstream does the equivalent in a later effect,
        // use-visual-element.ts:163-176).

        // `animateChanges` no longer runs our own lifecycle callbacks, so bridge
        // the VisualElement's events instead. The controls path still fires its
        // own callbacks directly (it is not animationState-driven until Step 7),
        // hence the guard.
        const offStart = visualElement.on('AnimationStart', (definition) => {
            onAnimationStartProp?.(definition as DOMKeyframesDefinition | undefined)
        })
        const offComplete = visualElement.on('AnimationComplete', (definition) => {
            // Flush one render on settle. An INTERRUPTED animation (a variant
            // retargeted mid-flight) can land its final value without a
            // subsequent render, leaving the element frozen at the frame the
            // interrupt happened on while `latestValues` reads correct — measured
            // on e2e/variants/stagger-interrupt. Scheduling here is idempotent:
            // motion-dom coalesces onto the frameloop's render step.
            visualElement.scheduleRender()
            onAnimationCompleteProp?.(definition as DOMKeyframesDefinition | undefined)
        })
        return () => {
            offStart()
            offComplete()
            if (visualElement.current === mounted) visualElement.unmount()
            visualElementStore.delete(mounted)
        }
    })

    // Keep the node's props in sync, then let the animationState diff them.
    // `untrack` on the write so only the props read inside
    // `buildMotionNodeProps` are tracked.
    //
    // This replaces the former JSON-dedup re-run effects wholesale: upstream
    // dedups inside `animateChanges` against `prevResolvedValues` (plus
    // `protectedKeys` for priority), so re-running on every prop change is
    // correct and idempotent — no `lastAnimatePropJson` / `lastRanVariantKey`
    // bookkeeping required.
    $effect(() => {
        if (!visualElement) return
        const next = buildMotionNodeProps()
        untrack(() => {
            visualElement.update(next, buildPresenceContext())
            // `update()` can change what the node renders WITHOUT scheduling a
            // render of its own: `addValue()` writes `latestValues[key]` directly
            // when a MotionValue instance is replaced (VisualElement.mjs:437-447),
            // and dropping `transformTemplate` changes how `latestValues` composes.
            // Both leave the DOM showing the previous frame — measured on
            // `transform-template` "removes transformTemplate if prop is removed"
            // (latestValues.x = 20 while the element still read translateX(10px)).
            // `scheduleRenderMicrotask` (not `scheduleRender`) because this is a
            // per-commit flush, exactly as upstream does after every React commit
            // (use-visual-element.ts:148); the frameloop variant can sit unflushed
            // when nothing else is animating, which left `renderState` stale.
            visualElement.scheduleRenderMicrotask()
            // Only once the mount/enter effect has run the first pass — it owns
            // the enter ordering and the wait-mode gate.
            //
            // And never while imperative controls are attached: the subscriber is
            // the writer then, and `props.animate` is `undefined`, so a pass would
            // see every key the previous declarative target animated as REMOVED
            // and animate it back to `getBaseTarget` — snapping the element to
            // `initial` on a declarative -> controls swap. Upstream never hits
            // this because it hands `animateChanges` the controls object itself,
            // which it early-skips; our props shape cannot do that without
            // tripping `isControllingVariants` (measured: 10 controls specs
            // regressed), so the guard lives here instead.
            if (firstAnimatePassDone && !animateControls) runAnimation()
        })
    })

    let explicitLayoutSnapshot: RectLike | null = null
    let lastRect: RectLike | null = null
    // Coordinates the two delivery paths so one layout change produces exactly
    // one FLIP commit (upstream guarantees one measure/animate pass per commit:
    // MeasureLayout.tsx getSnapshotBeforeUpdate→componentDidUpdate + the
    // create-projection-node animationId repeat guard). A change to the
    // element's OWN `class` is seen by BOTH the reactive path (`classProp` is a
    // tracked layout dependency) and the DOM self-attribute observer (its
    // `attributeFilter` includes `class`). The observer commits first on its
    // microtask; `commitObservedLayout` bumps this serial whenever it commits a
    // changed rect, and `runReactiveCommit` (running later on frame.postRender)
    // uses the advance to detect that its own snapshot's change was already
    // committed — so it skips the duplicate re-commit that would otherwise
    // restart the FLIP from origin and double-fire `onProjectionUpdate`.
    let observerCommitSerial = 0
    // Reactive deps the measure effects read to decide when to re-snapshot and
    // FLIP. When `layoutDependency` is set, gate measurement on *only* that
    // value so frequent renders that touch class/style/etc. no longer force a
    // re-measure. The fallback list stays a thunk so those props are tracked
    // only when gating is off. See `selectLayoutDependencies` for the contract.
    //
    // Drag escape hatch: upstream `MeasureLayout` also forces a snapshot while a
    // drag is active, regardless of `layoutDependency` (MeasureLayout.tsx:92).
    // We mirror that by ignoring the gate while `drag` is set, so a draggable
    // `layout` element keeps measuring as the user moves it.
    const trackLayoutProjectionDependencies = () =>
        selectLayoutDependencies(dragProp ? undefined : layoutDependencyProp, () => [
            classProp,
            styleProp,
            scopedLayoutId,
            mergedTransition
        ])

    $effect.pre(() => {
        const shouldProject = element && layoutProp && isLoaded === 'ready' && hasLayoutFeatures
        // Track common layout-affecting props so Svelte-owned updates can
        // snapshot before the DOM patch, matching upstream MeasureLayout.
        trackLayoutProjectionDependencies()

        if (!shouldProject) {
            explicitLayoutSnapshot = null
            return
        }

        // 'snapshot' phase: the pre-patch side of the update boundary.
        explicitLayoutSnapshot = measureLayoutRect('snapshot')
        motionDomProjection?.willUpdate()
        motionDomProjectionUpdatePending = true
    })

    // Reactive (Svelte-owned) layout commits race the DOM patch: this
    // post-effect can run before the flush's style writes land — notably a
    // PARENT's object-style change repositioning this `layout` element,
    // which motion-dom's styleEffect batches onto the frameloop's render
    // phase. Measuring then (or on upstream's microtask flush) reads the
    // OLD layout, sees no change, and skips the animation — a visible snap.
    // Defer the measure + commit to frame.postRender — after the frameloop's
    // style writes, still pre-paint — and drive the animation through the
    // same explicit-snapshot commit the observer path uses.
    let reactiveCommitPrevious: RectLike | null = null
    // Snapshot of `observerCommitSerial` taken when this reactive commit was
    // scheduled. If the observer path commits a changed rect before the
    // postRender callback runs, the serial advances past this captured value.
    let reactiveCommitSerialAtSchedule = 0

    const runReactiveCommit = () => {
        const prev = reactiveCommitPrevious
        reactiveCommitPrevious = null
        if (!(element && prev)) return
        // A PROPER ANCESTOR mid size-corrected FLIP (`runBoxSizeAnimation`)
        // re-slots this child every frame. This deferred (postRender) commit
        // runs AFTER the ancestor set `data-layout-size-animation`, so it can
        // see it — and it runs after the size-correction seed already reset the
        // child's cache. Committing a FLIP here (e.g. from the `.state` label's
        // copy→copied class flip) would re-apply the very enter transform the
        // seed cancelled, painting the one-frame pop. Skip it entirely; the
        // observer path keeps the cache fresh while the ancestor animates.
        if (element.parentElement?.closest('[data-layout-size-animation]')) return
        const next = measureLayoutRect()
        if (!next) return
        // The DOM observer already consumed this exact change: it committed a
        // changed rect on its microtask (serial advanced since this callback
        // was scheduled) AND the cached `lastRect` already equals `next`. The
        // FLIP is already running from the observer's commit — re-committing
        // from THIS path's pre-patch snapshot would restart it from origin and
        // emit a second `onProjectionUpdate` for one logical change. Skip both
        // the changed emit and the commit; the observer already emitted.
        // (Both conditions are required so a genuine reactive-only delta the
        // observer never saw still commits, and the no-delta idle event below
        // is untouched — the observer only bumps the serial on a real change.)
        const observerAlreadyCommitted =
            observerCommitSerial !== reactiveCommitSerialAtSchedule &&
            lastRect !== null &&
            !hasRectChanged(lastRect, next)
        if (observerAlreadyCommitted) return
        // Svelte-owned update: fan out the snapshot→measure delta to
        // `onProjectionUpdate` subscribers (zero deltas included — the
        // legacy node notified on every willUpdate/didUpdate pair, and the
        // idle "changed=false" event is part of the observable contract).
        emitProjectionUpdate(prev, next)
        if (hasRectChanged(prev, next)) {
            lastRect = next
            motionDomProjection?.commitObservedLayoutChange(prev)
        }
        // No delta from THIS path's snapshot: leave `lastRect` alone. The
        // snapshot may have raced the DOM patch (measured post-patch, so
        // prev === next), and overwriting the cache here would poison the
        // observer path's diff — it would compare new-vs-new and skip the
        // FLIP entirely (an intermittent snap, ordering-dependent).
    }

    $effect(() => {
        const shouldProject = element && layoutProp && isLoaded === 'ready' && hasLayoutFeatures
        trackLayoutProjectionDependencies()

        if (!shouldProject || !motionDomProjectionUpdatePending) return
        motionDomProjectionUpdatePending = false
        const previous = explicitLayoutSnapshot
        explicitLayoutSnapshot = null
        if (!previous) {
            motionDomProjection?.didUpdate()
            return
        }
        // Keep the OLDEST pending snapshot: with several reactive updates
        // before the frame, that is what is still visually on screen.
        // (Re-scheduling an already-queued callback is a frameloop no-op.)
        // Capture the observer serial alongside the oldest snapshot so a
        // subsequent observer commit (which runs on its microtask, after this
        // synchronous effect) advances the serial past this captured value.
        if (reactiveCommitPrevious === null) {
            reactiveCommitPrevious = previous
            reactiveCommitSerialAtSchedule = observerCommitSerial
        }
        frame.postRender(runReactiveCommit)
    })

    // Cancel a pending reactive commit when the component tears down.
    $effect(() => {
        return () => {
            reactiveCommitPrevious = null
            cancelFrame(runReactiveCommit)
        }
    })

    // Subscribe the consumer's `onLayoutMeasure` callback to the adapter's
    // stripped page-space measurements. The measure-then-subscribe order
    // matters: the seed read below would otherwise ALSO notify the fresh
    // subscription and double-fire the initial slot. Consumers like
    // `Reorder.Item` need that initial slot to register with their group
    // before the first layout change.
    $effect(() => {
        if (!(element && onLayoutMeasureProp && motionDomProjection)) return
        // Seed from the adapter's cache (mount() already ran seedLayout());
        // fall back to a fresh read only when no cached rect exists yet.
        const seed = motionDomProjection.lastMeasuredRect ?? measureLayoutRect()
        const off = motionDomProjection.onMeasure((rect) => onLayoutMeasureProp(boxFromRect(rect)))
        if (seed) {
            onLayoutMeasureProp(boxFromRect(seed))
        }
        return () => {
            off()
        }
    })

    // Upstream layout projection via motion-dom. Svelte runes mode doesn't
    // expose the React-style pre/post render hook pair used upstream, so the
    // component snapshots committed layout changes through DOM observers and
    // fans the public `onProjectionUpdate` events out from the same
    // page-space rect diffs that drive the commits.
    //
    // Measurements are taken in scroll-invariant PAGE space through the
    // motion-dom node's phase-cached scroll (see `measureLayoutRect`), so a
    // viewport scroll between two reads can never masquerade as a layout
    // delta. This is what allowed the former viewport-scroll/offscreen
    // suppression heuristic to be deleted (#437): pure scrolls fire no layout
    // observers, and real layout changes now diff scroll-clean rects —
    // including offscreen, which animates like upstream instead of snapping.
    $effect(() => {
        if (!(element && layoutProp && isLoaded === 'ready' && hasLayoutFeatures)) return

        let rafId: number | null = null
        const flipLayoutMode = layoutProp === 'position' ? 'position' : true
        motionDomProjection?.seedLayout()
        lastRect = measureLayoutRect()
        setCompositorHints(element!, true)

        const commitObservedLayout = () => {
            if (element!.hasAttribute('data-layout-size-animation')) {
                return
            }

            // A PROPER ANCESTOR mid size-corrected FLIP (`runBoxSizeAnimation`,
            // e.g. a `layout` button whose width springs between "copy" and
            // "copied") re-slots this `layout`/`layout="position"` child every
            // frame as it grows. The child must NOT FLIP each frame (that would
            // fight the parent), so it tracks its natural reflowed slot — but
            // its cached layout must stay fresh, or the parent's single-step
            // completion re-slot surfaces the whole accumulated delta as a
            // one-frame phantom FLIP (an ~8px pop that then glides back).
            // Seed to the current slot instead: keep the cache aligned with the
            // in-flight animation so completion produces a zero delta and no
            // uncompensated frame ever renders.
            const hasSizeAnimatingAncestor = !!element!.parentElement?.closest(
                '[data-layout-size-animation]'
            )
            if (hasSizeAnimatingAncestor) {
                finishFlipAnimations(element!)
                lastRect = measureLayoutRect()
                motionDomProjection?.seedLayout()
                motionDomProjection?.finishAnimation()
                return
            }

            const hasPresenceHold = element!.hasAttribute(presenceLayoutHoldAttribute)
            const hasHiddenWaitEnter = !!element!.querySelector(
                '[data-presence-wait-hidden="true"]'
            )
            const hasPresencePlaceholder =
                !!element!.querySelector('[data-presence-placeholder="true"]') ||
                !!element!.parentElement?.querySelector('[data-presence-placeholder="true"]')
            const hasSizeCorrectionTarget = !!element!.querySelector('[data-svelte-motion-layout]')

            if (hasPresenceHold || hasHiddenWaitEnter) {
                return
            }

            if (hasPresencePlaceholder && !hasSizeCorrectionTarget) {
                finishFlipAnimations(element!)
                lastRect = measureLayoutRect()
                motionDomProjection?.seedLayout()
                motionDomProjection?.finishAnimation()
                return
            }

            // A live drag's slot change routes to the `adjustOrigin`
            // compensation below instead of a FLIP (measurements are
            // page-coordinate, so the delta is scroll-clean).
            const isDragActiveElement =
                element!.dataset.svelteMotionDragActive === 'true' && !!teardownDrag

            const next = measureLayoutRect()
            if (!next) return
            const previous = lastRect
            lastRect = next
            if (previous && hasRectChanged(previous, next)) {
                // Mark that the observer path consumed a changed rect on this
                // commit, so a reactive commit scheduled for the same logical
                // change (`runReactiveCommit`) can detect the overlap and skip
                // its duplicate re-commit.
                observerCommitSerial += 1
                // Observed layout change: fan out to `onProjectionUpdate`
                // subscribers before branching, so drag-pinned and
                // size-corrected commits report their deltas too (the
                // legacy node emitted from its commit for all of them).
                emitProjectionUpdate(previous, next)
                // A live drag whose layout slot just moved (e.g. Reorder
                // swapped the dragged item's DOM position): a FLIP here
                // would fight the gesture, so instead the motion-dom
                // node's `didUpdate` delta shifts the drag origin
                // (upstream: VisualElementDragControls.ts:742-758) — the
                // element stays pinned under the cursor and
                // `dragSnapToOrigin` settles into the NEW slot on
                // release. The paint goes through the buildTransform
                // writer via `adjustOrigin`. The delta lands within the
                // upstream microtask flush — before the next pointermove
                // task — so the gesture transform is compensated before
                // Reorder's checkReorder can see the uncompensated
                // element and double-fire the swap.
                if (isDragActiveElement && teardownDrag) {
                    const activeDrag = teardownDrag
                    motionDomProjection?.commitDraggedLayoutChange(previous, (dx, dy) => {
                        activeDrag.adjustOrigin(dx, dy)
                    })
                    return
                }

                const transforms = computeFlipTransforms(previous, next, flipLayoutMode)
                const shouldUseSizeCorrectedFallback =
                    transforms.shouldScale && hasSizeCorrectionTarget

                if (motionDomProjection && !shouldUseSizeCorrectedFallback) {
                    motionDomProjection.commitObservedLayoutChange(previous)
                } else {
                    finishFlipAnimations(element!)
                    runFlipAnimation(element!, transforms, mergedTransition ?? {})
                }
            }
        }

        const commitPresenceLayoutRelease = (event: Event) => {
            const detail = (
                event as CustomEvent<{
                    previousRect?: RectLike
                    viewportScrolledDuringHold?: boolean
                }>
            ).detail
            const previous = detail?.previousRect
            const viewportRect = element!.getBoundingClientRect()
            const next = measureLayoutRect()
            if (!(previous && next)) return

            lastRect = next
            // Presence-hold semantics: a hold that spanned a viewport scroll
            // or released offscreen still skips its release FLIP.
            // `previousRect` arrives in PAGE space (converted at capture in
            // `releaseWaitLayoutHold`), matching `measureLayoutRect()` above —
            // both sides of the diff must share a coordinate space or a
            // scrolled page shows up as a phantom -scrollY delta (#437).
            const shouldSkipLayoutAnimation =
                detail?.viewportScrolledDuringHold || isViewportOffscreen(viewportRect)
            const transforms = computeFlipTransforms(previous, next, flipLayoutMode)
            const hasSizeCorrectionTarget = !!element!.querySelector('[data-svelte-motion-layout]')
            const shouldUseSizeCorrectedFallback = transforms.shouldScale && hasSizeCorrectionTarget

            if (
                !shouldSkipLayoutAnimation &&
                (!motionDomProjection || shouldUseSizeCorrectedFallback)
            ) {
                finishFlipAnimations(element!)
                runFlipAnimation(element!, transforms, mergedTransition ?? {})
            }
            if (!shouldSkipLayoutAnimation && hasRectChanged(previous, next)) {
                if (motionDomProjection && !shouldUseSizeCorrectedFallback) {
                    motionDomProjection.commitObservedLayoutChange(previous)
                }
            } else if (shouldSkipLayoutAnimation) {
                motionDomProjection?.finishAnimation()
            }
        }

        const scheduleProjectionCommit = () => {
            if (rafId) return
            commitObservedLayout()
            rafId = requestAnimationFrame(() => {
                rafId = null
            })
        }

        // A size-animating `layout` ancestor fires these synchronously at the
        // start/end of its `runBoxSizeAnimation` (before the next paint). On
        // START, BLOCK this child's projection: any enter/re-slot FLIP it
        // committed a beat earlier — before the ancestor's
        // `data-layout-size-animation` attribute was set, so the commit-path
        // guard could not yet see it — is finished and its scheduled frameloop
        // update is prevented from resurrecting the transform. The child then
        // tracks the growing parent at identity. On END, unblock and re-seed so
        // later real layout changes animate normally. This is what makes the
        // fix race-proof: `finishAnimation()` alone can be outrun by a
        // projection update already queued on the frameloop.
        const handleSizeCorrectionSeed = () => {
            lastRect = measureLayoutRect()
            motionDomProjection?.blockLayoutAnimation()
        }
        const handleSizeCorrectionEnd = () => {
            lastRect = measureLayoutRect()
            motionDomProjection?.unblockLayoutAnimation()
        }
        element!.addEventListener(sizeCorrectionSeedEvent, handleSizeCorrectionSeed)
        element!.addEventListener(sizeCorrectionEndEvent, handleSizeCorrectionEnd)

        const disconnectObservers = observeLayoutChanges(element!, () => scheduleProjectionCommit())
        element!.addEventListener(presenceLayoutReleaseEvent, commitPresenceLayoutRelease)

        return () => {
            disconnectObservers()
            element?.removeEventListener(presenceLayoutReleaseEvent, commitPresenceLayoutRelease)
            element?.removeEventListener(sizeCorrectionSeedEvent, handleSizeCorrectionSeed)
            element?.removeEventListener(sizeCorrectionEndEvent, handleSizeCorrectionEnd)
            lastRect = null
            if (element) {
                setCompositorHints(element, false)
            }
            if (rafId) cancelAnimationFrame(rafId)
        }
    })

    // Shared layout animation via layoutId.
    // On mount, consume the previous snapshot and FLIP from its position.
    $effect(() => {
        if (
            !(
                element &&
                scopedLayoutId &&
                layoutIdRegistry &&
                isLoaded === 'ready' &&
                hasLayoutFeatures
            )
        )
            return

        const prev = layoutIdRegistry.consume(scopedLayoutId)
        if (!prev) return // First appearance, no animation needed
        if (motionDomProjection && layoutProp) return

        const next = measureRect(element, resolveLayoutScrollAncestors())
        const transforms = computeFlipTransforms(prev.rect, next, true)

        setCompositorHints(element, true)
        runFlipAnimation(element, transforms, prev.transition ?? mergedTransition ?? {})
    })

    // Shared per-element coordination between the hover and tap gesture
    // systems: active-state flags + a single-writer animation registry
    // (upstream setActive / protected-keys semantics — see
    // gestureCoordinator.ts).
    const gestureCoordinator = createGestureCoordinator()

    // Per-element registry of persistent per-channel MotionValues the hover
    // composed writer drives. Sharing it with the tap system lets a mid-flight
    // hover→tap press read each channel's live velocity for a momentum-carrying
    // handoff (upstream re-targets the same MotionValue). Owned here so it
    // survives independent re-runs of the hover/tap effects.
    const gestureChannelValues = new Map<string, MotionValue<number>>()

    // whileTap handling via motion-dom's press()
    $effect(() => {
        if (
            !(element && isLoaded === 'ready' && hasGestureFeatures && isNotEmpty(resolvedWhileTap))
        )
            return
        return attachWhileTap(
            element!,
            (resolvedWhileTap ?? {}) as Record<string, unknown>,
            (resolvedInitial ?? {}) as Record<string, unknown>,
            (resolvedAnimate ?? {}) as Record<string, unknown>,
            {
                onTapStart: onTapStartProp,
                onTap: onTapProp,
                onTapCancel: onTapCancelProp,
                hoverDef: isNotEmpty(resolvedWhileHover ?? {})
                    ? ((resolvedWhileHover ?? {}) as Record<string, unknown>)
                    : undefined,
                hoverFallbackTransition: mergedTransition ?? {},
                tapTransition: mergedTransition ?? {},
                coordinator: gestureCoordinator,
                getBaseStyleValues,
                getSharedChannelValue: (key: string) => gestureChannelValues.get(key)
            }
        )
    })

    // whileHover handling, gated to true-hover devices to avoid sticky states on touch
    $effect(() => {
        if (
            !(
                element &&
                isLoaded === 'ready' &&
                hasGestureFeatures &&
                isNotEmpty(resolvedWhileHover)
            )
        )
            return
        return attachWhileHover(
            element!,
            (resolvedWhileHover ?? {}) as Record<string, unknown>,
            mergedTransition ?? {},
            { onStart: onHoverStartProp, onEnd: onHoverEndProp },
            {
                initial: (resolvedInitial ?? {}) as Record<string, unknown>,
                animate: (resolvedAnimate ?? {}) as Record<string, unknown>
            },
            {
                getBaseTransformValues: getStyleTransformValues,
                getLiveTransformValues: () => liveGestureTransformValues,
                getBaseTransform: () => userBaseTransform,
                transformTemplate: transformTemplateProp,
                getBaseStyleValues,
                channelValues: gestureChannelValues
            },
            gestureCoordinator
        )
    })

    // whileFocus handling for keyboard focus interactions
    $effect(() => {
        if (
            !(
                element &&
                isLoaded === 'ready' &&
                hasGestureFeatures &&
                isNotEmpty(resolvedWhileFocus)
            )
        )
            return
        return attachWhileFocus(
            element!,
            (resolvedWhileFocus ?? {}) as Record<string, unknown>,
            mergedTransition ?? {},
            { onStart: onFocusStartProp, onEnd: onFocusEndProp },
            {
                initial: (resolvedInitial ?? {}) as Record<string, unknown>,
                animate: (resolvedAnimate ?? {}) as Record<string, unknown>
            }
        )
    })

    // whileInView handling for viewport intersection
    $effect(() => {
        if (
            !(
                element &&
                isLoaded === 'ready' &&
                hasGestureFeatures &&
                isNotEmpty(resolvedWhileInView)
            )
        )
            return
        return attachWhileInView(
            element!,
            (resolvedWhileInView ?? {}) as Record<string, unknown>,
            mergedTransition ?? {},
            {
                onStart: onInViewStartProp,
                onEnd: onInViewEndProp,
                onAnimationComplete: onAnimationCompleteProp
            },
            {
                initial: (resolvedInitial ?? {}) as Record<string, unknown>,
                animate: (resolvedAnimate ?? {}) as Record<string, unknown>
            },
            viewportProp
        )
    })

    // Legacy animation controls (`animate={controls}`) mirror upstream's
    // VisualElement subscription model with a small Svelte adapter. The
    // controls own when animations start; this component only resolves
    // variants/custom data and runs the resulting target on its element.
    $effect(() => {
        if (!(element && animateControls)) return

        const node = visualElement
        if (!node) return

        /** Live value for a relative offset: the node's own value, else the DOM. */
        const readControlsChannel = (key: string): number | undefined => {
            const live = node.getValue(key)?.get()
            if (typeof live === 'number') return live
            const parsed = Number.parseFloat(String(live))
            return Number.isFinite(parsed) ? parsed : readLiveChannelValue(key)
        }

        const resolveControlsRelatives = (definition: unknown): unknown => {
            if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
                return definition
            }
            return (
                resolveWildcardKeyframes(
                    definition as DOMKeyframesDefinition,
                    readControlsChannel
                ) ?? definition
            )
        }

        const subscriber: AnimationControlsSubscriber = {
            // Upstream's `animation-controls.ts` does exactly this: hand the
            // definition to `animateVisualElement`, which resolves variant
            // labels, lists and function-form definitions against the node's own
            // props, notifies AnimationStart/AnimationComplete, and RETARGETS the
            // same MotionValues (so an interrupting start keeps velocity).
            start: (definition, transitionOverride) =>
                animateVisualElement(
                    node,
                    // Resolve `'+=N'` / `'-=N'` relatives against the CURRENT live
                    // value first. They are a svelte-motion extension with no
                    // motion-dom equivalent (`fillWildcards` handles `null` only),
                    // so an unresolved relative reaching `animateTarget` silently
                    // holds the channel. Deliberately NOT memoized, unlike the
                    // declarative path: every imperative `start()` is a fresh
                    // command that must offset from wherever the value is NOW.
                    // Object targets only — a bare label keeps going through
                    // motion-dom so `animateVariant`'s label handling and child
                    // propagation stay intact.
                    resolveControlsRelatives(definition) as never,
                    {
                        transitionOverride: transitionOverride as never,
                        custom: effectiveCustom
                    } as never
                ),
            // `set` is a jump, not an animation: resolve to resting values and
            // write them straight onto the node.
            set: (definition) => {
                const resolved = resolveAnimationControlsDefinition(definition)
                if (!resolved) return
                // Split the orchestration keys out before collapsing: `transition`
                // is irrelevant to a jump, and `transitionEnd` values are applied
                // ON TOP of the target (upstream `setTarget` semantics).
                const target = { ...(resolved as Record<string, unknown>) }
                const transitionEnd = target.transitionEnd as Record<string, unknown> | undefined
                delete target.transition
                delete target.transitionEnd
                const resting = {
                    ...((resolveRestingValues(target as DOMKeyframesDefinition) ?? {}) as Record<
                        string,
                        unknown
                    >),
                    ...(transitionEnd ?? {})
                }
                if (!isNotEmpty(resting)) return
                for (const [key, value] of Object.entries(resting)) {
                    if (value === undefined || value === null) continue
                    const target = value as string | number
                    node.getValue(key)?.jump(target)
                    node.setStaticValue(key, target)
                }
                node.scheduleRenderMicrotask()
            },
            // Upstream's shape exactly (`animation-controls.ts`): stop each
            // MotionValue. No snapshot bookkeeping — `MotionValue.stop()` routes
            // into `NativeAnimation.stop()`, which calls
            // `NativeAnimationExtended.updateMotionValue()`
            // (NativeAnimationExtended.mjs:54-84). That samples a renderless
            // JSAnimation twice at wall-clock elapsed time to recover BOTH value
            // and velocity, writes the sampled value to inline style so it
            // survives the post-`cancel()` gap, and calls `setWithVelocity` — so
            // an interrupted accelerated channel freezes exactly where it is and
            // any follow-up animation inherits its velocity.
            stop: () => {
                node.values.forEach((value) => value.stop())
            }
        }

        return animateControls.subscribe(subscriber)
    })

    // The per-attachment "clear the settle state on detach" effect lived here.
    // It is gone with Step 7: there is no settle state to clear any more. Values
    // live on the VisualElement's MotionValues, which ARE the upstream
    // last-writer-wins store — swapping `animate={controls}` -> declarative ->
    // back to idle controls now leaves each value wherever its last completed
    // animation put it, because that is simply where the MotionValue is.

    // Handle key prop changes inside AnimatePresence (simulates React's key-based remounting)
    // When key changes, run exit → initial → animate sequence on the same element
    $effect(() => {
        // Access keyProp to create reactive dependency
        const currentKey = keyProp

        // Only handle key changes when:
        // 1. We're inside AnimatePresence (context exists)
        // 2. Element is ready (not during initial mount)
        // 3. Key actually changed (not undefined → value on mount)
        // 4. Not already transitioning
        if (
            !shouldRegisterPresenceExit ||
            !element ||
            isLoaded !== 'ready' ||
            keyTrackerIsTransitioning ||
            currentKey === keyTrackerPrev ||
            keyTrackerPrev === undefined
        ) {
            pwLog('[motion] key effect: early return', {
                currentKey,
                keyTrackerPrev,
                isLoaded,
                hasElement: !!element,
                hasContext: !!context,
                keyTrackerIsTransitioning
            })
            // Update prev for next comparison
            if (currentKey !== keyTrackerPrev) {
                keyTrackerPrev = currentKey
            }
            return
        }

        pwLog('[motion] key changed, running exit→initial→animate', {
            prevKey: keyTrackerPrev,
            newKey: currentKey
        })

        // Mark as transitioning to prevent re-entry
        keyTrackerIsTransitioning = true
        keyTransitionStopped = false
        keyTrackerPrev = currentKey

        // Run the key transition sequence
        const runKeyTransition = async () => {
            try {
                // A Svelte `key` change on the SAME element is upstream's
                // unmount+remount. Reproduce it as: exit -> rewind -> re-enter,
                // with the exit half driven by the animationState so it gets the
                // same priority/protected-keys semantics as everything else
                // (upstream `exit.ts:19-72`). (plan 004 Step 4)
                const animationState = visualElement?.animationState

                // 1. Exit, via setActive — not a bespoke `animate()` call.
                if (animationState && exitProp !== undefined && !keyTransitionStopped) {
                    pwLog('[motion] key transition: setActive(exit, true)')
                    await animationState.setActive('exit', true)
                }

                pwLog('[motion] key transition: exit done', {
                    keyTransitionStopped,
                    hasElement: !!element
                })

                // Check if component was unmounted during the exit animation
                if (keyTransitionStopped || !element) return

                pwLog('[motion] key transition: rewinding to initial and re-entering')
                if (visualElement && animationState) {
                    // 2. Rewind to the CURRENTLY resolved `initial`. Keyframe
                    // arrays rewind to element [0] — the from-state.
                    for (const [key, value] of Object.entries(keyChangeInitialKeyframes ?? {})) {
                        const resolved = (Array.isArray(value) ? value[0] : value) as
                            | string
                            | number
                        if (resolved === undefined || resolved === null) continue
                        // `jump`, not `set`: a rewind must not leave velocity
                        // behind for the re-enter to inherit.
                        visualElement.getValue(key)?.jump(resolved)
                        visualElement.setStaticValue(key, resolved)
                    }
                    visualElement.scheduleRenderMicrotask()

                    // 3. Re-enter. `blockInitialAnimation` must be cleared first:
                    // it is set when `AnimatePresence initial={false}` suppressed
                    // the FIRST enter, but upstream scopes that to the first
                    // render only — a key change is a new mount and must animate.
                    // Left set, `animateChanges` swallows the re-enter after
                    // `reset()` restores `isInitialRender`, and the element stays
                    // on its exit target (measured on the rolling copy control:
                    // latestValues stuck at opacity 0 / y -14 / blur(5px)).
                    visualElement.blockInitialAnimation = false
                    // Release exit so it stops protecting those keys.
                    await animationState.setActive('exit', false)
                    // Clear `prevResolvedValues` so the re-enter is not deduped
                    // away as "already at target".
                    animationState.reset()
                }

                // SVG dash attrs are presentation attributes the style render
                // cannot rewind; keep writing them directly.
                if (keyChangeInitialKeyframes && element) {
                    const transformedInitial = transformSVGPathProperties(
                        element,
                        keyChangeInitialKeyframes
                    )
                    for (const [key, value] of Object.entries(transformedInitial)) {
                        if (key === 'strokeDasharray' || key === 'stroke-dasharray') {
                            element.setAttribute(
                                'stroke-dasharray',
                                String(Array.isArray(value) ? value[0] : value)
                            )
                        }
                        if (key === 'strokeDashoffset' || key === 'stroke-dashoffset') {
                            element.setAttribute(
                                'stroke-dashoffset',
                                String(Array.isArray(value) ? value[0] : value)
                            )
                        }
                    }
                }

                runAnimation()
            } finally {
                pwLog('[motion] key transition: finally', { keyTransitionStopped })
                if (!keyTransitionStopped) {
                    keyTrackerIsTransitioning = false
                }
            }
        }

        // Fire-and-forget: `$effect` bodies cannot be async, and the transition
        // manages its own cancellation via the cleanup returned below.
        void runKeyTransition()

        // Cleanup on unmount
        return () => {
            pwLog('[motion] key effect: cleanup, stopping transition')
            keyTransitionStopped = true
        }
    })

    // The former JSON-dedup re-run effects lived here (`lastAnimatePropJson`,
    // `lastRanVariantKey`, `lastRanResolvedJson`, `objectAnimateRanOnMount`,
    // `mountedWithInitialFalse`, `initialAnimationTriggered`). They are gone:
    // the props effect above calls `animateChanges()` on every prop change and
    // upstream dedups internally against `prevResolvedValues`, so a re-run with
    // an unchanged target is a no-op rather than a duplicate animation.

    // Mount/enter lifecycle.
    //
    // The animation itself is `animationState.animateChanges()` now, so every
    // duration-0 "snap" is gone: `latestValues` is seeded with the resolved
    // `initial` (or, under `initial={false}`, with the `animate` target's LAST
    // keyframe) and the VisualElement has already flushed it to the DOM via
    // `scheduleRenderMicrotask()`. This effect owns only the `isLoaded` phase
    // machine and the enter ordering.
    $effect(() => {
        if (!(element && isLoaded === 'mounting')) return
        markMotionMounted()

        // Capture non-transform authored base values (opacity) from the DOM at
        // rest, BEFORE any enter/gesture animation runs below, so hover-end can
        // restore the true authored value rather than a mid-animation transient.
        captureBaseStyleValues()

        pwLog('[motion] main effect running', {
            effectiveAnimate: !!effectiveAnimate,
            effectiveInitialProp,
            resolvedAnimate,
            initialKeyframes,
            hasInitialKeyframes: isNotEmpty(initialKeyframes)
        })

        if (effectiveAnimate) {
            if (effectiveInitialProp === false && resolvedAnimate) {
                // `initial={false}`: `blockInitialAnimation` is set and
                // `makeLatestValues` seeded from `animate`'s last keyframe, so the
                // element already renders at the target and nothing should move.
                //
                // The pass still has to RUN, though. `animateChanges` owns an
                // `isInitialRender` flag and swallows the first pass when
                // `props.initial === false` (animation-state.mjs:318-325); if we
                // skip that pass entirely the flag stays true, and the first REAL
                // variant change gets swallowed instead — the element records the
                // new target in `prevResolvedValues` and never animates to it.
                pwLog('[motion] path: initial=false, priming animationState at target')
                dataPath = 5
                isLoaded = 'ready'
                runAnimation()
            } else if (isNotEmpty(initialKeyframes)) {
                const canHandoffOptimizedAppear = hasOptimizedAppearAnimation(optimizedAppearId)
                if (canHandoffOptimizedAppear) {
                    pwLog('[motion] path: optimized appear handoff')
                    dataPath = 6
                    isLoaded = 'initial'
                    // The appear animation owns the values while it is in flight,
                    // so block the props effect from starting a competing pass.
                    firstAnimatePassDone = true
                    finishOptimizedAppearAnimation(optimizedAppearId)
                        .then(() => {
                            // Hand off to the animationState only AFTER the appear
                            // animation resolves (plan 002 scope note; upstream
                            // does the same in use-visual-element.ts:163-176).
                            // This is load-bearing, not belt-and-braces: the
                            // optimized-appear bootstrap only animates
                            // WAAPI-accelerated channels (opacity/transform), so
                            // without this pass a non-accelerated channel such as
                            // `filter` would never leave its `initial` value.
                            //
                            // Sync FIRST: the appear animation was accelerated, so
                            // the node's values still read the from-state and
                            // `animateChanges` would replay the whole enter.
                            syncValuesToAnimateTarget()
                            runAnimation()
                            isLoaded = 'ready'
                            onAnimationCompleteProp?.(resolvedAnimate)
                        })
                        .catch(() => {
                            isLoaded = 'ready'
                        })
                    return
                }
                pwLog('[motion] path: has initialKeyframes, will animate to target')

                // SVG dash properties are presentation ATTRIBUTES, not styles, so
                // the VE's style render cannot seed them. Keep the synchronous
                // attribute write that prevents a mount flash.
                const transformedInitial = transformSVGPathProperties(element!, initialKeyframes)
                if (
                    'strokeDasharray' in transformedInitial ||
                    'strokeDashoffset' in transformedInitial
                ) {
                    Object.entries(transformedInitial).forEach(([key, value]) => {
                        const v = String(Array.isArray(value) ? value[0] : value)
                        if (key === 'strokeDasharray' || key === 'stroke-dasharray') {
                            element!.setAttribute('stroke-dasharray', v)
                        }
                        if (key === 'strokeDashoffset' || key === 'stroke-dashoffset') {
                            element!.setAttribute('stroke-dashoffset', v)
                        }
                    })
                }

                // Expose 'initial': the seeded render already put the from-state on
                // the element, and this drops the pathLength visibility hold.
                isLoaded = 'initial'
                dataPath = 1

                // rAF expects a void return; an async callback hands it a Promise
                // nothing can await. Name the work and mark it fire-and-forget.
                const runEnterAnimation = async () => {
                    if (isPlaywright) {
                        await sleep(10)
                    }
                    pwLog('[motion] RAF: promoting to ready and running animation')

                    const wasDeferred = runAnimation()

                    // If the enter was deferred (wait mode) the unblock callback
                    // flips `isLoaded`; otherwise promote on the next frame.
                    if (!wasDeferred) {
                        requestAnimationFrame(() => {
                            isLoaded = 'ready'
                        })
                    }
                }
                requestAnimationFrame(() => void runEnterAnimation())
            } else {
                pwLog('[motion] path: no initialKeyframes, skip to ready')
                dataPath = 2
                isLoaded = 'ready'
                runAnimation()
            }
        } else if (isNotEmpty(initialKeyframes)) {
            // `initial` with no `animate`: the seeded render already applied it, so
            // there is nothing to write and nothing to animate.
            //
            // The gate still has to OPEN. It exists only to stop the props effect
            // racing the enter ordering; leaving it shut means a later prop change
            // can never animate. That is reachable in practice: a node with
            // `animate={controls}` has no declarative `animate` at all, so it
            // mounts here — and swapping it to a declarative target afterwards
            // produced no animation until this flag was set.
            firstAnimatePassDone = true
            dataPath = 3
            isLoaded = 'initial'
            // rAF expects a void return; see above.
            const promoteToReady = async () => {
                if (isPlaywright) {
                    await sleep(10)
                }
                isLoaded = 'ready'
            }
            requestAnimationFrame(() => void promoteToReady())
        } else {
            // Nothing to animate on mount, but open the gate for later changes
            // (see the dataPath 3 note above).
            firstAnimatePassDone = true
            dataPath = 4
            isLoaded = 'ready'
        }
    })
</script>

{#if isVoidTag}
    {#if isSVGTag(String(tag))}
        <svelte:element
            this={renderTag}
            bind:this={element}
            xmlns={SVG_NAMESPACE}
            {...derivedAttrs}
        />
        <!-- trunk-ignore(eslint/svelte/no-at-html-tags): optimized appear emits a JSON-escaped SSR bootstrap script, not user-authored HTML. -->
        {@html renderedOptimizedAppearScript}
    {:else}
        <svelte:element this={tag} bind:this={element} {...derivedAttrs} />
        <!-- trunk-ignore(eslint/svelte/no-at-html-tags): optimized appear emits a JSON-escaped SSR bootstrap script, not user-authored HTML. -->
        {@html renderedOptimizedAppearScript}
    {/if}
{:else if isSVGTag(String(tag))}
    <svelte:element this={renderTag} bind:this={element} xmlns={SVG_NAMESPACE} {...derivedAttrs}>
        {#if motionValueChild}
            {motionValueChildText ?? motionValueChildInitialText}
        {:else}
            {@render children?.()}
        {/if}
    </svelte:element>
    <!-- trunk-ignore(eslint/svelte/no-at-html-tags): optimized appear emits a JSON-escaped SSR bootstrap script, not user-authored HTML. -->
    {@html renderedOptimizedAppearScript}
{:else}
    <svelte:element this={tag} bind:this={element} {...derivedAttrs}>
        {#if motionValueChild}
            {motionValueChildText ?? motionValueChildInitialText}
        {:else}
            {@render children?.()}
        {/if}
    </svelte:element>
    <!-- trunk-ignore(eslint/svelte/no-at-html-tags): optimized appear emits a JSON-escaped SSR bootstrap script, not user-authored HTML. -->
    {@html renderedOptimizedAppearScript}
{/if}
