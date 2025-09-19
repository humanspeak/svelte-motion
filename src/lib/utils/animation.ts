import type { AnimationOptions, DOMKeyframesDefinition } from 'motion'
import { animate } from 'motion'
import { hasFinishedPromise, isPromiseLike } from './promise.js'

export function mergeTransitions(
    root: AnimationOptions | undefined,
    local: AnimationOptions | undefined
): AnimationOptions {
    return { ...(root ?? {}), ...(local ?? {}) }
}

export function animateWithLifecycle(
    el: HTMLElement,
    keyframes: DOMKeyframesDefinition,
    transition: AnimationOptions,
    onStart?: (def: unknown) => void,
    onComplete?: (def: unknown) => void
): void {
    const payload = keyframes
    onStart?.(payload)
    const controls = animate(el, payload, transition)
    if (hasFinishedPromise(controls as unknown as { finished?: unknown })) {
        ;(controls as { finished?: Promise<unknown> }).finished
            ?.then(() => onComplete?.(payload))
            .catch(() => {})
        return
    }
    if (isPromiseLike(controls as unknown)) {
        ;(controls as unknown as Promise<unknown>).then(() => onComplete?.(payload)).catch(() => {})
    }
}
