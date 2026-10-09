import { isPromiseLike } from '$lib/utils/promise'
import {
    animateLayout as motionAnimateLayout,
    type AnimationOptions,
    type ElementOrSelector,
    type LayoutAnimationBuilder
} from 'motion-dom'
import { flushSync } from 'svelte'

/**
 * Applies the DOM change {@link animateLayout} animates. May be async; the
 * new layout is measured after a returned promise settles. Any other
 * return value is ignored, so `() => (open = !open)` works.
 */
export type LayoutUpdate = () => unknown

/**
 * The awaitable builder returned by {@link animateLayout} — motion-dom's
 * `LayoutAnimationBuilder` under a stable local name. Chain
 * `.shared(layoutId, transition)` to override one shared element's
 * transition, and `await` it for the running `GroupAnimation`.
 */
export type AnimateLayoutBuilder = LayoutAnimationBuilder

type AsyncUpdate = () => void | Promise<void>

/**
 * motion-dom types the update as `() => void`, but `LayoutAnimationBuilder`
 * awaits a returned promise before measuring the new layout (its
 * `runUpdate`), so widen the signature to say so.
 */
const animateLayoutCore = motionAnimateLayout as (
    scopeOrUpdate: ElementOrSelector | AsyncUpdate,
    updateOrOptions?: AsyncUpdate | AnimationOptions,
    options?: AnimationOptions
) => LayoutAnimationBuilder

const flushAfter =
    (update: LayoutUpdate): AsyncUpdate =>
    () => {
        const result = update()
        // isPromiseLike (not instanceof) so thenables and cross-realm
        // promises take the async branch — the sync path would flush
        // before the state change lands.
        if (isPromiseLike(result)) {
            return result.then(() => {
                flushSync()
            })
        }
        flushSync()
    }

/**
 * Animate layout changes on plain (non-`motion`) elements — Motion 14.1's
 * vanilla `animateLayout`. Tag elements with `data-layout` (position and
 * size), `data-layout="position"` / `"size"`, or `data-layout-id` (shared
 * element), then make the change inside `update`: each tagged element
 * animates from its old box to its new one.
 *
 * Unlike calling motion-dom's `animateLayout` directly, Svelte `$state`
 * mutations made inside `update` are flushed to the DOM synchronously (via
 * `flushSync`) before the new layout is measured — so plain state
 * assignment "just works".
 *
 * Calls made in the same tick are batched into one commit: every tagged
 * element is measured before any `update` runs.
 *
 * @param scopeOrUpdate Element or selector limiting which tagged elements
 *     animate, or the update itself to animate every tagged element in
 *     the document.
 * @param updateOrOptions The update when a scope is given, otherwise the
 *     default transition.
 * @param options The default transition when a scope is given.
 * @returns The awaitable layout-animation builder.
 * @example
 * ```svelte
 * <script lang="ts">
 *     import { animateLayout } from '@humanspeak/svelte-motion'
 *
 *     let open = $state(false)
 *     const toggle = () => animateLayout(() => (open = !open), { type: 'spring' })
 * </script>
 *
 * <button data-layout class:open onclick={toggle}>Toggle</button>
 * ```
 * @example
 * ```ts
 * // Only animate tagged elements inside `list`
 * await animateLayout(list, () => list.prepend(item), { duration: 0.3 })
 * ```
 */
export function animateLayout(
    scopeOrUpdate: ElementOrSelector | LayoutUpdate,
    updateOrOptions?: LayoutUpdate | AnimationOptions,
    options?: AnimationOptions
): AnimateLayoutBuilder {
    if (typeof scopeOrUpdate === 'function') {
        return animateLayoutCore(
            flushAfter(scopeOrUpdate),
            updateOrOptions as AnimationOptions | undefined
        )
    }
    return animateLayoutCore(scopeOrUpdate, flushAfter(updateOrOptions as LayoutUpdate), options)
}
