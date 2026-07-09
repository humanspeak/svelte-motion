import {
    mapValue as mapValueCore,
    motionValue as motionValueCore,
    springValue as springValueCore,
    transformValue as transformValueCore,
    type FollowValueOptions,
    type SpringOptions,
    type TransformOptions
} from 'motion-dom'
import { augmentMotionValue, type AugmentedMotionValue } from './augmentMotionValue.svelte.js'
import { resolveMotionValueSource, type MotionValueSource } from './toMotionValue.svelte.js'

/**
 * Vanilla (component-free) counterparts of the `use*` motion-value
 * hooks. Same augmented value shape — rune-reactive `.current`, store
 * `.subscribe`, real motion-dom identity — but with MANUAL lifecycle:
 * nothing auto-destroys when a component unmounts, so call `.destroy()`
 * when done (module-scope values that live for the app's lifetime don't
 * need to).
 *
 * Inside components, prefer the `use*` hooks — they register cleanup
 * automatically. Reach for these in `.svelte.ts` modules, shared
 * stores, event handlers, or anywhere outside component init.
 */

/**
 * Create a mutable `MotionValue` outside component context — the
 * vanilla counterpart of `useMotionValue`.
 *
 * @template T The value type — typically `number` or `string`.
 * @param initial The starting value.
 * @returns An {@link AugmentedMotionValue} with manual lifecycle.
 * @example
 * ```ts
 * // module-scope shared value, readable reactively anywhere
 * import { motionValue } from '@humanspeak/svelte-motion'
 *
 * export const scrollProgress = motionValue(0)
 * ```
 */
export const motionValue = <T = number>(initial: T): AugmentedMotionValue<T> =>
    augmentMotionValue(motionValueCore<T>(initial))

/**
 * Spring + follow options for {@link springValue} — every
 * `SpringOptions` key plus `skipInitialAnimation` (forwarded to the
 * underlying follow attachment), matching `useSpring`'s option surface.
 */
export type SpringValueOptions = SpringOptions & Pick<FollowValueOptions, 'skipInitialAnimation'>

/**
 * Create a `MotionValue` that springs toward its source — the vanilla
 * counterpart of `useSpring`. The source can be a static initial value
 * (number or unit string like `'100vh'`), another `MotionValue`, a
 * Svelte readable, or a reactive getter (runes tracked).
 *
 * @param source Initial value or a source to follow.
 * @param options Spring physics options (`stiffness`, `damping`, `visualDuration`, …) plus `skipInitialAnimation`.
 * @returns An {@link AugmentedMotionValue} animating toward the source. `.destroy()` also tears down any internal source bridge.
 * @example
 * ```ts
 * import { motionValue, springValue } from '@humanspeak/svelte-motion'
 *
 * const x = motionValue(0)
 * const smoothX = springValue(x, { stiffness: 300, damping: 30 })
 * x.set(200) // smoothX animates there
 * ```
 * @example
 * ```ts
 * // Rune-driven source via a getter
 * let target = $state(0)
 * const smooth = springValue(() => target, { visualDuration: 0.3 })
 * ```
 */
export function springValue(
    source: number | MotionValueSource<number>,
    options?: SpringValueOptions
): AugmentedMotionValue<number>
export function springValue(
    source: string | MotionValueSource<string>,
    options?: SpringValueOptions
): AugmentedMotionValue<string>
export function springValue<T extends number | string>(
    source: T | MotionValueSource<T>,
    options?: SpringValueOptions
): AugmentedMotionValue<T> {
    if (typeof source === 'number' || typeof source === 'string') {
        return augmentMotionValue(springValueCore<T>(source, options))
    }
    const { value, dispose } = resolveMotionValueSource(source)
    return augmentMotionValue(springValueCore<T>(value, options), dispose)
}

/**
 * Create a computed `MotionValue` from a function — the vanilla
 * counterpart of `useTransform`'s compute form. Dependencies are
 * collected exactly like upstream motion-dom: `.get()` reads on
 * `MotionValue`s inside the compute are tracked.
 *
 * Svelte runes are NOT tracked here (upstream semantics, kept
 * deliberately) — bring rune state in through `toMotionValue`:
 *
 * @param compute Function deriving the value from `MotionValue.get()` reads.
 * @returns An {@link AugmentedMotionValue} recomputing when tracked values change.
 * @example
 * ```ts
 * import { motionValue, toMotionValue, transformValue } from '@humanspeak/svelte-motion'
 *
 * const x = motionValue(0)
 * // Rune state enters via toMotionValue, then tracks like any value:
 * const scale = toMotionValue(() => ui.scale)
 * const shifted = transformValue(() => x.get() * scale.get())
 * ```
 */
export const transformValue = <O>(compute: () => O): AugmentedMotionValue<O> =>
    augmentMotionValue(transformValueCore(compute))

/**
 * Create a `MotionValue` mapping a source range onto an output range —
 * the vanilla counterpart of `useTransform`'s range form. The source
 * can be a `MotionValue`, a Svelte readable, or a reactive getter.
 *
 * @template O The output value type (number, color string, unit string, …).
 * @param source The driving value.
 * @param inputRange Ascending breakpoints sampled from the source.
 * @param outputRange Values (same length) the input maps onto — mixable numbers, colors, or unit strings.
 * @param options Mapping options (`clamp`, `ease`, `mixer`).
 * @returns An {@link AugmentedMotionValue} of the mapped value. `.destroy()` also tears down any internal source bridge.
 * @example
 * ```ts
 * import { mapValue, motionValue } from '@humanspeak/svelte-motion'
 *
 * const x = motionValue(0)
 * const opacity = mapValue(x, [0, 200], [1, 0])
 * const color = mapValue(x, [0, 200], ['#ff0088', '#00ccff'])
 * ```
 */
export const mapValue = <O>(
    source: MotionValueSource<number>,
    inputRange: number[],
    outputRange: O[],
    options?: TransformOptions<O>
): AugmentedMotionValue<O> => {
    const { value, dispose } = resolveMotionValueSource(source)
    return augmentMotionValue(mapValueCore(value, inputRange, outputRange, options), dispose)
}
