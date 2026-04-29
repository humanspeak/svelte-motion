import { createScopedAnimate } from 'motion'
import type {
    AnimationPlaybackControlsWithThen,
    AnimationScope as MotionAnimationScope
} from 'motion-dom'

/**
 * The scope returned by {@link useAnimate}. Functions as a Svelte 5
 * attachment — pass it as `{@attach scope}` on the parent element so the
 * scoped `animate` function can resolve string selectors against it.
 *
 * Mirrors framer-motion's `AnimationScope`. `current` is hydrated once the
 * attachment runs; `animations` tracks every in-flight animation started
 * through the scoped `animate` so they can be stopped together when the
 * element detaches.
 */
export type AnimationScope<T extends Element = HTMLElement> = ((node: T) => () => void) & {
    /** The parent element, populated when the attachment fires. `undefined` before mount or after detach. */
    current: T | undefined
    /** Animations currently scoped to this element. */
    animations: AnimationPlaybackControlsWithThen[]
}

/**
 * Imperative animation API mirroring framer-motion's `useAnimate`. Returns a
 * tuple `[scope, animate]`:
 *
 * - `scope` is a Svelte 5 attachment: spread it on the parent element with
 *   `{@attach scope}`. Once mounted, `scope.current` is the element and
 *   `animate('selector', ...)` resolves selectors against it.
 * - `animate(target, keyframes, transition)` accepts the same overloads as
 *   motion's standalone `animate` — strings, elements, motion values, and
 *   sequences.
 *
 * When the attached element detaches, every animation started through the
 * scoped `animate` is stopped and `scope.animations` is cleared.
 *
 * `animate` ignores calls before the attachment fires — `scope.current` is
 * still `undefined`, and motion throws when asked to query selectors against
 * a missing root. Trigger animations from user events or `$effect` after
 * mount.
 *
 * @template T The parent element type. Defaults to `HTMLElement`.
 * @returns A `[scope, animate]` tuple.
 * @see https://motion.dev/docs/react-use-animate
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useAnimate } from '@humanspeak/svelte-motion'
 *
 *   const [scope, animate] = useAnimate()
 *
 *   const run = () =>
 *     animate(
 *       [
 *         ['li', { opacity: 1, x: 0 }, { delay: stagger(0.1) }],
 *         ['button', { scale: 1.05 }, { at: '-0.2' }]
 *       ]
 *     )
 * </script>
 *
 * <ul {@attach scope}>
 *   <li>One</li>
 *   <li>Two</li>
 *   <li>Three</li>
 * </ul>
 * <button onclick={run}>Animate</button>
 * ```
 */
export const useAnimate = <T extends HTMLElement = HTMLElement>(): [
    AnimationScope<T>,
    ReturnType<typeof createScopedAnimate>
] => {
    const scope = ((node: T) => {
        scope.current = node
        return () => {
            for (const animation of scope.animations) {
                animation.stop()
            }
            scope.animations.length = 0
            scope.current = undefined
        }
    }) as AnimationScope<T>
    scope.current = undefined
    scope.animations = []

    const animate = createScopedAnimate({
        scope: scope as MotionAnimationScope<T>
    })

    return [scope, animate]
}
