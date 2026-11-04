import type { AnimatePresenceMode, MotionExit, MotionTransition } from '$lib/types'
import { mergeTransitions } from '$lib/utils/animation'
import { layoutParentOf, markExiting, type ExitMarker } from '$lib/utils/layout'
import { holdLayoutIdHandoffs } from '$lib/utils/layoutId'
import { pwLog } from '$lib/utils/log'
import { MotionDomProjectionAdapter, type ExitLayoutHold } from '$lib/utils/motionDomProjection'
import {
    captureScrollSnapshot,
    holdsFixedDescendants,
    measureScreenScale,
    measureScrollDelta,
    translateRectByScrollDelta,
    type ScrollSnapshot
} from '$lib/utils/scrollBasis'
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
import {
    cancelFrame,
    frame,
    microtask,
    readTransformValue,
    transformPropOrder,
    transformProps,
    visualElementStore,
    type PresenceContextProps
} from 'motion-dom'
import { getContext, setContext, tick } from 'svelte'
import { createSubscriber } from 'svelte/reactivity'

/**
 * Context key for `AnimatePresence`.
 *
 * Used with Svelte's context API to provide/register presence management.
 */
const ANIMATE_PRESENCE_CONTEXT = Symbol('animate-presence-context')

/**
 * Context key for tracking nesting depth within AnimatePresence.
 *
 * Used to enforce key requirements only on direct children (depth 0),
 * matching Framer Motion behavior where only immediate children need keys.
 */
const PRESENCE_DEPTH_CONTEXT = Symbol('presence-depth-context')

/**
 * Internal record for a registered presence child.
 *
 * Tracks its element, last known layout/style snapshot, and exit definition
 * so we can create a visually accurate clone on unmount and animate it out.
 */
type PresenceChild = {
    element: HTMLElement
    exit?: MotionExit
    resolveExit?: PresenceExitResolver
    mergedTransition?: MotionTransition
    lastRect: DOMRect
    /**
     * Every computed property, captured as STRINGS while the element was
     * still connected — what the exit clone freezes onto itself. Never keep
     * the `CSSStyleDeclaration` itself: it is live, and once Svelte detaches
     * the node (keyed `{#each}` and `{#if}` both detach before unregister)
     * every property on it reads back as ''.
     *
     * Refreshed event-driven, never per animation frame: at registration,
     * when an attribute on the element changes (see `observeStyleChanges`),
     * and on the settle frame after an animation (`updateChildState`).
     */
    lastStyleSnapshot: ComputedStyleSnapshot
    /**
     * Layout fields captured as STRINGS while the element was still connected,
     * for out-of-flow detection and the exit placeholder (margins, display,
     * flex/grid placement). Cheap enough to refresh on every animating frame.
     */
    lastLayoutStyle: LayoutStyleSnapshot
    /** Stops the attribute watcher that keeps `lastStyleSnapshot` fresh. */
    stopObservingStyle?: () => void
    lastPopLayoutSnapshot?: PopLayoutSnapshot
    /**
     * `mode="popLayout"`: follows where the element rests, for the exit's
     * "before" point (see `createPopLayoutPointCache`).
     */
    popPointCache?: ReturnType<typeof createPopLayoutPointCache>
    /**
     * The element's parent captured at registration. The exit placeholder is
     * inserted here when the element is already detached — even a
     * `display: contents` parent (e.g. AnimatePresence's container) works,
     * since its children still occupy their slots in the grandparent's
     * grid/flex layout in DOM order.
     */
    insertionParent?: HTMLElement
    /**
     * The element's nearest `LayoutGroup` node group (plan 015b): its exit
     * clone's completion re-renders that group.
     */
    layoutGroup?: object
    /**
     * Plan 012: hands the element's projection node to its exit clone, so
     * the clone is held until the shared layout animation releases it.
     */
    layoutHandOff?: PresenceLayoutHandOff
    /**
     * The element's next sibling captured while it was still connected.
     * Svelte detaches keyed nodes before `unregisterChild` runs, so the exit
     * placeholder can't anchor on the element itself — it anchors on this
     * sibling (walking past siblings that detached in the same update) to
     * land in the exiting element's real layout slot.
     */
    lastNextSibling?: Element | null
    hasScrollableAncestor: boolean
    lastScrollSnapshot: ScrollSnapshot[]
    /** Last captured mid-animation opacity (from rAF polling). */
    lastAnimatedOpacity?: string
    /** Last captured mid-animation transform (from rAF polling). */
    lastAnimatedTransform?: string
    /**
     * The element's running animations at the last animating frame (plan 012
     * A2): a detached element reports none, so a held clone takes them over
     * from here.
     */
    lastAnimations?: Animation[]
}

/**
 * String copies of the computed-style fields an exit placeholder needs to
 * reproduce the exiting element's layout slot.
 */
type LayoutStyleSnapshot = Pick<
    CSSStyleDeclaration,
    | 'position'
    | 'display'
    | 'margin'
    | 'boxSizing'
    | 'flex'
    | 'alignSelf'
    | 'gridColumnStart'
    | 'gridColumnEnd'
    | 'gridRowStart'
    | 'gridRowEnd'
    | 'width'
    | 'height'
    | 'top'
    | 'right'
    | 'bottom'
    | 'left'
>

/**
 * Copy the placeholder-relevant layout fields out of a computed style.
 *
 * A `CSSStyleDeclaration` from `getComputedStyle` is live: once its element
 * is detached every property reads back as `''`. Snapshotting the values as
 * plain strings while the element is connected keeps them usable after
 * Svelte detaches a keyed node ahead of `unregisterChild`.
 *
 * @param style The computed style of a connected element.
 * @returns A detached, plain-string copy of the layout fields.
 */
const snapshotLayoutStyle = (style: CSSStyleDeclaration): LayoutStyleSnapshot => ({
    position: style.position,
    display: style.display,
    margin: style.margin,
    boxSizing: style.boxSizing,
    flex: style.flex,
    alignSelf: style.alignSelf,
    gridColumnStart: style.gridColumnStart,
    gridColumnEnd: style.gridColumnEnd,
    gridRowStart: style.gridRowStart,
    gridRowEnd: style.gridRowEnd,
    // Plan 012: the used, untransformed size and insets, for held clones and
    // placeholders (no transform or integer rounding, unlike a rect).
    width: style.width,
    height: style.height,
    top: style.top,
    right: style.right,
    bottom: style.bottom,
    left: style.left
})

/**
 * Plain-string copy of every computed property of an element, keyed by
 * property name. Computed declarations never carry an `!important` priority,
 * so the value alone is enough to re-apply them.
 */
export type ComputedStyleSnapshot = Record<string, string>

/**
 * Copy every computed property out of a (live) computed style as strings.
 *
 * The result stays valid after the element is detached, unlike the
 * `CSSStyleDeclaration` it was read from. Serializing every property costs a
 * few hundred string reads, so callers take it on discrete events
 * (registration, attribute changes, animation settle) — never per frame.
 *
 * @param style The computed style of a connected element.
 * @param element Optional connected element used to preserve line-height inheritance.
 * @returns A detached property → value map; empty values are omitted.
 * @example
 * ```ts
 * const snapshot = snapshotComputedStyle(getComputedStyle(element), element)
 * snapshot['background-color'] // 'rgb(43, 89, 195)', even after detach
 * ```
 */
export const snapshotComputedStyle = (
    style: CSSStyleDeclaration,
    element?: HTMLElement
): ComputedStyleSnapshot => {
    const snapshot: ComputedStyleSnapshot = {}
    for (let i = 0; i < style.length; i += 1) {
        const prop = style[i]
        const value = style.getPropertyValue(prop)
        if (value) snapshot[prop] = value
    }
    if (element) {
        const lineHeight = snapshotLineHeight(element, style)
        if (lineHeight) snapshot['line-height'] = lineHeight
        else delete snapshot['line-height']
    }
    return snapshot
}

/** Attribute identifying a temporary, non-rendered inheritance probe. */
const STYLE_PROBE_ATTRIBUTE = 'data-presence-style-probe'

/**
 * Capture the root's line height without converting inherited numbers to pixels.
 *
 * Typed OM exposes the computed number directly. Without it (Firefox), the
 * root's undisplayed `::after` inherits its value at twice its font size: only
 * a unitless line height doubles. The probe rule and attribute are removed
 * synchronously; no element is inserted, so no child's selectors change.
 *
 * @param element The connected presence child.
 * @param style Its computed style before the probe is applied.
 * @returns The inheritable CSS value, or undefined when it must remain stylesheet-driven.
 */
const snapshotLineHeight = (
    element: HTMLElement,
    style: CSSStyleDeclaration
): string | undefined => {
    const lineHeight = style.lineHeight
    if (!lineHeight || lineHeight === 'normal') return lineHeight
    if (typeof element.computedStyleMap === 'function') {
        const value = element.computedStyleMap().get('line-height')
        if (value) return value.toString()
    }
    const fontSize = parseFloat(style.fontSize)
    const usedHeight = parseFloat(lineHeight)
    if (
        !element.isConnected ||
        !Number.isFinite(fontSize) ||
        fontSize <= 0 ||
        !Number.isFinite(usedHeight)
    )
        return lineHeight
    if (usedHeight === 0) return '0'
    // Probe through the root's own ::after, never a child element: a child,
    // even an undisplayed one, flips :empty, :last-child, and :nth-* on the
    // root's children and can start their CSS transitions. The pseudo is
    // display: none, so it has no box and cannot start transitions either.
    // This also preserves ID-dependent line heights before the clone loses its ID.
    const root = element.getRootNode() as Document | ShadowRoot
    const Sheet = element.ownerDocument.defaultView?.CSSStyleSheet
    if (!Sheet || !('adoptedStyleSheets' in root)) return undefined
    const sheets = root.adoptedStyleSheets
    const marker = element.getAttribute(STYLE_PROBE_ATTRIBUTE)
    const sheet = new Sheet()
    sheet.replaceSync(
        `[${STYLE_PROBE_ATTRIBUTE}="line-height"]::after { display: none !important; font-size: ${fontSize * 2}px !important; line-height: inherit !important; }`
    )
    try {
        element.setAttribute(STYLE_PROBE_ATTRIBUTE, 'line-height')
        root.adoptedStyleSheets = [...sheets, sheet]
        const pseudo = getComputedStyle(element, '::after')
        const inheritedHeight = parseFloat(pseudo.lineHeight)
        if (parseFloat(pseudo.fontSize) !== fontSize * 2) return undefined
        return Math.abs(inheritedHeight / usedHeight - 2) < 0.0001
            ? String(inheritedHeight / (fontSize * 2))
            : lineHeight
    } finally {
        root.adoptedStyleSheets = sheets
        if (marker === null) element.removeAttribute(STYLE_PROBE_ATTRIBUTE)
        else element.setAttribute(STYLE_PROBE_ATTRIBUTE, marker)
    }
}

/**
 * Identify the probe's own attribute toggle so snapshot observers cannot retrigger themselves.
 *
 * @param record An observed DOM mutation.
 * @returns Whether the mutation is the temporary style-probe attribute.
 */
const isStyleProbeMutation = (record: MutationRecord): boolean =>
    record.type === 'attributes' && record.attributeName === STYLE_PROBE_ATTRIBUTE

/**
 * Keep a presence child's style snapshot fresh while it is connected.
 *
 * Watches the element's attributes and descendant structure/state changes that
 * can restyle the root through structural selectors.
 * Non-style attribute and descendant structure changes re-snapshot immediately.
 * Root `style` writes can arrive every frame (JS-driven animations render
 * inline styles), so they are coalesced: the snapshot is taken only once a
 * whole frame has passed without a further `style` write.
 *
 * @param element The registered presence child.
 * @param onChange Takes the snapshot; only called while `element` is connected.
 * @returns A function that stops watching and cancels any pending snapshot.
 * @example
 * ```ts
 * const stop = observeStyleChanges(element, () => {
 *     record.lastStyleSnapshot = snapshotComputedStyle(getComputedStyle(element), element)
 * })
 * ```
 */
export const observeStyleChanges = (element: HTMLElement, onChange: () => void): (() => void) => {
    if (typeof MutationObserver === 'undefined') return () => {}

    let settling = false
    let frameId = 0
    let styleWritten = false

    const snapshotIfConnected = () => {
        if (element.isConnected) onChange()
    }
    // Snapshot only when the interval between two consecutive frames saw no
    // `style` write, whatever order our callback and the animation's own
    // frame callback run in.
    const settleStyleWrites = () => {
        if (!settling) return
        if (styleWritten) {
            styleWritten = false
            frameId = requestAnimationFrame(settleStyleWrites)
            return
        }
        settling = false
        snapshotIfConnected()
    }

    const observer = new MutationObserver((records) => {
        const changes = records.filter(
            (record) =>
                !isStyleProbeMutation(record) &&
                // Descendant animations must not delay the root's own snapshot.
                (record.attributeName !== 'style' || record.target === element)
        )
        if (changes.length === 0) return
        if (changes.some((record) => record.attributeName !== 'style')) {
            snapshotIfConnected()
            return
        }
        styleWritten = true
        if (settling) return
        settling = true
        frameId = requestAnimationFrame(settleStyleWrites)
    })
    observer.observe(element, { attributes: true, childList: true, subtree: true })

    return () => {
        observer.disconnect()
        if (settling) cancelAnimationFrame(frameId)
        settling = false
    }
}

/**
 * The values an exit clone was showing when its key re-entered, handed to the
 * re-entering element so it animates back from there (upstream reverses the
 * exit on the same element instead of starting a fresh enter).
 */
export type ExitHandoff = {
    /** Each exit key's value on the clone at the moment of re-entry. */
    from: Record<string, string | number>
    /** Each exit key's value before the exit started (its pre-exit look). */
    base: Record<string, string | number>
}

const nonValueExitKeys = new Set(['transition', 'transitionEnd', 'ease'])

/**
 * Read the current value of each animated key from an element, in the units
 * Motion animates them in: transform shorthands (`x`, `scale`, `rotate`, …)
 * are decomposed from the computed matrix the way Motion's own DOM keyframe
 * resolver does (`readTransformValue`); `opacity` is a number; any other
 * property is its computed string.
 *
 * @param element The element to read (connected).
 * @param keys Motion value keys, camelCase or CSS custom properties.
 * @returns Key → current value; keys with no readable value are omitted.
 * @example
 * ```ts
 * readAnimatedValues(clone, ['opacity', 'x']) // { opacity: 0.53, x: 12 }
 * ```
 */
export const readAnimatedValues = (
    element: HTMLElement,
    keys: string[]
): Record<string, string | number> => {
    const values: Record<string, string | number> = {}
    const style = getComputedStyle(element)
    for (const key of keys) {
        if (nonValueExitKeys.has(key)) continue
        if (transformProps.has(key)) {
            values[key] = readTransformValue(element, key)
            continue
        }
        const cssName = key.startsWith('--')
            ? key
            : key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
        const value = style.getPropertyValue(cssName).trim()
        if (!value) continue
        values[key] = key === 'opacity' ? Number(value) : value
    }
    return values
}

/**
 * A measured `popLayout` box in the same coordinate space used by Motion's
 * upstream `PopChild`.
 */
export type PopLayoutSnapshot = {
    /** Width of the exiting element in pixels. */
    width: number
    /** Height of the exiting element in pixels. */
    height: number
    /** Offset from the top of the element's offset parent. */
    top: number
    /** Offset from the left of the element's offset parent. */
    left: number
    /** Offset from the right of the element's offset parent. */
    right: number
    /** Offset from the bottom of the element's offset parent. */
    bottom: number
    /** Resolved text direction used by horizontal anchoring. */
    direction: string
    /**
     * Position in the space the element scrolls in, in its offsetParent's
     * coordinate space (upstream `measurePoint`). Compared after the pop to
     * detect the container moving.
     */
    point: [number, number]
}

/**
 * Anchor used to preserve horizontal positioning in `mode="popLayout"`.
 */
export type PopLayoutAnchorX = 'left' | 'right'

/**
 * Anchor used to preserve vertical positioning in `mode="popLayout"`.
 */
export type PopLayoutAnchorY = 'top' | 'bottom'

/**
 * How `mode="popLayout"` pins an exiting element, from the
 * `<AnimatePresence anchorX anchorY root>` props.
 */
export type PopLayoutOptions = {
    /** The horizontal edge the popped element is pinned by. */
    anchorX: PopLayoutAnchorX
    /** The vertical edge the popped element is pinned by. */
    anchorY: PopLayoutAnchorY
    /**
     * Where the pop `<style>` is appended. Defaults to the head of the
     * element's own document; pass a shadow root to use it in shadow DOM.
     */
    root?: HTMLElement | ShadowRoot
}

const isHTMLElement = (element: Element | null): element is HTMLElement =>
    element instanceof HTMLElement

const statefulCloneContentSelector = 'canvas, iframe, video, audio'

/**
 * Determine whether cloning an exit subtree would visibly lose live state.
 *
 * `cloneNode(true)` copies markup but not canvas pixels, browsing contexts, or
 * active media playback state. In those cases an immediate removal is less
 * misleading than animating a blank or reset ghost.
 *
 * @param element The prospective exit-clone root.
 * @returns Whether the root or one of its descendants contains stateful media.
 */
export const containsStatefulCloneContent = (element: Element): boolean =>
    element.matches(statefulCloneContentSelector) ||
    element.querySelector(statefulCloneContentSelector) !== null

const readNumericStyle = (value: string, fallback: () => number): number => {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : fallback()
}

/** Elements {@link suppressScrollAnchoring} holds, with their own inline value. */
const anchoringSuppressions = new WeakMap<HTMLElement, { count: number; inline: string }>()

/**
 * Keep the browser from scroll-anchoring around an exit clone hand-off
 * (plan 012 A6): `overflow-anchor: none` on `element` until the second
 * animation frame, so the first frame's layout after the swap makes no
 * adjustment. Overlapping calls share one hold; the element's own inline
 * value comes back when the last one ends, unless the app wrote its own
 * value in the meantime.
 *
 * Upstream keeps the real element in place, so its clamp of a scrolled
 * container is the only scroll change an exit makes. The clone path removes
 * the element and inserts its clone, and the frame after a `popLayout` pop
 * the browser re-anchors the container to where its content sat before the
 * clamp, once the siblings' layout transforms extend the overflow again
 * (550 → 620 in `tests/animate-presence/pop-layout-scroll-siblings`
 * `?layoutScroll`). Suppressing anchoring on the clone's layout parent for
 * that frame leaves the clamp as upstream's; a compensating scroll write
 * would fight the browser and any scroll in progress.
 *
 * @param element The clone's layout parent (it generates a box).
 * @returns Nothing.
 *
 * @example
 * ```ts
 * parent.insertBefore(clone, slot)
 * suppressScrollAnchoring(layoutParentOf(parent, true))
 * ```
 */
export const suppressScrollAnchoring = (element: HTMLElement): void => {
    const held = anchoringSuppressions.get(element)
    if (held) {
        held.count += 1
    } else {
        anchoringSuppressions.set(element, { count: 1, inline: element.style.overflowAnchor })
        element.style.overflowAnchor = 'none'
    }
    const release = () => {
        const hold = anchoringSuppressions.get(element)
        if (!hold || --hold.count > 0) return
        anchoringSuppressions.delete(element)
        // A value the app wrote during the hold is its own; keep it.
        if (element.style.overflowAnchor === 'none') element.style.overflowAnchor = hold.inline
    }
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => requestAnimationFrame(release))
    } else {
        setTimeout(release, 32)
    }
}

/**
 * Remove what a nested `AnimatePresence` had in flight from a fresh exit
 * clone (plan 012, N3): copies of its own exit clones and placeholders, which
 * tear down with the subtree, and copied `data-layout-size-animation` marks
 * (the size animation runs on the detached original, and a copied mark would
 * hide the clone from part D, plan 015b E11).
 *
 * @param clone The exit clone, straight from `cloneNode(true)`.
 * @returns Nothing.
 */
const stripNestedExitArtifacts = (clone: HTMLElement): void => {
    for (const artifact of clone.querySelectorAll('[data-clone], [data-presence-placeholder]')) {
        artifact.remove()
    }
    clone.removeAttribute('data-layout-size-animation')
    for (const marked of clone.querySelectorAll('[data-layout-size-animation]')) {
        marked.removeAttribute('data-layout-size-animation')
    }
}

/**
 * The horizontal and vertical padding plus border of a computed style, for a
 * `content-box` element's border box.
 *
 * @param style A computed-style snapshot.
 * @returns `[horizontal, vertical]` px.
 */
const borderAndPadding = (style: ComputedStyleSnapshot): [number, number] => {
    const px = (prop: string) => parseFloat(style[prop] ?? '') || 0
    return [
        px('padding-left') +
            px('padding-right') +
            px('border-left-width') +
            px('border-right-width'),
        px('padding-top') +
            px('padding-bottom') +
            px('border-top-width') +
            px('border-bottom-width')
    ]
}

/** A camelCase style key as its CSS property (`marginLeft` → `margin-left`). */
const toCssProperty = (key: string): string =>
    key.startsWith('--') ? key : key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)

/**
 * A computed `margin` shorthand as `[top, right, bottom, left]` px, by the CSS
 * 1-4 value rules.
 *
 * @param margin The computed shorthand, e.g. `'0px 0px 0px 10px'`.
 * @returns The four sides; non-lengths read as 0.
 */
const expandMargin = (margin: string): [number, number, number, number] => {
    const values = (margin || '0')
        .trim()
        .split(/\s+/)
        .map((v) => parseFloat(v) || 0)
    const [top, right = top, bottom = top, left = right] = values
    return [top, right, bottom, left]
}

/**
 * The box an absolutely positioned clone in `slot` is placed against (plan
 * 012): from `slot` itself up, skipping `display: contents`, the first
 * positioned element or containing block of fixed boxes, else the initial
 * containing block. Reads only, in the caller's read pass.
 *
 * @param slot The clone's slot parent.
 * @returns The block's viewport left/top, its border, scroll and on-screen scale.
 */
const measureContainingBlock = (slot: HTMLElement) => {
    const doc = slot.ownerDocument
    const view = doc.defaultView ?? window
    for (
        let node: HTMLElement | null = slot;
        node && node !== doc.documentElement;
        node = node.parentElement
    ) {
        const style = view.getComputedStyle(node)
        if (style.display === 'contents') continue
        if (style.position !== 'static' || holdsFixedDescendants(node)) {
            const rect = node.getBoundingClientRect()
            return {
                left: rect.left,
                top: rect.top,
                clientLeft: node.clientLeft,
                clientTop: node.clientTop,
                scrollLeft: node.scrollLeft,
                scrollTop: node.scrollTop,
                scale: measurePopLayoutScale(node)
            }
        }
    }
    return {
        left: -view.scrollX,
        top: -view.scrollY,
        clientLeft: 0,
        clientTop: 0,
        scrollLeft: 0,
        scrollTop: 0,
        scale: [1, 1] as [number, number]
    }
}

/**
 * How much an element's transforms, and its ancestors', scale it on screen.
 * Port of upstream `PopChild` `measureScale` @ v14.7.1.
 *
 * @param element The element to measure; `null` reads as unscaled.
 * @returns The `[x, y]` on-screen scale, `1` where it can't be measured.
 */
// Maintenance note: an empty box reads as unscaled on that axis (0 / 0 is
// NaN, so `|| 1`). Popping the last item of a scaled fixed list leaves the
// list 0px tall, so its y-scale reads as 1 and that item's correction is off
// by the scale. Upstream has the same arithmetic (`PopChild.tsx` @ v14.7.1,
// lines 41-44); kept for parity.
export const measurePopLayoutScale = (element?: HTMLElement | null): [number, number] =>
    measureScreenScale(element)

/**
 * The element's position in the space it scrolls in, as the projection
 * system measures it: its viewport position, plus its scroll containers'
 * scroll (across shadow roots), plus the window's. Like the projection's
 * scroll roots, a fixed ancestor stops the walk: it doesn't scroll with
 * anything above it, so a fixed container is measured relative to the
 * viewport. So a scroll position clamped by content shrinking reads as the
 * element moving only if it doesn't scroll with that content.
 *
 * Scroll offsets are in their container's coordinate space, so are scaled
 * onto the screen, and the result is returned in the offsetParent's
 * coordinate space, which the pop offsets are in. Port of upstream
 * `PopChild` `measurePoint` @ v14.7.1 (#2348).
 *
 * @param element The element to measure.
 * @returns The `[left, top]` point in the offsetParent's coordinate space.
 */
export const measurePopLayoutPoint = (element: HTMLElement): [number, number] => {
    const view = element.ownerDocument.defaultView ?? window
    let { left, top } = element.getBoundingClientRect()
    let node: HTMLElement | null | undefined = element
    while (
        (node = (node.parentElement || (node.parentNode as ShadowRoot | null)?.host) as
            HTMLElement | null | undefined)
    ) {
        const { scrollLeft, scrollTop } = node
        if (scrollLeft || scrollTop) {
            const [x, y] = measurePopLayoutScale(node)
            left += scrollLeft * x
            top += scrollTop * y
        }
        if (view.getComputedStyle(node).position === 'fixed') break
    }
    const [x, y] = measurePopLayoutScale(element.offsetParent as HTMLElement | null)
    return [left / x, top / y]
}

/**
 * Measure an element for `mode="popLayout"` using upstream Motion's coordinate
 * model: offsets are the raw `offsetTop` / `offsetLeft` against
 * `offsetParent`, as upstream `PopChild` snapshots them, not viewport
 * coordinates. `point` is the element's position in the space it scrolls in
 * ({@link measurePopLayoutPoint}); measured again after the pop, it is what
 * detects the container moving ({@link schedulePopLayoutCorrection}).
 *
 * @param element The exiting element to measure while it is still in layout.
 * @param computedStyle The computed style for the exiting element.
 * @returns A snapshot that can be reapplied to an absolutely positioned exit node.
 */
export const measurePopLayoutSnapshot = (
    element: HTMLElement,
    computedStyle: CSSStyleDeclaration = getComputedStyle(element)
): PopLayoutSnapshot => {
    const parent = element.offsetParent
    const parentWidth = isHTMLElement(parent) ? parent.offsetWidth || 0 : 0
    const parentHeight = isHTMLElement(parent) ? parent.offsetHeight || 0 : 0
    // Only read the rect when the computed size isn't a length: every
    // element's reads must stay ahead of every correction's writes.
    const width = readNumericStyle(
        computedStyle.width,
        () => element.offsetWidth || element.getBoundingClientRect().width
    )
    const height = readNumericStyle(
        computedStyle.height,
        () => element.offsetHeight || element.getBoundingClientRect().height
    )
    const top = element.offsetTop
    const left = element.offsetLeft

    return {
        width,
        height,
        top,
        left,
        right: parentWidth - width - left,
        bottom: parentHeight - height - top,
        direction: computedStyle.direction || 'ltr',
        point: measurePopLayoutPoint(element)
    }
}

/**
 * Whether {@link measurePopLayoutPoint} stays put when anything scrolls, so
 * a cached point needs no scroll re-sample.
 *
 * The point adds every scrolling ancestor's scroll up to the first
 * `position: fixed` ancestor. That is scroll-invariant, unless that fixed
 * ancestor still scrolls (a transformed, filtered or contained ancestor is
 * its containing block), or the walk meets a sticky ancestor, or the element
 * itself is fixed or sticky: those can't be classified, so they re-sample.
 *
 * @param element The element whose point is cached.
 * @returns `true` when scrolling can't move its point.
 */
export const popLayoutPointFollowsScroll = (element: HTMLElement): boolean => {
    const view = element.ownerDocument.defaultView ?? window
    const parentOf = (node: HTMLElement) =>
        (node.parentElement || (node.parentNode as ShadowRoot | null)?.host) as
            HTMLElement | null | undefined
    const own = view.getComputedStyle(element).position
    if (own === 'fixed' || own === 'sticky') return false
    for (let node = parentOf(element); node; node = parentOf(node)) {
        const position = view.getComputedStyle(node).position
        if (position === 'sticky') return false
        if (position !== 'fixed') continue
        for (let ancestor = parentOf(node); ancestor; ancestor = parentOf(ancestor)) {
            if (holdsFixedDescendants(ancestor)) return false
        }
        return true
    }
    return true
}

/**
 * Caches where an owned `popLayout` element rests, for {@link PopLayoutSnapshot}'s
 * "before" `point`.
 *
 * Upstream reads that point in `getSnapshotBeforeUpdate` (`PopChild.tsx` @
 * v14.7.1, lines 87-111), before React commits any DOM change. Svelte has no
 * such hook: by `PresenceChild`'s `$effect.pre`, a sibling added in the same
 * update (a toast list's "remove the oldest, add one") is already in the DOM,
 * so a live measurement reads the element where the grown container has
 * moved it. So the point is measured while the element rests: when it is
 * tracked, then again whenever its own box, its container's box or subtree,
 * or the document's box changes, sampling once a frame until it stops moving
 * (so a layout animation that follows the change is followed to rest). The
 * container is the closest ancestor with a box: `AnimatePresence` wraps its
 * children in a `display: contents` element, which never resizes. At rest
 * nothing is sampled.
 *
 * Scrolling usually needs no re-sample: the point adds every scrolling
 * ancestor's scroll, so it doesn't move when they scroll. Except when the walk
 * stops early, at a `position: fixed` ancestor that still scrolls because a
 * transformed (or filtered, or contained) ancestor is its containing block, or
 * when it meets something it can't classify (a sticky ancestor, or the element
 * itself fixed or sticky). Only then does a capturing scroll listener on the
 * document re-sample it ({@link popLayoutPointFollowsScroll}). The class is
 * read when tracking starts; an ancestor transform added later isn't seen. A
 * move that changes none of the observed boxes and scrolls nothing (for
 * instance a transform written on an ancestor) is not seen either; the cache
 * then holds the last resting point.
 *
 * Samples run in motion-dom's frameloop read step (`frame.read`), with the
 * other layout reads of that frame.
 *
 * @returns `track` (start following an element, or stop with `undefined`),
 *     `read` (the cached point of a connected element), `peek` (the last
 *     point, even once the element is detached) and `dispose`.
 */
export const createPopLayoutPointCache = () => {
    let element: HTMLElement | undefined
    let point: [number, number] | undefined
    let framesLeft = 0
    let stableFrames = 0
    let resizeObserver: ResizeObserver | undefined
    let mutationObserver: MutationObserver | undefined
    let scrollTarget: Document | undefined
    let resizeView: Window | undefined
    // About five seconds at 60fps: long enough for a spring layout animation
    // to settle. Maintenance note: an element whose transform keeps moving
    // (an infinite or very long animation) stops being followed here and
    // leaves a stale point; upstream measures live, in getSnapshotBeforeUpdate.
    const maxFrames = 300

    // `scheduled` says whether a sample is pending; `run` is the queued
    // process, kept to cancel it.
    let scheduled = false
    const run = () => {
        scheduled = false
        sample()
    }
    const schedule = () => {
        if (scheduled) return
        scheduled = true
        frame.read(run)
    }

    const sample = () => {
        if (!element?.isConnected) return
        const next = measurePopLayoutPoint(element)
        // Tight: a spring's tail moves well under a pixel a frame for a while.
        const moved =
            !point || Math.abs(next[0] - point[0]) > 0.01 || Math.abs(next[1] - point[1]) > 0.01
        point = next
        stableFrames = moved ? 0 : stableFrames + 1
        if (stableFrames < 2 && --framesLeft > 0) schedule()
    }

    const refresh = () => {
        framesLeft = maxFrames
        stableFrames = 0
        schedule()
    }

    const stop = () => {
        if (scheduled) cancelFrame(run)
        scheduled = false
        resizeObserver?.disconnect()
        mutationObserver?.disconnect()
        resizeObserver = undefined
        mutationObserver = undefined
        scrollTarget?.removeEventListener('scroll', refresh, true)
        scrollTarget = undefined
        resizeView?.removeEventListener('resize', refresh)
        resizeView = undefined
        element = undefined
        point = undefined
    }

    return {
        /**
         * Follow `next`'s resting point, or stop following with `undefined`.
         *
         * @param next The element `mode="popLayout"` would pop.
         */
        track(next: HTMLElement | undefined): void {
            if (next === element) return
            stop()
            if (!next?.isConnected) return
            element = next
            point = measurePopLayoutPoint(next)
            const view = next.ownerDocument.defaultView ?? window
            let container = next.parentElement
            while (container && view.getComputedStyle(container).display === 'contents') {
                container = container.parentElement
            }
            if (typeof ResizeObserver !== 'undefined') {
                resizeObserver = new ResizeObserver(refresh)
                resizeObserver.observe(next)
                if (container) resizeObserver.observe(container)
                resizeObserver.observe(next.ownerDocument.documentElement)
            }
            if (container && typeof MutationObserver !== 'undefined') {
                mutationObserver = new MutationObserver(refresh)
                mutationObserver.observe(container, { childList: true, subtree: true })
            }
            if (!popLayoutPointFollowsScroll(next)) {
                scrollTarget = next.ownerDocument
                scrollTarget.addEventListener('scroll', refresh, { capture: true, passive: true })
            }
            // A viewport resize can move the element (a fixed, bottom-anchored
            // list) without resizing any observed box; upstream measures fresh
            // after every resize (plan 012 A2).
            resizeView = view
            view.addEventListener('resize', refresh)
            // The element may still be settling (an enter or layout animation).
            refresh()
        },
        /**
         * The cached resting point of `target`.
         *
         * @param target The element about to pop.
         * @returns Its last resting point, or `undefined` if it isn't tracked.
         */
        read(target: HTMLElement): [number, number] | undefined {
            return target === element && target.isConnected && point
                ? [point[0], point[1]]
                : undefined
        },
        /**
         * The last resting point recorded for `target`, connected or not (the
         * clone path reads it after Svelte has detached the element).
         *
         * @param target The element about to pop.
         * @returns Its last resting point, or `undefined` if it isn't tracked.
         */
        peek(target: HTMLElement): [number, number] | undefined {
            return target === element && point ? [point[0], point[1]] : undefined
        },
        dispose: stop
    }
}

/**
 * Offset a popped element back when popping it moved the container it is
 * pinned to (#2348): a bottom-anchored or centred container shrinks around
 * its remaining children, and the element, pinned to its edges, moves with
 * it. Port of upstream `PopChild` @ v14.7.1.
 *
 * Runs on motion-dom's `microtask` frameloop, so once the whole update is in
 * the DOM and before paint. Upstream: "Every popped element is measured in
 * its first step, then corrected at the start of the read step: before the
 * projection system, which schedules its layout measurement there from layout
 * effects, so layout animations see the corrected position." The projection
 * queues its update with `microtask.read` from `didUpdate`, after this is
 * scheduled in the same flush.
 *
 * @param element The popped node to measure after the update (the owned
 *     element, or the exit clone, which sits in the element's slot).
 * @param snapshot The pre-pop snapshot. Its offsets are corrected in place,
 *     so pass a copy if the caller keeps it.
 * @param isActive Whether the pop is still applied when the correction runs.
 * @param reapply Re-applies the pop with the corrected snapshot.
 */
export const schedulePopLayoutCorrection = (
    element: HTMLElement,
    snapshot: PopLayoutSnapshot,
    isActive: () => boolean,
    reapply: (snapshot: PopLayoutSnapshot) => void
): void => {
    let dx = 0
    let dy = 0
    microtask.setup(() => {
        const [x, y] = measurePopLayoutPoint(element)
        dx = snapshot.point[0] - x
        dy = snapshot.point[1] - y
    })
    microtask.read(() => {
        if (!isActive() || (!dx && !dy)) return
        snapshot.left += dx
        snapshot.right -= dx
        snapshot.top += dy
        snapshot.bottom -= dy
        reapply(snapshot)
    })
}

/**
 * Convert a `popLayout` snapshot to absolute-positioned clone styles.
 *
 * @param snapshot The snapshot captured before the child exited.
 * @param anchorX The horizontal edge to preserve.
 * @param anchorY The vertical edge to preserve.
 * @returns Inline styles equivalent to upstream `PopChild`'s injected rule.
 */
export const resolvePopLayoutStyles = (
    snapshot: PopLayoutSnapshot,
    anchorX: PopLayoutAnchorX = 'left',
    anchorY: PopLayoutAnchorY = 'top'
): Partial<CSSStyleDeclaration> => {
    const isRTL = snapshot.direction === 'rtl'
    const useLeft = anchorX === 'left' ? !isRTL : isRTL
    const xProperty = useLeft ? 'left' : 'right'
    const xValue = useLeft ? snapshot.left : snapshot.right
    const yProperty = anchorY === 'bottom' ? 'bottom' : 'top'
    const yValue = anchorY === 'bottom' ? snapshot.bottom : snapshot.top

    return {
        position: 'absolute',
        width: `${snapshot.width}px`,
        height: `${snapshot.height}px`,
        [xProperty]: `${xValue}px`,
        [yProperty]: `${yValue}px`
    }
}

/**
 * Resolves an exiting child's keyframes with the nearest
 * `<AnimatePresence custom>` value.
 *
 * @param custom Data supplied by `<AnimatePresence custom={...}>`.
 * @returns The resolved exit keyframes, or `undefined` when no exit applies.
 */
export type PresenceExitResolver = (custom: unknown) => DOMKeyframesDefinition | undefined

/**
 * Reset any CSS transforms on the element's inline style.
 *
 * Ensures the exiting clone is not additionally offset or scaled by an
 * inherited transform. Applies to standard and vendor-prefixed properties.
 *
 * @param element The element whose inline transform properties should be cleared.
 */
const resetTransforms = (element: HTMLElement): void => {
    const s = element.style as CSSStyleDeclaration & {
        webkitTransform?: string
        msTransform?: string
        MozTransform?: string
        OTransform?: string
    }
    s.transform = 'none'
    s.webkitTransform = 'none'
    s.msTransform = 'none'
    s.MozTransform = 'none'
    s.OTransform = 'none'
}

/**
 * Exits a clone walk started on a propagating boundary's children (plan
 * 012), keyed by the child's original element. The nested boundary's own
 * `unregisterChild` for that child finds no slot (its subtree went with the
 * outer clone) and counts the exit from here, so its `onExitComplete` fires
 * once the child has exited, as upstream's boundary stays mounted until then
 * (`AnimatePresence/index.tsx:171-179`).
 */
const propagatedExits = new WeakMap<Element, Promise<unknown>>()

const isExitArtifact = (element: Element) =>
    element.hasAttribute('data-clone') || element.hasAttribute('data-presence-placeholder')

type ExitAnimationState = { setActive(type: 'exit', isActive: boolean): Promise<unknown> }

/** Whether a WAAPI animation animates `transform`. */
const hasTransformKeyframes = (animation: Animation): boolean =>
    !!(animation.effect as KeyframeEffect | null)
        ?.getKeyframes()
        .some((keyframe) => 'transform' in keyframe)

/**
 * Keep an exiting element's running animations going on its held clone (plan
 * 012 A2), as upstream keeps animating the exiting element itself.
 *
 * Every running WAAPI animation on the element moves to the clone
 * (`effect.target = clone`), which keeps its timing and its compositor
 * thread. Motion keeps the same `Animation` objects, so its `stop()` and
 * `cancel()` still reach them. Its accelerated transforms are tracked in a
 * group keyed by the element, which never sees the clone, so when a moved
 * transform animation ends, the tracks that were running on it are completed
 * here: their motion values land on their final values and the
 * VisualElement renders them on the clone.
 *
 * The hand-off's update pass measures the clone. Upstream moves accelerated
 * transforms off the compositor before a measurement (`willUpdate`,
 * create-projection-node.ts @ v14.7.1); the moved ones are detached for that
 * read step instead, which keeps their timing, and put back before the
 * frame renders, as `stripToBaseTransforms` does.
 *
 * A detached element reports no animations, so `animations` are the ones the
 * motion element captured on its last animating frame.
 *
 * @param element The detached element, still the VisualElement's `current`.
 * @param clone Its exit clone, connected.
 * @param animations The element's animations at its last animating frame.
 * @param sharedLayout The element has a `layoutId`: its node relegates, so
 *     its accelerated transforms move to the main thread instead (plan 012 A3).
 */
const continueAnimationsOnClone = (
    element: HTMLElement,
    clone: HTMLElement,
    animations: Animation[],
    sharedLayout = false
): void => {
    const running = animations.filter(
        (animation) =>
            animation.playState === 'running' &&
            (animation.effect as KeyframeEffect | null)?.target === element
    )
    if (!running.length) return
    if (sharedLayout && running.some(hasTransformKeyframes)) {
        // A `layoutId` node relegates and follows the new lead, so the
        // projection owns its transform: upstream's `willUpdate` moves the
        // node's accelerated transforms to the main thread before it is
        // measured (`demoteTransforms`, create-projection-node.ts:129-131,
        // 744-750 @ v14.7.1), and they then render through the node. A new
        // `onUpdate` does that here (`VisualElement.update`), while the
        // VisualElement's `current` is still the element its group is keyed
        // by; their motion values are synced from the compositor first.
        const visualElement = visualElementStore.get(element) as
            | {
                  getProps(): Record<string, unknown>
                  presenceContext: unknown
                  update(props: unknown, presenceContext: unknown): void
              }
            | undefined
        if (visualElement && !visualElement.getProps().onUpdate) {
            const props = visualElement.getProps()
            const context = visualElement.presenceContext
            visualElement.update({ ...props, onUpdate: () => {} }, context)
            visualElement.update(props, context)
        }
        for (const animation of running) {
            if (hasTransformKeyframes(animation)) continue
            const effect = animation.effect as KeyframeEffect
            if (effect.target === element) effect.target = clone
        }
        return
    }
    const transforms: KeyframeEffect[] = []
    for (const animation of running) {
        const effect = animation.effect as KeyframeEffect
        effect.target = clone
        if (effect.getKeyframes().some((keyframe) => 'transform' in keyframe)) {
            transforms.push(effect)
        }
    }
    if (!transforms.length) return
    microtask.setup(() => {
        for (const effect of transforms) effect.target = null
    })
    microtask.preUpdate(() => {
        for (const effect of transforms) effect.target = clone
    })
    type Track = {
        complete(): void
        time: number
        duration: number
        _animation?: { tick?: (timestamp: number) => unknown }
    }
    const visualElement = visualElementStore.get(element) as
        { values: Map<string, unknown> } | undefined
    if (!visualElement) return
    type Value = {
        animation?: Track
        on(event: 'animationStart' | 'animationCancel', callback: () => void): () => void
    }
    const tracks: Array<[Value, Track]> = []
    ;(visualElement.values as Map<string, Value>).forEach((value, key) => {
        if (transformPropOrder.includes(key) && value.animation) {
            tracks.push([value, value.animation])
        }
    })
    const moved = running.filter((animation) =>
        transforms.includes(animation.effect as KeyframeEffect)
    )
    let ended = false
    // Motion stopping or replacing one of those tracks (a transform exit on
    // the clone) can't reach the moved compositor animation through its
    // group: cancel it then, so it never runs under the new one.
    const offs: Array<() => void> = []
    const release = () => {
        if (ended) return
        ended = true
        for (const off of offs) off()
        for (const animation of moved) animation.cancel()
    }
    for (const [value] of tracks) {
        offs.push(value.on('animationStart', release), value.on('animationCancel', release))
    }
    for (const animation of moved) {
        animation.finished
            .then(() => {
                if (ended) return
                ended = true
                for (const off of offs) off()
                for (const [value, track] of tracks) {
                    if (value.animation !== track) continue
                    // Its group, which would have ticked it to the end, is
                    // keyed by the element: tick it past its end here, which
                    // writes its final value and finishes it.
                    track.complete()
                    track._animation?.tick?.(performance.now() + 1e7)
                }
                // What the orphaned group still holds on the clone (its
                // static base) goes with it: the VisualElement renders now.
                for (const other of moved) if (other !== animation) other.cancel()
            })
            .catch(() => {})
    }
}

/**
 * Move every nested motion node of an exiting child to its copy in the exit
 * clone (plan 012), as upstream keeps every nested node mounted with its
 * element until the exit completes (each nested `MeasureLayout` has its own
 * `usePresence`, `MeasureLayout.tsx:246-260` @ v14.7.1).
 *
 * The original subtree and the clone are walked side by side (the clone's
 * nested exit artifacts are already stripped, so they are skipped here too).
 * In scope means no non-`propagate` `AnimatePresence` lies between the child
 * and the node (`index.tsx:213-217`: only `propagate` passes an exit down).
 *
 * - `held` (the child itself is held): an in-scope node that measures layout
 *   relegates and holds like the child; any other node is only re-pointed.
 * - Every clone: a direct motion child of an in-scope `propagate` boundary
 *   is re-pointed and runs its own exit (`exit.ts:58`), which the clone waits
 *   for.
 *
 * @param original The detached child element.
 * @param clone Its exit clone.
 * @param held Whether the child itself was handed off.
 * @param join Adds a hold (and, with `settles`, one flag it releases) or an
 *     exit promise to the clone's completion.
 */
const rehomeDescendants = (
    original: HTMLElement,
    clone: HTMLElement,
    held: boolean,
    join: (entry: {
        hold?: ExitLayoutHold
        settles?: boolean
        exit?: Promise<unknown>
    }) => (() => void) | void
): void => {
    const visit = (from: Element, to: Element, inScope: boolean, underPropagate: boolean) => {
        const fromChildren = Array.from(from.children).filter((el) => !isExitArtifact(el))
        const toChildren = Array.from(to.children)
        const count = Math.min(fromChildren.length, toChildren.length)
        for (let i = 0; i < count; i++) {
            const o = fromChildren[i]
            const c = toChildren[i] as HTMLElement
            let childInScope = inScope
            let childUnderPropagate = underPropagate
            if (o.classList.contains('animate-presence-container')) {
                const propagates = o.hasAttribute('data-propagate')
                childInScope = inScope && propagates
                childUnderPropagate = childInScope
            }
            const visualElement = visualElementStore.get(o) as
                (VisualElementLike & { animationState?: ExitAnimationState }) | undefined
            if (visualElement && o instanceof HTMLElement) {
                const propagating = underPropagate && inScope
                const adapter = MotionDomProjectionAdapter.adapterFor(visualElement.projection)
                if (held || propagating) {
                    if (adapter?.isMounted) {
                        const exiting = held && childInScope && adapter.measuresLayout
                        let settle: (() => void) | void = undefined
                        const hold = adapter.handOffToExitClone(c, () => settle?.(), { exiting })
                        if (hold) settle = join({ hold, settles: exiting })
                    } else if (visualElement.current === o) {
                        visualElement.current = c
                        visualElementStore.delete(o)
                        visualElementStore.set(c, visualElement as never)
                        join({
                            hold: {
                                cancel: () => visualElement.unmount(),
                                finish: () => visualElement.unmount()
                            }
                        })
                    }
                }
                if (propagating && visualElement.animationState) {
                    const exit = visualElement.animationState.setActive('exit', true)
                    propagatedExits.set(o, exit)
                    join({ exit })
                }
                // Below a motion node, a boundary's children aren't its
                // direct motion children any more.
                visit(o, c, childInScope, false)
                continue
            }
            visit(o, c, childInScope, childUnderPropagate)
        }
    }
    visit(original, clone, true, false)
}

type VisualElementLike = {
    current: unknown
    projection?: object
    unmount(): void
}

/**
 * How a motion element hands its projection node to its exit clone (plan 012).
 * Passed by the element as `registerChild`'s last argument.
 *
 * @example
 * ```ts
 * context.registerChild(key, element, exit, transition, resolveExit, group, {
 *     canHandOff: () => adapter.isMounted && !adapter.isHandedOff,
 *     ownedLayoutKeys: () => new Set(['width']),
 *     handOff: (clone, release) => adapter.handOffToExitClone(clone, release)
 * })
 * ```
 */
export type PresenceLayoutHandOff = {
    /**
     * Whether the element's node can be handed off: it measures layout
     * (upstream renders `MeasureLayout`), is mounted and isn't handed off
     * yet. Read during the element's teardown.
     */
    canHandOff(): boolean
    /**
     * The layout keys (`top`, `width`, `marginLeft`, `padding`, …, camelCase)
     * the element's VisualElement writes as `style` motion values. The clone
     * leaves them to it.
     */
    ownedLayoutKeys(): ReadonlySet<string>
    /**
     * Re-point the node at `clone` and hold it.
     *
     * @param clone The exit clone, connected in the element's slot.
     * @param release Called once when the node may be removed.
     * @returns The hold, or `undefined` when nothing was handed off.
     */
    handOff(clone: HTMLElement, release: () => void): ExitLayoutHold | undefined
}

/**
 * Presence context API used by `AnimatePresence` and motion elements.
 * Consumers register/unregister children and provide size/style snapshots
 * so we can clone and animate them out after removal.
 */
export type AnimatePresenceContext = {
    /** When false, children skip their enter animation on initial mount. */
    initial: boolean
    /** Animation coordination mode: 'sync', 'wait', or 'popLayout'. */
    mode: AnimatePresenceMode
    /**
     * Read the latest `anchorX` / `anchorY` / `root` for `mode="popLayout"`.
     *
     * @returns The boundary's pop options, read at pop time.
     */
    getPopLayoutOptions: () => PopLayoutOptions
    /** Latest data passed via `<AnimatePresence custom>`. */
    readonly custom: unknown
    /** Read the latest data passed via `<AnimatePresence custom>`. */
    getCustom: () => unknown
    /**
     * Update the latest data passed via `<AnimatePresence custom>`.
     *
     * @param custom Data supplied by the parent presence boundary.
     */
    setCustom: (custom: unknown) => void
    /**
     * Returns true if a child with the given key should animate its enter.
     * Returns false only during first render when initial={false} AND the key has never been seen.
     * Re-entries (after exit) always animate.
     */
    shouldAnimateEnter: (key: string) => boolean
    /**
     * For mode='wait': Returns true if enters should be blocked by an exiting
     * or currently-present sibling.
     * Motion elements should delay their enter animation until this returns false.
     */
    isEnterBlocked: (key?: string) => boolean
    /**
     * For mode='wait': Register a callback to be invoked when enters are unblocked.
     * Returns an unsubscribe function.
     */
    onEnterUnblocked: (callback: () => void) => () => void
    /** Called when all exit animations complete (optional). */
    onExitComplete?: () => void
    /** Register a child element and its exit definition. */
    registerChild: (
        key: string,
        element: HTMLElement,
        exit?: MotionExit,
        mergedTransition?: MotionTransition,
        resolveExit?: PresenceExitResolver,
        layoutGroup?: object,
        layoutHandOff?: PresenceLayoutHandOff
    ) => void
    /**
     * Update the last known rect/style snapshot for a registered child.
     *
     * @param key The child's presence key.
     * @param rect The child's current bounding rect.
     * @param computedStyle The child's (connected) computed style.
     * @param settled Pass `true` on the frame an animation comes to rest to
     *   also refresh the full computed-style snapshot the exit clone freezes.
     *   Leave unset on per-frame calls: that snapshot is too costly per frame.
     */
    updateChildState: (
        key: string,
        rect: DOMRect,
        computedStyle: CSSStyleDeclaration,
        settled?: boolean
    ) => void
    /**
     * Update the last captured mid-animation style values for a child.
     *
     * @param key The child's presence key.
     * @param opacity Its computed opacity.
     * @param transform Its computed transform.
     * @param animations Its running animations (`getAnimations()`), which a
     *   held exit clone takes over (plan 012).
     */
    updateChildAnimatedStyle: (
        key: string,
        opacity: string,
        transform: string,
        animations?: Animation[]
    ) => void
    /** Unregister a child. If it has an exit, clone and animate it out. */
    unregisterChild: (key: string) => void
    /**
     * Dispose the owning boundary without completing its cancelled exits.
     *
     * Stops observers and animations, removes exit clones/placeholders, and
     * prevents descendant teardown or queued work from starting new exits.
     */
    dispose: () => void
    /**
     * Claim the in-flight exit of `key` for a re-entering element.
     *
     * When a key comes back while its exit clone is still animating out,
     * upstream keeps the SAME element and reverses the exit from its current
     * values. The clone path can't keep the element, so the re-entering one
     * takes over instead: this stops the exit, removes the clone (no overlap)
     * and returns the values it was showing, for the new element to start
     * from. The reversed exit does not count as completed, so
     * `onExitComplete` does not fire for it.
     *
     * @param key The re-entering child's presence key.
     * @returns The clone's current and pre-exit values, or `undefined` when
     *   no exit is in flight for `key`.
     */
    takeExitHandoff: (key: string) => ExitHandoff | undefined
    /**
     * @internal Used by `PresenceChild` to participate in the same exit
     * accounting as the clone-based motion-element exit path. Increments the
     * in-flight exit counter and applies mode='wait' enter blocking. Not
     * intended for direct consumer use.
     */
    notifyExitStart: () => void
    /**
     * @internal Pairs with `notifyExitStart`. Decrements the in-flight exit
     * counter, fires `onExitComplete` once it reaches zero, and unblocks
     * pending enters in mode='wait'. Not intended for direct consumer use.
     */
    notifyExitComplete: () => void
}

/**
 * Create a new `AnimatePresence` context instance.
 *
 * - Maintains a registry of children keyed by a unique string.
 * - On unregister, if a child has an `exit` definition, a visual clone is
 *   created at its last known position and animated using Motion.
 *
 * @param context Optional callbacks, e.g. `onExitComplete`.
 * @returns An object implementing the `AnimatePresenceContext` API.
 */
/**
 * Create a new `AnimatePresence` context instance.
 *
 * Manages child registration and on unregistration performs exit animation by
 * cloning the DOM node, freezing its last known rect/styles, and animating
 * the clone using Motion. Calls `onExitComplete` once when all exits settle.
 *
 * @param context Optional callbacks, for example `onExitComplete`.
 * @returns A presence context with register/update/unregister APIs.
 */
export const createAnimatePresenceContext = (context: {
    initial?: boolean
    mode?: AnimatePresenceMode
    onExitComplete?: () => void
    /**
     * The nearest `<LayoutGroup>`'s `forceRender`, called once every exit
     * has completed so the group's members re-measure the freed space
     * (upstream AnimatePresence `forceRender?.()` on `isEveryExitComplete`).
     */
    forceRender?: () => void
    custom?: unknown
    getCustom?: () => unknown
    /** Horizontal `popLayout` anchor, when no `getPopLayoutOptions` is given. */
    anchorX?: PopLayoutAnchorX
    /** Vertical `popLayout` anchor, when no `getPopLayoutOptions` is given. */
    anchorY?: PopLayoutAnchorY
    /**
     * Reads the latest `popLayout` options at pop time (upstream passes them
     * to every `PopChild` on each render). Wins over `anchorX` / `anchorY`.
     */
    getPopLayoutOptions?: () => PopLayoutOptions
}): AnimatePresenceContext => {
    let disposed = false
    // Default initial to true (animate on first mount) unless explicitly false
    const initial = context.initial !== false

    // Default mode to 'sync' if not specified
    const mode: AnimatePresenceMode = context.mode ?? 'sync'
    let latestCustom = context.custom
    const customSubscribers = new Set<() => void>()
    const trackCustom = createSubscriber((update) => {
        customSubscribers.add(update)
        return () => customSubscribers.delete(update)
    })
    const getCustom = (): unknown => context.getCustom?.() ?? latestCustom
    const getPopLayoutOptions = (): PopLayoutOptions =>
        context.getPopLayoutOptions?.() ?? {
            anchorX: context.anchorX ?? 'left',
            anchorY: context.anchorY ?? 'top'
        }
    const setCustom = (custom: unknown): void => {
        if (Object.is(latestCustom, custom)) return
        latestCustom = custom
        customSubscribers.forEach((update) => update())
    }

    // Track whether we're still in the initial render phase
    // This is true only when initial={false} and we haven't completed the first frame
    let isInitialRenderPhase = context.initial === false

    // Track keys that have been seen (registered at least once)
    const seenKeys = new Set<string>()

    // Track keys that have exited (unregistered after being registered)
    const exitedKeys = new Set<string>()

    // For mode='wait': track whether enters should be blocked
    let enterBlocked = false

    // For mode='wait': callbacks to invoke when enters are unblocked
    const enterUnblockedCallbacks: Set<() => void> = new Set()

    // After first frame, mark initial render phase as complete
    // Guard for SSR - requestAnimationFrame only exists in browser
    let initialRenderFrame: number | undefined
    if (isInitialRenderPhase && typeof window !== 'undefined') {
        initialRenderFrame = requestAnimationFrame(() => {
            if (disposed) return
            initialRenderFrame = requestAnimationFrame(() => {
                initialRenderFrame = undefined
                if (disposed) return
                pwLog('[presence] initial render phase complete, enabling animations for new keys')
                isInitialRenderPhase = false
            })
        })
    }

    /**
     * Determine if a child with the given key should animate its enter.
     *
     * - If we're past the initial render phase → always animate
     * - If key has previously exited → animate (re-entry)
     * - If key has never been seen AND we're in initial render phase → skip animation
     */
    const shouldAnimateEnter = (key: string): boolean => {
        // If the key has previously exited, it's a re-entry - always animate
        if (exitedKeys.has(key)) {
            pwLog('[presence] shouldAnimateEnter', {
                key,
                result: true,
                reason: 're-entry after exit'
            })
            return true
        }

        // If we're past the initial render phase, all new entries animate
        if (!isInitialRenderPhase) {
            pwLog('[presence] shouldAnimateEnter', {
                key,
                result: true,
                reason: 'past initial render phase'
            })
            return true
        }

        // We're in initial render phase and key hasn't exited before
        // Check if key has been seen - if not, skip animation (initial={false} behavior)
        const hasBeenSeen = seenKeys.has(key)
        const shouldAnimate = hasBeenSeen // Only animate if we've seen it before (shouldn't happen in initial phase)

        pwLog('[presence] shouldAnimateEnter', {
            key,
            result: shouldAnimate,
            reason: shouldAnimate ? 'previously seen' : 'first appearance during initial render'
        })

        return shouldAnimate
    }

    /**
     * Check if enter animations should be blocked.
     *
     * For mode='wait': returns true when exit animations are in progress,
     * signaling that new elements should defer their enter animations until
     * all exits complete. For 'sync' and 'popLayout' modes, always returns false.
     *
     * @returns True if enters should be blocked (wait mode with exits in progress)
     * @example
     * ```ts
     * if (context.isEnterBlocked()) {
     *   // Defer animation until unblocked
     *   context.onEnterUnblocked(() => runAnimation())
     * }
     * ```
     */
    const isEnterBlocked = (key?: string): boolean => {
        if (disposed) return false
        if (mode !== 'wait') {
            pwLog('[presence] isEnterBlocked', { blocked: false, mode, inFlightExits, key })
            return false
        }

        const hasBlockingSibling =
            key !== undefined && Array.from(children.keys()).some((childKey) => childKey !== key)
        const blocked = inFlightExits > 0 || hasBlockingSibling
        pwLog('[presence] isEnterBlocked', {
            blocked,
            mode,
            inFlightExits,
            key,
            hasBlockingSibling
        })
        return blocked
    }

    /**
     * Register a callback to be invoked when enter animations are unblocked.
     *
     * For mode='wait': the callback is called when all exit animations complete
     * and new elements can begin their enter animations. Useful for deferring
     * animations until the appropriate time.
     *
     * @param callback - Function to call when enters are unblocked
     * @returns Unsubscribe function to remove the callback
     * @example
     * ```ts
     * const unsubscribe = context.onEnterUnblocked(() => {
     *   console.log('Exits complete, starting enter animation')
     *   runAnimation()
     * })
     * // Later, to cancel:
     * unsubscribe()
     * ```
     */
    const onEnterUnblocked = (callback: () => void): (() => void) => {
        if (disposed) return () => {}
        pwLog('[presence] onEnterUnblocked: registering callback')
        enterUnblockedCallbacks.add(callback)
        return () => {
            pwLog('[presence] onEnterUnblocked: removing callback')
            enterUnblockedCallbacks.delete(callback)
        }
    }

    /**
     * Invoke all registered enter-unblocked callbacks.
     *
     * Called internally when all exit animations complete in wait mode.
     * Each callback is invoked in a try-catch to prevent one failing callback
     * from blocking others.
     *
     * @internal
     */
    const notifyEnterUnblocked = () => {
        pwLog('[presence] notifyEnterUnblocked', { callbackCount: enterUnblockedCallbacks.size })
        // Copy and clear to prevent re-invocation on multiple exit completions
        const callbacks = Array.from(enterUnblockedCallbacks)
        enterUnblockedCallbacks.clear()
        callbacks.forEach((cb) => {
            try {
                cb()
            } catch (e) {
                console.error('[presence] onEnterUnblocked callback error:', e)
            }
        })
    }

    pwLog('[presence] createContext', {
        initial,
        mode,
        isInitialRenderPhase,
        onExitComplete: !!context.onExitComplete
    })

    const children = new Map<string, PresenceChild>()
    const exitPlaceholders = new Map<string, HTMLElement>()

    /**
     * Find the registered `PresenceChild` whose element is `el`.
     *
     * @param el The DOM element to look up.
     * @returns The matching child record, or `undefined` if `el` is not a
     *   registered child element.
     * @example
     * ```ts
     * const sibling = childByElement(anchor)
     * ```
     */
    const childByElement = (el: Element): PresenceChild | undefined => {
        for (const child of children.values()) {
            if (child.element === el) return child
        }
        return undefined
    }

    /**
     * Re-capture every still-connected child's next sibling. Called whenever
     * the child set changes so each child's `lastNextSibling` reflects the
     * DOM order just before the next detach — the exit placeholder's anchor.
     *
     * @returns Nothing; updates each connected child's `lastNextSibling`.
     * @example
     * ```ts
     * children.delete(key)
     * refreshSiblingAnchors()
     * ```
     */
    const refreshSiblingAnchors = () => {
        // Only registered sibling elements and THIS context's live exit
        // placeholders are usable anchors: anything else adjacent to a child
        // (Svelte-injected <script>/comment nodes, a nested AnimatePresence's
        // placeholders) can detach without this context noticing, leaving a
        // dangling reference the placeholder can't anchor on.
        const childElements = new Set<Element>()
        for (const child of children.values()) childElements.add(child.element)
        const ownPlaceholders = new Set<Element>(exitPlaceholders.values())
        for (const child of children.values()) {
            if (!child.element.isConnected) continue
            let next = child.element.nextElementSibling
            while (next && !childElements.has(next) && !ownPlaceholders.has(next)) {
                next = next.nextElementSibling
            }
            child.lastNextSibling = next
        }
    }

    /**
     * Resolve the connected node the exit placeholder should be inserted
     * before. Prefers the exiting element itself (still connected when Svelte
     * tears down after unregister), then walks the captured sibling chain,
     * hopping over siblings that detached in the same update. The chain is
     * acyclic by construction — every pointer comes from one forward
     * DOM-order pass in `refreshSiblingAnchors` — so the walk terminates.
     *
     * @param child The exiting child whose slot anchor is being resolved.
     * @returns The connected element to `insertBefore`, or `null` to append
     *   at the end of the insertion parent.
     * @example
     * ```ts
     * const anchor = resolvePlaceholderAnchor(child)
     * parent.insertBefore(placeholder, anchor)
     * ```
     */
    const resolvePlaceholderAnchor = (child: PresenceChild): Element | null => {
        if (child.element.isConnected) return child.element

        let anchor = child.lastNextSibling ?? null
        while (anchor && !anchor.isConnected) {
            anchor = childByElement(anchor)?.lastNextSibling ?? null
        }
        return anchor
    }
    /**
     * Where `element` was when it was removed from `parent`: the next sibling
     * its removal record saw, if still in `parent` (plan 012). Reads the
     * structure observer's pending records; their only job, scheduling a
     * snapshot refresh, is already done by the caller.
     *
     * @param element The detached child element.
     * @param parent Its slot parent.
     * @returns The node to insert before, or `null` when unknown.
     */
    const removalNextSibling = (element: Element, parent: Element): Node | null => {
        const records = (structureObserver?.takeRecords() ?? []).filter(
            (record) => record.target === parent && record.removedNodes.length > 0
        )
        // Svelte removes a branch node by node, so the element's next sibling
        // may have gone in a later record: follow the chain to the first one
        // still in place.
        let node: Node | null = element
        for (let guard = 0; node && node.parentNode !== parent && guard < 1000; guard++) {
            const removing: Node = node
            const record = records.find((r) => Array.from(r.removedNodes).includes(removing))
            if (!record) return null
            const removed = Array.from(record.removedNodes)
            node =
                removed.indexOf(removing) < removed.length - 1
                    ? removed[removed.indexOf(removing) + 1]
                    : record.nextSibling
        }
        return node && node !== element ? node : null
    }

    // Track number of in-flight exit animations to invoke onExitComplete once
    let inFlightExits = 0
    // One layoutId handoff hold per in-flight exit (see layoutId.ts `holdLayoutIdHandoffs`).
    const layoutIdHolds: Array<() => void> = []

    type ActiveExit = {
        clone: HTMLElement
        child: PresenceChild
        placeholder: HTMLElement | null
        /** Set once the exit animation (and its `startExit`) has begun. */
        animation?: { stop?: () => void }
        /** Pre-exit values of the exit keys, read before the animation starts. */
        base?: Record<string, string | number>
        /** Scheduled animation start, cancelled if the boundary is disposed. */
        frame?: number
        /** Re-entry or boundary disposal cancelled this exit. */
        cancelled: boolean
        /** Plan 012: the holds on the clone (its node, and re-homed descendants'). */
        holds: ExitLayoutHold[]
        /** `startExit()` ran for this exit. */
        started?: boolean
        /** The completion tail ran. */
        completed?: boolean
    }
    const activeExits = new Map<string, ActiveExit>()

    /**
     * Re-snapshot every still-connected child's computed style.
     *
     * A child's look can change with no attribute change on it: a sibling
     * leaving turns it into `:first-child`, an exit clone or placeholder
     * appearing or disappearing shifts `:nth-child`/`+` matches. Any such
     * structural change schedules this pass, coalesced to one per frame, so
     * a child that is removed later freezes the look it had at removal.
     */
    let snapshotRefreshScheduled = false
    let snapshotRefreshFrame: number | undefined
    const refreshConnectedSnapshots = () => {
        snapshotRefreshScheduled = false
        snapshotRefreshFrame = undefined
        if (disposed) return
        for (const child of children.values()) {
            if (!child.element.isConnected) continue
            const style = getComputedStyle(child.element)
            child.lastStyleSnapshot = snapshotComputedStyle(style, child.element)
            // A resting child moves when its siblings change (a toast list
            // growing), so its pop position has to follow, or the #2348
            // correction would also undo those earlier moves.
            if (mode === 'popLayout') {
                child.lastPopLayoutSnapshot = measurePopLayoutSnapshot(child.element, style)
            }
        }
    }
    const scheduleSnapshotRefresh = () => {
        if (disposed || snapshotRefreshScheduled || typeof requestAnimationFrame === 'undefined')
            return
        snapshotRefreshScheduled = true
        snapshotRefreshFrame = requestAnimationFrame(refreshConnectedSnapshots)
    }
    // Sibling insertions/removals in any registered child's parent (including
    // ones this context never hears about) restyle structural selectors.
    const structureObserver =
        typeof MutationObserver === 'undefined'
            ? undefined
            : new MutationObserver(scheduleSnapshotRefresh)

    const removeExitPlaceholder = (key: string, placeholder?: HTMLElement | null) => {
        const current = exitPlaceholders.get(key)
        const target = placeholder ?? current
        if (!target) return

        target.remove()
        if (!current || current === target) {
            exitPlaceholders.delete(key)
        }
        // Anchors captured while this placeholder was in the DOM may point at
        // it — re-capture from the reflowed DOM so later exits don't anchor
        // on a removed node.
        refreshSiblingAnchors()
        scheduleSnapshotRefresh()
    }

    /**
     * Begin tracking an exit.
     *
     * Increments the `inFlightExits` counter and, in `mode='wait'`, raises the
     * `enterBlocked` flag so sibling motion-element enters defer until every
     * exit reports back via {@link finishExit}. Shared by the clone-based exit
     * path in {@link unregisterChild} and the user-driven `PresenceChild` hold.
     *
     * Must be paired with exactly one {@link finishExit} call per invocation.
     *
     * @returns void
     * @example
     * ```ts
     * // unregisterChild (clone path)
     * startExit()
     * requestAnimationFrame(() => {
     *   animate(clone, exitKeyframes, transition).finished.finally(finishExit)
     * })
     *
     * // PresenceChild (user-driven path) — exposed as `notifyExitStart`
     * presenceContext.notifyExitStart()
     * // ... later, on transitionend or user signal ...
     * presenceContext.notifyExitComplete()
     * ```
     */
    const startExit = () => {
        if (disposed) return
        if (mode === 'wait') {
            enterBlocked = true
        }
        inFlightExits += 1
        // Keep departing layoutId snapshots alive until the exit ends (see layoutId.ts).
        layoutIdHolds.push(holdLayoutIdHandoffs())
    }

    /**
     * Mark an exit as finished.
     *
     * Decrements the `inFlightExits` counter. When the count reaches zero,
     * schedules the consumer's `onExitComplete` callback for after the next
     * flush (see {@link scheduleExitComplete}) and, in `mode='wait'`,
     * lowers `enterBlocked` plus notifies any deferred-enter callbacks
     * registered via {@link onEnterUnblocked}.
     *
     * Must be called exactly once per matching {@link startExit}; double-fires
     * underflow the counter and can permanently mis-route subsequent exits.
     *
     * @returns void
     * @example
     * ```ts
     * startExit()
     * // ... exit work ...
     * finishExit() // schedules onExitComplete if the last exit, unblocks waiters
     * ```
     */
    const finishExit = () => {
        if (disposed) return
        layoutIdHolds.pop()?.()
        inFlightExits -= 1
        if (inFlightExits === 0) {
            context.forceRender?.()
            scheduleExitComplete()
            if (mode === 'wait' && enterBlocked) {
                enterBlocked = false
                notifyEnterUnblocked()
            }
        }
    }

    // Exits counted from an outer clone's propagated child (plan 012). The
    // boundary outlives `dispose()` for them: upstream it stays mounted until
    // its children have exited (`AnimatePresence/index.tsx:171-179`).
    let pendingPropagatedExits = 0
    /**
     * `finishExit` for a propagated exit, which may settle after `dispose()`:
     * the counter, `onExitComplete` and the layoutId hold stay alive for it.
     */
    const finishPropagatedExit = () => {
        pendingPropagatedExits -= 1
        if (!disposed) {
            finishExit()
            return
        }
        layoutIdHolds.pop()?.()
        inFlightExits -= 1
        if (inFlightExits === 0) scheduleExitComplete()
    }

    // A scheduled `onExitComplete` that has not fired yet. Guards against a
    // second schedule for the same cycle (upstream's `pendingExitComplete` ref).
    let pendingExitComplete = false

    /**
     * Fire the consumer's `onExitComplete` after Svelte has flushed the state
     * change that removes the exiting children, so the callback sees them
     * unmounted and after their own `onDestroy` cleanups (framer-motion #2538).
     *
     * Upstream only stores the callback when every exit completes and fires it
     * from the cleanup of an effect keyed on the rendered children, "so it runs
     * in the commit that removes them (or when we unmount)"; `forceRender` and
     * the children re-diff stay synchronous (framer-motion
     * AnimatePresence/index.tsx @ v14.5.0, lines 101-117 and 236-251). Here
     * `PresenceChild` flips its phase before `notifyExitComplete`, so `tick()`
     * resolves after the held subtree's `{#if}` teardown. Once scheduled, the
     * call runs even if this context is disposed in between, matching
     * upstream's "or when we unmount".
     *
     * @returns void
     */
    const scheduleExitComplete = () => {
        const onExitComplete = context.onExitComplete
        if (!onExitComplete || pendingExitComplete) return
        pendingExitComplete = true
        void tick().then(() => {
            pendingExitComplete = false
            onExitComplete()
        })
    }

    /**
     * Stop counting an exit that was reversed by a re-entry.
     *
     * Pairs with the exit's {@link startExit} like {@link finishExit}, but a
     * reversed exit never completed: upstream deletes the key from its
     * `exitComplete` map on re-entry (AnimatePresence/index.tsx), so neither
     * `onExitComplete` nor the LayoutGroup re-render fire for it. Enters
     * blocked by `mode='wait'` are still released once nothing is exiting.
     */
    const cancelExit = () => {
        layoutIdHolds.pop()?.()
        inFlightExits -= 1
        if (inFlightExits === 0 && mode === 'wait' && enterBlocked) {
            enterBlocked = false
            notifyEnterUnblocked()
        }
    }

    /**
     * Register a child element and snapshot its initial rect/styles.
     */
    const registerChild = (
        key: string,
        element: HTMLElement,
        exit?: MotionExit,
        mergedTransition?: MotionTransition,
        resolveExit?: PresenceExitResolver,
        layoutGroup?: object,
        layoutHandOff?: PresenceLayoutHandOff
    ) => {
        if (disposed) return
        const wasExited = exitedKeys.has(key)
        if (wasExited) {
            removeExitPlaceholder(key)
        }

        const initialRect = element.getBoundingClientRect()
        const initialStyle = getComputedStyle(element)
        const initialScrollSnapshot = captureScrollSnapshot(element)

        // Mark this key as seen
        seenKeys.add(key)

        // If this key was previously exited, remove it from exitedKeys (it's re-entering)
        if (wasExited) {
            exitedKeys.delete(key)
        }

        // Note: For mode='wait', we do NOT preemptively block enters here.
        // Blocking only happens when an exit actually starts (in unregisterChild).
        // This ensures pure additions don't stall when other children merely have
        // exit definitions but aren't actually exiting.

        pwLog('[presence] registerChild', {
            key,
            hasExit: !!exit,
            exit,
            wasExited,
            mode,
            enterBlocked,
            rect: { w: initialRect.width, h: initialRect.height }
        })

        // Re-registration (exit/transition props changed) replaces the record;
        // stop the previous record's attribute watcher first.
        children.get(key)?.stopObservingStyle?.()
        children.get(key)?.popPointCache?.dispose()
        const record: PresenceChild = {
            element,
            exit,
            resolveExit,
            mergedTransition,
            lastRect: initialRect,
            lastStyleSnapshot: snapshotComputedStyle(initialStyle, element),
            lastLayoutStyle: snapshotLayoutStyle(initialStyle),
            lastPopLayoutSnapshot:
                mode === 'popLayout' ? measurePopLayoutSnapshot(element, initialStyle) : undefined,
            insertionParent: element.parentElement ?? undefined,
            layoutGroup,
            layoutHandOff,
            hasScrollableAncestor: initialScrollSnapshot.length > 0,
            lastScrollSnapshot: initialScrollSnapshot
        }
        record.stopObservingStyle = observeStyleChanges(element, () => {
            record.lastStyleSnapshot = snapshotComputedStyle(getComputedStyle(element), element)
        })
        if (mode === 'popLayout') {
            record.popPointCache = createPopLayoutPointCache()
            record.popPointCache.track(element)
        }
        children.set(key, record)
        if (element.parentElement) {
            structureObserver?.observe(element.parentElement, { childList: true })
        }
        // A new sibling may have landed between existing children — re-anchor
        // everyone (including this child) while the whole set is connected.
        refreshSiblingAnchors()
        scheduleSnapshotRefresh()
    }

    /**
     * Update the last known rect/style snapshot for a registered child.
     *
     * Runs on every animating frame, so it only copies the cheap layout
     * fields; the full computed-style snapshot is taken when `settled` is set
     * (the frame an animation comes to rest).
     */
    const updateChildState = (
        key: string,
        rect: DOMRect,
        computedStyle: CSSStyleDeclaration,
        settled = false
    ) => {
        const child = children.get(key)
        if (child && rect.width > 0 && rect.height > 0) {
            child.lastRect = rect
            child.lastLayoutStyle = snapshotLayoutStyle(computedStyle)
            if (settled && child.element.isConnected) {
                child.lastStyleSnapshot = snapshotComputedStyle(computedStyle, child.element)
            }
            child.lastScrollSnapshot = captureScrollSnapshot(child.element)
            child.hasScrollableAncestor = child.lastScrollSnapshot.length > 0
            if (mode === 'popLayout') {
                child.lastPopLayoutSnapshot = measurePopLayoutSnapshot(child.element, computedStyle)
            }
        }
    }

    /**
     * Update the last captured mid-animation style values for a child.
     * Called from a rAF loop while WAAPI animations are running.
     */
    const updateChildAnimatedStyle = (
        key: string,
        opacity: string,
        transform: string,
        animations?: Animation[]
    ) => {
        const child = children.get(key)
        if (child) {
            child.lastAnimatedOpacity = opacity
            child.lastAnimatedTransform = transform
            if (animations) child.lastAnimations = animations
        }
    }

    /**
     * Unregister a child. If it has an `exit` definition, create a styled
     * clone and run the exit animation using Motion. Cleans up after finish.
     */
    const unregisterChild = (key: string) => {
        if (disposed) return
        const child = children.get(key)
        pwLog('[presence] unregisterChild', {
            key,
            mode,
            found: !!child,
            hasExit: !!child?.exit,
            exit: child?.exit
        })

        // Only process if child was actually registered
        if (!child) {
            pwLog('[presence] unregisterChild - child not found, ignoring')
            return
        }

        // Mark this key as exited so re-entry will animate
        exitedKeys.add(key)
        // The element is leaving: nothing after this point may refresh its
        // style snapshot.
        child.stopObservingStyle?.()
        child.stopObservingStyle = undefined
        // Where it rested before this update (Svelte has usually detached it
        // by now, and a frame-after-mutation snapshot can be mid-animation).
        const restingPoint = child.popPointCache?.peek(child.element)
        child.popPointCache?.dispose()
        child.popPointCache = undefined
        // Its siblings' structural matches change once it is gone.
        scheduleSnapshotRefresh()

        // Plan 012: an element whose `MeasureLayout` would be rendered
        // upstream (`layout`, `layoutId`, `drag`) keeps its projection node on
        // the clone and is held until that node is released. Decided before
        // any clone work, so a non-held child without an exit never flashes
        // a clone.
        const layoutHandOff = child.layoutHandOff
        const held = !!layoutHandOff?.canHandOff()
        const ownedKeys: ReadonlySet<string> = held
            ? layoutHandOff!.ownedLayoutKeys()
            : new Set<string>()

        const removeAtOnce = () => {
            children.delete(key)
            // Anchors pointing at the removed child would sever the sibling
            // chain for a same-update multi-detach — re-anchor around it.
            refreshSiblingAnchors()
        }

        if (!held && !child.exit && !child.resolveExit) {
            pwLog('[presence] unregisterChild - no exit animation, removing immediately')
            removeAtOnce()
            return
        }

        if (containsStatefulCloneContent(child.element)) {
            pwLog(
                '[presence] unregisterChild - stateful media cannot be cloned faithfully, removing immediately',
                { key }
            )
            removeAtOnce()
            return
        }

        // The element's own document, not the global one, so exits work when
        // rendering into another window or iframe (motion cc77f7878).
        const doc = child.element.ownerDocument
        const insertionParent =
            (child.element.parentElement?.isConnected ? child.element.parentElement : null) ??
            (child.insertionParent?.isConnected ? child.insertionParent : null)
        // Plan 012 (N4): with no connected slot (the boundary itself is being
        // torn down) there is nowhere to put a clone; a clone on <body> would
        // escape every clipping ancestor.
        if (!insertionParent) {
            pwLog('[presence] unregisterChild - no connected slot, removing immediately', { key })
            removeAtOnce()
            // Its exit runs on an outer clone's copy (a `propagate` boundary
            // inside an exiting child): count it here, so this boundary's
            // `onExitComplete` fires once it has exited.
            const propagated = propagatedExits.get(child.element)
            if (propagated) {
                startExit()
                pendingPropagatedExits += 1
                propagated.catch(() => {}).finally(finishPropagatedExit)
            }
            return
        }

        const elementIsLive = child.element.isConnected
        const staleScrollDelta = measureScrollDelta(child.lastScrollSnapshot)
        let rect = elementIsLive
            ? child.element.getBoundingClientRect()
            : translateRectByScrollDelta(child.lastRect, staleScrollDelta)
        // Read styles live only while the element is still connected. A
        // detached element's computed style reads '' for everything, so fall
        // back to the string snapshots taken while it was connected.
        const liveStyle = elementIsLive ? getComputedStyle(child.element) : undefined
        const frozenStyle = liveStyle
            ? snapshotComputedStyle(liveStyle, child.element)
            : child.lastStyleSnapshot
        // Layout fields for the placeholder / out-of-flow check.
        const computed = liveStyle ? snapshotLayoutStyle(liveStyle) : child.lastLayoutStyle
        if (elementIsLive) {
            child.lastScrollSnapshot = captureScrollSnapshot(child.element)
            child.hasScrollableAncestor = child.lastScrollSnapshot.length > 0
        }
        // Plan 012: the untransformed size, from the recorded computed style
        // (the rect is transformed: an exit interrupting a scale-up would
        // shrink the slot). `auto` sizes fall back to the rect.
        const size = {
            width: readNumericStyle(computed.width, () => rect.width),
            height: readNumericStyle(computed.height, () => rect.height)
        }

        // sync/wait exits keep their layout slot until the exit finishes.
        // popLayout is the mode that explicitly pops exits out of flow so
        // surrounding layout can reflow immediately.
        const shouldPreserveLayout = mode !== 'popLayout'
        // An out-of-flow child holds no layout slot, so a placeholder would
        // INSERT space that never existed — e.g. absolutely-positioned labels
        // crossfading inside a fixed-size pill briefly balloon the pill.
        const isOutOfFlow = computed.position === 'absolute' || computed.position === 'fixed'
        let placeholder: HTMLElement | null = null
        let slotRect: DOMRect | null = null
        if (shouldPreserveLayout && !isOutOfFlow) {
            placeholder = doc.createElement(child.element.tagName.toLowerCase())
            placeholder.setAttribute('data-presence-placeholder', 'true')
            placeholder.style.display = computed.display === 'contents' ? 'block' : computed.display
            // The element's border box, untransformed: the placeholder has no
            // padding or border of its own.
            const extra =
                computed.boxSizing === 'border-box' ? [0, 0] : borderAndPadding(frozenStyle)
            placeholder.style.width = `${size.width + extra[0]}px`
            placeholder.style.height = `${size.height + extra[1]}px`
            placeholder.style.margin = computed.margin
            placeholder.style.boxSizing = 'border-box'
            placeholder.style.position = 'static'
            placeholder.style.visibility = 'hidden'
            placeholder.style.pointerEvents = 'none'
            if (computed.flex) {
                placeholder.style.flex = computed.flex
            }
            if (computed.alignSelf) {
                placeholder.style.alignSelf = computed.alignSelf
            }
            if (computed.gridColumnStart) {
                placeholder.style.gridColumnStart = computed.gridColumnStart
            }
            if (computed.gridColumnEnd) {
                placeholder.style.gridColumnEnd = computed.gridColumnEnd
            }
            if (computed.gridRowStart) {
                placeholder.style.gridRowStart = computed.gridRowStart
            }
            if (computed.gridRowEnd) {
                placeholder.style.gridRowEnd = computed.gridRowEnd
            }
            const anchor = resolvePlaceholderAnchor(child)
            const before = anchor?.parentElement === insertionParent ? anchor : null
            insertionParent.insertBefore(placeholder, before)
            exitPlaceholders.set(key, placeholder)

            // `lastRect` only refreshes on SIZE changes (ResizeObserver), so
            // a child that FLIPed to a new slot after a sibling's exit still
            // carries its old position. The placeholder now occupies the
            // child's real slot — measure IT so the exit clone fades where
            // the child currently is, not where it registered. A held clone
            // is always placed from it (plan 012).
            if (!elementIsLive || held) {
                slotRect = placeholder.getBoundingClientRect()
                if (!held && (slotRect.width > 0 || slotRect.height > 0)) {
                    // The slot is the untransformed box (plan 012, 10o); a
                    // clone that isn't held has no renderer for the
                    // element's transform, so it keeps the drawn size,
                    // centred on the slot (the default transform origin).
                    rect = new DOMRect(
                        slotRect.left + (slotRect.width - rect.width) / 2,
                        slotRect.top + (slotRect.height - rect.height) / 2,
                        rect.width,
                        rect.height
                    )
                }
            }
        }

        // Clone original node to preserve structure/classes, then inline the
        // snapshotted computed styles to freeze its look.
        const clone = child.element.cloneNode(true) as HTMLElement
        // A held clone stands in for the element itself (plan 012, ruling 2).
        if (clone.id && !held) clone.removeAttribute('id')
        stripNestedExitArtifacts(clone)
        // Keys the re-homed VisualElement writes itself (plan 012).
        const ownedCss = new Set(Array.from(ownedKeys, toCssProperty))
        try {
            for (const prop in frozenStyle) {
                // Skip transforms to avoid double offset/scale on the absolutely positioned clone
                if (/transform/i.test(prop)) continue
                if (ownedCss.has(prop)) continue
                // The cloned `style` attribute is the element's latest inline
                // styling — fresher than any snapshot (JS-driven animations
                // write it every frame), so it wins.
                if (clone.style.getPropertyValue(prop)) continue
                clone.style.setProperty(prop, frozenStyle[prop])
            }
            // Ensure no transform remains on the clone (including vendor-prefixed)
            resetTransforms(clone)
        } catch {
            // Ignore
        }

        // Apply last captured mid-animation values (from rAF polling) so that
        // exit clones start from the correct visual state when interrupting
        // an enter animation. The element is disconnected by now so
        // getComputedStyle/getAnimations won't reflect in-flight values.
        if (child.lastAnimatedOpacity != null) {
            clone.style.opacity = child.lastAnimatedOpacity
        }

        // The clone goes back into the element's own DOM slot (below), like
        // upstream, where the real element stays mounted until its exit
        // finishes. It is absolutely positioned against its containing block:
        // the nearest ancestor with a box.
        const slotParent = insertionParent
        let positioningParent = slotParent

        // Walk up to find a parent that has actual layout (not display: contents).
        // A `display: contents` element generates no box, so it can never be
        // the clone's containing block: whatever this walk finds is.
        while (positioningParent && positioningParent !== doc.body) {
            const parentDisplay = getComputedStyle(positioningParent).display
            if (parentDisplay !== 'contents') {
                break
            }
            positioningParent = positioningParent.parentElement ?? doc.body
        }

        const measuredPopLayoutSnapshot =
            mode === 'popLayout'
                ? liveStyle
                    ? measurePopLayoutSnapshot(child.element, liveStyle)
                    : child.lastPopLayoutSnapshot
                : undefined
        const popLayoutSnapshot =
            measuredPopLayoutSnapshot && restingPoint
                ? { ...measuredPopLayoutSnapshot, point: restingPoint }
                : measuredPopLayoutSnapshot
        // Plan 012: a held in-flow clone is placed against its real
        // containing block, read in this same pass.
        const heldBlock =
            held && !popLayoutSnapshot && placeholder ? measureContainingBlock(slotParent) : null
        const parentRect =
            popLayoutSnapshot || held ? undefined : positioningParent.getBoundingClientRect()

        if (!popLayoutSnapshot && !held) {
            const parentPosition = getComputedStyle(positioningParent).position
            if (parentPosition === 'static') {
                positioningParent.style.position = 'relative'
            }
        }

        // Preserve the original display property (especially flex for centered content)
        const originalDisplay = frozenStyle.display ?? ''

        clone.style.left = ''
        clone.style.right = ''
        clone.style.top = ''
        clone.style.bottom = ''
        const { anchorX, anchorY } = getPopLayoutOptions()
        const applyPopStyles = (snapshot: PopLayoutSnapshot) => {
            const popStyles = resolvePopLayoutStyles(snapshot, anchorX, anchorY)
            clone.style.left = ''
            clone.style.right = ''
            clone.style.top = ''
            clone.style.bottom = ''
            if (popStyles.position) clone.style.position = popStyles.position
            if (popStyles.width) clone.style.width = popStyles.width
            if (popStyles.height) clone.style.height = popStyles.height
            if (popStyles.left) clone.style.left = popStyles.left
            if (popStyles.right) clone.style.right = popStyles.right
            if (popStyles.top) clone.style.top = popStyles.top
            if (popStyles.bottom) clone.style.bottom = popStyles.bottom
        }
        /** Write `value` unless the re-homed VisualElement owns `key`. */
        const setUnowned = (
            key: 'width' | 'height' | 'top' | 'right' | 'bottom' | 'left',
            value: string
        ) => {
            if (!ownedKeys.has(key)) clone.style[key] = value
            else clone.style[key] = ''
        }
        if (popLayoutSnapshot) {
            applyPopStyles(popLayoutSnapshot)
        } else if (held) {
            // Plan 012 (M1): placed exactly, with no extra forced layout. The
            // re-homed VisualElement renders the element's transforms and
            // its `style` motion values onto the clone, so the clone takes
            // the untransformed box, and leaves owned keys alone.
            setUnowned('width', `${size.width}px`)
            setUnowned('height', `${size.height}px`)
            if (placeholder && slotRect && heldBlock) {
                const margins = expandMargin(computed.margin)
                const left =
                    (slotRect.left - heldBlock.left) / heldBlock.scale[0] -
                    heldBlock.clientLeft +
                    heldBlock.scrollLeft -
                    (ownedKeys.has('marginLeft') || ownedKeys.has('margin') ? margins[3] : 0)
                const top =
                    (slotRect.top - heldBlock.top) / heldBlock.scale[1] -
                    heldBlock.clientTop +
                    heldBlock.scrollTop -
                    (ownedKeys.has('marginTop') || ownedKeys.has('margin') ? margins[0] : 0)
                clone.style.position = 'absolute'
                clone.style.left = `${left}px`
                clone.style.top = `${top}px`
            } else {
                // Out of flow: its own resolved insets and position, in the
                // same slot, so the same containing block.
                clone.style.position = computed.position
                setUnowned('top', computed.top)
                setUnowned('right', computed.right)
                setUnowned('bottom', computed.bottom)
                setUnowned('left', computed.left)
            }
        } else {
            clone.style.position = 'absolute'
            clone.style.top = `${rect.top - parentRect!.top + (positioningParent.scrollTop ?? 0)}px`
            clone.style.left = `${rect.left - parentRect!.left + (positioningParent.scrollLeft ?? 0)}px`
            clone.style.width = `${rect.width}px`
            clone.style.height = `${rect.height}px`
        }
        if (!popLayoutSnapshot) {
            // In its original slot the clone can be a grid item; frozen
            // explicit grid lines would make its grid AREA the containing
            // block and shift it off the offsets computed above.
            clone.style.gridArea = 'auto'
        }
        clone.style.pointerEvents = 'none'
        clone.inert = true
        clone.setAttribute('aria-hidden', 'true')
        clone.style.visibility = 'visible'
        // Preserve flex/grid layout, only force 'block' if it was 'none' or 'contents'
        if (originalDisplay === 'none' || originalDisplay === 'contents') {
            clone.style.display = 'block'
        }
        // In flow its margin is in the slot already; out of flow a held
        // clone's resolved insets position its margin box, as the element's.
        if (!popLayoutSnapshot && (!held || placeholder)) {
            clone.style.margin = '0'
        }
        if (held) {
            // The element's own `box-sizing` (plan 012): a computed `width`
            // excludes padding and border under `content-box`.
            clone.style.boxSizing = computed.boxSizing
        } else {
            clone.style.boxSizing = 'border-box'
        }
        // Redundantly ensure no transforms are applied before positioning/z-index take effect
        resetTransforms(clone)
        // Elevate a non-held clone above siblings to ensure it renders on top
        // during exit. Its stacking siblings are both its DOM siblings in the
        // slot and the boxes laid out in its containing block. A held clone
        // keeps the element's own stacking, as upstream, where the exiting
        // element renders first and the entering one paints over it
        // (`AnimatePresence/index.tsx:155-164`, `PopChild.tsx:167-168` @
        // v14.7.1).
        if (!held) {
            try {
                const siblings = new Set([
                    ...Array.from(slotParent.children),
                    ...Array.from(positioningParent.children)
                ]) as Set<HTMLElement>
                let maxZ = 0
                for (const sib of siblings) {
                    if (sib === clone) continue
                    const z = parseInt(getComputedStyle(sib).zIndex || '0', 10)
                    if (!Number.isNaN(z)) maxZ = Math.max(maxZ, z)
                }
                // Ensure positioned so z-index applies; already absolute above
                clone.style.zIndex = String(maxZ + 1 || 9999)
            } catch {
                clone.style.zIndex = '9999'
            }
        }

        clone.setAttribute('data-clone', 'true')
        clone.setAttribute('data-exiting', 'true')
        clone.setAttribute('data-mode', mode)
        // Plan 015b (M3): its removal completes the exit. The element is
        // detached by now, so the boundary comes from the parent captured at
        // registration.
        const exitBoundaryFrom = child.insertionParent ?? slotParent
        const exitMarker: ExitMarker = {
            boundary: exitBoundaryFrom.closest('.animate-presence-container') ?? exitBoundaryFrom,
            group: child.layoutGroup
        }
        markExiting(clone, exitMarker)
        // Part D's M5 report of the completion, from the slot it leaves.
        const followParent = layoutParentOf(slotParent, true)

        pwLog('[presence] clone created', {
            key,
            mode,
            held,
            rect: { w: rect.width, h: rect.height, top: rect.top, left: rect.left }
        })
        // Structural placement like upstream: the element's original slot, so
        // ancestor, child-combinator and structural selectors (`> .card`,
        // `:first-child`) match the clone exactly as they matched the element.
        // With a placeholder holding the slot, the clone goes right before it
        // and takes the element's original sibling index.
        // A held clone takes the element's own place in the paint order (plan
        // 012, M2): where it was when Svelte removed it, before an entering
        // sibling Svelte inserted after it (`{#key}` creates the new branch
        // first), as upstream renders the exiting child first.
        const removedBefore =
            held && !placeholder ? removalNextSibling(child.element, slotParent) : null
        const slotAnchor = placeholder ?? removedBefore ?? resolvePlaceholderAnchor(child)
        slotParent.insertBefore(clone, slotAnchor?.parentNode === slotParent ? slotAnchor : null)
        // No scroll-anchoring adjustment from the swap, as upstream keeps
        // the element (plan 012 A6).
        if (followParent instanceof HTMLElement) suppressScrollAnchoring(followParent)
        const activeExit: ActiveExit = { clone, child, placeholder, cancelled: false, holds: [] }
        activeExits.set(key, activeExit)
        if (popLayoutSnapshot) {
            // The "before" point is the element's; the "after" one is the
            // clone's, in the same slot and offsetParent. Corrected on a copy
            // so the stored snapshot keeps describing the element.
            schedulePopLayoutCorrection(
                clone,
                { ...popLayoutSnapshot, point: [...popLayoutSnapshot.point] },
                () => clone.isConnected && !activeExit.cancelled && !disposed,
                applyPopStyles
            )
        }
        const releaseActiveExit = () => {
            if (activeExits.get(key) === activeExit) activeExits.delete(key)
        }

        // Capture the element reference for this specific exit animation
        // This prevents race conditions where re-entry registers a new element with the same key
        // before this exit animation completes
        const exitingElement = child.element

        /**
         * The existing completion tail, run once: every hold in the subtree
         * ends first (their deferred unmounts run while the clone is still
         * connected, as upstream unmounts nodes with their element attached),
         * then the clone, the child record and the placeholder go, part D
         * reports the completion, and the exit is finished.
         */
        const completeExit = () => {
            if (activeExit.cancelled || disposed || activeExit.completed) return
            activeExit.completed = true
            for (const hold of activeExit.holds) hold.finish()
            releaseActiveExit()
            pwLog('[presence] exit animation complete', { key, mode })

            // Reset elevated styles then remove
            try {
                clone.style.zIndex = ''
            } catch {
                // ignore
            }
            clone.remove()

            // Log clone removal and element counts for debugging rapid toggle
            pwLog('[presence] clone REMOVED from DOM', {
                key,
                mode,
                clonesInDOM: document.querySelectorAll('[data-clone="true"]').length,
                boxesInDOM: document.querySelectorAll('[data-testid="box"]').length
            })

            // Only delete from children map if the current registration is for the SAME element
            // If a re-entry happened while we were animating, a new element is registered
            // and we should NOT delete it
            const currentChild = children.get(key)
            if (currentChild && currentChild.element === exitingElement) {
                children.delete(key)
                pwLog('[presence] child deleted from map (same element)', { key })
            } else {
                pwLog('[presence] child NOT deleted (re-entry registered new element)', {
                    key,
                    hasCurrentChild: !!currentChild,
                    isSameElement: currentChild?.element === exitingElement
                })
            }

            // Log final state
            pwLog('[presence] element count after exit', {
                childrenMapSize: children.size,
                inFlightExits: inFlightExits - 1,
                clonesInDOM: document.querySelectorAll('[data-clone="true"]').length
            })

            removeExitPlaceholder(key, placeholder)
            // Plan 015b (M5): `layout` nodes after the list snap to
            // where the completion leaves them, even when no sibling
            // is left to report it. After the placeholder is gone:
            // in sync mode it still held the slot.
            if (followParent) {
                MotionDomProjectionAdapter.seedFollowingLayout(followParent, null, {
                    kind: 'exit-complete',
                    markers: [exitMarker]
                })
            }
            if (activeExit.started) finishExit()
        }
        // Plan 012: the clone goes once the exit and every hold have settled.
        let pendingFlags = 1
        const settle = () => {
            pendingFlags -= 1
            if (pendingFlags === 0) completeExit()
        }
        const startTracking = () => {
            if (activeExit.started) return
            activeExit.started = true
            // Start exit and track in-flight count (handles wait-mode blocking)
            startExit()
        }

        /**
         * Start the exit. A held child with nothing to animate settles its
         * exit flag; a non-held one is removed at once, as before.
         */
        const startExitAnimation = () => {
            const resolvedExit = child.resolveExit?.(getCustom()) ?? child.exit

            if (!resolvedExit) {
                pwLog('[presence] unregisterChild - no resolved exit animation after custom update')
                if (held) {
                    startTracking()
                    settle()
                    return
                }
                releaseActiveExit()
                clone.remove()
                removeExitPlaceholder(key, placeholder)
                const currentChild = children.get(key)
                if (currentChild && currentChild.element === exitingElement) {
                    children.delete(key)
                }
                return
            }

            // Prepare exit keyframes - extract ease separately, filter out transition
            // Note: transition is filtered out here as it's accessed via exitObj.transition for merging
            const rawExit = (resolvedExit ?? {}) as unknown as Record<string, unknown>
            const { ease: exitEase, transition: __, ...exitKeyframes } = rawExit
            void __ // Suppress unused variable warning - transition is accessed via exitObj.transition

            // Merge transitions: default < mergedTransition < exit.transition < exit.ease (last wins)
            const exitObj = (resolvedExit ?? {}) as unknown as { transition?: MotionTransition }
            const finalTransition = mergeTransitions(
                { duration: 0.35 } as AnimationOptions,
                child.mergedTransition ?? {},
                exitObj.transition ?? {},
                exitEase ? ({ ease: exitEase } as AnimationOptions) : {}
            )

            pwLog('[presence] starting exit animation', {
                key,
                mode,
                exitKeyframes,
                finalTransition
            })

            startTracking()

            activeExit.base = readAnimatedValues(clone, Object.keys(exitKeyframes))
            const exitAnimation = animate(
                clone,
                exitKeyframes as unknown as DOMKeyframesDefinition,
                finalTransition
            )
            activeExit.animation = exitAnimation
            exitAnimation.finished
                .catch(() => {})
                .finally(() => {
                    // Re-entry or boundary teardown already cleaned up.
                    if (activeExit.cancelled || disposed) return
                    settle()
                })
        }

        if (held) {
            // Plan 012 (A2): the element's running animations (Motion's
            // accelerated value and transform animations, an interrupted
            // enter) move to the clone with their timing, as upstream keeps
            // animating the exiting element itself. A Motion `stop()` still
            // reaches them: it holds the same Animation objects.
            continueAnimationsOnClone(
                exitingElement,
                clone,
                child.lastAnimations ?? [],
                exitingElement.hasAttribute('data-layout-id')
            )
            // Plan 012: hand the node to the clone, after the #2348
            // correction was queued, so the node's update pass measures the
            // corrected clone (its root update queues after the correction).
            const hold = layoutHandOff!.handOff(clone, () => {
                if (activeExit.cancelled || disposed) return
                settle()
            })
            if (hold) {
                activeExit.holds.push(hold)
                pendingFlags += 1
            }
        }
        // Plan 012: nested motion nodes move to their clone copies (every
        // clone runs a `propagate` boundary's child exits).
        rehomeDescendants(exitingElement, clone, held, ({ hold, settles, exit }) => {
            if (hold) activeExit.holds.push(hold)
            if (exit) {
                pendingFlags += 1
                exit.catch(() => {}).finally(() => {
                    if (activeExit.cancelled || disposed) return
                    settle()
                })
            }
            if (!settles) return
            pendingFlags += 1
            return () => {
                if (activeExit.cancelled || disposed) return
                settle()
            }
        })
        if (held) {
            // Resolved now: with nothing to animate, the exit starts (and
            // settles) at hand-off, so wait mode and `onExitComplete` wait
            // for the hold, as upstream.
            if (!(child.resolveExit?.(getCustom()) ?? child.exit)) {
                startTracking()
                settle()
                return
            }
        }

        activeExit.frame = requestAnimationFrame(() => {
            activeExit.frame = undefined
            // Re-entry or boundary teardown can cancel before the first frame.
            if (activeExit.cancelled || disposed) return
            startExitAnimation()
        })
    }

    const takeExitHandoff = (key: string): ExitHandoff | undefined => {
        const active = activeExits.get(key)
        if (!active || !active.clone.isConnected) return undefined

        const resolvedExit = (active.child.resolveExit?.(getCustom()) ?? active.child.exit) as
            Record<string, unknown> | undefined
        const keys = Object.keys(resolvedExit ?? {})
        const from = readAnimatedValues(active.clone, keys)
        // Not started yet: the clone still shows its pre-exit values.
        const base = active.base ?? from

        active.cancelled = true
        activeExits.delete(key)
        if (active.frame !== undefined) cancelAnimationFrame(active.frame)
        active.animation?.stop?.()
        // After the read: cancelling unmounts the VisualElement that renders
        // the clone's values (plan 012).
        for (const hold of active.holds) hold.cancel()
        active.clone.remove()
        removeExitPlaceholder(key, active.placeholder)
        if (children.get(key) === active.child) {
            children.delete(key)
            refreshSiblingAnchors()
        }
        if (active.started) cancelExit()

        pwLog('[presence] exit handed off to re-entering element', { key, from, base })
        return { from, base }
    }

    /**
     * Release a removed AnimatePresence boundary immediately.
     *
     * Boundary removal is cancellation, so it must not fire completion or
     * deferred-enter callbacks. Idempotent for repeated lifecycle cleanup.
     *
     * @returns Nothing; stops owned work and removes all exit artifacts.
     */
    const dispose = (): void => {
        if (disposed) return
        disposed = true
        structureObserver?.disconnect()
        if (initialRenderFrame !== undefined) cancelAnimationFrame(initialRenderFrame)
        if (snapshotRefreshFrame !== undefined) cancelAnimationFrame(snapshotRefreshFrame)
        for (const child of children.values()) {
            child.stopObservingStyle?.()
            child.popPointCache?.dispose()
        }
        for (const active of activeExits.values()) {
            active.cancelled = true
            if (active.frame !== undefined) cancelAnimationFrame(active.frame)
            active.animation?.stop?.()
            for (const hold of active.holds) hold.cancel()
            active.clone.remove()
        }
        for (const placeholder of exitPlaceholders.values()) placeholder.remove()
        children.clear()
        activeExits.clear()
        exitPlaceholders.clear()
        seenKeys.clear()
        exitedKeys.clear()
        enterUnblockedCallbacks.clear()
        customSubscribers.clear()
        // Propagated exits still in flight keep their count and holds (see
        // `finishPropagatedExit`); everything else is cancelled.
        for (const release of layoutIdHolds.splice(pendingPropagatedExits)) release()
        inFlightExits = pendingPropagatedExits
        enterBlocked = false
    }

    return {
        initial,
        mode,
        getPopLayoutOptions,
        get custom() {
            trackCustom()
            return getCustom()
        },
        getCustom,
        setCustom,
        shouldAnimateEnter,
        isEnterBlocked,
        onEnterUnblocked,
        onExitComplete: context.onExitComplete,
        registerChild,
        updateChildState,
        updateChildAnimatedStyle,
        unregisterChild,
        dispose,
        takeExitHandoff,
        notifyExitStart: startExit,
        notifyExitComplete: finishExit
    }
}

/**
 * Get the current `AnimatePresence` context from Svelte component context.
 *
 * Note: Trivial wrapper - ignored for coverage.
 */
/* c8 ignore next 3 */
export const getAnimatePresenceContext = (): AnimatePresenceContext | undefined => {
    return getContext(ANIMATE_PRESENCE_CONTEXT)
}

/**
 * Set the `AnimatePresence` context into Svelte component context.
 *
 * Note: Trivial wrapper - ignored for coverage.
 */
/* c8 ignore next 3 */
export const setAnimatePresenceContext = (context: AnimatePresenceContext): void => {
    setContext(ANIMATE_PRESENCE_CONTEXT, context)
}

/**
 * Get the current presence depth from Svelte component context.
 *
 * Returns undefined if not inside an AnimatePresence, or the depth level
 * where 0 means direct child of AnimatePresence.
 *
 * @returns The current depth level (0 for direct children), or undefined if outside AnimatePresence.
 * @example
 * ```ts
 * const depth = getPresenceDepth()
 * if (depth === 0) {
 *   // Direct child of AnimatePresence - key prop required
 * }
 * ```
 *
 * Note: Trivial wrapper - ignored for coverage.
 */
/* c8 ignore next */
export const getPresenceDepth = (): number | undefined => getContext(PRESENCE_DEPTH_CONTEXT)

/**
 * Set the presence depth in Svelte component context.
 *
 * AnimatePresence sets this to 0, and each motion element increments it
 * for its descendants so only direct children (depth 0) require keys.
 *
 * @param depth - The nesting depth to set (0 for direct children of AnimatePresence).
 * @returns void
 * @example
 * ```ts
 * // In AnimatePresence component
 * setPresenceDepth(0)
 *
 * // In nested motion element
 * const currentDepth = getPresenceDepth() ?? 0
 * setPresenceDepth(currentDepth + 1)
 * ```
 *
 * Note: Trivial wrapper - ignored for coverage.
 */
/* c8 ignore next */
export const setPresenceDepth = (depth: number): void => {
    setContext(PRESENCE_DEPTH_CONTEXT, depth)
}

/**
 * Per-`PresenceChild` Svelte context payload. Read by the `useIsPresent` and
 * `usePresence` hooks (and consulted by motion elements so they can opt out of
 * the outer `AnimatePresence` clone path when a `PresenceChild` is driving
 * the exit themselves).
 *
 * `isPresent` is exposed as a getter so consumers see live updates as the
 * wrapper toggles between mounted, exiting, and re-entered states.
 */
export type PresenceChildContext = {
    /** Reactive flag — `true` while present, `false` once the exit hold begins. */
    readonly isPresent: boolean
    /**
     * Release the whole wrapper: triggers the actual unmount and decrements
     * the parent `AnimatePresenceContext` exit count, even while registered
     * participants are still exiting. This is what the legacy reactive
     * `usePresence()` path returns. Idempotent and versioned (calls from a
     * canceled exit cycle are no-ops).
     */
    safeToRemove: () => void
    /** Register a motion descendant with this wrapper's exit barrier. */
    register: PresenceContextProps['register']
    /** Completion callback captured for the current exit cycle. */
    readonly onExitComplete: NonNullable<PresenceContextProps['onExitComplete']>
    /**
     * Installed by a legacy `<AnimatePresence propagate>`; its `isPresent`
     * follows the parent presence, while descendants still register clone
     * exits with the nested boundary.
     */
    readonly propagated?: boolean
    /**
     * Set by a `usePresence()` call made inside a reactive context. The
     * wrapper then keeps the pre-registration rule: an exit with nothing
     * registered holds until the whole-wrapper `safeToRemove`.
     *
     * @returns `true` on the first call only, for a once-per-wrapper dev
     *     warning.
     */
    markLegacyManual?: () => boolean
}

const PRESENCE_CHILD_CONTEXT = Symbol('presence-child-context')

/**
 * Get the nearest `PresenceChild` context from Svelte component context, or
 * `undefined` if the caller is not wrapped in one.
 *
 * Note: Trivial wrapper - ignored for coverage.
 */
/* c8 ignore next 3 */
export const getPresenceChildContext = (): PresenceChildContext | undefined => {
    return getContext(PRESENCE_CHILD_CONTEXT)
}

/**
 * Install a `PresenceChild` context for descendants.
 *
 * Note: Trivial wrapper - ignored for coverage.
 */
/* c8 ignore next 3 */
export const setPresenceChildContext = (context: PresenceChildContext): void => {
    setContext(PRESENCE_CHILD_CONTEXT, context)
}
