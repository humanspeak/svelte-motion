import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'

/**
 * Measure an element's bounding client rect without current transform.
 *
 * Temporarily clears `transform` to avoid skewing measurements, restoring it
 * immediately after reading the rect.
 *
 * When `scrollContainer` is provided, the returned rect is shifted into that
 * container's scroll coordinate space (i.e. its `scrollLeft` / `scrollTop`
 * are added to `left` / `top`). FLIP deltas computed from two such measures
 * stay correct even when the user scrolls the container between measurements.
 *
 * Without a `scrollContainer`, behaviour is unchanged: viewport-relative rect.
 *
 * @param el Element to measure.
 * @param scrollContainer Optional ancestor with `layoutScroll` enabled.
 * @return DOMRect snapshot of the element.
 */
export const measureRect = (el: HTMLElement, scrollContainer?: HTMLElement): DOMRect => {
    const prev = el.style.transform
    try {
        el.style.transform = 'none'
        const rect = el.getBoundingClientRect()
        if (!scrollContainer) return rect
        // Re-express the rect in scroll-container coordinates so a subsequent
        // scroll between measurements doesn't show up as movement. We can't
        // assign to a DOMRect's left/top, so allocate a fresh DOMRect.
        const { scrollLeft, scrollTop } = scrollContainer
        return new DOMRect(rect.left + scrollLeft, rect.top + scrollTop, rect.width, rect.height)
    } finally {
        el.style.transform = prev
    }
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
    prev: DOMRect,
    next: DOMRect,
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

    animate(el, keyframes as unknown as DOMKeyframesDefinition, transition)
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
        if (pendingRaf !== null || releaseTimeout !== null) return
        // Leading-edge: call immediately, then throttle further calls until next frame (or 50ms)
        onChange()
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            pendingRaf = window.requestAnimationFrame(() => {
                pendingRaf = null
            })
        } else {
            releaseTimeout = setTimeout(() => {
                releaseTimeout = null
            }, 50)
        }
    }
    const ro = new ResizeObserver(() => schedule())
    ro.observe(el)
    const mo = new MutationObserver(() => schedule())
    mo.observe(el, { attributes: true, attributeFilter: ['class', 'style'] })
    if (el.parentElement) {
        mo.observe(el.parentElement, { childList: true, subtree: false, attributes: true })
    }
    return () => {
        ro.disconnect()
        mo.disconnect()
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
