/**
 * Read-free "did this element move?" watcher (plan 008 Step 3b).
 *
 * The IntersectionObserver layout-shift technique from floating-ui's
 * `autoUpdate({ layoutShift })` (`observeMove`): shrink the observer's root,
 * via `rootMargin` insets, to exactly the element's last known viewport rect
 * and watch with `threshold: 1`. While the element stays put it fills that
 * root completely; a move of ≥1px drops the intersection ratio below 1 and
 * the browser calls back. The entry carries the new `boundingClientRect`, so
 * re-arming needs no `getBoundingClientRect()` call either. Unlike
 * floating-ui, which re-reads the element on every refresh, this watcher
 * never reads layout itself: the initial rect comes from a plain observer's
 * first entry, and every later rect from the entries.
 */

/** Minimal rect shape the watcher needs. `DOMRectReadOnly` satisfies it. */
export interface MoveRect {
    left: number
    top: number
    width: number
    height: number
}

/**
 * The `rootMargin` that shrinks a `rootWidth` × `rootHeight` viewport to
 * `rect`. Insets are floored, as floating-ui does, so the root never ends up
 * a sub-pixel larger than the element (the ratio would then never reach 1).
 * An element outside the viewport gets a positive margin that grows the root
 * out to it, so off-screen elements are watched too.
 *
 * @param rect The element's last known viewport rect.
 * @param rootWidth Viewport width (`documentElement.clientWidth`).
 * @param rootHeight Viewport height (`documentElement.clientHeight`).
 * @returns A CSS margin string: top, right, bottom, left.
 *
 * @example
 * ```ts
 * moveRootMargin({ left: 10, top: 20, width: 100, height: 50 }, 800, 600)
 * // '-20px -690px -530px -10px'
 * ```
 */
export const moveRootMargin = (rect: MoveRect, rootWidth: number, rootHeight: number): string => {
    const top = Math.floor(rect.top)
    const right = Math.floor(rootWidth - (rect.left + rect.width))
    const bottom = Math.floor(rootHeight - (rect.top + rect.height))
    const left = Math.floor(rect.left)
    return `${-top}px ${-right}px ${-bottom}px ${-left}px`
}

const sameRect = (a: MoveRect, b: MoveRect) =>
    a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height

/**
 * Call `onMove` whenever `element`'s viewport rect changes, without ever
 * calling `getBoundingClientRect()`.
 *
 * Fires for any on-screen movement: layout shifts, window or container
 * scrolls, transforms. Callers that only care about layout moves filter in
 * `onMove`. It never fires while nothing moves. A zero-size element can't be
 * watched (its intersection ratio is undefined) and is left unwatched until
 * the next arm. A no-op where `IntersectionObserver` doesn't exist (SSR,
 * jsdom).
 *
 * @param element Element to watch.
 * @param onMove Called with the element's new viewport rect after it moved.
 * @returns Stop watching.
 *
 * @example
 * ```ts
 * const stop = observeMove(element, (rect) => refreshCachedLayout(rect))
 * // later
 * stop()
 * ```
 */
export const observeMove = (
    element: Element,
    onMove: (rect: DOMRectReadOnly) => void
): (() => void) => {
    if (typeof IntersectionObserver === 'undefined') return () => {}
    const root = element.ownerDocument.documentElement
    let io: IntersectionObserver | null = null
    let retry: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const disconnect = () => {
        clearTimeout(retry)
        io?.disconnect()
        io = null
    }

    const observe = (callback: IntersectionObserverCallback, init: IntersectionObserverInit) => {
        try {
            // A `document` root makes `rootMargin` apply inside iframes too.
            io = new IntersectionObserver(callback, { ...init, root: element.ownerDocument })
        } catch {
            // Older engines reject a document root.
            io = new IntersectionObserver(callback, init)
        }
        io.observe(element)
    }

    /** Watch for the element leaving `rect`, the rect it was last seen at. */
    const arm = (rect: MoveRect, threshold = 1) => {
        disconnect()
        if (stopped || !rect.width || !rect.height) return
        let isFirst = true
        observe(
            (entries) => {
                const entry = entries[entries.length - 1]
                const next = entry.boundingClientRect
                const ratio = entry.intersectionRatio
                const first = isFirst
                isFirst = false
                if (!sameRect(next, rect)) {
                    // Moved (possibly before this observer's first check).
                    onMove(next)
                    arm(next)
                    return
                }
                if (ratio === threshold) return
                if (!first) {
                    // Same rect, different clipping: re-arm at the new ratio.
                    arm(next, ratio || 1)
                    return
                }
                if (ratio) {
                    // Partly clipped in place (e.g. by a scroll container):
                    // watch for that ratio changing instead.
                    arm(next, ratio)
                } else {
                    // Fully clipped: nothing to intersect. Retry later,
                    // throttled so it can't spin (floating-ui does the same).
                    retry = setTimeout(() => arm(next, 1e-7), 1000)
                }
            },
            {
                rootMargin: moveRootMargin(rect, root.clientWidth, root.clientHeight),
                threshold: Math.max(0, Math.min(1, threshold)) || 1
            }
        )
    }

    // Initial rect from a plain observer's first entry: no layout read here.
    observe(
        (entries) => {
            const entry = entries[entries.length - 1]
            arm(entry.boundingClientRect)
        },
        { threshold: 0 }
    )

    return () => {
        stopped = true
        disconnect()
    }
}
