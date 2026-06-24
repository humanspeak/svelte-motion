import {
    animate,
    type AnimationOptions,
    type AnimationPlaybackControls,
    type DOMKeyframesDefinition,
    type ValueAnimationTransition
} from 'motion'

const layoutSizeAnimationAttribute = 'data-layout-size-animation'

const roundedPx = (value: number): string => `${Math.max(0, Math.round(value))}px`
const mix = (from: number, to: number, progress: number): number => from + (to - from) * progress
type TrackedFlipAnimation = {
    animation: AnimationPlaybackControls
    cleanup: () => void
}

const activeFlipAnimations = new WeakMap<HTMLElement, Set<TrackedFlipAnimation>>()

const rememberFlipAnimation = (
    el: HTMLElement,
    animation: AnimationPlaybackControls,
    cleanup: () => void = () => {}
) => {
    let animations = activeFlipAnimations.get(el)
    if (!animations) {
        animations = new Set()
        activeFlipAnimations.set(el, animations)
    }
    let cleanupRan = false
    const tracked: TrackedFlipAnimation = {
        animation,
        cleanup: () => {
            if (cleanupRan) return
            cleanupRan = true
            cleanup()
        }
    }
    animations.add(tracked)
    animation.finished?.finally(() => {
        tracked.cleanup()
        const current = activeFlipAnimations.get(el)
        if (current !== animations) return
        current.delete(tracked)
        if (current.size === 0) activeFlipAnimations.delete(el)
    })
}

/**
 * Complete any active FLIP animation on an element and return it to its
 * committed layout transform.
 *
 * @param el Target element.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * finishFlipAnimations(node)
 * ```
 */
export const finishFlipAnimations = (el: HTMLElement): void => {
    const animations = activeFlipAnimations.get(el)
    if (!animations) return

    for (const animation of animations) {
        animation.animation.complete()
        animation.cleanup()
    }
    if (activeFlipAnimations.get(el) === animations) {
        activeFlipAnimations.delete(el)
    }
    el.style.transform = ''
}

const isViewportOffscreen = (el: HTMLElement): boolean => {
    if (typeof window === 'undefined') return false

    const rect = el.getBoundingClientRect()
    return (
        rect.bottom <= 0 ||
        rect.right <= 0 ||
        rect.top >= window.innerHeight ||
        rect.left >= window.innerWidth
    )
}

const runBoxSizeAnimation = (
    el: HTMLElement,
    transforms: {
        dx: number
        dy: number
        sx: number
        sy: number
    },
    transition: AnimationOptions
) => {
    const { dx, dy, sx, sy } = transforms
    const originalWidth = el.style.width
    const originalHeight = el.style.height
    const originalTransform = el.style.transform
    const originalTransformOrigin = el.style.transformOrigin

    const nextRect = el.getBoundingClientRect()
    const prevWidth = nextRect.width * sx
    const prevHeight = nextRect.height * sy

    el.setAttribute(layoutSizeAnimationAttribute, 'true')
    for (const child of el.querySelectorAll<HTMLElement>('[data-svelte-motion-layout]')) {
        child.style.transform = ''
        child.style.transformOrigin = ''
        if (child.style.willChange === 'transform') child.style.willChange = ''
    }
    el.style.width = roundedPx(prevWidth)
    el.style.height = roundedPx(prevHeight)

    const sizedRect = el.getBoundingClientRect()
    const residualDx = nextRect.left + dx - sizedRect.left
    const residualDy = nextRect.top + dy - sizedRect.top
    const shouldTranslate = Math.abs(residualDx) > 0.5 || Math.abs(residualDy) > 0.5

    if (shouldTranslate) {
        el.style.transformOrigin = '0 0'
        el.style.transform = `translate(${Math.round(residualDx)}px, ${Math.round(residualDy)}px)`
    }

    const writeBox = (progress: number) => {
        el.style.width = roundedPx(mix(prevWidth, nextRect.width, progress))
        el.style.height = roundedPx(mix(prevHeight, nextRect.height, progress))

        if (shouldTranslate) {
            const x = Math.round(mix(residualDx, 0, progress))
            const y = Math.round(mix(residualDy, 0, progress))
            el.style.transform = x === 0 && y === 0 ? '' : `translate(${x}px, ${y}px)`
        }
    }

    let removeScrollListener: (() => void) | undefined
    let offscreenRaf: number | null = null
    let cleanupRan = false
    const cleanup = () => {
        if (cleanupRan) return
        cleanupRan = true
        removeScrollListener?.()
        if (
            offscreenRaf !== null &&
            typeof window !== 'undefined' &&
            typeof window.cancelAnimationFrame === 'function'
        ) {
            window.cancelAnimationFrame(offscreenRaf)
            offscreenRaf = null
        }
        el.style.width = originalWidth
        el.style.height = originalHeight
        el.style.transformOrigin = originalTransformOrigin
        el.style.transform = originalTransform
        el.removeAttribute(layoutSizeAnimationAttribute)
    }

    const animation = animate(0, 1, {
        ...(transition as ValueAnimationTransition<number>),
        onUpdate: writeBox
    })
    rememberFlipAnimation(el, animation, cleanup)

    if (typeof window !== 'undefined') {
        const completeIfOffscreen = () => {
            if (cleanupRan) return
            if (isViewportOffscreen(el)) {
                animation.complete()
                cleanup()
            }
        }
        const scheduleCompleteIfOffscreen = () => {
            if (typeof window.requestAnimationFrame !== 'function') {
                completeIfOffscreen()
                return
            }
            if (offscreenRaf !== null) return
            offscreenRaf = window.requestAnimationFrame(() => {
                offscreenRaf = null
                completeIfOffscreen()
            })
        }
        const handleScroll = () => {
            completeIfOffscreen()
            scheduleCompleteIfOffscreen()
        }
        window.addEventListener('scroll', handleScroll, { passive: true })
        removeScrollListener = () => {
            window.removeEventListener('scroll', handleScroll)
        }
        completeIfOffscreen()
        scheduleCompleteIfOffscreen()
    }
}

/**
 * Measure an element's bounding client rect without current transform.
 *
 * Temporarily clears `transform` to avoid skewing measurements, restoring it
 * immediately after reading the rect.
 *
 * When `scrollContainers` are provided, the returned rect is shifted by the
 * **sum** of each container's `scrollLeft` / `scrollTop`. When
 * `includeViewportScroll` is true, the viewport's `window.scrollX` /
 * `window.scrollY` is included too. FLIP deltas computed from two such
 * measures stay correct even when the user scrolls between measurements —
 * including a nested `layoutScroll` inside another `layoutScroll`. Mirrors
 * framer-motion's `removeElementScroll`, which walks every ancestor in the
 * path, plus root scroll compensation from the projection tree.
 *
 * Pass an empty array (or omit) for viewport-relative behaviour.
 *
 * `baseTransform` is the value the element's `transform` is set to while
 * measuring (default `'none'`, i.e. all transforms removed). The
 * projection system passes the element's mount-time transform here so
 * that a user-authored static `transform` is preserved in the
 * measurement while only the motion-applied portion (written after
 * mount) is removed — mirroring framer-motion's `removeBoxTransforms`,
 * which only subtracts motion-tracked `latestValues` and leaves
 * user-authored transforms intact. Existing FLIP callers omit it and
 * get the original strip-everything behaviour.
 *
 * @param el Element to measure.
 * @param scrollContainers Optional ancestor chain with `layoutScroll` enabled.
 * @param baseTransform Transform string applied during measurement. Defaults to `'none'`.
 * @param includeViewportScroll Whether to include `window.scrollX/Y` in the returned rect.
 * @returns DOMRect snapshot of the element.
 *
 * @example
 * ```ts
 * // No scroll containers — viewport-relative rect.
 * const rect = measureRect(node)
 *
 * // Single ancestor scroll container (one `layoutScroll`).
 * const rect = measureRect(node, [scrollPanel])
 *
 * // Nested `layoutScroll` ancestors — sums offsets from every container.
 * const rect = measureRect(node, [innerScroll, outerScroll])
 * ```
 */
export const measureRect = (
    el: HTMLElement,
    scrollContainers?: HTMLElement[],
    baseTransform = 'none',
    includeViewportScroll = false
): DOMRect => {
    const prev = el.style.transform
    try {
        el.style.transform = baseTransform
        const rect = el.getBoundingClientRect()
        let offsetLeft = includeViewportScroll && typeof window !== 'undefined' ? window.scrollX : 0
        let offsetTop = includeViewportScroll && typeof window !== 'undefined' ? window.scrollY : 0
        if (!scrollContainers || scrollContainers.length === 0) {
            if (offsetLeft === 0 && offsetTop === 0) return rect
            return new DOMRect(
                rect.left + offsetLeft,
                rect.top + offsetTop,
                rect.width,
                rect.height
            )
        }
        // Re-express the rect in the *combined* scroll-container coordinate
        // space so a subsequent scroll on any of them doesn't show up as
        // movement. DOMRect's left/top are read-only, so allocate a fresh
        // one with the summed offsets applied.
        for (const container of scrollContainers) {
            offsetLeft += container.scrollLeft
            offsetTop += container.scrollTop
        }
        return new DOMRect(rect.left + offsetLeft, rect.top + offsetTop, rect.width, rect.height)
    } finally {
        el.style.transform = prev
    }
}

/**
 * Minimal rectangle shape `computeFlipTransforms` reads. A `DOMRect`
 * satisfies it structurally, and so does a projection `Box` converted to
 * `{ left, top, width, height }`. Declared here (rather than importing
 * the projection `Box`) so `layout.ts` stays free of a circular
 * dependency on `projection.ts`, which imports `measureRect` from here.
 */
export interface RectLike {
    left: number
    top: number
    width: number
    height: number
}

/**
 * Compute FLIP transform deltas between two rects.
 *
 * @param prev Previous rect.
 * @param next Next rect.
 * @param mode `true` for translate+scale, `'position'` for translate only.
 * @return Deltas and flags indicating which transforms to apply.
 */
export const computeFlipTransforms = (
    prev: RectLike,
    next: RectLike,
    mode: boolean | 'position'
): {
    dx: number
    dy: number
    sx: number
    sy: number
    shouldTranslate: boolean
    shouldScale: boolean
} => {
    const dx = prev.left - next.left
    const dy = prev.top - next.top
    const sx = next.width > 0 ? prev.width / next.width : 1
    const sy = next.height > 0 ? prev.height / next.height : 1

    const shouldTranslate = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5
    const shouldScale = mode !== 'position' && (Math.abs(1 - sx) > 0.01 || Math.abs(1 - sy) > 0.01)
    return { dx, dy, sx, sy, shouldTranslate, shouldScale }
}

/**
 * Run a FLIP animation for the provided deltas.
 *
 * Pre-applies the inverse transform to avoid layout flashes, then animates back
 * to identity using the provided transition.
 *
 * @param el Target element.
 * @param transforms Deltas computed by `computeFlipTransforms`.
 * @param transition Timing/options for the animation.
 */
export const runFlipAnimation = (
    el: HTMLElement,
    transforms: {
        dx: number
        dy: number
        sx: number
        sy: number
        shouldTranslate: boolean
        shouldScale: boolean
    },
    transition: AnimationOptions
): void => {
    const { dx, dy, sx, sy, shouldTranslate, shouldScale } = transforms
    if (!(shouldTranslate || shouldScale)) return

    const correctionTargets = shouldScale
        ? Array.from(el.querySelectorAll<HTMLElement>('[data-svelte-motion-layout]'))
        : []

    if (shouldScale && correctionTargets.length > 0) {
        runBoxSizeAnimation(el, { dx, dy, sx, sy }, transition)
        return
    }

    const keyframes: Record<string, unknown> = {}
    if (shouldTranslate) {
        keyframes.x = [dx, 0]
        keyframes.y = [dy, 0]
    }
    if (shouldScale) {
        keyframes.scaleX = [sx, 1]
        keyframes.scaleY = [sy, 1]
    }

    const parts: string[] = []
    if (shouldTranslate) parts.push(`translate(${dx}px, ${dy}px)`)
    if (shouldScale) parts.push(`scale(${sx}, ${sy})`)
    el.style.transformOrigin = '0 0'
    el.style.transform = parts.join(' ')

    const animation = animate(el, keyframes as unknown as DOMKeyframesDefinition, transition)
    rememberFlipAnimation(el, animation)
}

/**
 * Toggle compositor hints for smoother transform animations.
 *
 * @param el Target element.
 * @param enabled Whether to enable compositor hints.
 */
export const setCompositorHints = (el: HTMLElement, enabled: boolean): void => {
    el.style.willChange = enabled ? 'transform' : ''
    el.style.transformOrigin = enabled ? '0 0' : ''
    if (!enabled) el.style.transform = ''
}

/**
 * Select the reactive dependencies that gate `layout` (FLIP) measurement.
 *
 * When `layoutDependency` is provided — any value, including falsy ones like
 * `0`, `''`, or `null` — measurement is gated on *only* that value, so a
 * frequently-rerendering `layout` element stops re-measuring on every render
 * that merely touches `class`, `style`, `layoutId`, or `transition`. When it is
 * `undefined`, the lazily-evaluated `fallback` dependencies drive measurement,
 * matching framer-motion's default behavior.
 *
 * `fallback` is a thunk so its values are read (and, in a reactive context,
 * tracked) only when gating is off — that laziness is what makes the
 * optimization effective. Mirrors framer-motion's `MeasureLayout`, which calls
 * `willUpdate()` only when `layoutDependency` changed or is `undefined`.
 *
 * @param layoutDependency The user-supplied `layoutDependency` prop value.
 * @param fallback Thunk returning the default dependency list, evaluated only
 *   when `layoutDependency` is `undefined`.
 * @returns The dependency list the measurement effects should track.
 * @example
 * ```ts
 * // Gated: only re-measures when `order` changes.
 * selectLayoutDependencies(order, () => [klass, style]) // => [order]
 * // Default: tracks the fallback deps.
 * selectLayoutDependencies(undefined, () => [klass, style]) // => [klass, style]
 * ```
 */
export const selectLayoutDependencies = (
    layoutDependency: unknown,
    fallback: () => unknown[]
): unknown[] => (layoutDependency !== undefined ? [layoutDependency] : fallback())

/**
 * Observe size/attribute changes that commonly trigger layout changes.
 *
 * Returns a cleanup function that disconnects observers. The callback is called
 * for resize events and attribute/class/style changes on the element and
 * immediate parent child-list changes.
 *
 * @param el Element to observe.
 * @param onChange Callback invoked when a relevant change is detected.
 * @return Cleanup function.
 */
export const observeLayoutChanges = (el: HTMLElement, onChange: () => void): (() => void) => {
    let pendingRaf: number | null = null
    let releaseTimeout: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
        if (el.closest(`[${layoutSizeAnimationAttribute}]`)) {
            el.style.transform = ''
            el.style.transformOrigin = ''
            if (el.style.willChange === 'transform') el.style.willChange = ''
            return
        }
        if (pendingRaf !== null || releaseTimeout !== null) return
        // Leading-edge catches synchronous layout writes. The trailing read
        // catches Svelte presence DOM that finishes patching on the next frame
        // without polling throughout the active layout animation.
        onChange()
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            pendingRaf = window.requestAnimationFrame(() => {
                pendingRaf = null
                onChange()
            })
        } else {
            releaseTimeout = setTimeout(() => {
                releaseTimeout = null
                onChange()
            }, 50)
        }
    }
    const ro = new ResizeObserver(() => schedule())
    ro.observe(el)
    const attributeObserver = new MutationObserver(() => schedule())
    attributeObserver.observe(el, {
        attributes: true,
        attributeFilter: ['class', 'data-presence-layout-hold']
    })
    const childListObserver = new MutationObserver(() => schedule())
    childListObserver.observe(el, {
        childList: true,
        subtree: true
    })
    if (el.parentElement) {
        childListObserver.observe(el.parentElement, { childList: true, subtree: true })
    }
    return () => {
        ro.disconnect()
        attributeObserver.disconnect()
        childListObserver.disconnect()
        if (pendingRaf !== null && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(pendingRaf)
            pendingRaf = null
        }
        if (releaseTimeout !== null) {
            clearTimeout(releaseTimeout)
            releaseTimeout = null
        }
    }
}
