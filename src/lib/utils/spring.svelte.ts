import { type FollowValueOptions, type MotionValue, type SpringOptions } from 'motion-dom'
import { type Readable } from 'svelte/store'
import { type AugmentedMotionValue } from './augmentMotionValue.svelte.js'
import { useFollowValue } from './followValue.svelte.js'

/**
 * Spring + follow options for {@link useSpring}.
 *
 * Mirrors framer-motion's `useSpring` options 1:1: every `SpringOptions` key
 * (`stiffness`, `damping`, `mass`, `duration`, `visualDuration`, `bounce`,
 * `velocity`, `restDelta`, `restSpeed`) plus `skipInitialAnimation` for
 * scroll-restoration scenarios.
 *
 * `useSpring` is a thin wrapper over {@link useFollowValue} that hard-codes
 * `type: 'spring'`. For other transition types (tween, inertia, keyframes)
 * use `useFollowValue` directly.
 *
 * @see https://motion.dev/docs/react-use-spring
 */
export type UseSpringOptions = SpringOptions & Pick<FollowValueOptions, 'skipInitialAnimation'>

/**
 * The augmented `MotionValue` returned by {@link useSpring}.
 *
 * It IS a real `MotionValue<T>` (so it passes `isMotionValue`, composes with
 * `animate()`, `useTransform`, and the rest of motion-dom). On top of that it
 * adds two affordances:
 *
 * - `current` — a Svelte-5 reactive read backed by `$state`. Use in templates
 *   and `$derived` / `$effect` to track the spring value without subscribing.
 * - `subscribe` — Svelte readable store contract. Calls the run function once
 *   synchronously with the current value, then on every change.
 */
export type SpringMotionValue<T extends number | string> = AugmentedMotionValue<T>

/**
 * Creates a spring-animated `MotionValue`.
 *
 * Set a target with `.set(v)` to animate to it using spring physics, or
 * `.jump(v)` to skip the animation. Pass another `MotionValue` (or a Svelte
 * readable store from `useScroll` / `useTime`) as `source` and the spring
 * will animate toward whatever that source emits.
 *
 * Returned object is a real motion-dom `MotionValue` augmented with a
 * `$state`-backed `.current` getter and a Svelte readable `.subscribe` shim.
 * Composes with `useTransform`, `useVelocity`, `animate()`, and the rest of
 * the motion-value surface.
 *
 * Lifecycle: must be called during component initialization. The follow
 * animation, source bridge (if any), and motion value teardown are bound to
 * the surrounding `$effect` scope.
 *
 * SSR-safe: returns a static `MotionValue` with no animation on the server.
 *
 * Implementation: thin wrapper over {@link useFollowValue} that hard-codes
 * `type: 'spring'`. For tween / inertia / keyframes follows, call
 * `useFollowValue` directly.
 *
 * @template T The value type — `number` or `string` (unit strings preserved).
 * @param source Initial value, a `MotionValue` to follow, or a Svelte readable.
 * @param options Spring + follow configuration.
 * @returns A `MotionValue<T>` with `.current` and `.subscribe`.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useSpring } from '@humanspeak/svelte-motion'
 *
 *   const x = useSpring(0, { stiffness: 300, damping: 30 })
 * </script>
 *
 * <button onclick={() => x.set(100)}>Animate</button>
 * <div style="transform: translateX({x.current}px)">{x.current}</div>
 * ```
 *
 * @see https://motion.dev/docs/react-use-spring
 */
export function useSpring(source: number, options?: UseSpringOptions): SpringMotionValue<number>
export function useSpring(source: string, options?: UseSpringOptions): SpringMotionValue<string>
export function useSpring(
    source: MotionValue<number>,
    options?: UseSpringOptions
): SpringMotionValue<number>
export function useSpring(
    source: MotionValue<string>,
    options?: UseSpringOptions
): SpringMotionValue<string>
// Generic readable overload preserves the concrete T from the source so callers
// passing `Readable<number>` get `SpringMotionValue<number>` back.
export function useSpring<T extends number | string>(
    source: Readable<T>,
    options?: UseSpringOptions
): SpringMotionValue<T>
export function useSpring(
    source: number | string | MotionValue<number> | MotionValue<string> | Readable<number | string>,
    options: UseSpringOptions = {}
): SpringMotionValue<number> | SpringMotionValue<string> {
    // Cast through `unknown` because TypeScript can't narrow the multi-form
    // `source` against `useFollowValue`'s overload set; runtime behavior is
    // identical — `useFollowValue` dispatches on the same shapes.
    return useFollowValue(
        source as unknown as number,
        { type: 'spring', ...options } as FollowValueOptions
    ) as SpringMotionValue<number> | SpringMotionValue<string>
}
