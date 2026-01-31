import type { MotionExit, MotionTransition } from '$lib/types'
import { mergeTransitions } from '$lib/utils/animation'
import { pwLog } from '$lib/utils/log'
import { animate, type AnimationOptions, type DOMKeyframesDefinition } from 'motion'
import { getContext, onDestroy, setContext } from 'svelte'

/**
 * Context key for `AnimatePresence`.
 *
 * Used with Svelte's context API to provide/register presence management.
 */
const ANIMATE_PRESENCE_CONTEXT = Symbol('animate-presence-context')

/**
 * Internal record for a registered presence child.
 *
 * Tracks its element, last known layout/style snapshot, and exit definition
 * so we can create a visually accurate clone on unmount and animate it out.
 */
type PresenceChild = {
    element: HTMLElement
    exit?: MotionExit
    mergedTransition?: MotionTransition
    lastRect: DOMRect
    lastComputedStyle: CSSStyleDeclaration
}

/**
 * Reset any CSS transforms on the element's inline style.
 *
 * Ensures the exiting clone is not additionally offset or scaled by an
 * inherited transform. Applies to standard and vendor-prefixed properties.
 *
 * @param element The element whose inline transform properties should be cleared.
 */
const resetTransforms = (element: HTMLElement): void => {
    const s = element.style
    /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
    ;(s as any).transform = 'none'
    /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
    ;(s as any).webkitTransform = 'none'
    /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
    ;(s as any).msTransform = 'none'
    /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
    ;(s as any).MozTransform = 'none'
    /* trunk-ignore(eslint/@typescript-eslint/no-explicit-any) */
    ;(s as any).OTransform = 'none'
}

/**
 * Presence context API used by `AnimatePresence` and motion elements.
 * Consumers register/unregister children and provide size/style snapshots
 * so we can clone and animate them out after removal.
 */
export type AnimatePresenceContext = {
    /** When false, children skip their enter animation on initial mount. */
    initial: boolean
    /**
     * Returns true if a child with the given key should animate its enter.
     * Returns false only during first render when initial={false} AND the key has never been seen.
     * Re-entries (after exit) always animate.
     */
    shouldAnimateEnter: (key: string) => boolean
    /** Called when all exit animations complete (optional). */
    onExitComplete?: () => void
    /** Register a child element and its exit definition. */
    registerChild: (
        // trunk-ignore(eslint/no-unused-vars)
        key: string,
        // trunk-ignore(eslint/no-unused-vars)
        element: HTMLElement,
        // trunk-ignore(eslint/no-unused-vars)
        exit?: MotionExit,
        // trunk-ignore(eslint/no-unused-vars)
        mergedTransition?: MotionTransition
    ) => void
    /** Update the last known rect/style snapshot for a registered child. */
    updateChildState: (
        // trunk-ignore(eslint/no-unused-vars)
        key: string,
        // trunk-ignore(eslint/no-unused-vars)
        rect: DOMRect,
        // trunk-ignore(eslint/no-unused-vars)
        computedStyle: CSSStyleDeclaration
    ) => void
    /** Unregister a child. If it has an exit, clone and animate it out. */
    unregisterChild: (
        // trunk-ignore(eslint/no-unused-vars)
        key: string
    ) => void
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
export function createAnimatePresenceContext(context: {
    initial?: boolean
    onExitComplete?: () => void
}): AnimatePresenceContext {
    // Default initial to true (animate on first mount) unless explicitly false
    const initial = context.initial !== false

    // Track whether we're still in the initial render phase
    // This is true only when initial={false} and we haven't completed the first frame
    let isInitialRenderPhase = context.initial === false

    // Track keys that have been seen (registered at least once)
    const seenKeys = new Set<string>()

    // Track keys that have exited (unregistered after being registered)
    const exitedKeys = new Set<string>()

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

    pwLog('[presence] createContext', {
        initial,
        isInitialRenderPhase,
        onExitComplete: !!context.onExitComplete
    })

    const children = new Map<string, PresenceChild>()
    // Track number of in-flight exit animations to invoke onExitComplete once
    let inFlightExits = 0

    /**
     * Register a child element and snapshot its initial rect/styles.
     */
    const registerChild = (
        key: string,
        element: HTMLElement,
        exit?: MotionExit,
        mergedTransition?: MotionTransition
    ) => {
        const initialRect = element.getBoundingClientRect()
        const initialStyle = getComputedStyle(element)

        // Mark this key as seen
        const wasExited = exitedKeys.has(key)
        seenKeys.add(key)

        // If this key was previously exited, remove it from exitedKeys (it's re-entering)
        if (wasExited) {
            exitedKeys.delete(key)
        }

        pwLog('[presence] registerChild', {
            key,
            hasExit: !!exit,
            exit,
            wasExited,
            rect: { w: initialRect.width, h: initialRect.height }
        })

        children.set(key, {
            element,
            exit,
            mergedTransition,
            lastRect: initialRect,
            lastComputedStyle: initialStyle
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

        if (!child.exit) {
            pwLog('[presence] unregisterChild - no exit animation, removing immediately')
            children.delete(key)
            return
        }

        const rect = child.lastRect
        const computed = child.lastComputedStyle

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

        // Attach to original parent and position absolutely at the last known rect
        const parent = child.element.parentElement ?? document.body
        const parentRect = parent.getBoundingClientRect()

        const parentPosition = getComputedStyle(parent).position
        if (parentPosition === 'static') {
            ;(parent as HTMLElement).style.position = 'relative'
        }

        clone.style.position = 'absolute'
        clone.style.top = `${rect.top - parentRect.top + ((parent as HTMLElement).scrollTop ?? 0)}px`
        clone.style.left = `${rect.left - parentRect.left + ((parent as HTMLElement).scrollLeft ?? 0)}px`
        clone.style.width = `${rect.width}px`
        clone.style.height = `${rect.height}px`
        clone.style.pointerEvents = 'none'
        clone.style.visibility = 'visible'
        clone.style.display = 'block'
        clone.style.margin = '0'
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

        pwLog('[presence] clone created', {
            key,
            rect: { w: rect.width, h: rect.height, top: rect.top, left: rect.left }
        })
        parent.appendChild(clone)

        // Merge transitions: default < mergedTransition < exit.transition (last wins)
        const exitObj = (child.exit ?? {}) as unknown as { transition?: MotionTransition }
        const finalTransition = mergeTransitions(
            { duration: 0.35 } as AnimationOptions,
            (child.mergedTransition ?? {}) as AnimationOptions,
            (exitObj.transition ?? {}) as AnimationOptions
        )

        // Prepare exit keyframes without any inline transition data
        const rawExit = (child.exit ?? {}) as unknown as Record<string, unknown>
        /* trunk-ignore(eslint/@typescript-eslint/no-unused-vars) */
        const { transition: _ignoredTransition, ...exitKeyframes } = rawExit

        pwLog('[presence] starting exit animation', {
            key,
            exitKeyframes,
            finalTransition
        })

        // Capture the element reference for this specific exit animation
        // This prevents race conditions where re-entry registers a new element with the same key
        // before this exit animation completes
        const exitingElement = child.element

        // Start exit and track in-flight count
        inFlightExits += 1
        requestAnimationFrame(() => {
            animate(clone, exitKeyframes as unknown as DOMKeyframesDefinition, finalTransition)
                .finished.catch(() => {})
                .finally(() => {
                    pwLog('[presence] exit animation complete', { key })
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

                    inFlightExits -= 1
                    if (inFlightExits === 0) {
                        pwLog('[presence] all exits complete, calling onExitComplete')
                        context.onExitComplete?.()
                    }
                })
        })
    }

    return {
        initial,
        shouldAnimateEnter,
        onExitComplete: context.onExitComplete,
        registerChild,
        updateChildState,
        unregisterChild
    }
}

/**
 * Get the current `AnimatePresence` context from Svelte component context.
 *
 * Note: Trivial wrapper - ignored for coverage.
 */
/* c8 ignore next 3 */
export function getAnimatePresenceContext(): AnimatePresenceContext | undefined {
    return getContext(ANIMATE_PRESENCE_CONTEXT)
}

/**
 * Set the `AnimatePresence` context into Svelte component context.
 *
 * Note: Trivial wrapper - ignored for coverage.
 */
/* c8 ignore next 3 */
export function setAnimatePresenceContext(context: AnimatePresenceContext) {
    setContext(ANIMATE_PRESENCE_CONTEXT, context)
}

/**
 * Hook used by motion elements to participate in presence.
 * Registers the element and ensures its exit animation runs on teardown.
 *
 * Note: Svelte lifecycle wrapper - ignored for coverage.
 */
/* c8 ignore start */
/**
 * Hook used by motion elements to participate in presence.
 *
 * Registers the element with the presence context and guarantees that the
 * exit animation is scheduled on teardown.
 *
 * @param key Unique identifier for the presence child.
 * @param element The DOM element to track.
 * @param exit The exit keyframes definition.
 * @param mergedTransition The element's merged transition for precedence.
 */
export function usePresence(
    key: string,
    element: HTMLElement | null,
    exit: MotionExit,
    mergedTransition?: MotionTransition
): void {
    const context = getAnimatePresenceContext()
    pwLog('[presence] usePresence called', {
        key,
        hasElement: !!element,
        hasContext: !!context,
        hasExit: !!exit,
        exit
    })
    if (element && context && exit) {
        context.registerChild(key, element, exit, mergedTransition)
        onDestroy(() => {
            pwLog('[presence] onDestroy triggered', { key })
            context.unregisterChild(key)
        })
    } else {
        pwLog('[presence] usePresence - skipping registration', {
            reason: !element ? 'no element' : !context ? 'no context' : 'no exit'
        })
    }
}
/* c8 ignore end */
