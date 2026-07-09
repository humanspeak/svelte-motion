import { attachFollow, motionValue, type FollowValueOptions, type MotionValue } from 'motion-dom'
import { type Readable } from 'svelte/store'
import {
    augmentMotionValue,
    sampleSource,
    type AugmentedMotionValue
} from './augmentMotionValue.svelte.js'
import { resolveMotionValueSource, type MotionValueSource } from './toMotionValue.svelte.js'

/**
 * Options accepted by {@link useFollowValue}. Mirrors framer-motion's
 * `FollowValueOptions` 1:1 — any `ValueAnimationTransition` shape (spring /
 * tween / inertia / keyframes) plus `skipInitialAnimation` for
 * scroll-restoration scenarios.
 *
 * The shape is re-exported from motion-dom so consumers don't have to
 * cross-import.
 *
 * @see https://motion.dev/docs/react-use-follow-value
 */
export type UseFollowValueOptions = FollowValueOptions

/**
 * The augmented `MotionValue` returned by {@link useFollowValue} (and, since
 * `useSpring` now delegates here, by `useSpring` too).
 */
export type FollowMotionValue<T extends number | string> = AugmentedMotionValue<T>

/**
 * Creates an animated `MotionValue` that, when `.set(v)` is called, animates
 * toward `v` using **any** transition type — spring, tween, inertia, or
 * keyframes. Pass another `MotionValue` (or Svelte readable) as the source
 * and the result follows it: every source emit kicks off a new animation
 * toward the latest value.
 *
 * Mirrors React framer-motion's `useFollowValue` 1:1. `useSpring` in this
 * library is now a thin wrapper that delegates here with the default
 * `{ type: 'spring' }`.
 *
 * Returned object is a real motion-dom `MotionValue` (composes with
 * `useTransform`, `useVelocity`, `animate()`, etc.) augmented with a
 * `$state`-backed `.current` getter and a Svelte readable `.subscribe`
 * shim.
 *
 * Lifecycle: must be called during component initialization. Cleanup is
 * registered via `$effect`; the follow animation stops, the source bridge
 * (if any) tears down, and `value.destroy()` runs when the surrounding
 * `$effect` scope unmounts.
 *
 * SSR-safe: returns a static augmented `MotionValue` with no animation on
 * the server. `.set` and `.jump` become no-ops to avoid drifting away from
 * the server-rendered snapshot.
 *
 * @template T The value type — `number` or `string` (unit strings preserved).
 * @param source Initial value, a `MotionValue` to follow, a Svelte readable,
 *     or a reactive getter (`$state` / `$derived` reads inside it are tracked).
 * @param options Transition + follow configuration (`type: 'spring' | 'tween' | 'inertia' | 'keyframes'`, plus the corresponding per-type options).
 * @returns A `MotionValue<T>` with `.current` and `.subscribe`.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useFollowValue, useMotionValue } from '@humanspeak/svelte-motion'
 *
 *   const target = useMotionValue(0)
 *
 *   // Spring follow (default — same as `useSpring(target)`).
 *   const spring = useFollowValue(target, { stiffness: 300, damping: 30 })
 *
 *   // Tween follow — eased linear interpolation.
 *   const eased = useFollowValue(target, {
 *     type: 'tween',
 *     duration: 0.4,
 *     ease: 'easeInOut'
 *   })
 *
 *   // Inertia — decays from initial velocity.
 *   const drifting = useFollowValue(0, { type: 'inertia', velocity: 800, power: 0.6 })
 * </script>
 *
 * <button onclick={() => target.set(target.get() === 0 ? 200 : 0)}>Toggle</button>
 * <div style="transform: translateX({spring.current}px)">spring</div>
 * <div style="transform: translateX({eased.current}px)">tween</div>
 * <div style="transform: translateX({drifting.current}px)">inertia</div>
 * ```
 *
 * @see https://motion.dev/docs/react-use-follow-value
 */
export function useFollowValue(
    source: number,
    options?: UseFollowValueOptions
): FollowMotionValue<number>
export function useFollowValue(
    source: string,
    options?: UseFollowValueOptions
): FollowMotionValue<string>
export function useFollowValue(
    source: MotionValue<number>,
    options?: UseFollowValueOptions
): FollowMotionValue<number>
export function useFollowValue(
    source: MotionValue<string>,
    options?: UseFollowValueOptions
): FollowMotionValue<string>
// Generic source overload preserves the concrete T from the source so
// callers passing `Readable<T>` or `() => T` get `FollowMotionValue<T>` back.
export function useFollowValue<T extends number | string>(
    source: Readable<T> | (() => T),
    options?: UseFollowValueOptions
): FollowMotionValue<T>
export function useFollowValue(
    source: number | string | MotionValueSource<number> | MotionValueSource<string>,
    options: UseFollowValueOptions = {}
): FollowMotionValue<number> | FollowMotionValue<string> {
    type T = number | string

    // SSR: return a static MotionValue with no animation. Reads return the
    // best-effort initial value; .set / .jump become no-ops to avoid drifting
    // away from the server-rendered snapshot.
    if (typeof window === 'undefined') {
        const initial =
            typeof source === 'function'
                ? (source as () => T)()
                : sampleSource(source as T | MotionValue<T> | Readable<T>)
        const ssrValue = motionValue<T>(initial)
        ssrValue.set = () => undefined
        ssrValue.jump = () => undefined
        return augmentMotionValue(ssrValue) as unknown as
            | FollowMotionValue<number>
            | FollowMotionValue<string>
    }

    // Resolve the follow source through the shared machinery: MotionValues
    // pass through, readables and reactive getters are bridged (a readable's
    // synchronous initial emit is inert — the bridge skips it, and motion-dom
    // ignores same-value writes — so no explicit guard is needed here).
    let followSource: T | MotionValue<T>
    let disposeBridge: VoidFunction = () => undefined

    if (typeof source === 'number' || typeof source === 'string') {
        followSource = source
    } else {
        const resolved = resolveMotionValueSource(source as MotionValueSource<T>)
        followSource = resolved.value
        disposeBridge = resolved.dispose
    }

    const initial: T =
        typeof followSource === 'number' || typeof followSource === 'string'
            ? followSource
            : followSource.get()

    const value = motionValue<T>(initial)
    // Default transition is `spring` — matches React framer-motion's
    // `useFollowValue` default. Caller's `type` (if set) overrides.
    const stopFollow = attachFollow(value, followSource, { type: 'spring', ...options })

    const dispose = () => {
        stopFollow?.()
        disposeBridge()
    }

    $effect(() => () => value.destroy())

    return augmentMotionValue(value, dispose) as unknown as
        | FollowMotionValue<number>
        | FollowMotionValue<string>
}
