import type { AnimationOptions, DOMKeyframesDefinition } from 'motion'
import { animate } from 'motion'
import { hasFinishedPromise, isPromiseLike } from './promise.js'

/**
 * Merge two Motion `AnimationOptions` objects without mutating the inputs.
 *
 * Later values override earlier ones. Use to combine root configuration from
 * `MotionConfig` with local `transition` props.
 *
 * @param root Transition from context/root.
 * @param local Transition from the local component.
 * @return A new merged `AnimationOptions` object.
 */
export const mergeTransitions = (
    root: AnimationOptions | undefined,
    local: AnimationOptions | undefined
): AnimationOptions => {
    return { ...(root ?? {}), ...(local ?? {}) }
}

/**
 * Animate an element and invoke lifecycle callbacks around the main transition.
 *
 * This wraps `motion.animate` to ensure `onStart` and `onComplete` are called
 * whether the returned control exposes a `finished` Promise or is itself
 * then-able.
 *
 * @param el Target element.
 * @param keyframes Keyframes to animate to.
 * @param transition Animation timing/options.
 * @param onStart Optional lifecycle fired before animation starts.
 * @param onComplete Optional lifecycle fired after animation completes.
 */
export const animateWithLifecycle = (
    el: HTMLElement,
    keyframes: DOMKeyframesDefinition,
    transition: AnimationOptions,
    onStart?: (def: unknown) => void,
    onComplete?: (def: unknown) => void
): void => {
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
