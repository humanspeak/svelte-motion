import { pwLog } from '$lib/utils/log'
import { hasFinishedPromise, isPromiseLike } from '$lib/utils/promise'
import { mergeInlineStyles } from '$lib/utils/style'
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
    onStart?: (def: unknown) => void,
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

    /**
     * Commit the final keyframe values to the element's inline style so the
     * animated-to state persists after WAAPI clears its keyframes (default
     * `fill: 'none'`). Without this, `animate.{scaleX|scale|rotate|x|y|...}`
     * snap back to the un-animated baseline once the animation ends because
     * those transform shortcuts only exist via the `transform` property —
     * which WAAPI returns to the element's inline `transform` on completion.
     * CSS properties (`opacity`, `backgroundColor`, etc.) aren't affected
     * because `mergeInlineStyles` writes them as discrete properties.
     *
     * Skips committing while a follow-up animation hasn't started — the
     * lifecycle's `then()` resolution races with the next `animate()` call
     * in the wait-mode chain, and we don't want to leak the prior state
     * into the next animation's `from`.
     *
     * See issue #377 for full repro + history.
     */
    const commitFinalKeyframes = () => {
        if (!el.isConnected) return
        try {
            const merged = mergeInlineStyles(
                el.getAttribute('style') ?? '',
                payload as Record<string, unknown>
            )
            if (merged) el.setAttribute('style', merged)
        } catch {
            // Swallow merge failures rather than dropping the onComplete chain.
        }
    }

    if (hasFinishedPromise(controls as unknown as { finished?: unknown })) {
        ;(controls as { finished?: Promise<unknown> }).finished
            ?.then(() => {
                commitFinalKeyframes()
                onComplete?.(payload)
            })
            .catch(() => {})
        return
    }
    if (isPromiseLike(controls as unknown)) {
        ;(controls as unknown as Promise<unknown>)
            .then(() => {
                commitFinalKeyframes()
                onComplete?.(payload)
            })
            .catch(() => {})
    }
}
