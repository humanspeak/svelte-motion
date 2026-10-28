import { microtask } from 'motion-dom'

/**
 * Scroll bases for cached layouts (plan 015a).
 *
 * svelte-motion diffs observed layout changes against CACHED page-space
 * rects, where upstream measures live in `willUpdate()`. A cached rect goes
 * stale when something moves the element's page box without a layout read:
 *
 * - a scroll container that isn't `layoutScroll` scrolls (upstream
 *   `measure()` is `measurePageBox` then `removeElementScroll`,
 *   `create-projection-node.ts` @ v14.7.1, 1105-1156, and only
 *   `layoutScroll` offsets are removed, 1126-1156; `updateScroll` records
 *   them, 1022-1043);
 * - the window scrolls under a fixed element (`measurePageBox` adds the root
 *   scroll to a fixed element's viewport box, 1105-1124);
 * - the viewport resizes (the root's resize listener, 511-532: a width change
 *   blocks updates for 250ms, 523-528 and `isUpdateBlocked` 690, and a
 *   blocked update force-measures without animating, 797-820).
 *
 * A cache is stamped with the {@link ScrollBasis} of the read that produced
 * it: the scroll offsets of every scroll container on the element's path.
 * A tracker keeps the offsets as of the last scroll event or input event
 * (`seen`), which is the scroll from before a DOM change that clamps a
 * container. {@link scrollShift} then says how far the cache has moved since.
 *
 * The ancestor walk is upstream `PopChild`'s `measurePoint`
 * (`PopChild.tsx` @ v14.7.1, 63-80): `parentElement || parentNode.host`,
 * stopping after a fixed ancestor. Scroll offsets are in their container's
 * coordinate space, so they're scaled onto the screen with `measureScale`
 * (39-46), here {@link measureScreenScale}.
 *
 * Bounds: no layout read per frame or per scroll event. A scroll event reads
 * its target's scroll offsets; an input event reads every known container's.
 * Scales are read only for terms that changed.
 *
 * Maintenance notes: the computed-style memo is never invalidated, so an
 * `overflow` or `position` change after the first walk isn't seen. `seen` is
 * the scroll as of the last resample: a programmatic scroll and a DOM change
 * in one task, with no event between them, use the older value, where
 * upstream reads live.
 */

/**
 * Says whether a scroll container's offset is already folded into the
 * measurement (a `layoutScroll` node on the measured node's path, whose
 * scroll `removeElementScroll` removes), read at the time of each delta.
 * `wasRoot` is set when one of those nodes is a scroll root (a fixed
 * `layoutScroll` node), so `measurePageBox` adds no root scroll.
 */
export type FoldedIn = ((container: Element) => boolean) & { wasRoot?: boolean }

/**
 * The scroll containers between an element and the page.
 */
export interface ScrollAncestors {
    /** Non-root scroll containers on the path, innermost first. */
    scrollers: Element[]
    /** The element or an ancestor is `position: fixed` (the walk stops there). */
    fixed: boolean
    /** A `position: sticky` node is on the path, the element included. */
    sticky: boolean
}

/**
 * The scroll state a layout read was taken in.
 */
export interface ScrollBasis {
    /** The scroll containers on the element's path, innermost first. */
    scrollers: Element[]
    /** `[scrollLeft, scrollTop]` of each of `scrollers`. */
    values: Array<[number, number]>
    /** The tracker epoch when the read was taken. */
    epoch: number
    /** The resize epoch when the read was taken. */
    resizeEpoch: number
    /** For a fixed element, the root's `[x, y]` scroll; otherwise `null`. */
    fixedRoot: [number, number] | null
    /** A sticky node is on the path: its box doesn't follow its scroller's offset. */
    unreliable: boolean
}

type Point = { x: number; y: number }

const overflowPattern = /(auto|scroll|hidden|overlay)/

const styleMemo = new WeakMap<Element, { overflow: string; position: string }>()

/**
 * The computed overflow and position of `element`, memoized. `html` and
 * `body` aren't memoized: whether they scroll depends on which of them is
 * the root scroller.
 */
const styleOf = (element: Element): { overflow: string; position: string } => {
    const memo = styleMemo.get(element)
    if (memo) return memo
    const view = element.ownerDocument.defaultView ?? window
    const computed = view.getComputedStyle(element)
    const style = {
        // jsdom reports `overflowX`/`overflowY` as `visible` for an
        // `overflow: auto` shorthand, so read all three.
        overflow: `${computed.overflow}${computed.overflowX}${computed.overflowY}`,
        position: computed.position
    }
    const doc = element.ownerDocument
    if (element !== doc.documentElement && element !== doc.body) styleMemo.set(element, style)
    return style
}

const parentOf = (node: Element): Element | null =>
    node.parentElement ?? (node.parentNode as ShadowRoot | null)?.host ?? null

const rootScroller = (doc: Document): Element => doc.scrollingElement ?? doc.documentElement

/** The document's scroll, as upstream's root node measures it (`DocumentProjectionNode`). */
const readRootScroll = (doc: Document): [number, number] => [
    doc.documentElement.scrollLeft || doc.body?.scrollLeft || 0,
    doc.documentElement.scrollTop || doc.body?.scrollTop || 0
]

/**
 * The scroll containers, fixed and sticky nodes between `element` and the
 * page.
 *
 * A scroller is any ancestor whose `overflow + overflowX + overflowY`
 * matches `auto`, `scroll`, `hidden` or `overlay` (a hidden one can still be
 * scrolled by script). The root scroller
 * (`document.scrollingElement ?? document.documentElement`) is left out, as
 * are `html` and `body` with `overflow: visible`, so a body scroller under
 * `html { overflow: hidden }` counts. The walk crosses shadow hosts and stops
 * after a fixed node.
 *
 * @param element The element whose page box is cached.
 * @returns Its scrollers (innermost first), and whether it is fixed or sticky.
 *
 * @example
 * ```ts
 * const { scrollers, fixed, sticky } = getScrollAncestors(item)
 * ```
 */
export const getScrollAncestors = (element: Element): ScrollAncestors => {
    const doc = element.ownerDocument
    const root = rootScroller(doc)
    const scrollers: Element[] = []
    let fixed = false
    let sticky = false
    for (let node: Element | null = element; node; node = parentOf(node)) {
        const { overflow, position } = styleOf(node)
        if (position === 'sticky') sticky = true
        // `visible` (`html`/`body` included) never matches.
        if (node !== element && node !== root && overflowPattern.test(overflow)) {
            scrollers.push(node)
        }
        if (position === 'fixed') {
            fixed = true
            break
        }
    }
    return { scrollers, fixed, sticky }
}

// ---- Tracker ---------------------------------------------------------------

/** `[x, y]` scroll of each container as of the last resample. */
const seen = new WeakMap<Element | Document, [number, number]>()
/** The iterable companion of `seen`, pruned when a container disconnects. */
const known = new Set<Element>()
let rootKnown: Document | null = null
let epoch = 0
let resizeEpoch = 0
let installed = false

const readScroll = (element: Element): [number, number] => [element.scrollLeft, element.scrollTop]

const resampleAll = () => {
    epoch++
    for (const container of known) {
        if (!container.isConnected) {
            known.delete(container)
            continue
        }
        seen.set(container, readScroll(container))
    }
    if (rootKnown) seen.set(rootKnown, readRootScroll(rootKnown))
}

const onScroll = (event: Event) => {
    epoch++
    const target = event.target
    if (target instanceof Document) {
        seen.set(target, readRootScroll(target))
    } else if (target instanceof Element) {
        seen.set(target, readScroll(target))
    }
}

// ---- Resize ----------------------------------------------------------------

const resizeCallbacks = new Set<() => void>()
let resizeTimer: ReturnType<typeof setTimeout> | undefined
let resizeBlocked = false
let lastWidth = 0
let lastHeight = 0

const onResize = () => {
    const width = window.innerWidth
    const height = window.innerHeight
    if (width === lastWidth && height === lastHeight) return
    // Only a width change blocks updates (create-projection-node.ts 523-528).
    if (width !== lastWidth) resizeBlocked = true
    lastWidth = width
    lastHeight = height
    resizeEpoch++
    if (resizeTimer !== undefined) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
        resizeTimer = undefined
        resizeBlocked = false
        for (const callback of [...resizeCallbacks]) callback()
    }, 250)
}

const install = () => {
    if (installed || typeof window === 'undefined') return
    installed = true
    const capture = { capture: true, passive: true }
    document.addEventListener('scroll', onScroll, capture)
    // Browsers fire `scroll` at the next rendering opportunity, so a
    // programmatic scroll followed by an input-driven change in the same
    // frame is only seen here.
    for (const type of ['pointerdown', 'keydown', 'click']) {
        window.addEventListener(type, resampleAll, capture)
    }
    lastWidth = window.innerWidth
    lastHeight = window.innerHeight
    window.addEventListener('resize', onResize)
}

const remember = (container: Element | Document, value: [number, number]) => {
    if (container instanceof Element) known.add(container)
    else rootKnown = container
    if (!seen.has(container)) seen.set(container, value)
}

/**
 * Read `element`'s scroll basis live: the scroll offsets of every container
 * on its path (and the root's, for a fixed element). Call it right after the
 * layout read the basis describes. The containers become known to the
 * tracker; a container seen for the first time starts from this value.
 *
 * @param element The element whose layout was just read.
 * @returns The basis of that read.
 *
 * @example
 * ```ts
 * const rect = element.getBoundingClientRect()
 * const basis = readScrollBasis(element)
 * ```
 */
export const readScrollBasis = (element: Element): ScrollBasis => {
    install()
    const { scrollers, fixed, sticky } = getScrollAncestors(element)
    const values = scrollers.map((container) => {
        const value = readScroll(container)
        remember(container, value)
        return value
    })
    let fixedRoot: [number, number] | null = null
    if (fixed) {
        fixedRoot = readRootScroll(element.ownerDocument)
        remember(element.ownerDocument, fixedRoot)
    }
    return { scrollers, values, epoch, resizeEpoch, fixedRoot, unreliable: sticky }
}

/**
 * `element`'s scroll basis from the tracker, as of the last resample:
 * normally the scroll from before the current DOM change. Reads no scroll
 * offset of a known container; a container the tracker hasn't seen yet is
 * read live.
 *
 * @param element The element to describe.
 * @returns The basis the tracker holds for it.
 *
 * @example
 * ```ts
 * const before = seenScrollBasis(parent)
 * // ...the DOM changes, a scroll position clamps...
 * const move = scrollDelta(before, readScrollBasis(parent), isFoldedIn)
 * ```
 */
export const seenScrollBasis = (element: Element): ScrollBasis => {
    install()
    const { scrollers, fixed, sticky } = getScrollAncestors(element)
    const values = scrollers.map((container) => {
        const value = seen.get(container)
        if (value) return value
        const live = readScroll(container)
        remember(container, live)
        return live
    })
    let fixedRoot: [number, number] | null = null
    if (fixed) {
        const doc = element.ownerDocument
        fixedRoot = seen.get(doc) ?? readRootScroll(doc)
        remember(doc, fixedRoot)
    }
    return { scrollers, values, epoch, resizeEpoch, fixedRoot, unreliable: sticky }
}

/**
 * How much an element's transforms, and its ancestors', scale it on screen.
 * Port of upstream `PopChild` `measureScale` (`PopChild.tsx` @ v14.7.1,
 * 39-46).
 *
 * @param element The element to measure; `null` reads as unscaled.
 * @returns The `[x, y]` on-screen scale, `1` where it can't be measured.
 *
 * @example
 * ```ts
 * const [sx, sy] = measureScreenScale(container)
 * ```
 */
// Maintenance note: an empty box reads as unscaled on that axis (0 / 0 is
// NaN, so `|| 1`), as upstream's arithmetic does.
export const measureScreenScale = (element?: Element | null): [number, number] => {
    const { width, height } = element?.getBoundingClientRect() || ({} as DOMRect)
    const html = element as HTMLElement | null | undefined
    return [
        width / (html?.offsetWidth as number) || 1,
        height / (html?.offsetHeight as number) || 1
    ]
}

/**
 * How far the content scrolled from `from` to `to`, on screen: the sum over
 * every scroller in both bases that isn't folded in of its offset change,
 * scaled onto the screen, minus the root's for a fixed element (whose page
 * box moves the other way, upstream `measurePageBox`). An element that
 * scrolls with the content moves by minus this on screen.
 *
 * @param from The earlier basis.
 * @param to The later basis.
 * @param isFoldedIn Containers whose scroll the measurement already removes.
 * @returns The `{ x, y }` scroll, in screen px.
 *
 * @example
 * ```ts
 * scrollDelta(before, after, () => false) // { x: 0, y: 500 } after scrolling 500px
 * ```
 */
export const scrollDelta = (from: ScrollBasis, to: ScrollBasis, isFoldedIn: FoldedIn): Point => {
    const delta = { x: 0, y: 0 }
    from.scrollers.forEach((container, i) => {
        if (isFoldedIn(container)) return
        const j = to.scrollers.indexOf(container)
        if (j < 0) return
        const dx = to.values[j][0] - from.values[i][0]
        const dy = to.values[j][1] - from.values[i][1]
        if (!dx && !dy) return
        const [sx, sy] = measureScreenScale(container)
        delta.x += dx * sx
        delta.y += dy * sy
    })
    if (from.fixedRoot && to.fixedRoot && !isFoldedIn.wasRoot) {
        delta.x -= to.fixedRoot[0] - from.fixedRoot[0]
        delta.y -= to.fixedRoot[1] - from.fixedRoot[1]
    }
    return delta
}

/**
 * How far a box cached under `basis` has moved on the page since, by
 * scrolling alone, as of the tracker's last resample.
 *
 * - `null` when the cache can't be rebased: a sticky node is on its path, or
 *   the viewport resized since (the resize refresh replaces it).
 * - `{0, 0}` when the read came after the last resample: it is a
 *   post-change read (a clamp the tracker hasn't seen yet would otherwise
 *   look like a scroll).
 * - Otherwise minus the {@link scrollDelta} from `basis` to the tracker.
 *
 * Makes no reads when the basis has no terms.
 *
 * @param basis The basis the box was read in.
 * @param isFoldedIn Containers whose scroll the measurement already removes.
 * @returns The `{ x, y }` shift to add to the box, or `null`.
 *
 * @example
 * ```ts
 * const shift = scrollShift(basis, isFoldedIn)
 * if (shift) translateAxis(box.y, shift.y)
 * ```
 */
export const scrollShift = (basis: ScrollBasis, isFoldedIn: FoldedIn): Point | null => {
    if (basis.unreliable || basis.resizeEpoch !== resizeEpoch) return null
    if (basis.epoch === epoch || (!basis.scrollers.length && !basis.fixedRoot)) {
        return { x: 0, y: 0 }
    }
    const values = basis.scrollers.map((container, i) => seen.get(container) ?? basis.values[i])
    const fixedRoot = basis.fixedRoot ? (seen.get(document) ?? basis.fixedRoot) : null
    const delta = scrollDelta(basis, { ...basis, values, fixedRoot }, isFoldedIn)
    return { x: -delta.x || 0, y: -delta.y || 0 }
}

/**
 * Resample every known container once, at the end of the current microtask
 * batch (`microtask.postRender`), after a pass that rebased a cache: the
 * caches it wrote were read after the change, so the tracker catches up.
 *
 * @returns Nothing.
 *
 * @example
 * ```ts
 * if (rebased) scheduleResample()
 * ```
 */
export const scheduleResample = (): void => {
    if (resamplePending) return
    resamplePending = true
    microtask.postRender(() => {
        resamplePending = false
        resampleAll()
    })
}
let resamplePending = false

/**
 * Whether a viewport width change is still settling: true from a resize that
 * changed `innerWidth` until 250ms after the last resize event. Upstream
 * blocks layout updates for that long (`create-projection-node.ts` @
 * v14.7.1, 523-528, `isUpdateBlocked` 690); a blocked update measures
 * without animating (797-820).
 *
 * @returns Whether layout animations should be skipped.
 *
 * @example
 * ```ts
 * if (isResizeBlocked()) adapter.refreshLayout({ silent: true })
 * ```
 */
export const isResizeBlocked = (): boolean => resizeBlocked

/**
 * Call `callback` 250ms after the last resize event that changed the
 * viewport size, so each cached layout is refreshed once per resize gesture.
 *
 * @param callback Refreshes one cached layout.
 * @returns Unsubscribes.
 *
 * @example
 * ```ts
 * const off = onResizeSettled(() => adapter.refreshLayout({ silent: true }))
 * ```
 */
export const onResizeSettled = (callback: () => void): (() => void) => {
    install()
    resizeCallbacks.add(callback)
    return () => {
        resizeCallbacks.delete(callback)
    }
}

// ---- Moved from presence.ts (popLayout's clone placement) -------------------

/**
 * A scroll container's offsets, captured to detect scrolls between a
 * snapshot and its use.
 */
export type ScrollSnapshot = {
    element: HTMLElement
    scrollLeft: number
    scrollTop: number
}

/**
 * Whether `element` scrolls: it overflows and its overflow scrolls.
 *
 * @param element The candidate container.
 * @returns Whether it can scroll.
 */
export const canElementScroll = (element: HTMLElement): boolean => {
    const computed = getComputedStyle(element)
    const overflow = `${computed.overflow}${computed.overflowX}${computed.overflowY}`
    const canScroll =
        element.scrollHeight > element.clientHeight + 1 ||
        element.scrollWidth > element.clientWidth + 1

    return canScroll && /(auto|scroll|overlay)/.test(overflow)
}

/**
 * The scroll offsets of `element`'s scrollable ancestors, or the document's
 * when it has none.
 *
 * @param element The element.
 * @returns One snapshot per scrollable ancestor.
 */
export const captureScrollSnapshot = (element: HTMLElement): ScrollSnapshot[] => {
    const snapshots: ScrollSnapshot[] = []
    const doc = element.ownerDocument
    let parent = element.parentElement

    while (parent && parent !== doc.body && parent !== doc.documentElement) {
        if (canElementScroll(parent)) {
            snapshots.push({
                element: parent,
                scrollLeft: parent.scrollLeft,
                scrollTop: parent.scrollTop
            })
        }

        parent = parent.parentElement
    }

    const scrollingElement = doc.scrollingElement
    if (snapshots.length === 0 && scrollingElement instanceof HTMLElement) {
        snapshots.push({
            element: scrollingElement,
            scrollLeft: scrollingElement.scrollLeft,
            scrollTop: scrollingElement.scrollTop
        })
    }

    return snapshots
}

/**
 * How far the snapshotted containers have scrolled since.
 *
 * @param snapshots From {@link captureScrollSnapshot}.
 * @returns The summed `{ left, top }` scroll.
 */
export const measureScrollDelta = (snapshots: ScrollSnapshot[]): { left: number; top: number } => {
    return snapshots.reduce(
        (delta, snapshot) => {
            if (!snapshot.element.isConnected) return delta

            return {
                left: delta.left + snapshot.element.scrollLeft - snapshot.scrollLeft,
                top: delta.top + snapshot.element.scrollTop - snapshot.scrollTop
            }
        },
        { left: 0, top: 0 }
    )
}

/**
 * Move a viewport rect by a scroll delta.
 *
 * @param rect The rect captured before the scroll.
 * @param delta The scroll since ({@link measureScrollDelta}).
 * @returns The rect where it is now.
 */
export const translateRectByScrollDelta = (
    rect: DOMRect,
    delta: { left: number; top: number }
): DOMRect => {
    return new DOMRect(rect.left - delta.left, rect.top - delta.top, rect.width, rect.height)
}
