import type { MotionExit, MotionTransition } from '$lib/types'
import { mergeTransitions } from '$lib/utils/animation'
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
    onExitComplete?: () => void
}): AnimatePresenceContext {
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
        if (!child || !child.exit) {
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

        // Start exit and track in-flight count
        inFlightExits += 1
        requestAnimationFrame(() => {
            animate(clone, exitKeyframes as unknown as DOMKeyframesDefinition, finalTransition)
                .finished.catch(() => {})
                .finally(() => {
                    // Reset elevated styles then remove
                    try {
                        clone.style.zIndex = ''
                    } catch {
                        // ignore
                    }
                    clone.remove()
                    children.delete(key)
                    inFlightExits -= 1
                    if (inFlightExits === 0) {
                        context.onExitComplete?.()
                    }
                })
        })
    }

    return {
        ...context,
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
    if (element && context && exit) {
        context.registerChild(key, element, exit, mergedTransition)
        onDestroy(() => {
            context.unregisterChild(key)
        })
    }
}
/* c8 ignore end */
