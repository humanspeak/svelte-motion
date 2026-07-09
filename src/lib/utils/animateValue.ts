import {
    animate as animateCore,
    type AnimationSequence,
    type ObjectTarget,
    type SequenceOptions
} from 'motion'
import type {
    AnimationOptions,
    AnimationPlaybackControlsWithThen,
    DOMKeyframesDefinition,
    ElementOrSelector,
    UnresolvedValueKeyframe,
    ValueAnimationTransition
} from 'motion-dom'
import type { AnyMotionValue } from './transform.svelte.js'

/**
 * The `animate` signature re-typed so this library's Svelte-augmented motion
 * values (`AnyMotionValue<T>`) are accepted as the animation subject without a
 * cast. Every non-value overload (sequences, element/selector targets, object
 * targets) is preserved verbatim from motion's `animate`; only the motion-value
 * overloads widen their first parameter from `MotionValue<T>` to
 * `AnyMotionValue<T>`.
 *
 * The value overloads deliberately precede the object-target overload so a call
 * like `animate(motionValue, [0, 1])` resolves to the value overload rather than
 * being (mis)matched against `<O>(object: O, keyframes: ObjectTarget<O>)`.
 *
 * @see {@link https://motion.dev/docs/animate} for the runtime behavior.
 */
export interface SvelteMotionAnimate {
    /** Animate a sequence of segments on a shared timeline. */
    (sequence: AnimationSequence, options?: SequenceOptions): AnimationPlaybackControlsWithThen
    /** Animate a string motion value (raw or augmented). */
    (
        value: string | AnyMotionValue<string>,
        keyframes: string | UnresolvedValueKeyframe<string>[],
        options?: ValueAnimationTransition<string>
    ): AnimationPlaybackControlsWithThen
    /** Animate a numeric motion value (raw or augmented). */
    (
        value: number | AnyMotionValue<number>,
        keyframes: number | UnresolvedValueKeyframe<number>[],
        options?: ValueAnimationTransition<number>
    ): AnimationPlaybackControlsWithThen
    /** Animate a motion value of any keyframe-compatible type (raw or augmented). */
    <V extends string | number>(
        value: V | AnyMotionValue<V>,
        keyframes: V | UnresolvedValueKeyframe<V>[],
        options?: ValueAnimationTransition<V>
    ): AnimationPlaybackControlsWithThen
    /** Animate DOM element(s) or a CSS selector. */
    (
        element: ElementOrSelector,
        keyframes: DOMKeyframesDefinition,
        options?: AnimationOptions
    ): AnimationPlaybackControlsWithThen
    /** Animate the properties of a plain object (or array of objects). */
    <O extends object>(
        object: O | O[],
        keyframes: ObjectTarget<O>,
        options?: AnimationOptions
    ): AnimationPlaybackControlsWithThen
}

/**
 * Motion's `animate`, re-typed to accept this library's Svelte-augmented motion
 * values without a cast.
 *
 * Identical to motion's `animate` at runtime — this is a single type-level cast,
 * not a wrapper function, so `animate === motion's animate` and stack traces are
 * unchanged. The re-type exists because values from
 * `useMotionValue`/`useSpring`/`motionValue`/etc. are `AugmentedMotionValue<T>`,
 * whose structural `Omit`-based shape loses the `MotionValue` class's private
 * fields; TypeScript's nominal typing then rejects them against upstream's
 * `MotionValue<T>` parameter even though they are the same instances at runtime.
 * See `effects.ts` for the same pattern and `augmentMotionValue.svelte.ts` for
 * why the augmented type drops the class's private-field brand.
 *
 * When bumping `motion`/`motion-dom`, re-check the passthrough overloads below
 * against upstream's `animate`/`createScopedAnimate` signatures.
 *
 * @example
 * ```ts
 * import { animate, motionValue } from '@humanspeak/svelte-motion'
 *
 * const x = motionValue(0)
 * animate(x, 100, { duration: 0.5 }) // no cast required
 * ```
 */
export const animate = animateCore as SvelteMotionAnimate
