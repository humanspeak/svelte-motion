/**
 * Auto-scroll the nearest scrollable ancestor when a Reorder.Item is
 * dragged near a viewport edge. Direct port of framer-motion's
 * `Reorder/utils/auto-scroll.ts` — same threshold (50px), same easing
 * curve (quadratic intensity), same max speed (25px/frame), and the
 * same anti-runaway initial-scroll-limit cap.
 *
 * The state lives in module-scope `WeakMap`s keyed by the scrollable
 * element so multiple Reorder.Groups on a page don't fight over the
 * same accumulator. `resetAutoScrollState` is called on drag end to
 * clear the dragging-group's edge accumulator.
 */

const threshold = 50
const maxSpeed = 25

const overflowStyles = new Set(['auto', 'scroll'])

const initialScrollLimits = new WeakMap<HTMLElement, number>()

type ActiveEdge = 'start' | 'end' | null
const activeScrollEdge = new WeakMap<HTMLElement, ActiveEdge>()

let currentGroupElement: Element | null = null

export const resetAutoScrollState = (): void => {
    if (!currentGroupElement) return
    const sy = findScrollableAncestor(currentGroupElement, 'y')
    if (sy) {
        activeScrollEdge.delete(sy)
        initialScrollLimits.delete(sy)
    }
    const sx = findScrollableAncestor(currentGroupElement, 'x')
    if (sx && sx !== sy) {
        activeScrollEdge.delete(sx)
        initialScrollLimits.delete(sx)
    }
    currentGroupElement = null
}

const isScrollableElement = (element: Element, axis: 'x' | 'y'): boolean => {
    const style = getComputedStyle(element)
    const overflow = axis === 'x' ? style.overflowX : style.overflowY
    const isDocumentScroll = element === document.body || element === document.documentElement
    return overflowStyles.has(overflow) || isDocumentScroll
}

const findScrollableAncestor = (element: Element | null, axis: 'x' | 'y'): HTMLElement | null => {
    let current = element?.parentElement
    while (current) {
        if (isScrollableElement(current, axis)) return current
        current = current.parentElement
    }
    return null
}

const getScrollAmount = (
    pointerPosition: number,
    scrollElement: HTMLElement,
    axis: 'x' | 'y'
): { amount: number; edge: ActiveEdge } => {
    const rect = scrollElement.getBoundingClientRect()
    const start = axis === 'x' ? Math.max(0, rect.left) : Math.max(0, rect.top)
    const end =
        axis === 'x'
            ? Math.min(window.innerWidth, rect.right)
            : Math.min(window.innerHeight, rect.bottom)

    const distFromStart = pointerPosition - start
    const distFromEnd = end - pointerPosition

    if (distFromStart < threshold) {
        const intensity = 1 - distFromStart / threshold
        return { amount: -maxSpeed * intensity * intensity, edge: 'start' }
    }
    if (distFromEnd < threshold) {
        const intensity = 1 - distFromEnd / threshold
        return { amount: maxSpeed * intensity * intensity, edge: 'end' }
    }
    return { amount: 0, edge: null }
}

export const autoScrollIfNeeded = (
    groupElement: Element | null,
    pointerPosition: number,
    axis: 'x' | 'y',
    velocity: number
): void => {
    if (!groupElement) return
    currentGroupElement = groupElement

    const scrollable = findScrollableAncestor(groupElement, axis)
    if (!scrollable) return

    // Drag info uses page coords; getBoundingClientRect returns viewport
    // coords. Convert to apples-to-apples.
    const viewportPointerPosition =
        pointerPosition - (axis === 'x' ? window.scrollX : window.scrollY)

    const { amount, edge } = getScrollAmount(viewportPointerPosition, scrollable, axis)

    if (edge === null) {
        activeScrollEdge.delete(scrollable)
        initialScrollLimits.delete(scrollable)
        return
    }

    const currentEdge = activeScrollEdge.get(scrollable)
    const isDocumentScroll = scrollable === document.body || scrollable === document.documentElement

    if (currentEdge !== edge) {
        // Only engage if velocity actually pushes toward the edge — stops
        // a stationary item at the threshold from runaway-scrolling.
        const shouldStart = (edge === 'start' && velocity < 0) || (edge === 'end' && velocity > 0)
        if (!shouldStart) return

        activeScrollEdge.set(scrollable, edge)

        const maxScroll =
            axis === 'x'
                ? scrollable.scrollWidth -
                  (isDocumentScroll ? window.innerWidth : scrollable.clientWidth)
                : scrollable.scrollHeight -
                  (isDocumentScroll ? window.innerHeight : scrollable.clientHeight)
        initialScrollLimits.set(scrollable, maxScroll)
    }

    // Cap to initial limit so we don't keep growing the scroll surface.
    if (amount > 0) {
        const initialLimit = initialScrollLimits.get(scrollable)!
        const currentScroll =
            axis === 'x'
                ? isDocumentScroll
                    ? window.scrollX
                    : scrollable.scrollLeft
                : isDocumentScroll
                  ? window.scrollY
                  : scrollable.scrollTop
        if (currentScroll >= initialLimit) return
    }

    if (axis === 'x') {
        if (isDocumentScroll) window.scrollBy({ left: amount })
        else scrollable.scrollLeft += amount
    } else {
        if (isDocumentScroll) window.scrollBy({ top: amount })
        else scrollable.scrollTop += amount
    }
}
