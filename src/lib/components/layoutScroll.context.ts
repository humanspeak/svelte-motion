import { getContext, setContext } from 'svelte'

/**
 * Deferred references to the chain of `layoutScroll` ancestors for the
 * current subtree. Returned as a thunk because element refs are bound
 * after mount; consumers invoke at measurement time.
 *
 * Order is closest-first. Order doesn't matter for the current scroll-
 * offset sum, but is preserved so future per-container semantics (e.g.
 * a `scroll.wasRoot` marker like framer-motion) can iterate deterministically.
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
