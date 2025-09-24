import type { MotionExit } from '$lib/types'
import { animate, type AnimationOptions } from 'motion'
import { getContext, onDestroy, setContext } from 'svelte'

/** Context key for AnimatePresence */
const ANIMATE_PRESENCE_CONTEXT = Symbol('animate-presence-context')

type PresenceChild = {
    element: HTMLElement
    exit?: MotionExit
    lastRect: DOMRect
    lastComputedStyle: CSSStyleDeclaration
}

export type AnimatePresenceContext = {
    onExitComplete?: () => void
    registerChild: (
        // trunk-ignore(eslint/no-unused-vars)
        key: string,
        // trunk-ignore(eslint/no-unused-vars)
        element: HTMLElement,
        // trunk-ignore(eslint/no-unused-vars)
        exit?: MotionExit
    ) => void

    // trunk-ignore(eslint/no-unused-vars)
    updateChildState: (key: string, rect: DOMRect, computedStyle: CSSStyleDeclaration) => void
    // trunk-ignore(eslint/no-unused-vars)
    unregisterChild: (key: string) => void
}

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

export function getAnimatePresenceContext(): AnimatePresenceContext | undefined {
    return getContext(ANIMATE_PRESENCE_CONTEXT)
}

export function setAnimatePresenceContext(context: AnimatePresenceContext) {
    setContext(ANIMATE_PRESENCE_CONTEXT, context)
}

export function usePresence(key: string, element: HTMLElement | null, exit: MotionExit): void {
    const context = getAnimatePresenceContext()
    if (element && context && exit) {
        context.registerChild(key, element, exit)
        onDestroy(() => {
            context.unregisterChild(key)
        })
    }
}
