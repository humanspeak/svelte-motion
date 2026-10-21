import { scopeMotion } from 'motion'
import type { MotionScope, ScopeOptions, ScopeSetup } from 'motion-dom'
import { untrack } from 'svelte'

/**
 * Options for {@link useScopeMotion}: motion's `ScopeOptions` (a default
 * `transition` for every `animate()` in the scope, and `matchMedia`
 * conditions) plus a reactive `deps` getter.
 */
export type UseScopeMotionOptions = ScopeOptions & {
    /**
     * Reactive dependencies: read inside the attachment, so a change cancels
     * and re-runs the scope. Svelte's counterpart of React's `deps` array —
     * read every value you want tracked, e.g. `() => [count, mode]`.
     */
    deps?: () => unknown
}

/**
 * The attachment returned by {@link useScopeMotion}. Pass it as
 * `{@attach scope}` on the root element. `current` holds the live
 * `MotionScope` while attached.
 *
 * @template T The root element type. Defaults to `HTMLElement`.
 */
export type MotionScopeAttachment<T extends Element = HTMLElement> = ((node: T) => () => void) & {
    /** The live scope while attached, for `run()`/`bind()` in event handlers. `null` before mount or after detach. */
    current: MotionScope | null
}

/**
 * Svelte attachment for Motion 14.5's `scopeMotion`, mirroring framer-motion's
 * `useScopeMotion`. Returns an attachment: put it on a root element with
 * `{@attach scope}`.
 *
 * - When the element attaches, `setup` runs in a `scopeMotion()` scope rooted
 *   at it. String selectors (`animate('li', …)`, `hover('li', …)`) resolve
 *   inside the root, and every `animate()` gets `options.transition` as its
 *   default transition.
 * - Animations, `scroll`/`inView` listeners, `hover`/`press` gestures,
 *   `resize` observers, `delay`s and `animateLayout`/`animateView` builders
 *   started in setup are collected by the scope.
 * - When the element detaches, the scope is cancelled: everything stops, the
 *   inline styles of animated elements are restored, and setup's returned
 *   cleanup runs.
 * - With `options.matchMedia`, setup only runs while the conditions match and
 *   re-runs when they change; `scope.media` reports each named condition.
 * - `options.deps` is read reactively: when a value it reads changes, the
 *   scope is cancelled and setup runs again. Anything else read inside setup
 *   (including `$state`) is untracked and does not re-run it.
 * - `scope.current` is the live scope, so event handlers can use
 *   `scope.current?.bind(fn)` or `.run(fn)` to collect what they start.
 *
 * Caveats:
 * 1. `cancel()` (including the one on detach) restores the `style` attribute
 *    of every element animated in the scope. Prefer scoping plain elements
 *    rather than `motion.*` components, whose style svelte-motion manages.
 * 2. Call vanilla APIs (`animate`, `inView`, `scroll`, `hover`, `press`)
 *    inside setup, not `use*` hooks, which need component initialization.
 * 3. Setup runs when the attachment runs, which is in the browser only.
 *
 * @template T The root element type. Defaults to `HTMLElement`.
 * @param setup Runs inside the scope. May return a cleanup function.
 * @param options Default `transition`, `matchMedia` conditions and reactive `deps`.
 * @returns An attachment with a `current` property holding the live scope.
 * @see https://github.com/motiondivision/motion/blob/v14.5.0/packages/framer-motion/src/animation/hooks/use-scope-motion.ts
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { animate, hover, stagger, useScopeMotion } from '@humanspeak/svelte-motion'
 *
 *   const scope = useScopeMotion(
 *     ({ media }) => {
 *       animate('li', { x: media.desktop ? 100 : 0 }, { delay: stagger(0.05) })
 *       hover('li', (el) => {
 *         animate(el, { scale: 1.05 })
 *         return () => animate(el, { scale: 1 })
 *       })
 *     },
 *     { transition: { duration: 0.4 }, matchMedia: { desktop: '>=800' } }
 *   )
 * </script>
 *
 * <ul {@attach scope}>
 *   <li>One</li>
 *   <li>Two</li>
 * </ul>
 * <button onclick={() => scope.current?.cancel()}>Reset</button>
 * ```
 */
export const useScopeMotion = <T extends Element = HTMLElement>(
    setup: ScopeSetup,
    options: UseScopeMotionOptions = {}
): MotionScopeAttachment<T> => {
    const { deps, ...scopeOptions } = options

    const attachment = ((node: T) => {
        // Tracked: a change to anything `deps` reads re-runs the attachment.
        deps?.()

        // Untracked: `$state` read inside setup must not become a dependency.
        const scope = untrack(() => scopeMotion(node, (s) => setup(s), scopeOptions))
        attachment.current = scope

        return () => {
            scope.cancel()
            if (attachment.current === scope) attachment.current = null
        }
    }) as MotionScopeAttachment<T>
    attachment.current = null

    return attachment
}
