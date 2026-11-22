/**
 * Thin gesture attachers (#449 plan 003).
 *
 * Upstream gestures never animate. Each handler flips one flag —
 * `animationState.setActive('whileX', bool)` — and the single animation resolver
 * does the rest with priority ordering (`variantPriorityOrder`) and protected
 * keys. That is why hover↔tap velocity handoff is STRUCTURAL upstream: both
 * gestures retarget the SAME MotionValue, and `animateMotionValue` seeds the new
 * generator with `value.getVelocity()`.
 *
 * These four functions are ports of:
 * - `framer-motion/src/gestures/hover.ts` (HoverGesture)
 * - `framer-motion/src/gestures/press.ts` (PressGesture)
 * - `framer-motion/src/gestures/focus.ts` (FocusGesture)
 * - `framer-motion/src/motion/features/viewport/index.ts` (InViewFeature)
 *
 * They replace ~1,400 lines of per-gesture animation machinery plus the
 * `gestureCoordinator` that hand-approximated setActive/protected-keys.
 *
 * Like upstream's one Feature per gesture, the component keeps one attachment
 * per gesture for the element's lifetime and never re-attaches on a prop
 * change: the `while*` definitions are read from `visualElement.getProps()`
 * and the callbacks through getter-backed objects, both at event time. Only
 * the in-view observer restarts, and only when `viewport.amount`, `margin` or
 * `root` changes (`createInViewGesture`).
 */

import type { MotionViewport } from '$lib/types.js'
import {
    addDomEvent,
    extractEventInfo,
    frame,
    hover,
    press,
    type EventInfo,
    type PointerEventOptions,
    type TapInfo,
    type ViewportEventHandler,
    type VisualElement
} from 'motion-dom'

/*
 * Drag suppression is NOT handled here any more.
 *
 * motion-dom's `VisualElementDragControls` holds the global drag lock from
 * the drag's start until pointer-up (`setDragLock` in its pan `onStart`,
 * released by `cancel()` on session end), and the recognizers this
 * module wraps consult that lock themselves before they ever call back:
 * `hover()` filters on `isValidHover` → `!(touch || isDragActive())`
 * (`motion-dom/dist/es/gestures/hover.mjs:4-6`) and `press()` on
 * `isValidPressEvent` → `isPrimaryPointer(event) && !isDragActive()`
 * (`gestures/press/index.mjs:14-16`). The per-element dataset guard this file
 * used to consult is gone with the lock's arrival, and suppression now matches
 * upstream exactly: active while the pointer is down, released for the
 * post-release momentum glide.
 */

/**
 * Activate a variant type on the node, when the matching prop exists.
 *
 * Upstream guards on the prop (`props.whileHover && setActive(...)`) so an
 * element with only callbacks never starts an empty animation.
 *
 * @param visualElement Node owning the animation state.
 * @param type Variant type to toggle.
 * @param isActive Whether the gesture is active.
 * @returns Nothing.
 */
const setGestureActive = (
    visualElement: VisualElement,
    type: 'whileHover' | 'whileTap' | 'whileFocus' | 'whileInView',
    isActive: boolean
): void => {
    const props = visualElement.getProps() as Record<string, unknown>
    if (!visualElement.animationState || !props[type]) return
    void visualElement.animationState.setActive(type, isActive)
}

/**
 * Fire a user callback after the current render with its arguments, as
 * upstream's `handleGestureEvent` does (gestures/hover.ts:28-33 @ v14.14.0).
 * The callback is read by the caller at event time, so the latest prop wins.
 */
const postRender = <Args extends unknown[]>(
    callback: ((...args: Args) => void) | undefined,
    ...args: Args
): void => {
    if (!callback) return
    frame.postRender(() => callback(...args))
}

/**
 * Hover lifecycle callbacks. The arguments match Motion's: the pointer event
 * and `info.point`, its position relative to the page.
 */
export interface HoverGestureCallbacks {
    onHoverStart?: (event: PointerEvent, info: EventInfo) => void
    onHoverEnd?: (event: PointerEvent, info: EventInfo) => void
}

/**
 * Attach hover → `setActive('whileHover', …)`.
 *
 * Port of `framer-motion/src/gestures/hover.ts:22-32`. motion-dom's `hover()`
 * owns the pointer plumbing (pointerenter/leave with hover-capable media
 * gating), so this only flips the flag and fires callbacks. Each callback
 * gets the pointer event that started or ended the hover and
 * `extractEventInfo(event)`, as upstream (hover.ts:14-34).
 *
 * @param element Element to observe.
 * @param visualElement Node whose animationState receives the flag.
 * @param callbacks Optional lifecycle callbacks. Read at event time, so a
 *   getter-backed object supplies the latest callbacks without re-attaching.
 * @returns Cleanup that detaches the listeners.
 *
 * @example
 * ```ts
 * const stop = attachHoverGesture(el, visualElement, { onHoverStart })
 * ```
 */
export const attachHoverGesture = (
    element: Element,
    visualElement: VisualElement,
    callbacks?: HoverGestureCallbacks
): (() => void) => {
    return hover(element, (_element, startEvent) => {
        setGestureActive(visualElement, 'whileHover', true)
        postRender(callbacks?.onHoverStart, startEvent, extractEventInfo(startEvent))

        return (endEvent) => {
            setGestureActive(visualElement, 'whileHover', false)
            postRender(callbacks?.onHoverEnd, endEvent, extractEventInfo(endEvent))
        }
    })
}

/**
 * Tap lifecycle callbacks. The arguments match Motion's: the pointer event and
 * `info.point`, its position relative to the page.
 *
 * `attachPressGesture` reads these at event time, so a getter-backed object
 * can supply the latest callbacks without re-attaching `press()`.
 */
export interface PressGestureCallbacks {
    onTapStart?: (event: PointerEvent, info: TapInfo) => void
    onTap?: (event: PointerEvent, info: TapInfo) => void
    onTapCancel?: (event: PointerEvent, info: TapInfo) => void
}

/**
 * Attach press → `setActive('whileTap', …)`.
 *
 * Port of `framer-motion/src/gestures/press.ts` (`PressGesture.mount`) and the
 * `isRepeat` branch of `framer-motion/src/gestures/hover.ts`
 * (`handleGestureEvent`), both at v14.10.1. motion-dom's `press()` owns pointer
 * AND keyboard activation (it uses `isElementKeyboardAccessible` internally),
 * which is what keeps the #414 keyboard-tap behaviour without any custom code
 * here — `e2e/armed-buttons` is the parity check.
 *
 * As upstream (press.ts:35-52 @ v14.14.0), `onTapStart` gets the press event,
 * `onTap` and `onTapCancel` the release event, and a `repeat` fires `onTap`
 * with the press event; each also gets `extractEventInfo(event)`.
 *
 * `press()` reads `options` on each press, and keeps an in-progress `count`
 * sequence per `press()` call. Callers that want option changes to apply
 * without losing a half-finished double tap should pass ONE object for the
 * element's lifetime and mutate it in place (upstream `press.ts` `update()`).
 *
 * @param element Element to observe.
 * @param visualElement Node whose animationState receives the flag.
 * @param callbacks Optional lifecycle callbacks, read at event time.
 * @param options Optional press options passed straight to motion-dom's
 *   `press()`: `count`, `countTimeout`, `hold`, `repeat`, `useGlobalTarget`
 *   and `stopPropagation`.
 * @returns Cleanup that detaches the listeners.
 */
export const attachPressGesture = (
    element: Element,
    visualElement: VisualElement,
    callbacks?: PressGestureCallbacks,
    options?: PointerEventOptions
): (() => void) => {
    /** Upstream skips disabled buttons entirely (`press.ts` `handlePressEvent`). */
    const isDisabledButton = () => element instanceof HTMLButtonElement && element.disabled

    return press(
        element,
        (_element, startEvent) => {
            if (isDisabledButton()) return
            setGestureActive(visualElement, 'whileTap', true)
            postRender(callbacks?.onTapStart, startEvent, extractEventInfo(startEvent))

            return {
                onComplete: (endEvent, { success }) => {
                    if (isDisabledButton()) return
                    setGestureActive(visualElement, 'whileTap', false)
                    // `success` distinguishes a completed tap from a cancel
                    // (released outside, released before `hold`, an unfinished
                    // `count` sequence, or interrupted).
                    postRender(
                        success ? callbacks?.onTap : callbacks?.onTapCancel,
                        endEvent,
                        extractEventInfo(endEvent)
                    )
                },
                // Upstream hover.ts `isRepeat`: fire onTap, keep whileTap active.
                // A repeat passes the START event (upstream press.ts:47-48).
                onRepeat: () => {
                    if (isDisabledButton()) return
                    postRender(callbacks?.onTap, startEvent, extractEventInfo(startEvent))
                }
            }
        },
        options
    )
}

/** Zero-argument focus lifecycle callbacks, matching this library's public types. */
export interface FocusGestureCallbacks {
    onFocusStart?: () => void
    onFocusEnd?: () => void
}

/**
 * Attach focus → `setActive('whileFocus', …)`.
 *
 * Port of `framer-motion/src/gestures/focus.ts`. Only `:focus-visible` focus
 * counts, matching the browser's own outline behaviour — and when `matches`
 * THROWS (older engines, and jsdom, which does not know the selector) upstream
 * treats it as visible so the variant still applies.
 *
 * @param element Element to observe.
 * @param visualElement Node whose animationState receives the flag.
 * @param callbacks Optional lifecycle callbacks. Read at event time, so a
 *   getter-backed object supplies the latest callbacks without re-attaching.
 * @returns Cleanup that detaches the listeners.
 */
export const attachFocusGesture = (
    element: Element,
    visualElement: VisualElement,
    callbacks?: FocusGestureCallbacks
): (() => void) => {
    let isActive = false

    const onFocus = () => {
        let isFocusVisible: boolean
        try {
            isFocusVisible = element.matches(':focus-visible')
        } catch {
            // `:focus-visible` unsupported → the browser paints its default
            // outline, so match that by treating focus as visible.
            isFocusVisible = true
        }
        if (!isFocusVisible) return
        setGestureActive(visualElement, 'whileFocus', true)
        isActive = true
        postRender(callbacks?.onFocusStart)
    }

    const onBlur = () => {
        if (!isActive) return
        setGestureActive(visualElement, 'whileFocus', false)
        isActive = false
        postRender(callbacks?.onFocusEnd)
    }

    const removeFocus = addDomEvent(element, 'focus', onFocus)
    const removeBlur = addDomEvent(element, 'blur', onBlur)

    return () => {
        removeFocus()
        removeBlur()
    }
}

/**
 * In-view lifecycle callbacks. Each gets the IntersectionObserverEntry that
 * reported the change, as Motion's `onViewportEnter`/`onViewportLeave` do.
 */
export interface InViewGestureCallbacks {
    onViewportEnter?: ViewportEventHandler
    onViewportLeave?: ViewportEventHandler
    /** Alias of `onViewportEnter`, called right after it. */
    onInViewStart?: ViewportEventHandler
    /** Alias of `onViewportLeave`, called right after it. */
    onInViewEnd?: ViewportEventHandler
}

/** Upstream's `amount` → IntersectionObserver `threshold` mapping. */
const thresholdNames = { some: 0, all: 1 } as const

/**
 * A restartable in-view gesture, the shape of upstream's `InViewFeature`.
 *
 * @property startObserver Stops any current observer and starts a new one with
 *   the latest viewport options, keeping `hasEnteredView`/`isInView`. A no-op
 *   once a `once` gesture has latched.
 * @property unmount Stops the observer and resets the entry state.
 */
export interface InViewGesture {
    startObserver: () => void
    unmount: () => void
}

/**
 * Create the in-view gesture for an element without starting it.
 *
 * Port of `framer-motion/src/motion/features/viewport/index.ts:10-95`
 * (v14.14.0), driving an IntersectionObserver directly (upstream's
 * `observeIntersection`). `hasEnteredView` and `isInView` live for the
 * gesture's lifetime, as upstream's class fields do, so `startObserver()` can
 * restart the observer (upstream `update()` on an `amount`/`margin`/`root`
 * change) without the browser's initial report re-firing `onViewportEnter`.
 *
 * `onViewportEnter`/`onViewportLeave` run synchronously inside the observer
 * callback with the IntersectionObserverEntry, as upstream
 * (viewport/index.ts:57-63). The aliases `onInViewStart`/`onInViewEnd` run
 * right after them with the same entry.
 *
 * The `amount: 'some' | 'all' | number → threshold` mapping matches upstream's
 * `thresholdNames`. `once` latches on first entry: the leave half never runs
 * and the observer detaches, matching upstream's `hasEnteredView` guard and our
 * documented behaviour. Upstream does not disconnect; ours does, and a restart
 * after the latch is a no-op so it cannot reopen it.
 *
 * @param element Element to observe.
 * @param visualElement Node whose animationState receives the flag.
 * @param getViewport Returns the current viewport options (`root`, `margin`,
 *   `amount`, `once`); read on each start.
 * @param callbacks Optional viewport callbacks, each called with the entry.
 *   Read at event time, so a getter-backed object supplies the latest
 *   callbacks without restarting.
 * @returns The gesture controller; call `startObserver()` to begin observing.
 *
 * @example
 * ```ts
 * const gesture = createInViewGesture(el, visualElement, () => viewport, { onViewportEnter })
 * gesture.startObserver()
 * // later, on an amount/margin/root change:
 * gesture.startObserver()
 * // on teardown:
 * gesture.unmount()
 * ```
 */
export const createInViewGesture = (
    element: Element,
    visualElement: VisualElement,
    getViewport: () => MotionViewport | undefined,
    callbacks?: InViewGestureCallbacks
): InViewGesture => {
    let hasEnteredView = false
    let isInView = false
    let stopObserver: (() => void) | undefined

    const startObserver = () => {
        stopObserver?.()
        stopObserver = undefined
        if (typeof IntersectionObserver === 'undefined') return
        const { root, margin: rootMargin, amount = 0, once } = getViewport() ?? {}
        // Our `once` disconnects on first entry; a restart must not reopen it.
        if (once && hasEnteredView) return

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[entries.length - 1]
                if (!entry) return
                const { isIntersecting } = entry

                // No state change → nothing to do (upstream's early return).
                if (isInView === isIntersecting) return
                isInView = isIntersecting

                // `once`: latch on first entry, never run the leave half.
                if (once && !isIntersecting && hasEnteredView) return
                if (isIntersecting) hasEnteredView = true

                setGestureActive(visualElement, 'whileInView', isIntersecting)
                // Upstream calls these synchronously with the entry
                // (viewport/index.ts:57-63 @ v14.14.0). `onInViewStart`/`onInViewEnd`
                // are this library's older names, kept as aliases.
                if (isIntersecting) {
                    callbacks?.onViewportEnter?.(entry)
                    callbacks?.onInViewStart?.(entry)
                } else {
                    callbacks?.onViewportLeave?.(entry)
                    callbacks?.onInViewEnd?.(entry)
                }

                if (once && isIntersecting) observer.disconnect()
            },
            {
                root: (typeof root === 'function' ? (root as () => Element)() : root) as
                    Element | undefined,
                rootMargin,
                threshold: typeof amount === 'number' ? amount : thresholdNames[amount]
            }
        )

        observer.observe(element)
        stopObserver = () => observer.disconnect()
    }

    return {
        startObserver,
        unmount: () => {
            stopObserver?.()
            stopObserver = undefined
            hasEnteredView = false
            isInView = false
        }
    }
}

/**
 * Attach viewport intersection → `setActive('whileInView', …)`.
 *
 * Port of `framer-motion/src/motion/features/viewport/index.ts:29-70`, driving an
 * IntersectionObserver directly (upstream's `observeIntersection`). The
 * `amount: 'some' | 'all' | number → threshold` mapping matches both upstream's
 * `thresholdNames` and the options our retired `attachWhileInView` passed.
 *
 * `once` latches on first entry: the leave half never runs and the observer
 * detaches, matching upstream's `hasEnteredView` guard and our documented
 * behaviour.
 *
 * This is `createInViewGesture` + `startObserver()`, for callers whose viewport
 * options are fixed for the attachment's lifetime.
 *
 * @param element Element to observe.
 * @param visualElement Node whose animationState receives the flag.
 * @param viewport Observer options (`root`, `margin`, `amount`, `once`).
 * @param callbacks Optional viewport callbacks, each called synchronously with
 *   the IntersectionObserverEntry (`onViewportEnter`, `onViewportLeave` and
 *   their aliases `onInViewStart`, `onInViewEnd`).
 * @returns Cleanup that detaches the observer.
 */
export const attachInViewGesture = (
    element: Element,
    visualElement: VisualElement,
    viewport?: MotionViewport,
    callbacks?: InViewGestureCallbacks
): (() => void) => {
    const gesture = createInViewGesture(element, visualElement, () => viewport, callbacks)
    gesture.startObserver()
    return gesture.unmount
}
