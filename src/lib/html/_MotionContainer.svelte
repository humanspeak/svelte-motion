<script lang="ts">
    import { getMotionConfig } from '$lib/components/motionConfig.context'
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
    import { type Snippet } from 'svelte'
    import { VOID_TAGS } from '$lib/utils/constants'
    import { mergeTransitions, animateWithLifecycle } from '$lib/utils/animation'
    import { attachWhileTap } from '$lib/utils/interaction'
    import { attachWhileHover } from '$lib/utils/hover'
    import { attachWhileFocus } from '$lib/utils/focus'
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
    import { usePresence, getAnimatePresenceContext } from '$lib/utils/presence'
    import { getInitialKeyframes } from '$lib/utils/initial'
    import { attachDrag } from '$lib/utils/drag'
    import { resolveInitial, resolveAnimate, resolveExit } from '$lib/utils/variants'
    import {
        setVariantContext,
        getVariantContext,
        setInitialFalseContext,
        getInitialFalseContext
    } from '$lib/components/variantContext.context'
    import { writable } from 'svelte/store'
    import { transformSVGPathProperties, computeNormalizedSVGInitialAttrs } from '$lib/utils/svg'

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
        whileDrag: whileDragProp,
        onHoverStart: onHoverStartProp,
        onHoverEnd: onHoverEndProp,
        onFocusStart: onFocusStartProp,
        onFocusEnd: onFocusEndProp,
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
        ref: element = $bindable(null),
        ...rest
    }: Props = $props()
    let isLoaded = $state<'mounting' | 'initial' | 'ready' | 'animated'>('mounting')
    let dataPath = $state<number>(-1)
    const motionConfig = $derived(getMotionConfig())

    // Get presence context to check if we're inside AnimatePresence
    const context = getAnimatePresenceContext()

    // Validate key prop when inside AnimatePresence
    if (context && !keyProp) {
        throw new Error(
            'motion elements inside AnimatePresence must have a `key` prop. ' +
                'Example: <motion.div key="unique-id" />'
        )
    }

    // Use the provided key for presence tracking
    const presenceKey = keyProp ?? `motion-${Math.random().toString(36).slice(2)}`

    // Compute merged transition without mutating props to avoid effect write loops
    const mergedTransition = $derived<AnimationOptions>(
        mergeTransitions(
            (motionConfig?.transition ?? {}) as AnimationOptions,
            (transitionProp ?? {}) as AnimationOptions
        )
    )

    // Register with AnimatePresence so onDestroy triggers exit cloning
    $effect(() => {
        if (element) {
            usePresence(
                presenceKey,
                element,
                resolvedExit,
                mergedTransition as unknown as MotionTransition
            )
        }
    })

    // Update presence context with current state when element is ready and has size
    $effect(() => {
        if (!(context && element && isLoaded === 'ready')) return

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

    $effect(() => {
        if (!variantsProp) return localVariantStore.set(undefined)
        if (typeof animateProp === 'string') return localVariantStore.set(animateProp)
        if (typeof effectiveAnimate === 'string') return localVariantStore.set(effectiveAnimate)
        localVariantStore.set(undefined)
    })

    const resolvedInitial = $derived(resolveInitial(effectiveInitialProp, variantsProp))
    const resolvedAnimate = $derived(resolveAnimate(effectiveAnimate, variantsProp))
    const resolvedExit = $derived(resolveExit(exitProp, variantsProp))

    // Extract keyframes from resolved initial, handling initial={false}
    const initialKeyframes = $derived(getInitialKeyframes(resolvedInitial))

    // Derived attributes to keep both branches in sync (focusability, data flags, style, class)
    const derivedAttrs = $derived<Record<string, unknown>>({
        ...(rest as Record<string, unknown>),
        ...(whileTapProp &&
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
            whileDrag: whileDragProp as MotionWhileDrag,
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

    const runAnimation = () => {
        pwLog('[motion] runAnimation called', {
            hasElement: !!element,
            resolvedAnimate,
            mergedTransition
        })
        if (!element || !resolvedAnimate) {
            pwLog('[motion] runAnimation bailing - no element or resolvedAnimate')
            return
        }

        const transitionAnimate: MotionTransition = mergedTransition ?? {}
        let payload = $state.snapshot(resolvedAnimate)

        // Transform SVG path properties (pathLength, pathOffset) to their CSS equivalents
        payload = transformSVGPathProperties(
            element,
            payload as Record<string, unknown>
        ) as typeof payload

        // Ensure dash properties aren't pinned as inline styles
        if (element && (element as HTMLElement).style) {
            ;(element as HTMLElement).style.removeProperty('stroke-dasharray')
            ;(element as HTMLElement).style.removeProperty('stroke-dashoffset')
        }

        pwLog('[motion] runAnimation animating', {
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

    // Track the last variant key we ran to avoid re-running on mount
    let lastRanVariantKey = $state<string | undefined>(undefined)
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
        lastRect = measureRect(element!)
        // Hint compositor for smoother FLIP transforms
        setCompositorHints(element!, true)

        let rafId: number | null = null
        const runFlip = () => {
            if (!lastRect) {
                lastRect = measureRect(element!)
                return
            }
            const next = measureRect(element!)
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

    // whileTap handling without relying on motion.press (fallback compatible)
    $effect(() => {
        if (!(element && isLoaded === 'ready' && isNotEmpty(whileTapProp))) return
        return attachWhileTap(
            element!,
            (whileTapProp ?? {}) as Record<string, unknown>,
            (resolvedInitial ?? {}) as Record<string, unknown>,
            (resolvedAnimate ?? {}) as Record<string, unknown>,
            {
                onTapStart: onTapStartProp,
                onTap: onTapProp,
                onTapCancel: onTapCancelProp,
                hoverDef: isNotEmpty(whileHoverProp ?? {})
                    ? ((whileHoverProp ?? {}) as Record<string, unknown>)
                    : undefined,
                hoverFallbackTransition: (mergedTransition ?? {}) as AnimationOptions
            }
        )
    })

    // whileHover handling, gated to true-hover devices to avoid sticky states on touch
    $effect(() => {
        if (!(element && isLoaded === 'ready' && isNotEmpty(whileHoverProp))) return
        return attachWhileHover(
            element!,
            (whileHoverProp ?? {}) as Record<string, unknown>,
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
        if (!(element && isLoaded === 'ready' && isNotEmpty(whileFocusProp))) return
        return attachWhileFocus(
            element!,
            (whileFocusProp ?? {}) as Record<string, unknown>,
            (mergedTransition ?? {}) as AnimationOptions,
            { onStart: onFocusStartProp, onEnd: onFocusEndProp },
            {
                initial: (resolvedInitial ?? {}) as Record<string, unknown>,
                animate: (resolvedAnimate ?? {}) as Record<string, unknown>
            }
        )
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
            if (lastRanVariantKey !== animateProp) {
                lastRanVariantKey = animateProp
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
            if (lastRanVariantKey !== currentAnimateKey) {
                lastRanVariantKey = currentAnimateKey
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

                    // IMPORTANT: Start the animation BEFORE changing isLoaded.
                    // When isLoaded changes to 'ready', Svelte will reactively remove the
                    // initial inline styles. We need the animation to capture the current
                    // state (from inline styles) before they're removed.
                    runAnimation()

                    // CRITICAL: Wait for the next animation frame before changing isLoaded.
                    // This gives WAAPI time to:
                    // 1. Parse and create the animation
                    // 2. Start the animation layer
                    // 3. Lock in the "from" values from current computed style
                    // Only THEN can we safely clear inline styles without killing the animation
                    requestAnimationFrame(() => {
                        isLoaded = 'ready'
                    })
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
    <svelte:element this={tag} bind:this={element} {...derivedAttrs} />
{:else}
    <svelte:element this={tag} bind:this={element} {...derivedAttrs}>
        {@render children?.()}
    </svelte:element>
{/if}
