/**
 * Counts the animations on `#id` whose keyframes animate `transform`.
 *
 * Same body as upstream Motion's `window.countTransformAnimations` test
 * helper: Motion 14.2 runs an element's accelerated independent transforms
 * as one WAAPI `transform` animation, so `1` means "on the compositor" and
 * `0` means "on the main thread" (or idle).
 *
 * @param id - The element's `id`.
 * @returns How many of its animations have `transform` keyframes.
 *
 * @example
 * ```ts
 * countTransformAnimations('box') // 1 while `x` runs accelerated
 * ```
 */
export const countTransformAnimations = (id: string): number =>
    document
        .getElementById(id)!
        .getAnimations()
        .filter((animation) =>
            (animation.effect as KeyframeEffect)
                .getKeyframes()
                .some((keyframe) => 'transform' in keyframe)
        ).length

/**
 * Exposes {@link countTransformAnimations} on `window` for the e2e specs,
 * which call `window.countTransformAnimations(id)`.
 *
 * @example
 * ```ts
 * onMount(exposeCountTransformAnimations)
 * ```
 */
export const exposeCountTransformAnimations = (): void => {
    ;(window as unknown as Record<string, unknown>).countTransformAnimations =
        countTransformAnimations
}
