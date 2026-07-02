import { isPromiseLike } from '$lib/utils/promise'
import {
    animateView as animateViewCore,
    type ViewTransitionBuilder,
    type ViewTransitionOptions
} from 'motion-dom'
import { flushSync } from 'svelte'

export type { ViewTransitionTarget, ViewTransitionTargetDefinition } from 'motion-dom'
export type { ViewTransitionOptions }
export type AnimateViewBuilder = ViewTransitionBuilder

/**
 * Animate a view change with the browser's View Transitions API —
 * crossfades, shared-element morphs, and enter/exit animations between
 * two DOM states, driven by Motion's spring-capable timing.
 *
 * The `update` callback performs the state change that produces the new
 * view. Unlike calling motion-dom's `animateView` directly, Svelte
 * `$state` mutations made inside `update` are flushed to the DOM
 * synchronously (via `flushSync`) before the new snapshot is captured —
 * so plain state assignment "just works":
 *
 * ```svelte
 * <script lang="ts">
 *     import { animateView } from '@humanspeak/svelte-motion'
 *
 *     let showDetail = $state(false)
 *     const open = () => {
 *         animateView(() => (showDetail = true))
 *             .add('.thumbnail', '.detail-hero')
 *     }
 * </script>
 * ```
 *
 * Returns motion-dom's thenable {@link ViewTransitionBuilder}: chain
 * `.add()` (shared-element pairs), `.enter()` / `.exit()` (pure
 * newcomers/leavers), `.new()` / `.old()` (either view of any layer),
 * `.layout()` (morph timing), `.crop()`, `.class()` and `.group()`, and
 * `await` it for completion.
 *
 * A bare call with no chained subject swaps INSTANTLY by design —
 * motion-dom suppresses the root capture unless something opts in.
 * Chain `.layout()` to opt the page into the root crossfade:
 *
 * ```ts
 * animateView(() => (theme = 'dark')).layout()
 * ```
 *
 * Browsers without `document.startViewTransition` (or with reduced
 * motion forcing it off) still run `update` — the view swaps instantly
 * and the returned promise resolves, so no feature-gating is needed at
 * call sites.
 *
 * @param update Applies the state/DOM change producing the new view. May
 *     be async; the new snapshot is captured after it settles.
 * @param options Default transition options for every layer (a subject's
 *     own `.layout()`/`.enter()`/… options win), plus `interrupt`:
 *     `'wait'` (default) queues behind an in-flight transition,
 *     `'immediate'` skips it to its end state and starts this one.
 * @returns The chainable, awaitable view-transition builder.
 */
export const animateView = (
    update: () => void | Promise<void>,
    options?: ViewTransitionOptions
): AnimateViewBuilder =>
    animateViewCore(() => {
        const result = update()
        // isPromiseLike (not instanceof) so thenables and cross-realm
        // promises take the async branch — the sync path would flush
        // before the state change lands and drop the pending work.
        if (isPromiseLike(result)) {
            return result.then(() => {
                flushSync()
            })
        }
        flushSync()
    }, options)
