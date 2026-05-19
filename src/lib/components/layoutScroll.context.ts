import { getContext, setContext } from 'svelte'

/**
 * A deferred reference to a scroll container element. The element isn't bound
 * until after mount, so we pass a thunk; descendants resolve the current
 * element at measurement time.
 */
export type LayoutScrollContainerRef = () => HTMLElement | null | undefined

const LAYOUT_SCROLL_CONTEXT_KEY = Symbol('layout-scroll-container')

/**
 * Publish a scroll container reference for descendant motion components so
 * their FLIP measurements account for the container's scroll offset.
 *
 * Called on a `motion.*` component with `layoutScroll` enabled during its
 * init phase. The element ref is bound later (after mount), so callers pass
 * a thunk; descendants invoke it at measure-time.
 *
 * Mirrors framer-motion: any element with `layoutScroll` becomes a
 * measurement origin for nested `layout` animations.
 *
 * @param ref Thunk returning the scroll container element.
 */
export const setLayoutScrollContainer = (ref: LayoutScrollContainerRef): void => {
    setContext<LayoutScrollContainerRef>(LAYOUT_SCROLL_CONTEXT_KEY, ref)
}

/**
 * Capture the nearest ancestor scroll container's thunk at component init.
 *
 * Important: call this **before** the same component calls
 * `setLayoutScrollContainer(...)`. Otherwise the lookup returns the
 * component's own thunk (Svelte `setContext` shadows from the call site
 * down) and measurements collapse to zero against the element itself.
 *
 * Returns `undefined` when no ancestor has `layoutScroll`. The caller
 * invokes the returned thunk at measure-time to resolve the element.
 *
 * @returns Ancestor's deferred element ref, or `undefined`.
 */
export const getLayoutScrollContainerRef = (): LayoutScrollContainerRef | undefined => {
    return getContext<LayoutScrollContainerRef | undefined>(LAYOUT_SCROLL_CONTEXT_KEY)
}
