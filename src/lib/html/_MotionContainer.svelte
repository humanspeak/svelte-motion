<script lang="ts">
    import { getMotionConfig } from '$lib/components/motionConfig.context.js'
    import type { MotionProps, MotionTransition } from '$lib/types.js'
    import { isNotEmpty } from '$lib/utils/objects.js'
    import { sleep } from '$lib/utils/testing.js'
    import { animate } from 'motion'
    import { type Snippet } from 'svelte'
    import type { SvelteHTMLElements } from 'svelte/elements'

    type Props = MotionProps & {
        children?: Snippet
        tag: keyof SvelteHTMLElements
        [key: string]: unknown
    }

    let {
        children,
        tag = 'div',
        initial: initialProp,
        animate: animateProp,
        transition: transitionProp,
        onAnimationStart: onAnimationStartProp,
        onAnimationComplete: onAnimationCompleteProp,
        style: styleProp,
        class: classProp,
        whileTap: whileTapProp,
        whileHover: whileHoverProp,
        onHoverStart: onHoverStartProp,
        onHoverEnd: onHoverEndProp,
        layout: layoutProp,
        ...rest
    }: Props = $props()
    let element: HTMLElement | null = $state(null)
    let isLoaded = $state<'mounting' | 'initial' | 'ready' | 'animated'>('mounting')
    let dataPath = $state<number>(-1)
    const motionConfig = getMotionConfig()
    const isPlaywright =
        typeof window !== 'undefined' &&
        window.location.search.includes('@humanspeak-svelte-motion-isPlaywright=true')

    // Recognized HTML void elements that cannot contain children
    const voidTags = new Set([
        'area',
        'base',
        'br',
        'col',
        'embed',
        'hr',
        'img',
        'input',
        'link',
        'meta',
        'param',
        'source',
        'track',
        'wbr'
    ])
    const isVoidTag = $derived(voidTags.has(tag as string))

    // Compute merged transition without mutating props to avoid effect write loops
    let mergedTransition = $derived<MotionTransition>({
        ...(motionConfig?.transition ?? {}),
        ...(transitionProp ?? {})
    })

    // Type guards for animate return types
    function isPromiseLike(value: unknown): value is Promise<unknown> {
        return (
            typeof value === 'object' &&
            value !== null &&
            'then' in (value as { then?: unknown }) &&
            typeof (value as { then?: unknown }).then === 'function'
        )
    }
    type WithFinished = { finished?: Promise<unknown> }
    function hasFinishedPromise(value: unknown): value is WithFinished {
        return (
            typeof value === 'object' &&
            value !== null &&
            'finished' in (value as { finished?: unknown }) &&
            isPromiseLike((value as { finished?: unknown }).finished)
        )
    }

    const runAnimation = () => {
        if (!element || !animateProp) return
        const transitionAmimate: MotionTransition = mergedTransition ?? {}
        // Fire lifecycle callbacks for main animate transitions
        const payload = $state.snapshot(animateProp)
        onAnimationStartProp?.(payload)
        const controls = animate(element, payload, transitionAmimate)
        // controls may be a promise-like or have a finished promise depending on engine
        if (hasFinishedPromise(controls)) {
            controls.finished?.then(() => onAnimationCompleteProp?.(payload)).catch(() => {})
        } else if (isPromiseLike(controls as unknown)) {
            ;(controls as unknown as Promise<unknown>)
                .then(() => onAnimationCompleteProp?.(payload))
                .catch(() => {})
        }
    }

    // Minimal layout animation using FLIP when `layout` is enabled.
    // When layout === 'position' we only translate.
    // When layout === true we also scale to smoothly interpolate size changes.
    let lastRect: DOMRect | null = null
    $effect(() => {
        if (!(element && layoutProp && isLoaded === 'ready')) return

        // Initialize last rect on first ready frame
        const measure = () => {
            const prev = element!.style.transform
            element!.style.transform = 'none'
            const rect = element!.getBoundingClientRect()
            element!.style.transform = prev
            return rect
        }
        lastRect = measure()
        // Hint compositor for smoother FLIP transforms
        element!.style.willChange = 'transform'
        element!.style.transformOrigin = '0 0'

        let rafId: number | null = null
        const runFlip = () => {
            if (!lastRect) {
                lastRect = measure()
                return
            }
            const prev = element!.style.transform
            element!.style.transform = 'none'
            const next = element!.getBoundingClientRect()
            element!.style.transform = prev
            // Use top-left corner for FLIP to match transformOrigin '0 0'
            const dx = lastRect.left - next.left
            const dy = lastRect.top - next.top
            const sx = next.width > 0 ? lastRect.width / next.width : 1
            const sy = next.height > 0 ? lastRect.height / next.height : 1

            const shouldTranslate = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5
            const shouldScale =
                layoutProp !== 'position' && (Math.abs(1 - sx) > 0.01 || Math.abs(1 - sy) > 0.01)

            if (shouldTranslate || shouldScale) {
                const keyframes: Record<string, unknown> = {}
                if (shouldTranslate) {
                    keyframes.x = [dx, 0]
                    keyframes.y = [dy, 0]
                }
                if (shouldScale) {
                    keyframes.scaleX = [sx, 1]
                    keyframes.scaleY = [sy, 1]
                    ;(keyframes as Record<string, unknown>).transformOrigin = '0 0'
                }
                // Apply the inverse transform immediately so we don't flash the new layout
                // before the animation starts (classic FLIP: First, Last, Invert, Play)
                const parts: string[] = []
                if (shouldTranslate) parts.push(`translate(${dx}px, ${dy}px)`)
                if (shouldScale) parts.push(`scale(${sx}, ${sy})`)
                element!.style.transformOrigin = '0 0'
                element!.style.transform = parts.join(' ')
                animate(
                    element!,
                    keyframes as unknown as import('motion').DOMKeyframesDefinition,
                    (mergedTransition ?? {}) as import('motion').AnimationOptions
                )
            }
            lastRect = next
        }

        const scheduleFlip = () => {
            if (rafId) cancelAnimationFrame(rafId)
            rafId = requestAnimationFrame(() => {
                rafId = null
                runFlip()
            })
        }
        const ro = new ResizeObserver(() => scheduleFlip())
        ro.observe(element)
        // Also observe attribute/class changes and nearby DOM mutations that commonly cause reflow/reposition
        const mo = new MutationObserver(() => scheduleFlip())
        mo.observe(element, { attributes: true, attributeFilter: ['class', 'style'] })
        if (element.parentElement) {
            mo.observe(element.parentElement, { childList: true, subtree: false, attributes: true })
        }

        return () => {
            ro.disconnect()
            mo.disconnect()
            lastRect = null
            // Reset compositor hints on teardown
            if (element) {
                element.style.willChange = ''
                element.style.transformOrigin = ''
                element.style.transform = ''
            }
            if (rafId) cancelAnimationFrame(rafId)
        }
    })
    // Merge style for before/after ready so styles carry through post-anim
    // Merge styles directly in markup; keep effect solely for readiness logic

    // whileTap handling without relying on motion.press (fallback compatible)
    $effect(() => {
        if (!(element && isLoaded === 'ready' && isNotEmpty(whileTapProp))) return

        const handlePointerDown = () => {
            animate(element!, whileTapProp!)
        }
        const handlePointerUp = () => {
            // Build reset record preferring animateProp values, falling back to initialProp
            if (isNotEmpty(whileTapProp) && (isNotEmpty(initialProp) || isNotEmpty(animateProp))) {
                const initialRecord = (initialProp ?? {}) as Record<string, unknown>
                const animateRecord = (animateProp ?? {}) as Record<string, unknown>
                const whileTapRecord = (whileTapProp ?? {}) as Record<string, unknown>

                const keys = new Set<string>([
                    ...Object.keys(initialRecord),
                    ...Object.keys(animateRecord)
                ])
                const overlappingKeys: string[] = []
                for (const k of keys) if (k in whileTapRecord) overlappingKeys.push(k)

                const resetRecord: Record<string, unknown> = {}
                for (const k of overlappingKeys) {
                    resetRecord[k] = Object.prototype.hasOwnProperty.call(animateRecord, k)
                        ? animateRecord[k]
                        : initialRecord[k]
                }
                if (Object.keys(resetRecord).length > 0) {
                    animate(
                        element!,
                        resetRecord as unknown as import('motion').DOMKeyframesDefinition
                    )
                }
            }
        }

        element.addEventListener('pointerdown', handlePointerDown)
        element.addEventListener('pointerup', handlePointerUp)
        element.addEventListener('pointercancel', handlePointerUp)

        return () => {
            element?.removeEventListener('pointerdown', handlePointerDown)
            element?.removeEventListener('pointerup', handlePointerUp)
            element?.removeEventListener('pointercancel', handlePointerUp)
        }
    })

    // whileHover handling, gated to true-hover devices to avoid sticky states on touch
    $effect(() => {
        if (!(element && isLoaded === 'ready' && isNotEmpty(whileHoverProp))) return

        const isHoverCapable = () => {
            if (typeof window === 'undefined') return false
            const mqHover = window.matchMedia('(hover: hover)')
            const mqPointerFine = window.matchMedia('(pointer: fine)')
            return mqHover.matches && mqPointerFine.matches
        }

        // Cache baseline values per hover session so we can restore on leave
        let hoverBaseline: Record<string, unknown> | null = null

        const computeBaseline = () => {
            const baseline: Record<string, unknown> = {}
            const initialRecord = (initialProp ?? {}) as Record<string, unknown>
            const animateRecord = (animateProp ?? {}) as Record<string, unknown>
            const whileHoverRecordRaw = (whileHoverProp ?? {}) as Record<string, unknown>
            const whileHoverRecord = { ...whileHoverRecordRaw }
            delete (whileHoverRecord as Record<string, unknown>)['transition']

            const neutralTransformDefaults: Record<string, unknown> = {
                x: 0,
                y: 0,
                translateX: 0,
                translateY: 0,
                scale: 1,
                scaleX: 1,
                scaleY: 1,
                rotate: 0,
                rotateX: 0,
                rotateY: 0,
                rotateZ: 0,
                skewX: 0,
                skewY: 0
            }

            const cs = getComputedStyle(element!)
            for (const key of Object.keys(whileHoverRecord)) {
                if (Object.prototype.hasOwnProperty.call(animateRecord, key)) {
                    baseline[key] = animateRecord[key]
                } else if (Object.prototype.hasOwnProperty.call(initialRecord, key)) {
                    baseline[key] = initialRecord[key]
                } else if (key in neutralTransformDefaults) {
                    baseline[key] = neutralTransformDefaults[key]
                } else if (key in cs) {
                    baseline[key] = (cs as unknown as Record<string, unknown>)[key] as string
                }
            }
            return baseline
        }

        const handlePointerEnter = () => {
            if (!isHoverCapable()) return
            hoverBaseline = computeBaseline()
            onHoverStartProp?.()
            const whileHoverRecordRaw = (whileHoverProp ?? {}) as Record<string, unknown>
            const { transition: whileHoverTransition, ...whileHoverRecord } =
                whileHoverRecordRaw as { transition?: import('motion').AnimationOptions }
            animate(
                element!,
                whileHoverRecord as unknown as import('motion').DOMKeyframesDefinition,
                (whileHoverTransition ??
                    mergedTransition ??
                    {}) as import('motion').AnimationOptions
            )
        }

        const handlePointerLeave = () => {
            if (!isHoverCapable()) return
            // Reset changed keys back to baseline values when hover ends
            if (hoverBaseline && Object.keys(hoverBaseline).length > 0) {
                animate(
                    element!,
                    hoverBaseline as unknown as import('motion').DOMKeyframesDefinition,
                    // Exit uses component/root transition (not whileHover's nested transition)
                    (mergedTransition ?? {}) as import('motion').AnimationOptions
                )
            }
            onHoverEndProp?.()
        }

        element.addEventListener('pointerenter', handlePointerEnter)
        element.addEventListener('pointerleave', handlePointerLeave)

        return () => {
            element?.removeEventListener('pointerenter', handlePointerEnter)
            element?.removeEventListener('pointerleave', handlePointerLeave)
        }
    })

    // Re-run animate when animateProp changes while ready
    $effect(() => {
        if (element && isLoaded === 'ready' && isNotEmpty(animateProp)) {
            runAnimation()
        }
    })

    $effect(() => {
        if (!(element && isLoaded === 'mounting')) return
        if (animateProp) {
            if (isNotEmpty(initialProp)) {
                // Apply initial instantly BEFORE exposing 'initial' state
                animate(element!, initialProp!, { duration: 0 })
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
                runAnimation()
            }
        } else if (isNotEmpty(initialProp)) {
            // Apply initial instantly BEFORE exposing 'initial' state
            animate(element!, initialProp!, { duration: 0 })
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

<svelte:element
    this={tag}
    bind:this={element}
    {...rest}
    data-playwright={isPlaywright ? isPlaywright : undefined}
    data-is-loaded={isPlaywright ? isLoaded : undefined}
    data-path={isPlaywright ? dataPath : undefined}
    style={styleProp}
    class={classProp}
>
    {#if isLoaded === 'ready' && !isVoidTag}
        {@render children?.()}
    {/if}
</svelte:element>
