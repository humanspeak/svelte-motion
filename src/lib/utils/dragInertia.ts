import {
    animateValue,
    inertia,
    type AnimationPlaybackControlsWithThen,
    type KeyframeGenerator,
    type ValueAnimationOptions
} from 'motion-dom'

/** Options for one axis of a drag-release inertia animation. */
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
 * Creates the upstream Motion inertia generator options for one drag axis.
 *
 * @param options Initial axis state and inertia transition options.
 * @returns Motion-compatible inertia animation options.
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
 * @returns Motion animation playback controls.
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
 * @param options Initial axis state and inertia transition options.
 * @returns A Motion inertia keyframe generator.
 */
export const createDragInertiaGenerator = (
    options: DragInertiaAxisOptions
): KeyframeGenerator<number> => {
    return inertia(createDragInertiaOptions(options))
}
