import type { AnimatePresenceMode, MotionExit, MotionTransition } from '$lib/types'
import { mergeTransitions } from '$lib/utils/animation'
import { pwLog } from '$lib/utils/log'
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
import { readTransformValue, transformProps, type PresenceContextProps } from 'motion-dom'
import { getContext, setContext } from 'svelte'
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
     * The element's parent captured at registration. The exit placeholder is
     * inserted here when the element is already detached — even a
     * `display: contents` parent (e.g. AnimatePresence's container) works,
     * since its children still occupy their slots in the grandparent's
     * grid/flex layout in DOM order.
     */
    insertionParent?: HTMLElement
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
    gridRowEnd: style.gridRowEnd
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
 * Typed OM exposes the computed number directly. Without it, a hidden probe
 * inherits the root's value at twice its font size: only a unitless line height
 * doubles. The probe is removed synchronously and never occupies a layout slot.
 *
 * @param element The connected presence child.
 * @param style Its computed style before any probe is inserted.
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
    // Empty roots need a pseudo-element probe: adding a child changes :empty.
    // This also preserves ID-dependent line heights before the clone loses its ID.
    if (element.matches(':empty')) {
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
    const probe = element.ownerDocument.createElement('span')
    probe.setAttribute(STYLE_PROBE_ATTRIBUTE, '')
    probe.style.cssText = `all: initial !important; display: none !important; font-size: ${fontSize * 2}px !important; line-height: inherit !important;`
    element.appendChild(probe)
    try {
        const rootStyle = getComputedStyle(element)
        // :empty and :has() can react to even a non-rendered child. Leave the
        // original stylesheet in charge rather than snapshot a perturbed value.
        if (rootStyle.lineHeight !== lineHeight || parseFloat(rootStyle.fontSize) !== fontSize)
            return undefined
        const inheritedHeight = parseFloat(getComputedStyle(probe).lineHeight)
        return Math.abs(inheritedHeight / usedHeight - 2) < 0.0001
            ? String(inheritedHeight / (fontSize * 2))
            : lineHeight
    } finally {
        probe.remove()
    }
}

/**
 * Identify a probe insertion/removal so snapshot observers cannot retrigger themselves.
 *
 * @param record An observed DOM mutation.
 * @returns Whether every changed node is a temporary style probe.
 */
const isStyleProbeMutation = (record: MutationRecord): boolean =>
    (record.type === 'attributes' && record.attributeName === STYLE_PROBE_ATTRIBUTE) ||
    (record.type === 'childList' &&
        [...record.addedNodes, ...record.removedNodes].every(
            (node) => node.nodeType === 1 && (node as Element).hasAttribute(STYLE_PROBE_ATTRIBUTE)
        ))

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
}

type ScrollSnapshot = {
    element: HTMLElement
    scrollLeft: number
    scrollTop: number
}

/**
 * Anchor used to preserve horizontal positioning in `mode="popLayout"`.
 */
export type PopLayoutAnchorX = 'left' | 'right'

/**
 * Anchor used to preserve vertical positioning in `mode="popLayout"`.
 */
export type PopLayoutAnchorY = 'top' | 'bottom'

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

const readNumericStyle = (value: string, fallback: number): number => {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Measure an element for `mode="popLayout"` using upstream Motion's coordinate
 * model: offsets are captured relative to `offsetParent`, not the viewport.
 * Ancestor scroll is intentionally not subtracted here because upstream
 * `PopChild` snapshots raw `offsetTop`/`offsetLeft`; any Svelte clone fallback
 * that breaks that containing-block relationship must compensate at the clone
 * application layer instead.
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
    const rect = element.getBoundingClientRect()
    const width = readNumericStyle(computedStyle.width, element.offsetWidth || rect.width)
    const height = readNumericStyle(computedStyle.height, element.offsetHeight || rect.height)
    const top = element.offsetTop
    const left = element.offsetLeft

    return {
        width,
        height,
        top,
        left,
        right: parentWidth - width - left,
        bottom: parentHeight - height - top,
        direction: computedStyle.direction || 'ltr'
    }
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

const canElementScroll = (element: HTMLElement): boolean => {
    const computed = getComputedStyle(element)
    const overflow = `${computed.overflow}${computed.overflowX}${computed.overflowY}`
    const canScroll =
        element.scrollHeight > element.clientHeight + 1 ||
        element.scrollWidth > element.clientWidth + 1

    return canScroll && /(auto|scroll|overlay)/.test(overflow)
}

const captureScrollSnapshot = (element: HTMLElement): ScrollSnapshot[] => {
    const snapshots: ScrollSnapshot[] = []
    let parent = element.parentElement

    while (parent && parent !== document.body && parent !== document.documentElement) {
        if (canElementScroll(parent)) {
            snapshots.push({
                element: parent,
                scrollLeft: parent.scrollLeft,
                scrollTop: parent.scrollTop
            })
        }

        parent = parent.parentElement
    }

    const scrollingElement = document.scrollingElement
    if (snapshots.length === 0 && isHTMLElement(scrollingElement)) {
        snapshots.push({
            element: scrollingElement,
            scrollLeft: scrollingElement.scrollLeft,
            scrollTop: scrollingElement.scrollTop
        })
    }

    return snapshots
}

const measureScrollDelta = (snapshots: ScrollSnapshot[]): { left: number; top: number } => {
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

const translateRectByScrollDelta = (
    rect: DOMRect,
    delta: { left: number; top: number }
): DOMRect => {
    return new DOMRect(rect.left - delta.left, rect.top - delta.top, rect.width, rect.height)
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
        resolveExit?: PresenceExitResolver
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
    /** Update the last captured mid-animation style values for a child. */
    updateChildAnimatedStyle: (key: string, opacity: string, transform: string) => void
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
    // Track number of in-flight exit animations to invoke onExitComplete once
    let inFlightExits = 0

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
            child.lastStyleSnapshot = snapshotComputedStyle(
                getComputedStyle(child.element),
                child.element
            )
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
            : new MutationObserver((records) => {
                  if (records.some((record) => !isStyleProbeMutation(record)))
                      scheduleSnapshotRefresh()
              })

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
    }

    /**
     * Mark an exit as finished.
     *
     * Decrements the `inFlightExits` counter. When the count reaches zero,
     * fires the consumer's `onExitComplete` callback and, in `mode='wait'`,
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
     * finishExit() // fires onExitComplete if the last exit, unblocks waiters
     * ```
     */
    const finishExit = () => {
        if (disposed) return
        inFlightExits -= 1
        if (inFlightExits === 0) {
            context.forceRender?.()
            context.onExitComplete?.()
            if (mode === 'wait' && enterBlocked) {
                enterBlocked = false
                notifyEnterUnblocked()
            }
        }
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
        resolveExit?: PresenceExitResolver
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
            hasScrollableAncestor: initialScrollSnapshot.length > 0,
            lastScrollSnapshot: initialScrollSnapshot
        }
        record.stopObservingStyle = observeStyleChanges(element, () => {
            record.lastStyleSnapshot = snapshotComputedStyle(getComputedStyle(element), element)
        })
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
    const updateChildAnimatedStyle = (key: string, opacity: string, transform: string) => {
        const child = children.get(key)
        if (child) {
            child.lastAnimatedOpacity = opacity
            child.lastAnimatedTransform = transform
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
        // Its siblings' structural matches change once it is gone.
        scheduleSnapshotRefresh()

        if (!child.exit && !child.resolveExit) {
            pwLog('[presence] unregisterChild - no exit animation, removing immediately')
            children.delete(key)
            // Anchors pointing at the removed child would sever the sibling
            // chain for a same-update multi-detach — re-anchor around it.
            refreshSiblingAnchors()
            return
        }

        if (containsStatefulCloneContent(child.element)) {
            pwLog(
                '[presence] unregisterChild - stateful media cannot be cloned faithfully, removing immediately',
                { key }
            )
            children.delete(key)
            refreshSiblingAnchors()
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

        // sync/wait exits keep their layout slot until the exit finishes.
        // popLayout is the mode that explicitly pops exits out of flow so
        // surrounding layout can reflow immediately.
        const shouldPreserveLayout = mode !== 'popLayout'
        // An out-of-flow child holds no layout slot, so a placeholder would
        // INSERT space that never existed — e.g. absolutely-positioned labels
        // crossfading inside a fixed-size pill briefly balloon the pill.
        const isOutOfFlow = computed.position === 'absolute' || computed.position === 'fixed'
        let placeholder: HTMLElement | null = null
        const insertionParent =
            (child.element.parentElement?.isConnected ? child.element.parentElement : null) ??
            (child.insertionParent?.isConnected ? child.insertionParent : null)
        if (shouldPreserveLayout && !isOutOfFlow && insertionParent) {
            placeholder = document.createElement(child.element.tagName.toLowerCase())
            placeholder.setAttribute('data-presence-placeholder', 'true')
            placeholder.style.display = computed.display === 'contents' ? 'block' : computed.display
            placeholder.style.width = `${rect.width}px`
            placeholder.style.height = `${rect.height}px`
            placeholder.style.margin = computed.margin
            placeholder.style.boxSizing = computed.boxSizing
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
            // the child currently is, not where it registered.
            if (!elementIsLive) {
                const slotRect = placeholder.getBoundingClientRect()
                if (slotRect.width > 0 || slotRect.height > 0) {
                    rect = slotRect
                }
            }
        }

        // Clone original node to preserve structure/classes, then inline the
        // snapshotted computed styles to freeze its look.
        const clone = child.element.cloneNode(true) as HTMLElement
        if (clone.id) clone.removeAttribute('id')
        try {
            for (const prop in frozenStyle) {
                // Skip transforms to avoid double offset/scale on the absolutely positioned clone
                if (/transform/i.test(prop)) continue
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
        // the nearest ancestor with a box. Svelte can detach keyed nodes
        // before unregister runs, so fall back to the parent captured at
        // registration time instead of escaping to <body>, which would bypass
        // clipping parents.
        const slotParent = insertionParent ?? document.body
        let positioningParent = slotParent

        // Walk up to find a parent that has actual layout (not display: contents).
        // A `display: contents` element generates no box, so it can never be
        // the clone's containing block: whatever this walk finds is.
        while (positioningParent && positioningParent !== document.body) {
            const parentDisplay = getComputedStyle(positioningParent).display
            if (parentDisplay !== 'contents') {
                break
            }
            positioningParent = positioningParent.parentElement ?? document.body
        }

        const popLayoutSnapshot =
            mode === 'popLayout'
                ? liveStyle
                    ? measurePopLayoutSnapshot(child.element, liveStyle)
                    : child.lastPopLayoutSnapshot
                : undefined
        const parentRect = popLayoutSnapshot ? undefined : positioningParent.getBoundingClientRect()

        if (!popLayoutSnapshot) {
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
        if (popLayoutSnapshot) {
            const popStyles = resolvePopLayoutStyles(popLayoutSnapshot)
            if (popStyles.position) clone.style.position = popStyles.position
            if (popStyles.width) clone.style.width = popStyles.width
            if (popStyles.height) clone.style.height = popStyles.height
            if (popStyles.left) clone.style.left = popStyles.left
            if (popStyles.right) clone.style.right = popStyles.right
            if (popStyles.top) clone.style.top = popStyles.top
            if (popStyles.bottom) clone.style.bottom = popStyles.bottom
        } else {
            clone.style.position = 'absolute'
            clone.style.top = `${rect.top - parentRect!.top + (positioningParent.scrollTop ?? 0)}px`
            clone.style.left = `${rect.left - parentRect!.left + (positioningParent.scrollLeft ?? 0)}px`
            clone.style.width = `${rect.width}px`
            clone.style.height = `${rect.height}px`
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
        if (!popLayoutSnapshot) {
            clone.style.margin = '0'
        }
        clone.style.boxSizing = 'border-box'
        // Redundantly ensure no transforms are applied before positioning/z-index take effect
        resetTransforms(clone)
        // Elevate clone above siblings to ensure it renders on top during exit.
        // Its stacking siblings are both its DOM siblings in the slot and the
        // boxes laid out in its containing block.
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

        clone.setAttribute('data-clone', 'true')
        clone.setAttribute('data-exiting', 'true')
        clone.setAttribute('data-mode', mode)

        pwLog('[presence] clone created', {
            key,
            mode,
            rect: { w: rect.width, h: rect.height, top: rect.top, left: rect.left }
        })
        // Structural placement like upstream: the element's original slot, so
        // ancestor, child-combinator and structural selectors (`> .card`,
        // `:first-child`) match the clone exactly as they matched the element.
        // With a placeholder holding the slot, the clone goes right before it
        // and takes the element's original sibling index.
        const slotAnchor = placeholder ?? resolvePlaceholderAnchor(child)
        slotParent.insertBefore(clone, slotAnchor?.parentElement === slotParent ? slotAnchor : null)
        const activeExit: ActiveExit = { clone, child, placeholder, cancelled: false }
        activeExits.set(key, activeExit)
        const releaseActiveExit = () => {
            if (activeExits.get(key) === activeExit) activeExits.delete(key)
        }

        // Capture the element reference for this specific exit animation
        // This prevents race conditions where re-entry registers a new element with the same key
        // before this exit animation completes
        const exitingElement = child.element

        activeExit.frame = requestAnimationFrame(() => {
            activeExit.frame = undefined
            // Re-entry or boundary teardown can cancel before the first frame.
            if (activeExit.cancelled || disposed) return
            const resolvedExit = child.resolveExit?.(getCustom()) ?? child.exit

            if (!resolvedExit) {
                pwLog('[presence] unregisterChild - no resolved exit animation after custom update')
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

            // Start exit and track in-flight count (handles wait-mode blocking)
            startExit()

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
                    finishExit()
                })
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
        active.animation?.stop?.()
        active.clone.remove()
        removeExitPlaceholder(key, active.placeholder)
        if (children.get(key) === active.child) {
            children.delete(key)
            refreshSiblingAnchors()
        }
        if (active.animation) cancelExit()

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
        for (const child of children.values()) child.stopObservingStyle?.()
        for (const active of activeExits.values()) {
            active.cancelled = true
            if (active.frame !== undefined) cancelAnimationFrame(active.frame)
            active.animation?.stop?.()
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
        inFlightExits = 0
        enterBlocked = false
    }

    return {
        initial,
        mode,
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
     * Signal that the consumer's exit work is complete. Triggers actual
     * unmount and decrements the parent `AnimatePresenceContext` exit count.
     * Idempotent and versioned (calls from a canceled exit cycle are no-ops).
     */
    safeToRemove: () => void
    /** Register a motion descendant with this wrapper's exit barrier. */
    register: PresenceContextProps['register']
    /** Completion callback captured for the current exit cycle. */
    readonly onExitComplete: NonNullable<PresenceContextProps['onExitComplete']>
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
