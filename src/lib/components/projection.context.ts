import type { ProjectionNode } from '$lib/utils/projection'
import { getContext, setContext } from 'svelte'

/**
 * Svelte context plumbing for the projection tree.
 *
 * Every `motion.*` element creates a `ProjectionNode` at setup time and
 * publishes it via `setProjectionParent(node)` so descendant motion
 * elements can pick it up via `getProjectionParent()` and wire themselves
 * as `node.parent` + register in `node.parent.children`. The tree shape
 * mirrors the Svelte component tree exactly because Svelte's
 * `setContext` propagates down through descendants in component-init
 * order.
 *
 * This is the closest analog we have to framer-motion's depth-sorted
 * FlatTree (`projection/node/create-projection-node.ts`), but without
 * the global `root` registry — parent/child pointers are sufficient
 * for the workflows this PR enables (drag↔swap origin compensation,
 * ancestor-zeroing measure). A global root would only be needed once we
 * port shared-element `layoutId` morphing onto projection nodes; the
 * current `layoutId.ts` registry continues to handle that case
 * independently.
 *
 * Order of operations inside a single `motion.*` component (CRITICAL):
 * 1. Read parent via `getProjectionParent()` BEFORE creating own node.
 * 2. Construct own node, set `node.parent = parent`.
 * 3. Publish own node via `setProjectionParent(node)`.
 * If steps 1 and 3 are reversed, the component sees ITS OWN node as
 * the parent (because `setContext` shadows from the call site down)
 * and the tree collapses to a chain of self-references. Same trap
 * `layoutScroll.context.ts` documents — don't repeat it.
 */
const PROJECTION_CONTEXT_KEY = Symbol('svelte-motion:projection-parent')

/**
 * Publish a `ProjectionNode` as the projection parent for descendant
 * motion components.
 *
 * @param node The current component's ProjectionNode, or `null` to
 *   explicitly clear (rarely needed — Svelte context auto-clears on
 *   component unmount).
 */
export const setProjectionParent = (node: ProjectionNode | null): void => {
    setContext<ProjectionNode | null>(PROJECTION_CONTEXT_KEY, node)
}

/**
 * Read the ancestor `ProjectionNode` published by the nearest motion
 * ancestor. Returns `null` when this component is at the root of the
 * projection tree (or when no motion ancestor exists).
 *
 * Must be called BEFORE the current component publishes its own node
 * via `setProjectionParent` — see the order-of-operations note in this
 * file's header.
 *
 * @returns The parent ProjectionNode, or `null`.
 */
export const getProjectionParent = (): ProjectionNode | null => {
    return getContext<ProjectionNode | null>(PROJECTION_CONTEXT_KEY) ?? null
}
