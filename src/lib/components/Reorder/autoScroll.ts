/**
 * Edge auto-scroll for drag-to-reorder.
 *
 * While a `Reorder.Item` drags within `threshold` px of a scrollable
 * ancestor's start/end edge, the ancestor scrolls in that direction so
 * long lists can be traversed in a single gesture.
 *
 * Port of framer-motion `Reorder/utils/auto-scroll.ts` with one
 * deliberate difference: our `DragInfo.point` carries CLIENT
 * coordinates (see `drag.ts`, which reads `clientX`/`clientY`), while
 * upstream's gesture point is page coordinates — so the upstream
 * `window.scrollX/Y` subtraction is omitted here.
 */

const threshold = 50
const maxSpeed = 25

const overflowStyles = new Set(['auto', 'scroll'])

/**
 * Scroll limits captured when an edge first activates, so a gesture
 * can't grow the scroll range it started with (e.g. when scrolling
 * itself triggers layout that extends the scrollable area).
 */
const initialScrollLimits = new WeakMap<HTMLElement, number>()

/** Which edge is currently auto-scrolling: "start" (top/left) or "end" (bottom/right). */
type ActiveEdge = 'start' | 'end' | null
const activeScrollEdge = new WeakMap<HTMLElement, ActiveEdge>()

/** Group element of the in-flight drag, so `resetAutoScrollState` can clear per-ancestor state. */
let currentGroupElement: Element | null = null

/**
 * Clear all auto-scroll bookkeeping for the group involved in the
 * gesture that just ended. Called from `Reorder.Item`'s `onDragEnd`.
 */
export const resetAutoScrollState = (): void => {
    if (currentGroupElement) {
        const scrollableAncestor = findScrollableAncestor(currentGroupElement, 'y')
        if (scrollableAncestor) {
            activeScrollEdge.delete(scrollableAncestor)
            initialScrollLimits.delete(scrollableAncestor)
        }
        const scrollableAncestorX = findScrollableAncestor(currentGroupElement, 'x')
        if (scrollableAncestorX && scrollableAncestorX !== scrollableAncestor) {
            activeScrollEdge.delete(scrollableAncestorX)
            initialScrollLimits.delete(scrollableAncestorX)
        }
        currentGroupElement = null
    }
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
        if (isScrollableElement(current, axis)) {
            return current
        }
        current = current.parentElement
    }
    return null
}

/**
 * Quadratic ease into `maxSpeed` as the pointer approaches the edge:
 * zero at `threshold` px away, full speed at the edge itself.
 */
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

    const distanceFromStart = pointerPosition - start
    const distanceFromEnd = end - pointerPosition

    if (distanceFromStart < threshold) {
        const intensity = 1 - distanceFromStart / threshold
        return { amount: -maxSpeed * intensity * intensity, edge: 'start' }
    } else if (distanceFromEnd < threshold) {
        const intensity = 1 - distanceFromEnd / threshold
        return { amount: maxSpeed * intensity * intensity, edge: 'end' }
    }

    return { amount: 0, edge: null }
}

/**
 * Scroll the group's nearest scrollable ancestor when a drag pointer
 * is inside the edge threshold and travelling toward that edge.
 * Called from `Reorder.Item`'s `onDrag` on every gesture frame.
 *
 * @param groupElement - The `Reorder.Group` element the item belongs to.
 * @param pointerPosition - Pointer position on `axis`, in client coordinates.
 * @param axis - The group's reorder axis.
 * @param velocity - Pointer velocity on `axis`; scrolling only starts when it points at the edge.
 */
export const autoScrollIfNeeded = (
    groupElement: Element | null,
    pointerPosition: number,
    axis: 'x' | 'y',
    velocity: number
): void => {
    if (!groupElement) return

    currentGroupElement = groupElement

    const scrollableAncestor = findScrollableAncestor(groupElement, axis)
    if (!scrollableAncestor) return

    const { amount: scrollAmount, edge } = getScrollAmount(
        pointerPosition,
        scrollableAncestor,
        axis
    )

    // Outside both threshold zones: clear state so re-entering an edge
    // re-runs the velocity gate below.
    if (edge === null) {
        activeScrollEdge.delete(scrollableAncestor)
        initialScrollLimits.delete(scrollableAncestor)
        return
    }

    const currentActiveEdge = activeScrollEdge.get(scrollableAncestor)

    const isDocumentScroll =
        scrollableAncestor === document.body || scrollableAncestor === document.documentElement

    if (currentActiveEdge !== edge) {
        // Only start scrolling when the gesture is moving toward the
        // edge — hovering near it after dragging away shouldn't scroll.
        const shouldStart = (edge === 'start' && velocity < 0) || (edge === 'end' && velocity > 0)
        if (!shouldStart) return

        activeScrollEdge.set(scrollableAncestor, edge)

        const maxScroll =
            axis === 'x'
                ? scrollableAncestor.scrollWidth -
                  (isDocumentScroll ? window.innerWidth : scrollableAncestor.clientWidth)
                : scrollableAncestor.scrollHeight -
                  (isDocumentScroll ? window.innerHeight : scrollableAncestor.clientHeight)

        initialScrollLimits.set(scrollableAncestor, maxScroll)
    }

    // Cap forward scrolling at the limit captured on activation.
    if (scrollAmount > 0) {
        const initialLimit = initialScrollLimits.get(scrollableAncestor)!
        const currentScroll =
            axis === 'x'
                ? isDocumentScroll
                    ? window.scrollX
                    : scrollableAncestor.scrollLeft
                : isDocumentScroll
                  ? window.scrollY
                  : scrollableAncestor.scrollTop
        if (currentScroll >= initialLimit) return
    }

    if (axis === 'x') {
        if (isDocumentScroll) {
            window.scrollBy({ left: scrollAmount })
        } else {
            scrollableAncestor.scrollLeft += scrollAmount
        }
    } else {
        if (isDocumentScroll) {
            window.scrollBy({ top: scrollAmount })
        } else {
            scrollableAncestor.scrollTop += scrollAmount
        }
    }
}
