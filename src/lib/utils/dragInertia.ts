import {
    animateValue,
    inertia,
    type AnimationPlaybackControlsWithThen,
    type KeyframeGenerator,
    type ValueAnimationOptions
} from 'motion-dom'

/**
 * Options for one axis of a drag-release inertia animation.
 *
 * @property value Current axis position in pixels.
 * @property velocity Release velocity in pixels per second.
 * @property min Optional minimum boundary in pixels.
 * @property max Optional maximum boundary in pixels.
 * @property power Optional inertia target multiplier.
 * @property timeConstant Optional exponential decay time constant, in milliseconds.
 * @property bounceStiffness Optional boundary spring stiffness.
 * @property bounceDamping Optional boundary spring damping.
 * @property restDelta Optional distance threshold for settling, in pixels.
 * @property restSpeed Optional velocity threshold for settling, in pixels per second.
 * @property modifyTarget Optional callback that adjusts the calculated inertia target.
 */
export type DragInertiaAxisOptions = {
    value: number
    velocity: number
    min?: number
    max?: number
    power?: number
    timeConstant?: number
    bounceStiffness?: number
    bounceDamping?: number
    restDelta?: number
    restSpeed?: number
    modifyTarget?: (target: number) => number
}

/**
 * Creates Motion-compatible inertia animation options for one drag axis.
 *
 * Converts {@link DragInertiaAxisOptions} into
 * {@link ValueAnimationOptions}. The duplicated `keyframes` value seeds
 * Motion's inertia generator from the current drag-release position while the
 * `inertia` type calculates the target from velocity, bounds, and
 * `modifyTarget`.
 *
 * @param options Initial axis state, boundary constraints, and inertia physics.
 * @returns Motion animation options consumed by `animateValue` or `inertia`.
 *
 * @example
 * ```ts
 * const options = createDragInertiaOptions({ value: 0, velocity: 600, min: -100, max: 100 })
 * ```
 */
export const createDragInertiaOptions = (
    options: DragInertiaAxisOptions
): ValueAnimationOptions<number> => {
    const {
        value,
        velocity,
        min,
        max,
        power,
        timeConstant,
        bounceStiffness,
        bounceDamping,
        restDelta,
        restSpeed,
        modifyTarget
    } = options

    return {
        keyframes: [value, value],
        type: inertia,
        velocity,
        power,
        timeConstant,
        bounceStiffness,
        bounceDamping,
        restDelta,
        restSpeed,
        modifyTarget,
        min,
        max
    }
}

/**
 * Starts an upstream Motion inertia animation for one drag axis.
 *
 * @param options Initial axis state and inertia transition options.
 * @param handlers Animation lifecycle handlers.
 * @param handlers.onUpdate Called repeatedly with the current axis value.
 * @param handlers.onComplete Called once when the inertia animation settles.
 * @returns Motion animation playback controls.
 *
 * @example
 * ```ts
 * const controls = startDragInertia(
 *   { value: 0, velocity: 600 },
 *   { onUpdate: console.log, onComplete: () => undefined }
 * )
 * ```
 */
export const startDragInertia = (
    options: DragInertiaAxisOptions,
    handlers: {
        onUpdate: (value: number) => void
        onComplete: () => void
    }
): AnimationPlaybackControlsWithThen => {
    return animateValue({
        ...createDragInertiaOptions(options),
        onUpdate: handlers.onUpdate,
        onComplete: handlers.onComplete
    })
}

/**
 * Creates an upstream Motion inertia generator for deterministic sampling.
 *
 * Use this when tests or calculations need repeatable samples from Motion's
 * inertia generator without starting a live animation. For DOM animation,
 * prefer {@link startDragInertia}.
 *
 * @param options Initial axis state and inertia transition options.
 * @returns A keyframe generator that can be sampled deterministically.
 *
 * @example
 * ```ts
 * const generator = createDragInertiaGenerator({ value: 0, velocity: 600 })
 * const sample = generator.next(100)
 * ```
 */
export const createDragInertiaGenerator = (
    options: DragInertiaAxisOptions
): KeyframeGenerator<number> => {
    return inertia(createDragInertiaOptions(options))
}
