import type { VisualElement } from 'motion-dom'
import { getContext, setContext } from 'svelte'

const VISUAL_ELEMENT_TREE_CONTEXT_KEY = Symbol('svelte-motion:visual-element-parent')

/**
 * Publish this component's motion-dom VisualElement to descendants.
 *
 * Upstream Framer Motion builds the VisualElement tree by passing the parent
 * node down through `MotionContext` (`framer-motion/src/motion/index.tsx`); the
 * parent link is what makes variant propagation and projection ancestry work.
 * This context is the Svelte equivalent.
 *
 * @param visualElement Current component's VisualElement, or `null` to clear.
 * @returns Nothing.
 *
 * @example
 * ```ts
 * setVisualElementParent(visualElement)
 * ```
 */
export const setVisualElementParent = (visualElement: VisualElement | null): void => {
    setContext<VisualElement | null>(VISUAL_ELEMENT_TREE_CONTEXT_KEY, visualElement)
}

/**
 * Read the nearest ancestor motion-dom VisualElement.
 *
 * @returns The parent VisualElement, or `undefined` when no motion ancestor
 * published one (e.g. a top-level motion element, or SSR).
 *
 * @example
 * ```ts
 * const parent = getVisualElementParent()
 * ```
 */
export const getVisualElementParent = (): VisualElement | undefined => {
    return getContext<VisualElement | null>(VISUAL_ELEMENT_TREE_CONTEXT_KEY) ?? undefined
}
