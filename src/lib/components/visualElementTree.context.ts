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
 * The context holds a getter rather than the node, because a component can
 * create its node after its children have initialised: an `m` whose
 * `<LazyMotion>` bundle arrives after mount (upstream
 * `motion/utils/use-visual-element.ts:60-87` creates the node the first render
 * a renderer exists). Children call the getter when they create their own node.
 *
 * @param visualElement Returns this component's VisualElement, or `null`
 *   while it has none (no features yet, or SSR).
 * @returns Nothing.
 *
 * @example
 * ```ts
 * let visualElement = $state.raw<VisualElement | null>(null)
 * setVisualElementParent(() => visualElement)
 * ```
 */
export const setVisualElementParent = (visualElement: () => VisualElement | null): void => {
    setContext<() => VisualElement | null>(VISUAL_ELEMENT_TREE_CONTEXT_KEY, visualElement)
}

/**
 * Read the nearest ancestor motion-dom VisualElement.
 *
 * Returns a getter, read when the caller creates its own node, so it sees a
 * parent node that was created after the caller initialised (see
 * {@link setVisualElementParent}).
 *
 * @returns A getter for the parent VisualElement. It returns `undefined` when
 *   no motion ancestor published one, or the ancestor has no node (a top-level
 *   motion element, a featureless `m` parent, or SSR).
 *
 * @example
 * ```ts
 * const readParent = getVisualElementParent()
 * const parent = readParent()
 * ```
 */
export const getVisualElementParent = (): (() => VisualElement | undefined) => {
    const read = getContext<(() => VisualElement | null) | undefined>(
        VISUAL_ELEMENT_TREE_CONTEXT_KEY
    )
    return () => read?.() ?? undefined
}
