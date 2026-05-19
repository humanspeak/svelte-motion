import { getContext, setContext } from 'svelte'

/**
 * Deferred references to the chain of `layoutScroll` ancestors for the
 * current subtree. Element refs are bound after mount, so we pass thunks;
 * descendants invoke them at measurement time.
 *
 * The chain is **bottom-up**: the closest ancestor first, then its
 * `layoutScroll` ancestor, and so on. Order doesn't matter for offset
 * summing — they're all combined — but the array is the chain so a
 * future feature (per-container `wasRoot` semantics, etc.) can iterate
 * in a defined direction.
 */
export type LayoutScrollContainerRef = () => Array<HTMLElement | null | undefined>

const LAYOUT_SCROLL_CONTEXT_KEY = Symbol('layout-scroll-container')

/**
 * Publish the scroll-container chain for descendant motion components.
 *
 * Called on a `motion.*` component with `layoutScroll` enabled during
 * its init phase. The provided thunk should resolve to `[...ancestorChain,
 * ownElement]` — descendants get the full chain in one call.
 *
 * Mirrors framer-motion's `removeElementScroll`, which walks the path
 * and sums every `layoutScroll` ancestor's offset.
 *
 * @param ref Thunk returning the full ancestor chain (closest first).
 */
export const setLayoutScrollContainer = (ref: LayoutScrollContainerRef): void => {
    setContext<LayoutScrollContainerRef>(LAYOUT_SCROLL_CONTEXT_KEY, ref)
}

/**
 * Capture the ancestor chain thunk at component init.
 *
 * Important: call this **before** the same component calls
 * `setLayoutScrollContainer(...)`. Otherwise the lookup returns the
 * component's own thunk (Svelte `setContext` shadows from the call site
 * down) and the chain collapses.
 *
 * Returns `undefined` when no ancestor has `layoutScroll`.
 *
 * @returns Ancestor chain thunk, or `undefined`.
 */
export const getLayoutScrollContainerRef = (): LayoutScrollContainerRef | undefined => {
    return getContext<LayoutScrollContainerRef | undefined>(LAYOUT_SCROLL_CONTEXT_KEY)
}
