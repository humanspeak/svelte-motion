import { isMotionValue, resolveVariant, type VisualElement } from 'motion-dom'

/**
 * Resolves the value a key reverts to when it drops out of an animation
 * target: `initial` (object or variant label) -> `props.style` (non-MotionValue)
 * -> the value first read from the instance.
 *
 * Replaces the removed `VisualElement.getBaseTarget`. Mirrors the inline
 * fallback in Motion's `animation-state.ts` (`animateChanges`), introduced by
 * motion commit `5114f0074` ("Move the removed-value fallback into the
 * animation state"). Array `initial` values are ignored, as upstream does.
 *
 * @param visualElement - The VisualElement whose base target to resolve.
 * @param key - The motion value key, e.g. `opacity`.
 * @returns The base value, or `undefined` when none applies (so callers can
 * chain `?? visualElement.readValue(...)`).
 * @example
 * const base = resolveBaseTarget(visualElement, 'opacity') ?? visualElement.readValue('opacity')
 */
export const resolveBaseTarget = (visualElement: VisualElement, key: string): unknown => {
    // `baseTarget`/`initialValues` are internal, not part of motion-dom's public types
    // (`private` in 13.5.0, omitted from the 13.5.1 typings), so the cast stays.
    const internals = visualElement as unknown as {
        baseTarget: Record<string, unknown>
        initialValues: Record<string, unknown>
    }
    const { props } = visualElement
    const initial = props.initial
    const resolvedInitial =
        typeof initial !== 'boolean' && initial !== undefined
            ? resolveVariant(
                  visualElement,
                  (Array.isArray(initial) ? initial[0] : initial) as never,
                  visualElement.presenceContext?.custom
              )
            : undefined

    const fromInitial =
        resolvedInitial && !Array.isArray(initial)
            ? (resolvedInitial as Record<string, unknown>)[key]
            : undefined
    if (fromInitial !== undefined) return fromInitial

    const fromProps = visualElement.getBaseTargetFromProps(props, key)
    if (fromProps !== undefined && !isMotionValue(fromProps)) return fromProps

    return internals.initialValues[key] === undefined ? internals.baseTarget[key] : undefined
}
