/**
 * Edge auto-scroll for drag-to-reorder.
 *
 * While a `Reorder.Item` drags within `threshold` px of a scrollable
 * ancestor's start/end edge, the ancestor scrolls in that direction so
 * long lists can be traversed in a single gesture.
 *
 * Port of framer-motion `Reorder/utils/auto-scroll.ts` with one
 * deliberate difference in the input: `Item.svelte` passes the pointer
 * event's CLIENT coordinate (`event.clientX`/`clientY`), while upstream's
 * `Reorder.Item` passes the gesture's page point (`info.point`) and
 * subtracts `window.scrollX/Y` here. Client = page - scroll, so the
 * subtraction is omitted.
 */

import type { DragPoint } from '$lib/types'
import { frameData } from 'motion-dom'
import type { ReorderAxis } from './types'

const threshold = 50
// Pixels per millisecond (25px per frame at 60fps)
const maxSpeed = 1.5

const overflowStyles = new Set(['auto', 'scroll'])

/**
 * Select the one axis eligible for edge auto-scroll during this drag frame.
 *
 * Two-dimensional reorder uses the dominant velocity axis so a diagonal
 * gesture never scrolls two containers at once. Ties prefer the vertical
 * axis, matching Motion 13.1.
 *
 * @param axis - The group's configured or detected reorder axis.
 * @param velocity - Current pointer velocity on both axes.
 * @returns The axis to pass to {@link autoScrollIfNeeded}.
 */
export const selectAutoScrollAxis = (axis: ReorderAxis, velocity: DragPoint): 'x' | 'y' =>
    axis === 'xy' ? (Math.abs(velocity.x) > Math.abs(velocity.y) ? 'x' : 'y') : axis

/** Which edge is currently auto-scrolling: "start" (top/left) or "end" (bottom/right). */
type ActiveEdge = 'start' | 'end' | null

interface ScrollState {
    edge: ActiveEdge
    limit: number
}

/**
 * Per axis and scrollable element, for the current drag: the edge it's
 * auto-scrolling towards, "start" (top/left) or "end" (bottom/right), and
 * its scroll limit when that began (Bug 1 fix). A drag in a Reorder.Board
 * scrolls on both axes, often of one element (like the page), and can
 * scroll several, so they're kept per axis and all cleared when it ends.
 */
const scrollStates = {
    x: new Map<HTMLElement, ScrollState>(),
    y: new Map<HTMLElement, ScrollState>()
}

/**
 * Forget every container scrolled during the drag that just ended.
 * Called from `Reorder.Item`'s `onDragEnd`.
 */
export const resetAutoScrollState = (): void => {
    scrollStates.x.clear()
    scrollStates.y.clear()
}

const isScrollableElement = (element: Element, axis: 'x' | 'y'): boolean => {
    const style = getComputedStyle(element)
    const overflow = axis === 'x' ? style.overflowX : style.overflowY

    const isDocumentScroll = element === document.body || element === document.documentElement

    /**
     * An element that scrolls on one axis computes overflow auto on both
     * (e.g. a column of a board that scrolls the other way), so it must also
     * have content to scroll on this one.
     */
    return (
        isDocumentScroll ||
        (overflowStyles.has(overflow) &&
            (axis === 'x'
                ? element.scrollWidth > element.clientWidth
                : element.scrollHeight > element.clientHeight))
    )
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
 * Speed ramps up towards the edge and is capped at maxSpeed once the
 * pointer reaches or passes it. This runs from `onDrag`, within a frame,
 * so it scales by the frame's elapsed time (`frameData.delta`) to scroll
 * at the same speed whatever the display's refresh rate.
 *
 * Port of framer-motion `Reorder/utils/auto-scroll.ts` @ v14.6.0
 * (commit `2984e9d60`, #3955).
 *
 * @param distanceFromEdge - Pointer distance inside the edge, in px; negative once past it.
 * @returns Scroll distance for this frame, in px, from 0 up to `maxSpeed × frameData.delta`.
 */
const scrollSpeed = (distanceFromEdge: number): number => {
    const intensity = Math.min(1, 1 - distanceFromEdge / threshold)
    return maxSpeed * intensity * intensity * frameData.delta
}

/**
 * Quadratic ease into `maxSpeed` as the pointer approaches the edge:
 * zero at `threshold` px away, full speed at the edge, and capped at
 * `maxSpeed × frameData.delta` px for this frame once the pointer is
 * past the edge.
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
        return { amount: -scrollSpeed(distanceFromStart), edge: 'start' }
    } else if (distanceFromEnd < threshold) {
        return { amount: scrollSpeed(distanceFromEnd), edge: 'end' }
    }

    return { amount: 0, edge: null }
}

/**
 * Scroll the group's nearest scrollable ancestor when a drag pointer
 * is inside the edge threshold and travelling toward that edge.
 * Called from `Reorder.Item`'s `onDrag` on every gesture frame.
 *
 * Port of framer-motion `Reorder/utils/auto-scroll.ts` @ v14.10.1.
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

    const scrollableAncestor = findScrollableAncestor(groupElement, axis)
    if (!scrollableAncestor) return

    const { amount: scrollAmount, edge } = getScrollAmount(
        pointerPosition,
        scrollableAncestor,
        axis
    )

    const states = scrollStates[axis]

    // Outside both threshold zones: clear this axis' state so re-entering
    // an edge re-runs the velocity gate below.
    if (edge === null) {
        states.delete(scrollableAncestor)
        return
    }

    let state = states.get(scrollableAncestor)

    const isDocumentScroll =
        scrollableAncestor === document.body || scrollableAncestor === document.documentElement

    if (state?.edge !== edge) {
        // Only start scrolling when the gesture is moving toward the
        // edge — hovering near it after dragging away shouldn't scroll.
        const shouldStart = (edge === 'start' && velocity < 0) || (edge === 'end' && velocity > 0)
        if (!shouldStart) return

        // Activate this edge, and record the initial scroll limit
        // (prevents infinite scroll)
        state = {
            edge,
            limit:
                axis === 'x'
                    ? scrollableAncestor.scrollWidth -
                      (isDocumentScroll ? window.innerWidth : scrollableAncestor.clientWidth)
                    : scrollableAncestor.scrollHeight -
                      (isDocumentScroll ? window.innerHeight : scrollableAncestor.clientHeight)
        }
        states.set(scrollableAncestor, state)
    }

    // Cap forward scrolling at the limit captured on activation.
    if (scrollAmount > 0) {
        const currentScroll =
            axis === 'x'
                ? isDocumentScroll
                    ? window.scrollX
                    : scrollableAncestor.scrollLeft
                : isDocumentScroll
                  ? window.scrollY
                  : scrollableAncestor.scrollTop
        if (currentScroll >= state.limit) return
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
