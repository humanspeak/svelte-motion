import { pwLog } from '$lib/utils/log'
import { hasFinishedPromise, isPromiseLike } from '$lib/utils/promise'
import { type AnimationOptions, type DOMKeyframesDefinition, animate } from 'motion'

/**
 * Animation utilities for Svelte Motion.
 *
 * Provides helpers for composing transition objects and ensuring lifecycle
 * callbacks fire consistently regardless of the underlying Motion control type.
 */

/**
 * Merge Motion `AnimationOptions` objects without mutating the inputs.
 *
 * Later values override earlier ones. Use to combine root configuration from
 * `MotionConfig` with local `transition` props. Accepts a variadic list.
 *
 * @param args List of `AnimationOptions` to merge in left-to-right order.
 * @return A new merged `AnimationOptions` object.
 */
export const mergeTransitions = (...args: AnimationOptions[]): AnimationOptions => {
    return args.reduce<AnimationOptions>((acc, next) => {
        return { ...acc, ...next }
    }, {})
}

/**
 * Animate an element and invoke lifecycle callbacks around the main transition.
 *
 * Wraps `motion.animate` to ensure `onStart` and `onComplete` are called
 * whether the returned control exposes a `finished` promise or is then-able.
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
    /* trunk-ignore(eslint/no-unused-vars) */
    onStart?: (def: unknown) => void,
    /* trunk-ignore(eslint/no-unused-vars) */
    onComplete?: (def: unknown) => void
): void => {
    const payload = keyframes
    const computed = getComputedStyle(el)
    pwLog('[animateWithLifecycle] starting', {
        keyframes: payload,
        transition,
        currentOpacity: el.style.opacity,
        currentTransform: el.style.transform,
        computedOpacity: computed.opacity,
        computedTransform: computed.transform
    })
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
