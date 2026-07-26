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
 */

import type { MotionViewport } from '$lib/types.js'
import { addDomEvent, frame, hover, press, type VisualElement } from 'motion-dom'

/*
 * Drag suppression is NOT handled here any more.
 *
 * `drag.ts` holds motion-dom's global drag lock for the duration of a drag
 * SESSION (`setDragLock`, released at pointer-up), and the recognizers this
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

/** Fire a user callback after the current render, as upstream does. */
const postRender = (callback: (() => void) | undefined): void => {
    if (!callback) return
    frame.postRender(() => callback())
}

/** Zero-argument lifecycle callbacks, matching this library's public types. */
export interface HoverGestureCallbacks {
    onHoverStart?: () => void
    onHoverEnd?: () => void
}

/**
 * Attach hover → `setActive('whileHover', …)`.
 *
 * Port of `framer-motion/src/gestures/hover.ts:22-32`. motion-dom's `hover()`
 * owns the pointer plumbing (pointerenter/leave with hover-capable media
 * gating), so this only flips the flag and fires callbacks.
 *
 * @param element Element to observe.
 * @param visualElement Node whose animationState receives the flag.
 * @param callbacks Optional lifecycle callbacks.
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
    return hover(element, () => {
        setGestureActive(visualElement, 'whileHover', true)
        postRender(callbacks?.onHoverStart)

        return () => {
            setGestureActive(visualElement, 'whileHover', false)
            postRender(callbacks?.onHoverEnd)
        }
    })
}

/** Zero-argument tap lifecycle callbacks, matching this library's public types. */
export interface PressGestureCallbacks {
    onTapStart?: () => void
    onTap?: () => void
    onTapCancel?: () => void
}

/**
 * Attach press → `setActive('whileTap', …)`.
 *
 * Port of `framer-motion/src/gestures/press.ts:31-56`. motion-dom's `press()`
 * owns pointer AND keyboard activation (it uses `isElementKeyboardAccessible`
 * internally), which is what keeps the #414 keyboard-tap behaviour without any
 * custom code here — `e2e/armed-buttons` is the parity check.
 *
 * @param element Element to observe.
 * @param visualElement Node whose animationState receives the flag.
 * @param callbacks Optional lifecycle callbacks.
 * @returns Cleanup that detaches the listeners.
 */
export const attachPressGesture = (
    element: Element,
    visualElement: VisualElement,
    callbacks?: PressGestureCallbacks
): (() => void) => {
    /** Upstream skips disabled buttons entirely (`press.ts:12-14`). */
    const isDisabledButton = () => element instanceof HTMLButtonElement && element.disabled

    return press(element, () => {
        if (isDisabledButton()) return
        setGestureActive(visualElement, 'whileTap', true)
        postRender(callbacks?.onTapStart)

        return (_endEvent, { success }) => {
            if (isDisabledButton()) return
            setGestureActive(visualElement, 'whileTap', false)
            // `success` distinguishes a real tap from a cancel (released
            // outside, or interrupted) — upstream `press.ts:20-24`.
            postRender(success ? callbacks?.onTap : callbacks?.onTapCancel)
        }
    })
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
 * @param callbacks Optional lifecycle callbacks.
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

/** Zero-argument in-view lifecycle callbacks, matching this library's public types. */
export interface InViewGestureCallbacks {
    onInViewStart?: () => void
    onInViewEnd?: () => void
}

/** Upstream's `amount` → IntersectionObserver `threshold` mapping. */
const thresholdNames = { some: 0, all: 1 } as const

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
 * @param element Element to observe.
 * @param visualElement Node whose animationState receives the flag.
 * @param viewport Observer options (`root`, `margin`, `amount`, `once`).
 * @param callbacks Optional lifecycle callbacks.
 * @returns Cleanup that detaches the observer.
 */
export const attachInViewGesture = (
    element: Element,
    visualElement: VisualElement,
    viewport?: MotionViewport,
    callbacks?: InViewGestureCallbacks
): (() => void) => {
    if (typeof IntersectionObserver === 'undefined') return () => {}

    const { root, margin: rootMargin, amount = 0, once } = viewport ?? {}
    let hasEnteredView = false
    let isInView = false

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
            postRender(isIntersecting ? callbacks?.onInViewStart : callbacks?.onInViewEnd)

            if (once && isIntersecting) observer.disconnect()
        },
        {
            root: (typeof root === 'function' ? (root as () => Element)() : root) as
                | Element
                | undefined,
            rootMargin,
            threshold: typeof amount === 'number' ? amount : thresholdNames[amount]
        }
    )

    observer.observe(element)

    return () => observer.disconnect()
}
