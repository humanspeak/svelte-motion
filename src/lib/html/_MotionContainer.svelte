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
        MotionTransition,
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
    import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
    import {
        animateSingleValue,
        motionValue,
        readTransformValue,
        styleEffect,
        svgEffect,
        type MotionValue,
        type ValueAnimationTransition
    } from 'motion-dom'
    import { isPlaywrightEnv, pwLog } from '$lib/utils/log'
    import { onDestroy, untrack, type Snippet } from 'svelte'
    import { VOID_TAGS } from '$lib/utils/constants'
    import { mergeTransitions, animateWithLifecycle } from '$lib/utils/animation'
    import { isAnimationControls } from '$lib/utils/animationControls.svelte'
    import { attachWhileTap } from '$lib/utils/interaction'
    import { attachWhileHover, computeHoverBaseline, splitHoverDefinition } from '$lib/utils/hover'
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
    import { isWillChangeMotionValue } from '$lib/utils/willChange.svelte'
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
    import { ProjectionNode } from '$lib/utils/projection'
    import { getProjectionParent, setProjectionParent } from '$lib/components/projection.context'
    import { MotionDomProjectionAdapter } from '$lib/utils/motionDomProjection'
    import { SvelteSet } from 'svelte/reactivity'
    import {
        getMotionDomProjectionParent,
        setMotionDomProjectionParent
    } from '$lib/components/motionDomProjection.context'
    import {
        resolveInitial,
        resolveAnimate,
        resolveExit,
        resolveWhile,
        resolveVariantList,
        resolveRestingValues
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
        hasSVGPathProperties,
        isSVGPathElement,
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
    const inPresenceChild = !!getPresenceChildContext()

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

    // Projection tree wiring (#379). Capture the parent node BEFORE
    // publishing our own — same shadowing trap as layoutScroll above.
    // The node measures through `resolveLayoutScrollAncestors` so its
    // boxes share the FLIP coordinate space, and zeros ancestor
    // transforms during measure so nested layout-animated parents don't
    // corrupt a child's delta.
    // The user-authored transform, sourced from the `style` prop rather
    // than the live inline transform — the latter already carries any
    // transform-type `initial`/`animate` keyframe by the time the node
    // measures, which would be mistaken for the user's base.
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
    const userBaseTransform = $derived(extractTransform(styleProp))
    let liveGestureTransform = $state<string | null>(null)
    const liveGestureComposedTransform = $derived.by(() => {
        if (!liveGestureTransform) return null

        const { transform } = splitSerializedTransform(serializedStyleProp)
        return [liveGestureTransform, transform].filter(Boolean).join(' ')
    })
    const serializedStyleWithLiveGestureTransform = $derived.by(() => {
        if (!liveGestureComposedTransform) return serializedStyleProp

        const { rest } = splitSerializedTransform(serializedStyleProp)
        return `${rest}${rest ? '; ' : ''}transform: ${liveGestureComposedTransform}`
    })

    $effect(() => {
        if (!element || !liveGestureComposedTransform) return
        if (element.style.transform === liveGestureComposedTransform) return

        element.style.transform = liveGestureComposedTransform
    })

    const projectionParent = getProjectionParent()
    const projection = new ProjectionNode({
        parent: projectionParent,
        getScrollContainers: resolveLayoutScrollAncestors,
        getBaseTransform: () => userBaseTransform
    })
    setProjectionParent(projection)

    const motionDomProjectionParent =
        typeof window !== 'undefined' ? getMotionDomProjectionParent() : null
    const motionDomProjection =
        typeof window !== 'undefined'
            ? new MotionDomProjectionAdapter({
                  parent: motionDomProjectionParent
              })
            : null
    if (motionDomProjection) {
        setMotionDomProjectionParent(motionDomProjection)
    }

    // Convert a projection `Box` (ancestor chain reset to base, self
    // transform stripped, scroll containers compensated) to the
    // `RectLike` shape `computeFlipTransforms` consumes.
    const boxToRectLike = (box: {
        x: { min: number; max: number }
        y: { min: number; max: number }
    }): RectLike => ({
        left: box.x.min,
        top: box.y.min,
        width: box.x.max - box.x.min,
        height: box.y.max - box.y.min
    })
    const domRectToRectLike = (rect: DOMRect): RectLike => ({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
    })
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

    // Ancestor-transform-invariant layout measurement for seeding the
    // fallback FLIP effect's first rect.
    const measureLayoutRect = (): RectLike | null => {
        const box = projection.measure()
        return box ? boxToRectLike(box) : null
    }

    // Get current presence depth (0 = direct child of AnimatePresence, undefined = not in AnimatePresence)
    const presenceDepth = getPresenceDepth()

    // Validate key prop only for direct children of AnimatePresence (depth 0)
    // This matches Framer Motion behavior where only immediate children need keys
    if (context && presenceDepth === 0 && !keyProp) {
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

    // Use the provided key for presence tracking
    // When not inside AnimatePresence, use a stable identifier based on component instance
    // trunk-ignore(eslint/no-useless-assignment): false positive — presenceKey is used throughout the component
    const presenceKey = keyProp ?? `motion-${++keyCounter}`

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

    $effect(() => {
        if (!element) return

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
    const resolvePresenceCustom = () => {
        const presenceCustom = context?.custom
        return presenceCustom !== undefined ? presenceCustom : effectiveCustom
    }
    const resolvedExit = $derived(resolveExit(exitProp, variantsProp, resolvePresenceCustom()))

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
        if (!transformTemplateProp || !restingValues) return restingValues

        const restingJson = JSON.stringify(restingValues)
        if (enterAnimationSettled && lastAnimateRestingJson === restingJson) return restingValues
        return lastAnimateRestingValues ?? restingValues
    })
    const extractTargetTransition = <T extends Record<string, unknown>>(
        keyframes: T,
        transitionOverride?: AnimationOptions
    ) => {
        const transition = keyframes.transition as AnimationOptions | undefined
        const transitionEnd = keyframes.transitionEnd as Record<string, unknown> | undefined
        const target = { ...keyframes }
        delete target.transition
        delete target.transitionEnd

        return {
            target,
            transition:
                transitionOverride ?? mergeTransitions(mergedTransition ?? {}, transition ?? {}),
            transitionEnd
        }
    }

    /**
     * Notify a `useWillChange()` value carried in object-form `style` that the
     * given keys are animating, so it can promote the element to its own
     * compositor layer. Mirrors framer-motion wiring the will-change value into
     * the animation pipeline. `add()` self-filters to transform/accelerated
     * keys, so passing the full key set is safe.
     *
     * @param {string[]} keys The property keys about to animate.
     */
    const notifyWillChange = (keys: string[]) => {
        // Widen to `unknown` first: narrowing the motion-dom `MotionValue` union
        // directly against `WillChangeMotionValue` collapses to `never` (the
        // augmented public `current` clashes with the base's private one).
        const willChange: unknown = collectMotionStyleValues(styleProp)?.willChange
        if (!isWillChangeMotionValue(willChange)) return
        for (const key of keys) willChange.add(key)
    }

    const applyAnimateRestingStyle = () => {
        if (!element) return
        if (!animateKeyframes) return
        const { target, transitionEnd } = extractTargetTransition(animateKeyframes)
        const restingValues = resolveRestingValues({
            ...getResolvedStyleTransformValues(),
            ...target,
            ...(transitionEnd ?? {})
        } as DOMKeyframesDefinition | undefined) as Record<string, unknown> | undefined
        if (!restingValues) return
        lastAnimateRestingValues = restingValues
        lastAnimateRestingJson = JSON.stringify(restingValues)
        element.setAttribute(
            'style',
            mergeInlineStyles(
                element.getAttribute('style') ?? '',
                undefined,
                restingValues,
                transformTemplateProp
            )
        )
    }
    const isJsdomRuntime = (): boolean =>
        typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)
    const getTransitionFallbackMs = (transition: AnimationOptions | undefined): number => {
        const duration = typeof transition?.duration === 'number' ? transition.duration : 0
        const delay = typeof transition?.delay === 'number' ? transition.delay : 0
        return Math.max(0, (duration + delay) * 1000)
    }
    let cleanupSVGPathAttributeEffect: (() => void) | null = null

    /**
     * Reads the current normalized SVG path drawing state from DOM
     * attributes. `motion-dom`'s svgEffect owns future writes; this only
     * seeds its MotionValues from the currently rendered frame.
     *
     * @param {SVGPathElement} path The SVG path element to inspect.
     * @returns {{ pathLength: number; pathSpacing: number; pathOffset: number }} The normalized drawing state.
     */
    const readSVGPathDrawingState = (
        path: SVGPathElement
    ): { pathLength: number; pathSpacing: number; pathOffset: number } => {
        const dashArray =
            path.getAttribute('stroke-dasharray') || path.style.strokeDasharray || '1 0'
        const [rawLength, rawSpacing] = dashArray
            .split(/[,\s]+/)
            .filter(Boolean)
            .map((part) => Number.parseFloat(part))
        const rawOffset = Number.parseFloat(
            path.getAttribute('stroke-dashoffset') || path.style.strokeDashoffset || '0'
        )

        return {
            pathLength: Number.isFinite(rawLength) ? rawLength : 1,
            pathSpacing: Number.isFinite(rawSpacing) ? rawSpacing : 1,
            pathOffset: Number.isFinite(rawOffset) ? -rawOffset : 0
        }
    }

    /**
     * Removes custom SVG path props from keyframes after `svgEffect` has
     * taken ownership of them.
     *
     * @param {Record<string, unknown>} keyframes Keyframes to copy.
     * @returns {Record<string, unknown>} Keyframes without SVG path-only props.
     */
    const stripSVGPathKeyframes = (keyframes: Record<string, unknown>): Record<string, unknown> => {
        const stripped = { ...keyframes }
        delete stripped.pathLength
        delete stripped.pathSpacing
        delete stripped.pathOffset
        return stripped
    }

    /**
     * Extracts an animation completion promise from a Motion control when
     * one is available.
     *
     * @param {unknown} control The return value from `animate`.
     * @returns {Promise<unknown> | null} The finished promise, or null.
     */
    const getFinishedPromise = (control: unknown): Promise<unknown> | null => {
        if (!control || typeof control !== 'object') return null
        const finished = (control as { finished?: unknown }).finished
        return finished && typeof (finished as Promise<unknown>).then === 'function'
            ? (finished as Promise<unknown>)
            : null
    }

    const getAnimationPromise = (control: unknown): Promise<unknown> => {
        const finished = getFinishedPromise(control)
        if (finished) return finished
        if (control && typeof (control as Promise<unknown>).then === 'function') {
            return control as Promise<unknown>
        }
        return Promise.resolve()
    }

    type StoppableAnimationControl = {
        stop?: () => void
        cancel?: () => void
    }

    const activeAnimationControls = new SvelteSet<StoppableAnimationControl>()
    let animationControlsGeneration = 0
    let animationControlsHasReceivedCommand = false
    let lastAnimationControlsTarget = $state<Record<string, unknown> | undefined>(undefined)
    const templatedTransformMotionValues: Record<string, MotionValue> = {}
    let templatedTransformAnimationControls: StoppableAnimationControl[] = []
    let templatedTransformAnimationGeneration = 0
    let templatedTransformAnimationCleanup: (() => void) | null = null

    const isStoppableAnimationControl = (control: unknown): control is StoppableAnimationControl =>
        !!control &&
        typeof control === 'object' &&
        (typeof (control as StoppableAnimationControl).stop === 'function' ||
            typeof (control as StoppableAnimationControl).cancel === 'function')

    const trackAnimationControlsControl = (control: unknown): Promise<unknown> => {
        const promise = getAnimationPromise(control)
        if (isStoppableAnimationControl(control)) {
            activeAnimationControls.add(control)
            promise.then(
                () => activeAnimationControls.delete(control),
                () => activeAnimationControls.delete(control)
            )
        }
        return promise
    }

    const templatedTransformKeys = new Set([
        'x',
        'y',
        'z',
        'scale',
        'scaleX',
        'scaleY',
        'rotate',
        'rotateX',
        'rotateY',
        'rotateZ',
        'skew',
        'skewX',
        'skewY',
        'translateX',
        'translateY',
        'translateZ',
        'transform',
        'transformPerspective'
    ])

    const getFirstKeyframeValue = (value: unknown): unknown =>
        Array.isArray(value) ? value[0] : value

    const getMotionStyleInitialValue = (key: string): unknown => {
        if (!styleProp || typeof styleProp !== 'object' || Array.isArray(styleProp))
            return undefined
        const value = (styleProp as Record<string, unknown>)[key]
        if (
            value &&
            typeof value === 'object' &&
            'get' in value &&
            typeof value.get === 'function'
        ) {
            return (value as { get: () => unknown }).get()
        }
        return value
    }

    const getDefaultTransformValue = (key: string, target: unknown): unknown => {
        if (key === 'transform') {
            return element?.style.transform || getComputedStyle(element!).transform || 'none'
        }
        if (key.startsWith('scale')) return 1
        if (typeof target === 'string' && /%$/.test(target)) return '0%'
        if (typeof target === 'string' && /turn$/.test(target)) return '0turn'
        if (typeof target === 'string' && /rad$/.test(target)) return '0rad'
        if (typeof target === 'string' && /deg$/.test(target)) return '0deg'
        if (typeof target === 'string' && /px$/.test(target)) return '0px'
        return 0
    }

    const getCurrentTransformValue = (key: string, target: unknown): unknown => {
        if (!element || key === 'transform') return undefined

        try {
            const current = readTransformValue(element, key)
            if (!Number.isFinite(current)) return undefined
            if (typeof target === 'string') {
                if (/%$/.test(target)) return `${current}%`
                if (/turn$/.test(target)) return `${current}turn`
                if (/rad$/.test(target)) return `${current}rad`
                if (/deg$/.test(target)) return `${current}deg`
                if (/px$/.test(target)) return `${current}px`
            }
            return current
        } catch {
            return undefined
        }
    }

    const getTemplatedTransformInitialValue = (key: string, target: unknown): unknown => {
        const fromInitial =
            initialKeyframes && key in initialKeyframes
                ? getFirstKeyframeValue(initialKeyframes[key])
                : undefined
        if (fromInitial != null) return fromInitial

        const fromStyle = getMotionStyleInitialValue(key)
        if (fromStyle != null) return getFirstKeyframeValue(fromStyle)

        return getDefaultTransformValue(key, getFirstKeyframeValue(target))
    }

    const getTemplatedTransformMotionValue = (key: string, target: unknown): MotionValue => {
        const existing = templatedTransformMotionValues[key]
        if (existing) return existing

        const firstTarget = getFirstKeyframeValue(target)
        const initialValue =
            getCurrentTransformValue(key, firstTarget) ??
            getTemplatedTransformInitialValue(key, firstTarget)

        const value = motionValue(initialValue) as MotionValue
        templatedTransformMotionValues[key] = value
        return value
    }

    const stopTemplatedTransformAnimations = () => {
        templatedTransformAnimationGeneration += 1
        for (const control of templatedTransformAnimationControls) {
            if (typeof control.stop === 'function') {
                control.stop()
            } else {
                control.cancel?.()
            }
        }
        templatedTransformAnimationControls = []
    }

    const cleanupTemplatedTransformAnimations = () => {
        stopTemplatedTransformAnimations()
        templatedTransformAnimationCleanup?.()
        templatedTransformAnimationCleanup = null
    }

    const splitTemplatedTransformPayload = (payload: Record<string, unknown>) => {
        const templatePayload: Record<string, unknown> = {}
        const nativePayload: Record<string, unknown> = {}

        for (const [key, value] of Object.entries(payload)) {
            if (templatedTransformKeys.has(key)) {
                templatePayload[key] = value
            } else {
                nativePayload[key] = value
            }
        }

        return {
            templatePayload,
            nativePayload,
            hasTemplatePayload: Object.keys(templatePayload).length > 0,
            hasNativePayload: Object.keys(nativePayload).length > 0
        }
    }

    const getTemplatedStyleTransformValues = (): Record<string, unknown> => {
        if (!styleProp || typeof styleProp !== 'object' || Array.isArray(styleProp)) return {}

        const values: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(styleProp as Record<string, unknown>)) {
            if (templatedTransformKeys.has(key)) values[key] = value
        }
        return values
    }

    const getResolvedStyleTransformValues = (): Record<string, unknown> => {
        const values: Record<string, unknown> = {}
        for (const key of templatedTransformKeys) {
            const value = getMotionStyleInitialValue(key)
            if (value !== undefined) values[key] = value
        }
        return values
    }

    const animateTemplatedTransformPayload = (
        payload: Record<string, unknown>,
        transition: AnimationOptions,
        onStart: (def: unknown) => void,
        onComplete: (def: unknown) => void
    ): Promise<unknown> => {
        if (!element || !transformTemplateProp) return Promise.resolve()

        const { templatePayload, nativePayload, hasNativePayload } =
            splitTemplatedTransformPayload(payload)
        const motionValues: Record<string, MotionValue> = {}
        const valueTransition: ValueAnimationTransition = {
            ...transition,
            delay: typeof transition.delay === 'number' ? transition.delay : undefined
        }
        stopTemplatedTransformAnimations()
        const generation = templatedTransformAnimationGeneration

        for (const [key, target] of Object.entries(templatePayload)) {
            motionValues[key] = getTemplatedTransformMotionValue(key, target)
        }

        templatedTransformAnimationCleanup?.()
        templatedTransformAnimationCleanup =
            applyMotionStyleEffect(
                element,
                { ...getTemplatedStyleTransformValues(), ...motionValues },
                transformTemplateProp
            ) ?? null

        onStart(payload)

        const promises: Promise<unknown>[] = []
        for (const [key, target] of Object.entries(templatePayload)) {
            const control = animateSingleValue(motionValues[key], target as never, valueTransition)
            if (isStoppableAnimationControl(control)) {
                templatedTransformAnimationControls.push(control)
            }
            promises.push(getAnimationPromise(control))
        }

        if (hasNativePayload) {
            const nativeControl = animate(
                element,
                nativePayload as DOMKeyframesDefinition,
                transition
            )
            if (isStoppableAnimationControl(nativeControl)) {
                templatedTransformAnimationControls.push(nativeControl)
            }
            promises.push(getAnimationPromise(nativeControl))
        }

        return Promise.all(promises)
            .then(() => {
                if (generation !== templatedTransformAnimationGeneration) return
                templatedTransformAnimationControls = []
                templatedTransformAnimationCleanup?.()
                templatedTransformAnimationCleanup = null
                onComplete(payload)
            })
            .catch(() => {
                if (generation !== templatedTransformAnimationGeneration) return
                templatedTransformAnimationControls = []
                templatedTransformAnimationCleanup?.()
                templatedTransformAnimationCleanup = null
                onComplete(payload)
            })
    }

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

    const applyAnimationControlsTarget = (definition: AnimationControlsDefinition) => {
        if (!element) return
        const resolved = resolveAnimationControlsDefinition(definition)
        if (!resolved) return

        animationControlsHasReceivedCommand = true
        const target = { ...(resolved as Record<string, unknown>) } as Record<string, unknown> & {
            transition?: AnimationOptions
            transitionEnd?: Record<string, unknown>
        }
        const transitionEnd = target.transitionEnd
        delete target.transition
        delete target.transitionEnd
        const finalTarget = resolveRestingValues({
            ...target,
            ...(transitionEnd ?? {})
        } as DOMKeyframesDefinition) as Record<string, unknown> | undefined
        if (!finalTarget) return

        const transformedTarget = transformSVGPathProperties(element, finalTarget)
        if (!transformTemplateProp) {
            animate(element, transformedTarget as DOMKeyframesDefinition, { duration: 0 })
        }
        element.setAttribute(
            'style',
            mergeInlineStyles(
                element.getAttribute('style') ?? '',
                undefined,
                transformedTarget,
                transformTemplateProp
            )
        )
        lastAnimationControlsTarget = transformedTarget
        enterAnimationSettled = true
    }

    const stopAnimationControlsAnimations = () => {
        animationControlsHasReceivedCommand = true
        animationControlsGeneration += 1

        // The templated-transform path animates MotionValues that are not part of
        // `activeAnimationControls` and never surface in `element.getAnimations()`,
        // so a public `controls.stop()` would otherwise leak a running templated
        // transform animation (and its style-effect cleanup). Upstream stops a
        // VisualElement by stopping all of its values; mirror that here. (#402)
        cleanupTemplatedTransformAnimations()

        for (const control of activeAnimationControls) {
            if (typeof control.stop === 'function') {
                control.stop()
            } else {
                control.cancel?.()
            }
        }
        activeAnimationControls.clear()

        if (!element) return
        if (typeof element.getAnimations !== 'function') return
        for (const animation of element.getAnimations()) {
            try {
                animation.commitStyles?.()
            } catch {
                // Ignore unsupported commitStyles cases.
            }
            animation.cancel()
        }
    }

    const startAnimationControlsDefinition = async (
        definition: AnimationControlsDefinition,
        transitionOverride?: AnimationOptions
    ): Promise<unknown> => {
        if (!element) return
        const resolved = resolveAnimationControlsDefinition(definition)
        if (!resolved) return

        animationControlsHasReceivedCommand = true
        const filtered = filterReducedMotionKeyframes(
            resolved as Record<string, unknown>,
            reducedMotion
        ) as Record<string, unknown> & {
            transition?: AnimationOptions
            transitionEnd?: Record<string, unknown>
        }
        const transition = filtered.transition
        const target = { ...filtered }
        delete target.transition
        delete target.transitionEnd
        const transitionAnimate: MotionTransition =
            transitionOverride ?? mergeTransitions(mergedTransition ?? {}, transition ?? {})
        const svgPathFinished =
            isSVGPathElement(element) && hasSVGPathProperties(target)
                ? animateSVGPathAttributes(element, target, transitionAnimate, true)
                : []
        const payload = transformSVGPathProperties(
            element,
            svgPathFinished.length > 0 ? stripSVGPathKeyframes(target) : target
        )

        // Imperative controls (useAnimationControls/useAnimate) animate transforms
        // too — notify will-change here just like the declarative path does.
        notifyWillChange(Object.keys(payload))

        const controlsGeneration = ++animationControlsGeneration
        enterAnimationSettled = false
        onAnimationStartProp?.(definition as unknown as DOMKeyframesDefinition)

        const promises: Promise<unknown>[] = [...svgPathFinished]
        if (isNotEmpty(payload)) {
            const shouldAnimateThroughTransformTemplate =
                !!transformTemplateProp &&
                splitTemplatedTransformPayload(payload).hasTemplatePayload

            if (shouldAnimateThroughTransformTemplate) {
                promises.push(
                    animateTemplatedTransformPayload(
                        payload,
                        transitionAnimate,
                        () => {},
                        () => {}
                    )
                )
            } else {
                cleanupTemplatedTransformAnimations()
                promises.push(
                    trackAnimationControlsControl(
                        animate(element, payload as DOMKeyframesDefinition, transitionAnimate)
                    )
                )
            }
        }

        try {
            await Promise.all(promises)
        } catch (error) {
            if (controlsGeneration !== animationControlsGeneration) return
            throw error
        }
        if (controlsGeneration !== animationControlsGeneration) return
        applyAnimationControlsTarget(definition)
        onAnimationCompleteProp?.(definition as unknown as DOMKeyframesDefinition)
    }

    /**
     * Animates SVG path drawing props via motion-dom's `svgEffect`, matching
     * upstream's attribute-based pathLength/pathSpacing/pathOffset behavior.
     *
     * @param {SVGPathElement} path The path element to animate.
     * @param {Record<string, unknown>} keyframes Keyframes containing SVG path props.
     * @param {MotionTransition} transition The transition to apply to generated MotionValues.
     * @returns {Promise<unknown>[]} Promises for generated path animations.
     */
    const animateSVGPathAttributes = (
        path: SVGPathElement,
        keyframes: Record<string, unknown>,
        transition: MotionTransition,
        trackControl = false
    ): Promise<unknown>[] => {
        if (!hasSVGPathProperties(keyframes)) return []

        cleanupSVGPathAttributeEffect?.()
        const current = readSVGPathDrawingState(path)
        const values: Record<string, MotionValue<number>> = {}

        if ('pathLength' in keyframes) {
            values.pathLength = motionValue(current.pathLength)
        }
        if ('pathLength' in keyframes || 'pathSpacing' in keyframes) {
            values.pathSpacing = motionValue(current.pathSpacing)
        }
        if ('pathOffset' in keyframes) {
            values.pathOffset = motionValue(current.pathOffset)
        }

        cleanupSVGPathAttributeEffect = svgEffect(path, values)

        return Object.entries(values)
            .map(([key, value]) => {
                const control = animate(
                    value as never,
                    (key === 'pathSpacing' && !('pathSpacing' in keyframes)
                        ? 1
                        : keyframes[key]) as never,
                    transition as unknown as AnimationOptions
                )
                return trackControl
                    ? trackAnimationControlsControl(control)
                    : getFinishedPromise(control)
            })
            .filter((promise): promise is Promise<unknown> => promise !== null)
    }

    onDestroy(() => {
        cleanupSVGPathAttributeEffect?.()
        cleanupSVGPathAttributeEffect = null
        stopTemplatedTransformAnimations()
        templatedTransformAnimationCleanup?.()
        templatedTransformAnimationCleanup = null
    })

    // Wait-mode enter coordination needs to affect the first rendered attrs,
    // before the blocked entrant can participate in layout.
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
    const renderedInlineStyle = $derived.by(() =>
        mergeInlineStyles(
            `${initialKeyframes && 'pathLength' in initialKeyframes && isLoaded === 'mounting' ? `${serializedStyleWithLiveGestureTransform};visibility:hidden` : serializedStyleWithLiveGestureTransform}${waitEnterBlockedBeforeMount || waitHiddenDisplay !== null ? ';display:none' : ''}`,
            // The "from" slot: apply initialKeyframes as inline styles during
            // the mounting/initial phases (before the WAAPI animation locks
            // its from-value and we promote to 'ready' — see the lifecycle
            // around the enter rAF). mergeInlineStyles prefers this slot when
            // non-empty, so it wins over the animate slot below in these phases.
            isLoaded === 'mounting' || isLoaded === 'initial' ? initialKeyframes : undefined,
            // The "target" slot. Only AFTER the enter animation completes does
            // the target become the inline baseline, so the element holds it
            // once WAAPI surrenders the property (default fill:'none' would
            // otherwise leave transform:none). It must NOT be applied during
            // the run: flipping the inline value to the target mid-animation
            // shows the target for the one frame the inline changes (a visible
            // snap), since WAAPI's composite doesn't override that exact frame.
            // While the animation runs we keep the original behavior — initial
            // keyframes own the inline (via the slot above), or, with no
            // initial, the animate values seed the inline as the from. Resting
            // values collapse keyframe arrays to their last element
            // (animate={{x:[0,100,50]}} rests at 50). (#377)
            enterAnimationSettled
                ? renderedAnimateBaseline
                : animateControls &&
                    !animationControlsHasReceivedCommand &&
                    isNotEmpty(initialKeyframes)
                  ? initialKeyframes
                  : animateControls && animationControlsHasReceivedCommand
                    ? lastAnimationControlsTarget
                    : isNotEmpty(initialKeyframes)
                      ? !effectiveAnimate
                          ? initialKeyframes
                          : undefined
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
            })()
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
                onVisualUpdate: (transform: string) => {
                    liveGestureTransform = transform || null
                }
            },
            baselineSources: dragRuntimeOptions.baselineSources,
            getBaseTransform: () => splitSerializedTransform(serializedStyleProp).transform,
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
                    whileHover: (resolvedWhilePan ?? {}) as Record<string, unknown>
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
     * Execute the actual animation without wait mode checks.
     */
    const executeAnimation = () => {
        if (!element || !resolvedAnimate) {
            pwLog('[motion] executeAnimation bailing - no element or resolvedAnimate')
            return
        }

        const rawPayload = filterReducedMotionKeyframes(
            $state.snapshot(resolvedAnimate) as Record<string, unknown>,
            reducedMotion
        )
        const { target: rawTarget, transition: transitionAnimate } =
            extractTargetTransition(rawPayload)
        const svgPathFinished =
            isSVGPathElement(element) && hasSVGPathProperties(rawTarget)
                ? animateSVGPathAttributes(element, rawTarget, transitionAnimate)
                : []
        let payload = svgPathFinished.length > 0 ? stripSVGPathKeyframes(rawTarget) : rawTarget

        // Transform SVG path properties (pathLength, pathOffset) to their CSS equivalents
        payload = transformSVGPathProperties(element, payload)

        // Ensure dash properties aren't pinned as inline styles
        if (element && element.style) {
            element.style.removeProperty('stroke-dasharray')
            element.style.removeProperty('stroke-dashoffset')
        }

        pwLog('[motion] executeAnimation animating', {
            payload,
            transitionAnimate
        })

        notifyWillChange(Object.keys(payload))

        // A fresh run owns the transform again until it completes.
        enterAnimationSettled = false
        const completeEnterAnimation = (
            def: DOMKeyframesDefinition | undefined = payload as unknown as DOMKeyframesDefinition
        ) => {
            if (enterAnimationSettled) return
            // Now the target is the resting state — promote it to the
            // inline baseline so it persists after WAAPI surrenders the
            // property (default fill:'none'). (#377)
            applyAnimateRestingStyle()
            enterAnimationSettled = true
            onAnimationCompleteProp?.(def)
        }
        const shouldAnimateThroughTransformTemplate =
            !!transformTemplateProp && splitTemplatedTransformPayload(payload).hasTemplatePayload

        if (isNotEmpty(payload) && shouldAnimateThroughTransformTemplate) {
            // Fire-and-forget: the enter animation drives its own lifecycle
            // callbacks; nothing here awaits its completion.
            void animateTemplatedTransformPayload(
                payload,
                transitionAnimate,
                (def) => onAnimationStartProp?.(def as DOMKeyframesDefinition | undefined),
                (def) => completeEnterAnimation(def as DOMKeyframesDefinition | undefined)
            )
        } else if (isNotEmpty(payload)) {
            cleanupTemplatedTransformAnimations()
            animateWithLifecycle(
                element,
                payload as unknown as DOMKeyframesDefinition,
                transitionAnimate,
                (def) => onAnimationStartProp?.(def as DOMKeyframesDefinition | undefined),
                (def) => completeEnterAnimation(def as DOMKeyframesDefinition | undefined)
            )
        } else if (svgPathFinished.length > 0) {
            onAnimationStartProp?.(rawPayload as unknown as DOMKeyframesDefinition)
            Promise.all(svgPathFinished)
                .then(() => completeEnterAnimation(rawPayload as unknown as DOMKeyframesDefinition))
                .catch(() =>
                    completeEnterAnimation(rawPayload as unknown as DOMKeyframesDefinition)
                )
        }
        if (isJsdomRuntime()) {
            window.setTimeout(
                () => completeEnterAnimation(),
                getTransitionFallbackMs(transitionAnimate)
            )
        }
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
        const previousRect = parent.getBoundingClientRect()
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
                    previousRect: domRectToRectLike(previousRect),
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

    /**
     * Run the enter animation, respecting wait mode if inside AnimatePresence.
     * Returns true if animation was deferred (wait mode with blocked enters).
     */
    const runAnimation = (): boolean => {
        pwLog('[motion] runAnimation called', {
            hasElement: !!element,
            resolvedAnimate,
            mergedTransition,
            mode: context?.mode
        })

        if (!element || !resolvedAnimate) {
            pwLog('[motion] runAnimation bailing - no element or resolvedAnimate')
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

                    // Snap to initial state first (in case inline styles were removed)
                    if (initialKeyframes && element) {
                        const transformedInitial = transformSVGPathProperties(
                            element,
                            initialKeyframes
                        )
                        animate(element, transformedInitial as DOMKeyframesDefinition, {
                            duration: 0
                        })
                    }

                    // Use RAF to ensure DOM is settled, then run animation
                    requestAnimationFrame(() => {
                        executeAnimation()
                        // Now it's safe to mark as ready
                        requestAnimationFrame(() => {
                            // Ensure follow-up effects treat this as the initial enter animation.
                            // Without this, the ready-state effects can fire and re-run enter,
                            // which shows up as a "pop" after the deferred animation completes.
                            pwLog('[motion] wait-unblocked: marking enter handled')
                            initialAnimationTriggered = true
                            if (
                                declarativeAnimateProp &&
                                typeof declarativeAnimateProp !== 'string'
                            ) {
                                objectAnimateRanOnMount = true
                                lastAnimatePropJson = JSON.stringify(declarativeAnimateProp)
                            }
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
        executeAnimation()
        return false
    }

    // Track the last variant key we ran to avoid re-running on mount
    let lastRanVariantKey = $state<string | undefined>(undefined)
    // Companion to `lastRanVariantKey`: the JSON-serialized resolved
    // keyframes for that variant. Lets us detect when a function-form
    // variant produces new keyframes (because `custom` changed) while
    // the variant key stayed the same — otherwise the animate effect
    // would short-circuit and the element would never re-animate.
    let lastRanResolvedJson = $state<string | undefined>(undefined)
    let mountedWithInitialFalse = $state(false)
    // Track if the initial->animate transition has already been triggered by main effect
    let initialAnimationTriggered = $state(false)
    // Track if we've run the animation for object animateProp on this mount
    let objectAnimateRanOnMount = $state(false)
    // Track the serialized animateProp to detect changes for object animate props
    let lastAnimatePropJson = $state<string | undefined>(undefined)
    let motionDomProjectionUpdatePending = false
    const currentAnimateKey = $derived(
        typeof declarativeAnimateProp === 'string'
            ? declarativeAnimateProp
            : typeof effectiveAnimate === 'string'
              ? effectiveAnimate
              : undefined
    )

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

    $effect(() => {
        if (!motionDomProjection) return
        if (!element) return
        motionDomProjection.updateOptions({
            layout: layoutProp,
            layoutId: scopedLayoutId,
            layoutScroll: layoutScrollProp,
            transition: mergedTransition as never,
            style: styleProp
        })
        motionDomProjection.mount(element)
        return () => {
            motionDomProjection.unmount()
        }
    })

    let explicitLayoutSnapshot: RectLike | null = null
    let lastRect: RectLike | null = null
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

        explicitLayoutSnapshot = measureLayoutRect()
        projection.willUpdate()
        motionDomProjection?.willUpdate()
        motionDomProjectionUpdatePending = true
    })

    $effect(() => {
        const shouldProject = element && layoutProp && isLoaded === 'ready' && hasLayoutFeatures
        trackLayoutProjectionDependencies()

        if (!shouldProject || !motionDomProjectionUpdatePending) return
        motionDomProjectionUpdatePending = false
        const previous = explicitLayoutSnapshot
        explicitLayoutSnapshot = null
        if (previous) {
            const next = measureLayoutRect()
            if (next) {
                if (motionDomProjection) {
                    lastRect = next
                } else {
                    const flipLayoutMode = layoutProp === 'position' ? 'position' : true
                    const transforms = computeFlipTransforms(previous, next, flipLayoutMode)
                    runFlipAnimation(element!, transforms, mergedTransition ?? {})
                    lastRect = next
                }
            }
        }
        projection.didUpdate()
        motionDomProjection?.didUpdate()
    })

    // Projection node lifecycle + the `onProjectionUpdate` listener.
    // Mount once the element binds; seed the baseline layout; unmount on
    // cleanup. Depends ONLY on `element` — the `onProjectionUpdate`
    // subscription lives in its own effect below so a change to the
    // callback's identity re-subscribes WITHOUT tearing the node down
    // (an unmount would clear latestLayout/children and re-seed the
    // first commit instead of emitting a real delta).
    $effect(() => {
        if (!element) return
        projection.mount(element)
        projection.measure() // seed latestLayout so the first commit can diff
        return () => {
            projection.unmount()
        }
    })

    // Subscribe the consumer's `onProjectionUpdate` callback. Separate
    // from the mount effect so re-subscribing on a callback-identity
    // change never unmounts the node.
    $effect(() => {
        if (!(element && onProjectionUpdateProp)) return
        const off = projection.addEventListener('didUpdate', (data) => onProjectionUpdateProp(data))
        return () => {
            off()
        }
    })

    // Subscribe the consumer's `onLayoutMeasure` callback to projection
    // `measure` events. The mount effect above runs first in source
    // order and already seeded `latestLayout`, so that seed measurement
    // is replayed here — otherwise a subscriber would only hear about
    // the element's slot after its first layout CHANGE, and consumers
    // like `Reorder.Item` need the initial slot too.
    $effect(() => {
        if (!(element && onLayoutMeasureProp)) return
        const off = projection.addEventListener('measure', (box) => onLayoutMeasureProp(box))
        const seed = projection.latestLayout
        if (seed) {
            onLayoutMeasureProp({
                x: { min: seed.x.min, max: seed.x.max },
                y: { min: seed.y.min, max: seed.y.max }
            })
        }
        return () => {
            off()
        }
    })

    // Upstream layout projection via motion-dom. Svelte runes mode doesn't
    // expose the React-style pre/post render hook pair used upstream, so the
    // component snapshots committed layout changes through DOM observers while
    // keeping the existing local ProjectionNode event fan-out alive.
    $effect(() => {
        if (!(element && layoutProp && isLoaded === 'ready' && hasLayoutFeatures)) return

        let rafId: number | null = null
        let wasViewportOffscreenSinceLastLayout = false
        let wasViewportScrolledSinceLastLayout = false
        const flipLayoutMode = layoutProp === 'position' ? 'position' : true
        motionDomProjection?.seedLayout()
        lastRect = measureLayoutRect()
        setCompositorHints(element!, true)

        const rememberOffscreenScroll = () => {
            wasViewportScrolledSinceLastLayout = true
            if (motionDomProjection?.isAnimating()) {
                motionDomProjection.finishAnimation()
            }
            if (isViewportOffscreen(element!.getBoundingClientRect())) {
                wasViewportOffscreenSinceLastLayout = true
                motionDomProjection?.finishAnimation()
            }
        }

        const commitObservedLayout = () => {
            if (element!.hasAttribute('data-layout-size-animation')) {
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

            // An actively dragged element must NOT take the viewport-scroll
            // early-out: its slot change still needs the `adjustOrigin`
            // compensation below (measurements are page-coordinate, so the
            // delta is scroll-clean). Skipping it leaves the gesture's
            // transform uncompensated, which re-triggers Reorder's
            // checkReorder and double-fires the swap after any scroll.
            const isDragActiveElement =
                element!.dataset.svelteMotionDragActive === 'true' && !!teardownDrag

            if (
                !isDragActiveElement &&
                (wasViewportScrolledSinceLastLayout ||
                    wasViewportOffscreenSinceLastLayout ||
                    isViewportOffscreen(element!.getBoundingClientRect()))
            ) {
                lastRect = measureLayoutRect()
                motionDomProjection?.finishAnimation()
                wasViewportScrolledSinceLastLayout = false
                wasViewportOffscreenSinceLastLayout = false
                return
            }

            const nextBox = projection.commitLayoutChange()
            if (nextBox && lastRect) {
                const next = boxToRectLike(nextBox)
                const previous = lastRect
                const shouldCommitMotionDomLayout = hasRectChanged(lastRect, next)
                if (shouldCommitMotionDomLayout) {
                    // A live drag whose layout slot just moved (e.g. Reorder
                    // swapped the dragged item's DOM position): a FLIP here
                    // would fight the gesture, so instead shift the drag
                    // origin by the slot delta — the element stays pinned
                    // under the cursor and `dragSnapToOrigin` settles into
                    // the NEW slot on release. `seedLayout` re-syncs the
                    // motion-dom projection cache so the skipped commit
                    // can't replay as a stale delta later.
                    if (isDragActiveElement && teardownDrag) {
                        teardownDrag.adjustOrigin(
                            previous.left - next.left,
                            previous.top - next.top
                        )
                        motionDomProjection?.seedLayout()
                        lastRect = next
                        wasViewportScrolledSinceLastLayout = false
                        wasViewportOffscreenSinceLastLayout = false
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
                lastRect = next
                wasViewportScrolledSinceLastLayout = false
                wasViewportOffscreenSinceLastLayout = false
            } else if (nextBox) {
                lastRect = boxToRectLike(nextBox)
                wasViewportScrolledSinceLastLayout = false
                wasViewportOffscreenSinceLastLayout = false
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
            const shouldSkipLayoutAnimation =
                detail?.viewportScrolledDuringHold ||
                wasViewportScrolledSinceLastLayout ||
                wasViewportOffscreenSinceLastLayout ||
                isViewportOffscreen(viewportRect)
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
            wasViewportScrolledSinceLastLayout = false
            wasViewportOffscreenSinceLastLayout = false
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

        const disconnectObservers = observeLayoutChanges(element!, () => scheduleProjectionCommit())
        window.addEventListener('scroll', rememberOffscreenScroll, { passive: true })
        element!.addEventListener(presenceLayoutReleaseEvent, commitPresenceLayoutRelease)

        return () => {
            disconnectObservers()
            window.removeEventListener('scroll', rememberOffscreenScroll)
            element?.removeEventListener(presenceLayoutReleaseEvent, commitPresenceLayoutRelease)
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
                tapTransition: mergedTransition ?? {}
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
            }
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

        const subscriber: AnimationControlsSubscriber = {
            start: startAnimationControlsDefinition,
            set: applyAnimationControlsTarget,
            stop: stopAnimationControlsAnimations
        }

        return animateControls.subscribe(subscriber)
    })

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
                // 1. Run exit animation if defined
                if (resolvedExit && element && !keyTransitionStopped) {
                    const exitPayload = filterReducedMotionKeyframes(
                        { ...(resolvedExit as Record<string, unknown>) },
                        reducedMotion
                    )
                    const { target: exitKeyframes, transition: exitTransition } =
                        extractTargetTransition(exitPayload)

                    pwLog('[motion] key transition: running exit', { exitKeyframes })
                    await animate(element, exitKeyframes as DOMKeyframesDefinition, exitTransition)
                        .finished
                }

                pwLog('[motion] key transition: exit done', {
                    keyTransitionStopped,
                    hasElement: !!element
                })

                // Check if component was unmounted during exit animation
                if (keyTransitionStopped || !element) return

                // 2. Snap to initial state
                if (initialKeyframes && element) {
                    const transformedInitial = transformSVGPathProperties(element, initialKeyframes)
                    pwLog('[motion] key transition: snapping to initial', { transformedInitial })
                    animate(element, transformedInitial as DOMKeyframesDefinition, { duration: 0 })
                }

                // Check again before running enter animation
                if (keyTransitionStopped || !element) return

                // 3. Run enter animation
                pwLog('[motion] key transition: running enter animation')
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

    // Re-run animate when animateProp changes while ready
    $effect(() => {
        if (!(element && isLoaded === 'ready')) return
        if (animateControls) return
        // Skip first run if we mounted with initial={false} AND the variant hasn't changed
        if (mountedWithInitialFalse) {
            // Only skip if the variant is the same as what we mounted with
            if (
                typeof declarativeAnimateProp === 'string' &&
                lastRanVariantKey === declarativeAnimateProp
            ) {
                mountedWithInitialFalse = false
                return
            }
            // Variant has changed, so we should animate
            mountedWithInitialFalse = false
        }
        // Skip if the initial animation was already triggered by the main effect
        if (initialAnimationTriggered) {
            pwLog('[motion] effect: skipping, initial animation already triggered')
            initialAnimationTriggered = false
            // Also mark object animate as ran to prevent duplicate runs from effect re-triggers
            if (declarativeAnimateProp && typeof declarativeAnimateProp !== 'string') {
                objectAnimateRanOnMount = true
            }
            return
        }
        if (typeof declarativeAnimateProp === 'string') {
            // Compare BOTH the variant key and the resolved keyframes JSON.
            // For static variants the JSON is constant per key; for
            // function-form variants the JSON changes when `custom`
            // changes, which we must treat as a new animation target.
            const resolvedJson = resolvedAnimate ? JSON.stringify(resolvedAnimate) : undefined
            if (
                lastRanVariantKey !== declarativeAnimateProp ||
                lastRanResolvedJson !== resolvedJson
            ) {
                lastRanVariantKey = declarativeAnimateProp
                lastRanResolvedJson = resolvedJson
                runAnimation()
            }
        } else if (declarativeAnimateProp) {
            // Object animate props - detect if the prop actually changed
            const currentJson = JSON.stringify(declarativeAnimateProp)
            const propChanged = lastAnimatePropJson !== currentJson

            // Reset flag if animate prop changed
            if (propChanged) {
                objectAnimateRanOnMount = false
                lastAnimatePropJson = currentJson
            }

            // Only run if we haven't already animated on this mount (or prop changed)
            // This prevents duplicate animations when Svelte re-triggers the effect
            if (!objectAnimateRanOnMount) {
                objectAnimateRanOnMount = true
                lastRanVariantKey = undefined
                runAnimation()
            }
        }
    })

    // Also run when inherited/effective variant changes
    $effect(() => {
        void resolvedAnimate
        if (!(element && isLoaded === 'ready' && !declarativeAnimateProp && resolvedAnimate)) return
        // Skip first run if we mounted with initial={false} AND the variant hasn't changed
        if (mountedWithInitialFalse) {
            // Only skip if the variant is the same as what we mounted with
            if (typeof currentAnimateKey === 'string' && lastRanVariantKey === currentAnimateKey) {
                mountedWithInitialFalse = false
                return
            }
            // Variant has changed, so we should animate
            mountedWithInitialFalse = false
        }
        if (typeof currentAnimateKey === 'string') {
            const resolvedJson = resolvedAnimate ? JSON.stringify(resolvedAnimate) : undefined
            if (lastRanVariantKey !== currentAnimateKey || lastRanResolvedJson !== resolvedJson) {
                lastRanVariantKey = currentAnimateKey
                lastRanResolvedJson = resolvedJson
                runAnimation()
            }
        } else {
            runAnimation()
        }
    })

    $effect(() => {
        if (!(element && isLoaded === 'mounting')) return
        markMotionMounted()

        pwLog('[motion] main effect running', {
            effectiveAnimate: !!effectiveAnimate,
            effectiveInitialProp,
            resolvedAnimate,
            initialKeyframes,
            hasInitialKeyframes: isNotEmpty(initialKeyframes)
        })

        if (effectiveAnimate) {
            // If initial={false}, render at animate state immediately with no transition
            if (effectiveInitialProp === false && resolvedAnimate) {
                pwLog('[motion] path: initial=false, skip to animate')
                // Use Motion's animate() with duration:0 so it takes control of these properties
                // This prevents inline styles from pinning the properties during future animations
                let snapshot = $state.snapshot(resolvedAnimate) as Record<string, unknown>
                snapshot = transformSVGPathProperties(element!, snapshot)
                animate(element!, snapshot as DOMKeyframesDefinition, { duration: 0 })
                // Mark that we've already applied this variant to avoid a second animate pass
                mountedWithInitialFalse = true
                if (typeof currentAnimateKey === 'string') {
                    lastRanVariantKey = currentAnimateKey
                    lastRanResolvedJson = resolvedAnimate
                        ? JSON.stringify(resolvedAnimate)
                        : undefined
                }
                dataPath = 5
                isLoaded = 'ready'
            } else if (isNotEmpty(initialKeyframes)) {
                const canHandoffOptimizedAppear = hasOptimizedAppearAnimation(optimizedAppearId)
                if (canHandoffOptimizedAppear) {
                    pwLog('[motion] path: optimized appear handoff')
                    dataPath = 6
                    isLoaded = 'initial'
                    initialAnimationTriggered = true
                    if (declarativeAnimateProp && typeof declarativeAnimateProp !== 'string') {
                        objectAnimateRanOnMount = true
                        lastAnimatePropJson = JSON.stringify(declarativeAnimateProp)
                    }
                    finishOptimizedAppearAnimation(optimizedAppearId)
                        .then(() => {
                            applyAnimateRestingStyle()
                            enterAnimationSettled = true
                            isLoaded = 'ready'
                            onAnimationCompleteProp?.(resolvedAnimate)
                        })
                        .catch(() => {
                            isLoaded = 'ready'
                        })
                    return
                }
                pwLog('[motion] path: has initialKeyframes, will animate to target')
                // Apply initial instantly BEFORE exposing 'initial' state
                const transformedInitial = transformSVGPathProperties(element!, initialKeyframes)

                // For SVG paths, apply initial state truly synchronously to prevent flash
                const hasSVGProps =
                    'strokeDasharray' in transformedInitial ||
                    'strokeDashoffset' in transformedInitial
                if (hasSVGProps) {
                    // Apply presentation attributes to avoid pinning CSS properties
                    Object.entries(transformedInitial).forEach(([key, value]) => {
                        const v = String(Array.isArray(value) ? value[0] : value)
                        if (key === 'strokeDasharray' || key === 'stroke-dasharray') {
                            element!.setAttribute('stroke-dasharray', v)
                        }
                        if (key === 'strokeDashoffset' || key === 'stroke-dashoffset') {
                            element!.setAttribute('stroke-dashoffset', v)
                        }
                    })
                    // no-op
                }
                // Avoid pinning: strip stroke dash props from the animate(0) payload
                const initialForAnimate = { ...transformedInitial }
                delete (initialForAnimate as Record<string, unknown>).strokeDasharray
                delete (initialForAnimate as Record<string, unknown>)['stroke-dasharray']
                delete (initialForAnimate as Record<string, unknown>).strokeDashoffset
                delete (initialForAnimate as Record<string, unknown>)['stroke-dashoffset']

                animate(element!, initialForAnimate as DOMKeyframesDefinition, { duration: 0 })
                // no-op

                // Mark initial after styles are applied so tests read CSS=0 while state=initial
                // This also removes visibility:hidden that was hiding SVG paths during mount
                isLoaded = 'initial'
                dataPath = 1

                // Then promote to ready and run the enter animation
                // rAF expects a void return; an async callback hands it a Promise that
                // nothing can await. Name the work and mark it fire-and-forget.
                const runEnterAnimation = async () => {
                    if (isPlaywright) {
                        await sleep(10)
                    }
                    pwLog('[motion] RAF: promoting to ready and running animation')

                    // Mark that we're triggering the initial animation to prevent duplicate runs
                    initialAnimationTriggered = true
                    if (declarativeAnimateProp && typeof declarativeAnimateProp !== 'string') {
                        lastAnimatePropJson = JSON.stringify(declarativeAnimateProp)
                    }

                    // IMPORTANT: Start the animation BEFORE changing isLoaded.
                    // When isLoaded changes to 'ready', Svelte will reactively remove the
                    // initial inline styles. We need the animation to capture the current
                    // state (from inline styles) before they're removed.
                    const wasDeferred = runAnimation()

                    // CRITICAL: Wait for the next animation frame before changing isLoaded.
                    // This gives WAAPI time to:
                    // 1. Parse and create the animation
                    // 2. Start the animation layer
                    // 3. Lock in the "from" values from current computed style
                    // Only THEN can we safely clear inline styles without killing the animation
                    // BUT: If animation was deferred (wait mode), don't change isLoaded yet -
                    // the callback will handle it when the animation actually runs.
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
                // If we're inheriting a variant and parent had initial={false}, apply the variant instantly
                // without animation, then mark it as applied
                if (
                    parentInitialFalse &&
                    typeof currentAnimateKey === 'string' &&
                    resolvedAnimate
                ) {
                    // Apply variant styles instantly with duration:0
                    let snapshot = $state.snapshot(resolvedAnimate) as Record<string, unknown>
                    snapshot = transformSVGPathProperties(element!, snapshot)
                    animate(element!, snapshot as DOMKeyframesDefinition, { duration: 0 })
                    lastRanVariantKey = currentAnimateKey
                    lastRanResolvedJson = resolvedAnimate
                        ? JSON.stringify(resolvedAnimate)
                        : undefined
                } else {
                    runAnimation()
                }
            }
        } else if (isNotEmpty(initialKeyframes)) {
            // Apply initial instantly BEFORE exposing 'initial' state
            const transformedInitial = transformSVGPathProperties(element!, initialKeyframes)
            element!.setAttribute(
                'style',
                mergeInlineStyles(
                    element!.getAttribute('style') ?? '',
                    transformedInitial,
                    undefined,
                    transformTemplateProp
                )
            )
            dataPath = 3
            isLoaded = 'initial'
            // rAF expects a void return; an async callback hands it a Promise that
            // nothing can await. Name the work and mark it fire-and-forget.
            const promoteToReady = async () => {
                if (isPlaywright) {
                    await sleep(10)
                }
                isLoaded = 'ready'
            }
            requestAnimationFrame(() => void promoteToReady())
        } else {
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
