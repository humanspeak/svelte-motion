import {
    animateMotionValue,
    inertia,
    type AnyResolvedKeyframe,
    type KeyframeGenerator,
    type MotionValue,
    type ValueAnimationOptions,
    type ValueTransition
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
 * Start a drag-release animation ON an axis MotionValue.
 *
 * This is upstream's `startAxisValueAnimation`
 * (`VisualElementDragControls.ts:515-530`): the release animation is registered
 * as the value's OWN animation via `value.start(animateMotionValue(…))`, which
 * buys three things a detached animation cannot:
 *
 * 1. `value.stop()` freezes it correctly, through motion-dom's own
 *    interruption machinery — no hand-rolled sampling.
 * 2. `animateMotionValue` seeds `velocity` from `value.getVelocity()` unless the
 *    transition overrides it, so continuity from the pointer is structural.
 * 3. Every renderer already subscribed to the value (the VisualElement, a
 *    consumer's `style={{ y }}`) tracks the release with no extra plumbing.
 *
 * The `target` is `0` and always overridden: both drag transitions carry their
 * own `keyframes`, and the inertia generator computes its target from velocity
 * and bounds regardless.
 *
 * `isSync` is REQUIRED here, not a preference. Without it `animateMotionValue`
 * builds an `AsyncMotionValueAnimation`, whose resolver asks
 * `canAnimate(keyframes, name, type, velocity)` first — and that returns `false`
 * for our seed keyframes, because `hasKeyframesChanged([v, v])` is false and
 * `isGenerator(inertia)` does not hold for motion-dom's inertia generator. The
 * animation would be made INSTANT: measured as a release that lands on its
 * target in one frame with no glide at all. `isSync` takes the same
 * `JSAnimation` path `animateValue` used before this retarget, so the physics
 * are bit-for-bit the signed-off ones. (Upstream avoids the trap differently: it
 * passes `[null, 0]` keyframes, which read as "changed".)
 *
 * @param name Axis channel name, `'x'` or `'y'` (drives value-type lookup).
 * @param value The axis MotionValue to animate.
 * @param transition Release physics — either {@link createDragInertiaOptions}
 *   output or a boundary spring — plus optional `onComplete`.
 * @returns A promise that resolves when the animation completes.
 *
 * @example
 * ```ts
 * await startAxisRelease('x', xValue, {
 *     ...createDragInertiaOptions({ value: 40, velocity: 600, min: 0, max: 200 }),
 *     onComplete: () => console.log('settled')
 * })
 * ```
 */
export const startAxisRelease = (
    name: 'x' | 'y',
    value: MotionValue<AnyResolvedKeyframe>,
    transition: ValueAnimationOptions<number> & { onComplete?: () => void }
): Promise<void> =>
    value.start(
        animateMotionValue(name, value, 0, {
            ...transition,
            isSync: true
        } as unknown as ValueTransition)
    )

/**
 * Creates an upstream Motion inertia generator for deterministic sampling.
 *
 * Use this when tests or calculations need repeatable samples from Motion's
 * inertia generator without starting a live animation. For DOM animation,
 * prefer {@link startAxisRelease}.
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
