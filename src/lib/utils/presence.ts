import type { MotionExit } from '$lib/types'
import { animate, type AnimationOptions } from 'motion'
import { getContext, onDestroy, setContext } from 'svelte'

/** Context key for AnimatePresence */
const ANIMATE_PRESENCE_CONTEXT = Symbol('animate-presence-context')

/**
 * Internal record for a registered presence child.
 * Tracks its element, last known layout/style snapshot, and exit definition.
 */
type PresenceChild = {
    element: HTMLElement
    exit?: MotionExit
    lastRect: DOMRect
    lastComputedStyle: CSSStyleDeclaration
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
    // trunk-ignore(eslint/no-unused-vars)
    registerChild: (key: string, element: HTMLElement, exit?: MotionExit) => void
    /** Update the last known rect/style snapshot for a registered child. */
    // trunk-ignore(eslint/no-unused-vars)
    updateChildState: (key: string, rect: DOMRect, computedStyle: CSSStyleDeclaration) => void
    /** Unregister a child. If it has an exit, clone and animate it out. */
    // trunk-ignore(eslint/no-unused-vars)
    unregisterChild: (key: string) => void
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
export function createAnimatePresenceContext(context: {
    onExitComplete?: () => void
}): AnimatePresenceContext {
    const children = new Map<string, PresenceChild>()

    const registerChild = (key: string, element: HTMLElement, exit?: MotionExit) => {
        const initialRect = element.getBoundingClientRect()
        const initialStyle = getComputedStyle(element)
        children.set(key, {
            element,
            exit,
            lastRect: initialRect,
            lastComputedStyle: initialStyle
        })
    }

    const updateChildState = (key: string, rect: DOMRect, computedStyle: CSSStyleDeclaration) => {
        const child = children.get(key)
        if (child && rect.width > 0 && rect.height > 0) {
            child.lastRect = rect
            child.lastComputedStyle = computedStyle
        }
    }

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
                const value = computed.getPropertyValue(prop)
                const priority = computed.getPropertyPriority(prop)
                if (value) clone.style.setProperty(prop, value, priority)
            }
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

        clone.setAttribute('data-clone', 'true')
        clone.setAttribute('data-exiting', 'true')

        parent.appendChild(clone)

        // Animate the clone to exit state with a default duration, then clean up
        const durationSeconds = 0.35
        requestAnimationFrame(() => {
            animate(
                clone,
                child.exit as unknown as HTMLElement,
                { duration: durationSeconds } as unknown as AnimationOptions
            ).finished.finally(() => {
                clone.remove()
                children.delete(key)
                context.onExitComplete?.()
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
export function usePresence(key: string, element: HTMLElement | null, exit: MotionExit): void {
    const context = getAnimatePresenceContext()
    if (element && context && exit) {
        context.registerChild(key, element, exit)
        onDestroy(() => {
            context.unregisterChild(key)
        })
    }
}
/* c8 ignore end */
