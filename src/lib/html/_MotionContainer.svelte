<script lang="ts">
    import { getMotionConfig } from '$lib/components/motionConfig.context'
    import type { MotionProps, MotionTransition } from '$lib/types'
    import { isNotEmpty } from '$lib/utils/objects'
    import { sleep } from '$lib/utils/testing'
    import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
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
    import { resolveInitial, resolveAnimate, resolveExit } from '$lib/utils/variants'
    import {
        setVariantContext,
        getVariantContext,
        setInitialFalseContext,
        getInitialFalseContext
    } from '$lib/components/variantContext.context'
    import { writable } from 'svelte/store'
    import { transformSVGPathProperties } from '$lib/utils/svg'

    type Props = MotionProps & {
        children?: Snippet
        tag: keyof SvelteHTMLElements
        [key: string]: unknown
    }

    let {
        children,
        tag = 'div',
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
        onHoverStart: onHoverStartProp,
        onHoverEnd: onHoverEndProp,
        onFocusStart: onFocusStartProp,
        onFocusEnd: onFocusEndProp,
        onTapStart: onTapStartProp,
        onTap: onTapProp,
        onTapCancel: onTapCancelProp,
        layout: layoutProp,
        ref: element = $bindable(null),
        ...rest
    }: Props = $props()
    let isLoaded = $state<'mounting' | 'initial' | 'ready' | 'animated'>('mounting')
    let dataPath = $state<number>(-1)
    const motionConfig = $derived(getMotionConfig())

    // Generate unique key for presence tracking
    const presenceKey = `motion-${Math.random().toString(36).slice(2)}`

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

    const context = getAnimatePresenceContext()
    // Update presence context with current state when element is ready and has size
    $effect(() => {
        if (!(context && element && isLoaded === 'ready')) return

        let rafId: number | null = null
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
            measureAndUpdate()
        })
        try {
            resizeObserver.observe(element)
        } catch {
            // Ignore
        }

        // Also poll on RAF to catch transform/layout-driven changes
        const tick = () => {
            if (stopped) return
            measureAndUpdate()
            rafId = requestAnimationFrame(tick)
        }
        rafId = requestAnimationFrame(tick)

        // Initial measure once
        measureAndUpdate()

        return () => {
            stopped = true
            try {
                resizeObserver.disconnect()
            } catch {
                // Ignore
            }
            if (rafId) cancelAnimationFrame(rafId)
        }
    })

    const isPlaywright =
        typeof window !== 'undefined' &&
        window.location.search.includes('@humanspeak-svelte-motion-isPlaywright=true')

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
    const parentInitialFalse = getInitialFalseContext()
    const effectiveInitialProp =
        initialProp !== undefined
            ? initialProp
            : parentInitialFalse && variantsProp
              ? false
              : undefined

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
        // If we have pathLength in initial, set the pathLength attribute for normalization
        ...(initialKeyframes && 'pathLength' in initialKeyframes ? { pathLength: '1' } : {}),
        style: mergeInlineStyles(
            styleProp,
            initialKeyframes as unknown as Record<string, unknown>,
            resolvedAnimate as unknown as Record<string, unknown>
        ),
        class: classProp
    })

    const runAnimation = () => {
        if (!element || !resolvedAnimate) return
        const transitionAnimate: MotionTransition = mergedTransition ?? {}
        let payload = $state.snapshot(resolvedAnimate)

        // Transform SVG path properties (pathLength, pathOffset) to their CSS equivalents
        payload = transformSVGPathProperties(
            element,
            payload as Record<string, unknown>
        ) as typeof payload

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
                hoverDef: (whileHoverProp ?? {}) as Record<string, unknown>,
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
            undefined,
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
        if (typeof animateProp === 'string') {
            if (lastRanVariantKey !== animateProp) {
                lastRanVariantKey = animateProp
                runAnimation()
            }
        } else if (animateProp) {
            // Object animate props - always run
            lastRanVariantKey = undefined
            runAnimation()
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
        if (effectiveAnimate) {
            // If initial={false}, render at animate state immediately with no transition
            if (effectiveInitialProp === false && resolvedAnimate) {
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
                    // Apply immediately using element.style for instant effect
                    Object.entries(transformedInitial).forEach(([key, value]) => {
                        if (key === 'strokeDasharray' || key === 'strokeDashoffset') {
                            element!.style.setProperty(
                                key,
                                String(Array.isArray(value) ? value[0] : value)
                            )
                        }
                    })
                }
                animate(element!, transformedInitial as DOMKeyframesDefinition, { duration: 0 })
                // Mark initial after styles are applied so tests read CSS=0 while state=initial
                isLoaded = 'initial'
                dataPath = 1
                // Then promote to ready and run the enter animation
                requestAnimationFrame(async () => {
                    if (isPlaywright) {
                        await sleep(10)
                    }
                    isLoaded = 'ready'
                    runAnimation()
                })
            } else {
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
