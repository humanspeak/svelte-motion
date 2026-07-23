import {
    animate,
    type AnimationOptions,
    type AnimationPlaybackControls,
    type DOMKeyframesDefinition,
    type ValueAnimationTransition
} from 'motion'

const layoutSizeAnimationAttribute = 'data-layout-size-animation'

/**
 * Dispatched on each size-corrected `[data-svelte-motion-layout]` child at the
 * START of a parent's `runBoxSizeAnimation`, synchronously and before the next
 * paint. A child re-slot commit can race ahead of the parent setting
 * `data-layout-size-animation` (MutationObserver ordering), setting up an enter
 * FLIP whose transform the size-animation guard then clears one frame later — a
 * visible one-frame pop. On this event the child BLOCKS its projection
 * (`blockLayoutAnimation`), finishing and preventing any pending frameloop
 * update from painting a transform, so it tracks the growing parent at identity
 * instead. Bubbles: no.
 */
export const sizeCorrectionSeedEvent = 'svelte-motion:size-correction-seed'

/**
 * Dispatched on each size-corrected `[data-svelte-motion-layout]` child when a
 * parent's `runBoxSizeAnimation` finishes (or is cleaned up). Pairs with
 * {@link sizeCorrectionSeedEvent}: the child lifts the projection block it took
 * on seed, re-seeds to the settled layout, and resumes animating real layout
 * changes normally. Bubbles: no.
 */
export const sizeCorrectionEndEvent = 'svelte-motion:size-correction-end'

/**
 * How many ancestor levels above the element `observeLayoutChanges` watches
 * for re-slotting style/class changes. Upstream framer-motion re-measures the
 * WHOLE projection tree on any tracked update (`create-projection-node.ts`
 * `didUpdate` → `nodes.forEach(updateLayout)`), so a re-slot from ANY ancestor
 * animates. This DOM-scoped port approximates that tree-global reach with a
 * fixed, bounded walk: a deliberate cost cap so observer count stays O(1) per
 * layout element. Raise it consciously for a deep-tree bug — never silently.
 */
const MAX_OBSERVED_ANCESTORS = 4

/**
 * CSS declaration names whose changes never re-slot CHILDREN: composited
 * animation channels written every frame by gesture and FLIP writers
 * (`transform` + the CSS independent transforms), plus paint-only hints.
 * Used to ignore parent style mutations that can't affect child layout.
 */
const nonChildLayoutStyleProps = new Set([
    'transform',
    'transform-origin',
    'translate',
    'rotate',
    'scale',
    'will-change',
    'opacity',
    'filter'
])

/**
 * Strip declarations that cannot affect CHILD layout from a serialized
 * style string, normalizing the remainder for change comparison.
 *
 * Declaration-parsing (not regex) so values containing `;`-adjacent
 * constructs or varied whitespace compare stably.
 *
 * @param style Serialized inline style (may be empty).
 * @returns The layout-affecting declarations, normalized.
 * @example
 * ```ts
 * stripNonChildLayoutStyle('align-items: flex-end; transform: scale(2)')
 * // => 'align-items:flex-end'
 * ```
 */
export const stripNonChildLayoutStyle = (style: string): string => {
    const kept: string[] = []
    for (const declaration of style.split(';')) {
        const separator = declaration.indexOf(':')
        if (separator === -1) continue
        const property = declaration.slice(0, separator).trim().toLowerCase()
        if (!property || nonChildLayoutStyleProps.has(property)) continue
        kept.push(`${property}:${declaration.slice(separator + 1).trim()}`)
    }
    return kept.join(';')
}

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
    // Fire-and-forget: the caller does not await the FLIP animation. `finished`
    // rejects when an animation is cancelled, and `.finally()` re-raises that, so
    // swallow it — the cleanup has already run by then.
    void animation.finished
        ?.finally(() => {
            tracked.cleanup()
            const current = activeFlipAnimations.get(el)
            if (current !== animations) return
            current.delete(tracked)
            if (current.size === 0) activeFlipAnimations.delete(el)
        })
        .catch(() => undefined)
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
        // Cancel any enter/re-slot FLIP the child set up before this size
        // animation started (and before it could observe the attribute above):
        // the child blocks its projection on this event so the pending render
        // never paints a one-frame transform that the guard would then clear.
        // It tracks the parent's growth at identity instead (released on END).
        child.dispatchEvent(new CustomEvent(sizeCorrectionSeedEvent))
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
        // Release each size-corrected child's projection block (taken on seed at
        // animation start) now that the settled layout is in the DOM.
        for (const child of el.querySelectorAll<HTMLElement>('[data-svelte-motion-layout]')) {
            child.dispatchEvent(new CustomEvent(sizeCorrectionEndEvent))
        }
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
 * for resize events, attribute/class/style changes on the element, the
 * immediate parent's child-list changes, and layout-affecting style/class
 * changes on a bounded chain of ancestors (up to `MAX_OBSERVED_ANCESTORS`
 * levels) — so a re-slot driven from a grandparent-or-higher still animates.
 * The ancestor observers re-bind automatically when the element is re-parented.
 *
 * @param el Element to observe.
 * @param onChange Callback invoked when a relevant change is detected.
 * @return Cleanup function.
 */
export const observeLayoutChanges = (el: HTMLElement, onChange: () => void): (() => void) => {
    let pendingRaf: number | null = null
    let releaseTimeout: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
        const sizeAnimationHost = el.closest(`[${layoutSizeAnimationAttribute}]`)
        if (sizeAnimationHost) {
            el.style.transform = ''
            el.style.transformOrigin = ''
            if (el.style.willChange === 'transform') el.style.willChange = ''
            // When the size-animating host is a PROPER ANCESTOR, this element
            // is a size-corrected CHILD being re-slotted every frame as the
            // ancestor grows. Keep committing so its projection cache tracks
            // the in-flight slot — the commit path detects the active ancestor
            // size-animation and SEEDS rather than FLIPs, so nothing fights the
            // parent. Without this the child's cache goes stale for the whole
            // animation and the ancestor's completion re-slot lands as a
            // one-frame phantom FLIP (the accumulated delta) on the child.
            // The host element ITSELF still short-circuits (its own commit is
            // guarded upstream), so its residual translate is untouched.
            if (sizeAnimationHost !== el) onChange()
            return
        }
        // Re-parenting (portal / imperative move) leaves the ancestor
        // observers pointed at the OLD chain, so subsequent new-parent changes
        // would go unseen. Re-bind before the throttle guard so a move is never
        // swallowed — upstream never has a stale parent because it measures the
        // whole projection tree (`create-projection-node.ts`).
        rewireIfReparented()
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
    const attributeObserver = new MutationObserver(() => schedule())
    const childListObserver = new MutationObserver(() => schedule())
    // The element's OWN childList (subtree) observation. Kept separate from the
    // ancestor wiring below so a re-parent can disconnect/re-attach the ancestor
    // observers without dropping this self-observation.
    const observeSelfChildList = () =>
        childListObserver.observe(el, {
            childList: true,
            subtree: true
        })
    // An ANCESTOR's style/class change can re-slot this element (e.g. the
    // classic toggle-switch: align-items flip on the track, or the same flip
    // two levels up) with no childList or resize signal, and the Svelte-owned
    // reactive path can't snapshot it — the ancestor patches before this
    // element's effects run. Watch each observed ancestor's attributes and let
    // the commit path diff against the cached rect. Style mutations that only
    // touch animation channels (transforms / opacity / will-change — written
    // every frame by gesture and FLIP animations) never re-slot children, so
    // they're filtered out at EVERY observed level to avoid commit storms.
    const parentAttributeObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.attributeName === 'style') {
                const before = stripNonChildLayoutStyle(mutation.oldValue ?? '')
                const after = stripNonChildLayoutStyle(
                    (mutation.target as HTMLElement).getAttribute('style') ?? ''
                )
                if (before === after) continue
            }
            schedule()
            return
        }
    })

    /**
     * Collect the bounded ancestor chain (closest first) up to
     * `MAX_OBSERVED_ANCESTORS` levels. Captured references are compared by
     * identity to detect re-parenting.
     */
    const collectAncestors = (): HTMLElement[] => {
        const chain: HTMLElement[] = []
        let current = el.parentElement
        while (current && chain.length < MAX_OBSERVED_ANCESTORS) {
            chain.push(current)
            current = current.parentElement
        }
        return chain
    }

    // Eagerly captured so a synchronously-firing observer double (tests) that
    // reaches `rewireIfReparented` during setup sees the real chain, not an
    // empty placeholder — real MutationObserver/ResizeObserver never fire on
    // `observe()`, so in production this is simply the initial chain.
    let observedAncestors: HTMLElement[] = collectAncestors()
    const wireAncestors = () => {
        observedAncestors.forEach((ancestor, index) => {
            // Only the IMMEDIATE parent gets childList: `subtree: true` already
            // covers sibling reorders/insertions that re-slot this element.
            // Higher levels intentionally SKIP childList — a higher-level DOM
            // insertion that re-slots us still changes some observed ancestor's
            // rect, which surfaces on the attribute path; adding childList at
            // every level only widens noise without catching a distinct case.
            if (index === 0) {
                childListObserver.observe(ancestor, { childList: true, subtree: true })
            }
            parentAttributeObserver.observe(ancestor, {
                attributes: true,
                attributeFilter: ['style', 'class'],
                attributeOldValue: true
            })
        })
    }

    /**
     * If the element's ancestor chain has changed since it was last wired
     * (portal, imperative move), disconnect the stale ancestor observers and
     * re-attach to the new chain. Cheap array-of-references equality.
     */
    const rewireIfReparented = () => {
        const next = collectAncestors()
        const unchanged =
            next.length === observedAncestors.length &&
            next.every((ancestor, index) => ancestor === observedAncestors[index])
        if (unchanged) return
        // Drop every stale-chain observer and re-attach to the new chain.
        // childListObserver also carries el's own self-observation, so
        // disconnect() wipes that too — re-establish it before re-wiring.
        childListObserver.disconnect()
        parentAttributeObserver.disconnect()
        observedAncestors = next
        observeSelfChildList()
        wireAncestors()
    }

    // Wire every observer only AFTER all closures above are initialized: an
    // observer double that fires synchronously on `observe()` (used in tests)
    // would otherwise re-enter `schedule` → `rewireIfReparented` before those
    // closures exist. Real observers never fire on `observe()`.
    ro.observe(el)
    attributeObserver.observe(el, {
        attributes: true,
        attributeFilter: ['class', 'data-presence-layout-hold']
    })
    observeSelfChildList()
    wireAncestors()

    return () => {
        ro.disconnect()
        attributeObserver.disconnect()
        childListObserver.disconnect()
        parentAttributeObserver.disconnect()
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
