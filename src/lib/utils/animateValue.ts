import {
    animate as animateCore,
    createScopedAnimate as createScopedAnimateCore,
    type AnimationSequence,
    type ObjectTarget,
    type Timeline,
    type TimelineOptions
} from 'motion'
import type {
    AnimateEffect,
    AnimationOptions,
    DOMKeyframesDefinition,
    ElementOrSelector,
    AnimationScope as MotionAnimationScope,
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
 * `AnyMotionValue<T>`. The effect-registry statics live on
 * {@link SvelteMotionAnimateWithEffects}, which only the module-level `animate`
 * uses — the scoped animate from `useAnimate()` has no statics at runtime.
 *
 * The value overloads deliberately precede the object-target overload so a call
 * like `animate(motionValue, [0, 1])` resolves to the value overload rather than
 * being (mis)matched against `<O>(object: O, keyframes: ObjectTarget<O>)`.
 *
 * Every overload returns a mutable `Timeline` (Motion 14.7): segments, labels
 * (with offsets like `'mid+0.5'`), callbacks and pauses can be added, moved and
 * removed while it plays, and it can `playTo` a label or `reverse`. The sequence
 * overload takes the timeline options (`autoplay`, `onUpdate`, `onRepeat`,
 * `onReverseComplete`, …) minus `scope`, which comes from `useAnimate()`.
 *
 * @see {@link https://motion.dev/docs/animate} for the runtime behavior.
 */
export interface SvelteMotionAnimate {
    /** Animate a sequence of segments on a shared timeline. */
    (sequence: AnimationSequence, options?: Omit<TimelineOptions, 'scope'>): Timeline
    /** Animate a string motion value (raw or augmented). */
    (
        value: string | AnyMotionValue<string>,
        keyframes: string | UnresolvedValueKeyframe<string>[],
        options?: ValueAnimationTransition<string>
    ): Timeline
    /** Animate a numeric motion value (raw or augmented). */
    (
        value: number | AnyMotionValue<number>,
        keyframes: number | UnresolvedValueKeyframe<number>[],
        options?: ValueAnimationTransition<number>
    ): Timeline
    /** Animate a motion value of any keyframe-compatible type (raw or augmented). */
    <V extends string | number>(
        value: V | AnyMotionValue<V>,
        keyframes: V | UnresolvedValueKeyframe<V>[],
        options?: ValueAnimationTransition<V>
    ): Timeline
    /** Animate DOM element(s) or a CSS selector. */
    (
        element: ElementOrSelector,
        keyframes: DOMKeyframesDefinition,
        options?: AnimationOptions
    ): Timeline
    /** Animate the properties of a plain object (or array of objects). */
    <O extends object>(
        object: O | O[],
        keyframes: ObjectTarget<O>,
        options?: AnimationOptions
    ): Timeline
}

/**
 * The module-level `animate`: every call signature above, plus Motion 13.2's
 * effect-registry statics.
 *
 * These live here and NOT on {@link SvelteMotionAnimate} because the scoped
 * animate returned by `useAnimate()` genuinely does not have them at runtime —
 * upstream's `createScopedAnimate()` returns a bare function. Declaring them on
 * the shared interface would let `const [, animate] = useAnimate();
 * animate.addEffect(effect)` compile and then throw
 * `TypeError: animate.addEffect is not a function`.
 */
export interface SvelteMotionAnimateWithEffects extends SvelteMotionAnimate {
    /**
     * Register an effect so `animate()` can drive the non-DOM subjects it
     * claims (e.g. `animate.addEffect(threeEffect)`). The most recently added
     * effect is tested first; DOM elements are always animated directly.
     */
    addEffect<Subject extends object>(effect: AnimateEffect<Subject>): void
    /** Unregister an effect previously passed to {@link addEffect}. */
    removeEffect<Subject extends object>(effect: AnimateEffect<Subject>): void
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
 * When bumping `motion`/`motion-dom`, re-check the passthrough overloads in
 * {@link SvelteMotionAnimate} against upstream's `animate`/`createScopedAnimate`
 * signatures (last checked against framer-motion `animation/animate/index.ts`
 * @ v14.7.1).
 *
 * @example
 * ```ts
 * import { animate, motionValue } from '@humanspeak/svelte-motion'
 *
 * const x = motionValue(0)
 * animate(x, 100, { duration: 0.5 }) // no cast required
 * ```
 */
export const animate = animateCore as SvelteMotionAnimateWithEffects

/**
 * Options for {@link createScopedAnimate}. Mirrors upstream's (unexported)
 * `ScopedAnimateOptions` in `framer-motion/src/animation/animate/index.ts`.
 */
export interface ScopedAnimateOptions {
    /** Element scope: selectors resolve inside `scope.current`, and started animations are pushed onto `scope.animations`. Accepts the scope from `useAnimate()`. */
    scope?: MotionAnimationScope
    /** Make transform and layout values animate instantly, as `MotionConfig reducedMotion="always"` does. */
    reduceMotion?: boolean
    /** Skip every animation straight to its final value. */
    skipAnimations?: boolean
}

/**
 * Create an `animate` function bound to an optional scope element and
 * settings — Motion's `createScopedAnimate`, re-typed like {@link animate} so
 * Svelte-augmented motion values are accepted without a cast.
 *
 * Selector strings passed to the returned function resolve inside
 * `scope.current` instead of the whole document, and every animation it
 * starts is pushed onto `scope.animations`, so stopping the scope's
 * animations stops them all. This is the factory `useAnimate()` is built on;
 * reach for it directly outside components (actions, attachments, plain
 * modules) or when you own the element's lifecycle.
 *
 * Every call shape returns a mutable `Timeline` (Motion 14.7). Unlike the
 * module-level `animate`, the returned function has no
 * `addEffect`/`removeEffect` statics.
 *
 * Identical to motion's `createScopedAnimate` at runtime — a single
 * type-level cast, not a wrapper.
 *
 * @param options - `scope` to resolve selectors in and register animations
 *   on, plus `reduceMotion` and `skipAnimations`.
 * @returns An `animate` function bound to those options.
 *
 * @example
 * ```ts
 * import { createScopedAnimate } from '@humanspeak/svelte-motion'
 *
 * const card = document.querySelector('.card')!
 * const animateCard = createScopedAnimate({ scope: { current: card, animations: [] } })
 * animateCard('.dot', { x: 100 }) // only the dots inside .card move
 * ```
 *
 * @see {@link https://motion.dev/docs/animate}
 */
export const createScopedAnimate = createScopedAnimateCore as (
    options?: ScopedAnimateOptions
) => SvelteMotionAnimate
