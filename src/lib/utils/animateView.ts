import { isPromiseLike } from '$lib/utils/promise'
import {
    animateView as animateViewCore,
    type ViewTransitionBuilder,
    type ViewTransitionOptions
} from 'motion-dom'
import { flushSync } from 'svelte'

export type { ViewTransitionTarget, ViewTransitionTargetDefinition } from 'motion-dom'
export type { ViewTransitionOptions }

/**
 * The chainable, awaitable builder returned by {@link animateView} —
 * motion-dom's `ViewTransitionBuilder` under a stable local name.
 * Chain `.add()`, `.enter()`/`.exit()`, `.new()`/`.old()`, `.layout()`,
 * `.crop()`, `.class()` and `.group()`; `await` it for completion.
 */
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
 * so plain state assignment "just works".
 *
 * Returns motion-dom's thenable {@link ViewTransitionBuilder}: chain
 * `.add()` (shared-element pairs), `.enter()` / `.exit()` (pure
 * newcomers/leavers), `.new()` / `.old()` (either view of any layer),
 * `.layout()` (morph timing), `.crop()`, `.class()` and `.group()`, and
 * `await` it for completion.
 *
 * A bare call with no chained subject swaps INSTANTLY by design —
 * motion-dom suppresses the root capture unless something opts in;
 * chain `.layout()` to opt the page into the root crossfade.
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
 * @example
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
 * @example
 * ```ts
 * // Whole-page crossfade: opt the root in with .layout()
 * await animateView(() => (theme = 'dark'), { duration: 0.5 }).layout()
 * ```
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
