<script lang="ts" module>
    // Module-level counter for deterministic key generation (avoids SSR hydration mismatch)
    let keyCounter = 0
</script>

<script lang="ts">
    import { getMotionConfig } from '$lib/components/motionConfig.context'
    import {
        filterReducedMotionKeyframes,
        useReducedMotionConfig
    } from '$lib/utils/reducedMotionConfig.svelte'
    import type {
        MotionProps,
        MotionTransition,
        DragAxis,
        DragConstraints,
        DragControls,
        DragTransition,
        MotionWhileDrag,
        DragInfo
    } from '$lib/types'
    import { isNotEmpty } from '$lib/utils/objects'
    import { sleep } from '$lib/utils/testing'
    import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
    import { isPlaywrightEnv, pwLog } from '$lib/utils/log'
    import { onDestroy, type Snippet } from 'svelte'
    import { VOID_TAGS } from '$lib/utils/constants'
    import { mergeTransitions, animateWithLifecycle } from '$lib/utils/animation'
    import { attachWhileTap } from '$lib/utils/interaction'
    import { attachWhileHover } from '$lib/utils/hover'
    import { attachWhileFocus } from '$lib/utils/focus'
    import { attachWhileInView } from '$lib/utils/inView.svelte'
    import {
        measureRect,
        computeFlipTransforms,
        runFlipAnimation,
        setCompositorHints,
        observeLayoutChanges
    } from '$lib/utils/layout'
    import type { SvelteHTMLElements } from 'svelte/elements'
    import { mergeInlineStyles } from '$lib/utils/style'
    import { isNativelyFocusable } from '$lib/utils/a11y'
    import {
        getAnimatePresenceContext,
        getPresenceChildContext,
        getPresenceDepth,
        setPresenceDepth
    } from '$lib/utils/presence'
    import { getInitialKeyframes } from '$lib/utils/initial'
    import { attachDrag } from '$lib/utils/drag'
    import { attachPan } from '$lib/utils/pan'
    import { resolveInitial, resolveAnimate, resolveExit, resolveWhile } from '$lib/utils/variants'
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
        isSVGTag,
        SVG_NAMESPACE
    } from '$lib/utils/svg'
    import { getLayoutIdRegistry } from '$lib/utils/layoutId'
    import {
        getLayoutScrollContainerRef,
        setLayoutScrollContainer
    } from '$lib/components/layoutScroll.context'
    import { getLayoutGroupContext, scopeLayoutId } from '$lib/components/layoutGroup.context'

    type Props = MotionProps & {
        children?: Snippet
        tag: keyof SvelteHTMLElements
        [key: string]: unknown
    }

    let {
        children,
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
        ref: element = $bindable(null),
        ...rest
    }: Props = $props()
    let isLoaded = $state<'mounting' | 'initial' | 'ready' | 'animated'>('mounting')
    let dataPath = $state<number>(-1)
    const motionConfig = $derived(getMotionConfig())
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
        mergeTransitions(
            (motionConfig?.transition ?? {}) as AnimationOptions,
            (transitionProp ?? {}) as AnimationOptions
        )
    )

    // Register onDestroy at component level (guaranteed to work in Svelte 5)
    // — getContext()/onDestroy() must run during component initialization.
    if (context && !inPresenceChild) {
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
        if (!(element && context) || inPresenceChild) return
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
                layoutIdRegistry.snapshot(
                    scopedLayoutId,
                    layoutIdLastRect,
                    (mergedTransition ?? {}) as AnimationOptions
                )
            }
        }
    })

    // Reactively update registration when element/exit/transition props change
    $effect(() => {
        if (element && context && !inPresenceChild && resolvedExit) {
            const filteredExit = filterReducedMotionKeyframes(
                resolvedExit as Record<string, unknown>,
                reducedMotion
            )
            context.registerChild(
                presenceKey,
                element,
                filteredExit,
                mergedTransition as unknown as MotionTransition
            )
        }
    })

    // Update presence context with current state when element is ready and has size.
    // Skipped inside <PresenceChild> — the rect/style snapshot only feeds the clone path.
    $effect(() => {
        if (!(context && element && isLoaded === 'ready') || inPresenceChild) return

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

    // Variant inheritance and resolution
    const parentVariantStore = getVariantContext()

    // Get initial inherited variant synchronously
    let initialInheritedVariant: string | undefined = undefined
    if (parentVariantStore) {
        parentVariantStore.subscribe((v) => (initialInheritedVariant = v))()
    }

    // Create store with initial value so children can inherit immediately
    const initialVariantValue =
        typeof animateProp === 'string'
            ? animateProp
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
        animateProp ?? (variantsProp ? (inheritedVariant ?? initialInheritedVariant) : undefined)
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
        if (typeof animateProp === 'string') return localVariantStore.set(animateProp)
        if (typeof effectiveAnimate === 'string') return localVariantStore.set(effectiveAnimate)
        localVariantStore.set(undefined)
    })

    const resolvedInitial = $derived(
        resolveInitial(effectiveInitialProp, variantsProp, effectiveCustom)
    )
    const resolvedAnimate = $derived(
        resolveAnimate(effectiveAnimate, variantsProp, effectiveCustom)
    )
    const resolvedExit = $derived(resolveExit(exitProp, variantsProp, effectiveCustom))

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

    // Derived attributes to keep both branches in sync (focusability, data flags, style, class)
    const derivedAttrs = $derived<Record<string, unknown>>({
        ...(rest as Record<string, unknown>),
        // Gate on the *resolved* whileTap, not the raw prop. With
        // variant-label support a truthy-but-unresolved value (unknown
        // key, empty array) would otherwise add `tabindex=0` for an
        // element that never actually receives a tap gesture — an
        // unintended tab stop. (#349 CR feedback)
        ...(isNotEmpty(resolvedWhileTap) &&
        !isNativelyFocusable(tag, rest as Record<string, unknown>) &&
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
        // Apply normalized SVG path attributes synchronously on first render to avoid flash
        // Compute via svg utils (no dynamic import in SSR/derived expressions)
        ...(() => {
            if (!initialKeyframes) return {}
            const attrs = computeNormalizedSVGInitialAttrs(
                initialKeyframes as Record<string, unknown>
            )
            if (attrs) {
                return attrs
            }
            return {}
        })(),
        style: mergeInlineStyles(
            initialKeyframes && 'pathLength' in initialKeyframes && isLoaded === 'mounting'
                ? `${styleProp || ''};visibility:hidden`
                : styleProp,
            // Apply initialKeyframes as inline styles during mounting and initial phases
            // The animation starts in RAF after 'initial' phase, so we need styles until then
            // When ready AND we have initialKeyframes: DON'T set any animated properties!
            // WAAPI is controlling them and inline styles can override the animation
            isLoaded === 'mounting' || isLoaded === 'initial'
                ? (initialKeyframes as unknown as Record<string, unknown>)
                : undefined,
            // Only use resolvedAnimate as fallback when we DON'T have initialKeyframes
            // If we have initialKeyframes, the enter animation is running - setting
            // inline styles to the target values will override the WAAPI animation
            // Use isNotEmpty to handle empty initial objects (initial: {}) which should fallback
            isNotEmpty(initialKeyframes)
                ? undefined
                : (resolvedAnimate as unknown as Record<string, unknown>)
        ),
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
    let teardownDrag: (() => void) | null = null
    $effect(() => {
        if (!(element && isLoaded === 'ready')) return
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

        const controls = dragControlsProp as DragControls | undefined
        const opts = {
            axis,
            constraints: dragConstraintsProp as DragConstraints | undefined,
            elastic: dragElasticProp as number | undefined,
            momentum: dragMomentumProp as boolean | undefined,
            transition: dragTransitionProp as DragTransition | undefined,
            directionLock: !!dragDirectionLockProp,
            listener: dragListenerProp !== false,
            controls,
            whileDrag: resolvedWhileDrag as MotionWhileDrag,
            mergedTransition: (mergedTransition ?? {}) as AnimationOptions,
            callbacks: {
                onStart: onDragStartProp as (e: PointerEvent, info: DragInfo) => void,
                onMove: onDragProp as (e: PointerEvent, info: DragInfo) => void,
                onEnd: onDragEndProp as (e: PointerEvent, info: DragInfo) => void,
                onDirectionLock: onDirectionLockProp as (axis: 'x' | 'y') => void,
                onTransitionEnd: onDragTransitionEndProp as () => void
            },
            baselineSources: {
                initial: (initialKeyframes ?? {}) as Record<string, unknown>,
                animate: (resolvedAnimate ?? {}) as Record<string, unknown>
            },
            propagation: !!dragPropagationProp,
            snapToOrigin: !!dragSnapToOriginProp
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
     */
    let teardownPan: (() => void) | null = null
    let activeWhilePanKeyframes: Record<string, unknown> | null = null
    $effect(() => {
        if (isPlaywright) {
            pwLog('[motion] pan attach effect run', {
                hasOnPan: !!onPanProp,
                hasWhilePan: !!resolvedWhilePan,
                isLoaded
            })
        }
        if (!element) return
        teardownPan?.()
        teardownPan = null

        const hasAnyHandler =
            !!onPanProp ||
            !!onPanStartProp ||
            !!onPanEndProp ||
            !!onPanSessionStartProp ||
            !!resolvedWhilePan
        if (!hasAnyHandler) return

        const applyWhilePan = (keyframes: Record<string, unknown> | null) => {
            if (!element || !keyframes) return
            activeWhilePanKeyframes = keyframes
            animateWithLifecycle(
                element,
                keyframes as unknown as DOMKeyframesDefinition,
                (mergedTransition ?? {}) as unknown as AnimationOptions
            )
        }
        const revertWhilePan = () => {
            if (!element || !activeWhilePanKeyframes) return
            const reverted = Object.fromEntries(
                Object.keys(activeWhilePanKeyframes).map((k) => [
                    k,
                    (resolvedAnimate as Record<string, unknown> | undefined)?.[k] ?? null
                ])
            )
            activeWhilePanKeyframes = null
            animateWithLifecycle(
                element,
                reverted as unknown as DOMKeyframesDefinition,
                (mergedTransition ?? {}) as unknown as AnimationOptions
            )
        }

        teardownPan = attachPan(element, {
            onSessionStart: onPanSessionStartProp,
            onStart: (event, info) => {
                if (resolvedWhilePan) {
                    applyWhilePan(resolvedWhilePan as Record<string, unknown>)
                }
                onPanStartProp?.(event, info)
            },
            onMove: onPanProp,
            onEnd: (event, info) => {
                if (activeWhilePanKeyframes) revertWhilePan()
                onPanEndProp?.(event, info)
            }
        })

        return () => {
            teardownPan?.()
            teardownPan = null
            activeWhilePanKeyframes = null
        }
    })

    /**
     * Execute the actual animation without wait mode checks.
     */
    const executeAnimation = () => {
        if (!element || !resolvedAnimate) {
            pwLog('[motion] executeAnimation bailing - no element or resolvedAnimate')
            return
        }

        const transitionAnimate: MotionTransition = mergedTransition ?? {}
        let payload = $state.snapshot(resolvedAnimate)

        // Transform SVG path properties (pathLength, pathOffset) to their CSS equivalents
        payload = transformSVGPathProperties(
            element,
            payload as Record<string, unknown>
        ) as typeof payload

        // Strip transform keys when reduced-motion is active so the element
        // stays in place while opacity / color etc. still animate.
        payload = filterReducedMotionKeyframes(
            payload as Record<string, unknown>,
            reducedMotion
        ) as typeof payload

        // Ensure dash properties aren't pinned as inline styles
        if (element && (element as HTMLElement).style) {
            ;(element as HTMLElement).style.removeProperty('stroke-dasharray')
            ;(element as HTMLElement).style.removeProperty('stroke-dashoffset')
        }

        pwLog('[motion] executeAnimation animating', {
            payload,
            transitionAnimate
        })

        animateWithLifecycle(
            element,
            payload as unknown as DOMKeyframesDefinition,
            transitionAnimate as unknown as AnimationOptions,
            (def) => onAnimationStartProp?.(def as unknown as DOMKeyframesDefinition | undefined),
            (def) => onAnimationCompleteProp?.(def as unknown as DOMKeyframesDefinition | undefined)
        )
    }

    // Track if we've already registered a wait callback to prevent duplicates
    let waitCallbackRegistered = $state(false)
    let waitUnsubscribe: (() => void) | null = null

    // Cleanup wait callback on component unmount to prevent memory leaks
    $effect(() => {
        return () => {
            waitUnsubscribe?.()
            waitUnsubscribe = null
        }
    })

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

            const blocked = context.isEnterBlocked?.()
            pwLog('[motion] runAnimation: wait mode', { blocked })

            if (blocked) {
                pwLog('[motion] runAnimation: enters blocked, deferring')

                waitCallbackRegistered = true

                // Register callback to run animation when unblocked
                waitUnsubscribe = context.onEnterUnblocked(() => {
                    pwLog('[motion] runAnimation: enters unblocked, running')
                    waitUnsubscribe?.()
                    waitUnsubscribe = null
                    waitCallbackRegistered = false

                    // Snap to initial state first (in case inline styles were removed)
                    if (initialKeyframes && element) {
                        const transformedInitial = transformSVGPathProperties(
                            element,
                            initialKeyframes as Record<string, unknown>
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
                            if (animateProp && typeof animateProp !== 'string') {
                                objectAnimateRanOnMount = true
                                lastAnimatePropJson = JSON.stringify(animateProp)
                            }
                            isLoaded = 'ready'
                        })
                    })
                })
                return true // Animation was deferred
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
    const currentAnimateKey = $derived(
        typeof animateProp === 'string'
            ? animateProp
            : typeof effectiveAnimate === 'string'
              ? effectiveAnimate
              : undefined
    )

    // Minimal layout animation using FLIP when `layout` is enabled.
    // When layout === 'position' we only translate.
    // When layout === true we also scale to smoothly interpolate size changes.
    let lastRect: DOMRect | null = null
    $effect(() => {
        if (!(element && layoutProp && isLoaded === 'ready')) return

        // Initialize last rect on first ready frame
        lastRect = measureRect(element!, resolveLayoutScrollAncestors())
        // Hint compositor for smoother FLIP transforms
        setCompositorHints(element!, true)

        let rafId: number | null = null
        const runFlip = () => {
            const scrollContainers = resolveLayoutScrollAncestors()
            if (!lastRect) {
                lastRect = measureRect(element!, scrollContainers)
                return
            }
            const next = measureRect(element!, scrollContainers)
            const transforms = computeFlipTransforms(lastRect, next, layoutProp ?? false)
            runFlipAnimation(element!, transforms, (mergedTransition ?? {}) as AnimationOptions)
            lastRect = next
        }

        const scheduleFlip = () => {
            if (rafId) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => {
                rafId = null
                runFlip()
            })
        }
        const disconnectObservers = observeLayoutChanges(element!, () => scheduleFlip())

        return () => {
            disconnectObservers()
            lastRect = null
            // Reset compositor hints on teardown
            if (element) {
                setCompositorHints(element, false)
            }
            if (rafId) cancelAnimationFrame(rafId)
        }
    })

    // Shared layout animation via layoutId.
    // On mount, consume the previous snapshot and FLIP from its position.
    $effect(() => {
        if (!(element && scopedLayoutId && layoutIdRegistry && isLoaded === 'ready')) return

        const prev = layoutIdRegistry.consume(scopedLayoutId)
        if (!prev) return // First appearance, no animation needed

        const next = measureRect(element, resolveLayoutScrollAncestors())
        const transforms = computeFlipTransforms(prev.rect, next, true)

        setCompositorHints(element, true)
        runFlipAnimation(
            element,
            transforms,
            (prev.transition ?? mergedTransition ?? {}) as AnimationOptions
        )
    })

    // whileTap handling via motion-dom's press()
    $effect(() => {
        if (!(element && isLoaded === 'ready' && isNotEmpty(resolvedWhileTap))) return
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
                hoverFallbackTransition: (mergedTransition ?? {}) as AnimationOptions
            }
        )
    })

    // whileHover handling, gated to true-hover devices to avoid sticky states on touch
    $effect(() => {
        if (!(element && isLoaded === 'ready' && isNotEmpty(resolvedWhileHover))) return
        return attachWhileHover(
            element!,
            (resolvedWhileHover ?? {}) as Record<string, unknown>,
            (mergedTransition ?? {}) as AnimationOptions,
            { onStart: onHoverStartProp, onEnd: onHoverEndProp },
            {
                initial: (resolvedInitial ?? {}) as Record<string, unknown>,
                animate: (resolvedAnimate ?? {}) as Record<string, unknown>
            }
        )
    })

    // whileFocus handling for keyboard focus interactions
    $effect(() => {
        if (!(element && isLoaded === 'ready' && isNotEmpty(resolvedWhileFocus))) return
        return attachWhileFocus(
            element!,
            (resolvedWhileFocus ?? {}) as Record<string, unknown>,
            (mergedTransition ?? {}) as AnimationOptions,
            { onStart: onFocusStartProp, onEnd: onFocusEndProp },
            {
                initial: (resolvedInitial ?? {}) as Record<string, unknown>,
                animate: (resolvedAnimate ?? {}) as Record<string, unknown>
            }
        )
    })

    // whileInView handling for viewport intersection
    $effect(() => {
        if (!(element && isLoaded === 'ready' && isNotEmpty(resolvedWhileInView))) return
        return attachWhileInView(
            element!,
            (resolvedWhileInView ?? {}) as Record<string, unknown>,
            (mergedTransition ?? {}) as AnimationOptions,
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
            !context ||
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
                    const exitKeyframes = filterReducedMotionKeyframes(
                        { ...(resolvedExit as Record<string, unknown>) },
                        reducedMotion
                    )
                    // Remove transition from keyframes (it's passed separately)
                    delete exitKeyframes.transition

                    pwLog('[motion] key transition: running exit', { exitKeyframes })
                    await animate(
                        element,
                        exitKeyframes as DOMKeyframesDefinition,
                        mergedTransition
                    ).finished
                }

                pwLog('[motion] key transition: exit done', {
                    keyTransitionStopped,
                    hasElement: !!element
                })

                // Check if component was unmounted during exit animation
                if (keyTransitionStopped || !element) return

                // 2. Snap to initial state
                if (initialKeyframes && element) {
                    const transformedInitial = transformSVGPathProperties(
                        element,
                        initialKeyframes as Record<string, unknown>
                    )
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

        runKeyTransition()

        // Cleanup on unmount
        return () => {
            pwLog('[motion] key effect: cleanup, stopping transition')
            keyTransitionStopped = true
        }
    })

    // Re-run animate when animateProp changes while ready
    $effect(() => {
        if (!(element && isLoaded === 'ready')) return
        // Skip first run if we mounted with initial={false} AND the variant hasn't changed
        if (mountedWithInitialFalse) {
            // Only skip if the variant is the same as what we mounted with
            if (typeof animateProp === 'string' && lastRanVariantKey === animateProp) {
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
            if (animateProp && typeof animateProp !== 'string') {
                objectAnimateRanOnMount = true
            }
            return
        }
        if (typeof animateProp === 'string') {
            // Compare BOTH the variant key and the resolved keyframes JSON.
            // For static variants the JSON is constant per key; for
            // function-form variants the JSON changes when `custom`
            // changes, which we must treat as a new animation target.
            const resolvedJson = resolvedAnimate ? JSON.stringify(resolvedAnimate) : undefined
            if (lastRanVariantKey !== animateProp || lastRanResolvedJson !== resolvedJson) {
                lastRanVariantKey = animateProp
                lastRanResolvedJson = resolvedJson
                runAnimation()
            }
        } else if (animateProp) {
            // Object animate props - detect if the prop actually changed
            const currentJson = JSON.stringify(animateProp)
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
        if (!(element && isLoaded === 'ready' && !animateProp && resolvedAnimate)) return
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
                pwLog('[motion] path: has initialKeyframes, will animate to target')
                // Apply initial instantly BEFORE exposing 'initial' state
                const transformedInitial = transformSVGPathProperties(
                    element!,
                    initialKeyframes as Record<string, unknown>
                )

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
                const initialForAnimate = { ...(transformedInitial as Record<string, unknown>) }
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
                requestAnimationFrame(async () => {
                    if (isPlaywright) {
                        await sleep(10)
                    }
                    pwLog('[motion] RAF: promoting to ready and running animation')

                    // Mark that we're triggering the initial animation to prevent duplicate runs
                    initialAnimationTriggered = true
                    if (animateProp && typeof animateProp !== 'string') {
                        lastAnimatePropJson = JSON.stringify(animateProp)
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
                })
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
            const transformedInitial = transformSVGPathProperties(
                element!,
                initialKeyframes as Record<string, unknown>
            )
            animate(element!, transformedInitial as DOMKeyframesDefinition, { duration: 0 })
            dataPath = 3
            isLoaded = 'initial'
            requestAnimationFrame(async () => {
                if (isPlaywright) {
                    await sleep(10)
                }
                isLoaded = 'ready'
            })
        } else {
            dataPath = 4
            isLoaded = 'ready'
        }
    })
</script>

{#if isVoidTag}
    {#if isSVGTag(String(tag))}
        <svelte:element this={tag} bind:this={element} xmlns={SVG_NAMESPACE} {...derivedAttrs} />
    {:else}
        <svelte:element this={tag} bind:this={element} {...derivedAttrs} />
    {/if}
{:else if isSVGTag(String(tag))}
    <svelte:element this={tag} bind:this={element} xmlns={SVG_NAMESPACE} {...derivedAttrs}>
        {@render children?.()}
    </svelte:element>
{:else}
    <svelte:element this={tag} bind:this={element} {...derivedAttrs}>
        {@render children?.()}
    </svelte:element>
{/if}
