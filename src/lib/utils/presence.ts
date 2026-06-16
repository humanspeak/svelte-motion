import type { AnimatePresenceMode, MotionExit, MotionTransition } from '$lib/types'
import { mergeTransitions } from '$lib/utils/animation'
import { pwLog } from '$lib/utils/log'
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
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
    lastComputedStyle: CSSStyleDeclaration
    lastPopLayoutSnapshot?: PopLayoutSnapshot
    layoutInsertion?: { parent: HTMLElement; before?: HTMLElement }
    hasScrollableAncestor: boolean
    lastScrollSnapshot: ScrollSnapshot[]
    /** Last captured mid-animation opacity (from rAF polling). */
    lastAnimatedOpacity?: string
    /** Last captured mid-animation transform (from rAF polling). */
    lastAnimatedTransform?: string
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
    } as Partial<CSSStyleDeclaration>
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

const findLayoutInsertionParent = (
    element: HTMLElement
): { parent: HTMLElement; before?: HTMLElement } | null => {
    let before = element
    let parent = element.parentElement

    while (parent && getComputedStyle(parent).display === 'contents') {
        before = parent
        parent = parent.parentElement
    }

    return parent ? { parent, before } : null
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
    /** Update the last known rect/style snapshot for a registered child. */
    updateChildState: (key: string, rect: DOMRect, computedStyle: CSSStyleDeclaration) => void
    /** Update the last captured mid-animation style values for a child. */
    updateChildAnimatedStyle: (key: string, opacity: string, transform: string) => void
    /** Unregister a child. If it has an exit, clone and animate it out. */
    unregisterChild: (key: string) => void
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
    custom?: unknown
    getCustom?: () => unknown
}): AnimatePresenceContext => {
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
    if (isInitialRenderPhase && typeof window !== 'undefined') {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
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
    // Track number of in-flight exit animations to invoke onExitComplete once
    let inFlightExits = 0

    const removeExitPlaceholder = (key: string, placeholder?: HTMLElement | null) => {
        const current = exitPlaceholders.get(key)
        const target = placeholder ?? current
        if (!target) return

        target.remove()
        if (!current || current === target) {
            exitPlaceholders.delete(key)
        }
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
        inFlightExits -= 1
        if (inFlightExits === 0) {
            context.onExitComplete?.()
            if (mode === 'wait' && enterBlocked) {
                enterBlocked = false
                notifyEnterUnblocked()
            }
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

        children.set(key, {
            element,
            exit,
            resolveExit,
            mergedTransition,
            lastRect: initialRect,
            lastComputedStyle: initialStyle,
            lastPopLayoutSnapshot:
                mode === 'popLayout' ? measurePopLayoutSnapshot(element, initialStyle) : undefined,
            layoutInsertion: findLayoutInsertionParent(element) ?? undefined,
            hasScrollableAncestor: initialScrollSnapshot.length > 0,
            lastScrollSnapshot: initialScrollSnapshot
        })
    }

    /**
     * Update the last known rect/style snapshot for a registered child.
     */
    const updateChildState = (key: string, rect: DOMRect, computedStyle: CSSStyleDeclaration) => {
        const child = children.get(key)
        if (child && rect.width > 0 && rect.height > 0) {
            child.lastRect = rect
            child.lastComputedStyle = computedStyle
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

        if (!child.exit && !child.resolveExit) {
            pwLog('[presence] unregisterChild - no exit animation, removing immediately')
            children.delete(key)
            return
        }

        const elementIsLive = child.element.isConnected
        const staleScrollDelta = measureScrollDelta(child.lastScrollSnapshot)
        const rect = elementIsLive
            ? child.element.getBoundingClientRect()
            : translateRectByScrollDelta(child.lastRect, staleScrollDelta)
        const computed = elementIsLive ? getComputedStyle(child.element) : child.lastComputedStyle
        if (elementIsLive) {
            child.lastScrollSnapshot = captureScrollSnapshot(child.element)
            child.hasScrollableAncestor = child.lastScrollSnapshot.length > 0
        }

        // sync/wait exits keep their layout slot until the exit finishes.
        // popLayout is the mode that explicitly pops exits out of flow so
        // surrounding layout can reflow immediately.
        const shouldPreserveLayout = mode !== 'popLayout'
        let placeholder: HTMLElement | null = null
        const liveLayoutInsertion = findLayoutInsertionParent(child.element)
        const layoutInsertion =
            liveLayoutInsertion ??
            (child.layoutInsertion?.parent.isConnected ? child.layoutInsertion : null)
        if (shouldPreserveLayout && layoutInsertion) {
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
            const before =
                layoutInsertion.before?.parentElement === layoutInsertion.parent
                    ? layoutInsertion.before
                    : null
            layoutInsertion.parent.insertBefore(placeholder, before)
            exitPlaceholders.set(key, placeholder)
        }

        // Clone original node to preserve structure/classes, then inline computed styles to freeze look
        const clone = child.element.cloneNode(true) as HTMLElement
        if (clone.id) clone.removeAttribute('id')
        try {
            for (let i = 0; i < computed.length; i += 1) {
                const prop = computed[i]
                // Skip transforms to avoid double offset/scale on the absolutely positioned clone
                if (/transform/i.test(prop)) continue
                const value = computed.getPropertyValue(prop)
                const priority = computed.getPropertyPriority(prop)
                if (value) clone.style.setProperty(prop, value, priority)
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

        // Attach to the original insertion parent and position absolutely at the
        // last known rect. Svelte can detach keyed nodes before unregister runs,
        // so fall back to the parent captured at registration time instead of
        // escaping to <body>, which would bypass clipping parents.
        let parent =
            child.element.parentElement ??
            (child.layoutInsertion?.parent.isConnected ? child.layoutInsertion.parent : null) ??
            document.body
        let positioningParent = parent

        // Walk up to find a parent that has actual layout (not display: contents)
        while (positioningParent && positioningParent !== document.body) {
            const parentDisplay = getComputedStyle(positioningParent).display
            if (parentDisplay !== 'contents') {
                break
            }
            positioningParent = positioningParent.parentElement ?? document.body
        }

        const popLayoutSnapshot =
            mode === 'popLayout'
                ? child.element.isConnected
                    ? measurePopLayoutSnapshot(child.element, computed)
                    : child.lastPopLayoutSnapshot
                : undefined
        const parentRect = popLayoutSnapshot ? undefined : positioningParent.getBoundingClientRect()

        if (!popLayoutSnapshot) {
            const parentPosition = getComputedStyle(positioningParent).position
            if (parentPosition === 'static') {
                ;(positioningParent as HTMLElement).style.position = 'relative'
            }
        }

        // Append to the actual positioning parent
        parent = positioningParent

        // Preserve the original display property (especially flex for centered content)
        const originalDisplay = computed.display

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
            clone.style.top = `${rect.top - parentRect!.top + ((parent as HTMLElement).scrollTop ?? 0)}px`
            clone.style.left = `${rect.left - parentRect!.left + ((parent as HTMLElement).scrollLeft ?? 0)}px`
            clone.style.width = `${rect.width}px`
            clone.style.height = `${rect.height}px`
        }
        clone.style.pointerEvents = 'none'
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
        // Elevate clone above siblings to ensure it renders on top during exit
        try {
            const siblings = Array.from(parent.children) as HTMLElement[]
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
        parent.appendChild(clone)

        // Capture the element reference for this specific exit animation
        // This prevents race conditions where re-entry registers a new element with the same key
        // before this exit animation completes
        const exitingElement = child.element

        requestAnimationFrame(() => {
            const resolvedExit = child.resolveExit?.(getCustom()) ?? child.exit

            if (!resolvedExit) {
                pwLog('[presence] unregisterChild - no resolved exit animation after custom update')
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
                (child.mergedTransition ?? {}) as AnimationOptions,
                (exitObj.transition ?? {}) as AnimationOptions,
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

            animate(clone, exitKeyframes as unknown as DOMKeyframesDefinition, finalTransition)
                .finished.catch(() => {})
                .finally(() => {
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
