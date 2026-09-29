import type { NodeGroup } from 'motion-dom'
import { getContext, setContext } from 'svelte'

/**
 * What a `<LayoutGroup>` publishes to its subtree. Mirrors framer-motion's
 * `LayoutGroupContext` (`context/LayoutGroupContext.ts`), including
 * `forceRender`.
 *
 * - `id` — scope prefix for descendants' `layoutId` lookups, so two
 *   `<LayoutGroup>`s containing the same `layoutId` values don't
 *   cross-animate. `undefined` when no group in the chain has an id.
 * - `group` — the projection node group. Every `layout` / `layoutId` node
 *   in the subtree joins it, so when any member updates or unmounts the
 *   other members are snapshotted and animate together
 *   (motion-dom `projection/node/group.ts`).
 *
 * The context itself is `undefined` when there is no enclosing
 * `<LayoutGroup>`: descendants use `layoutId` verbatim against the global
 * registry and join no node group, preserving the un-grouped behaviour.
 */
export type LayoutGroupContext =
    | {
          /** Effective (possibly chained) scope id. */
          id?: string
          /** Projection node group shared by this group's members. */
          group?: NodeGroup
          /**
           * Re-measure every member of this group on the next frame and
           * animate any that moved — the Svelte counterpart of upstream's
           * `useForceUpdate` re-render. `AnimatePresence` calls it once all
           * exits complete.
           */
          forceRender?: () => void
      }
    | undefined

const LAYOUT_GROUP_CONTEXT_KEY = Symbol('layout-group')

/**
 * Publish a LayoutGroup context for descendants. Called once by
 * `<LayoutGroup>` after computing its (possibly inherited and chained) id
 * and its node group.
 *
 * @param context The context to publish.
 * @returns Nothing.
 */
export const setLayoutGroupContext = (context: LayoutGroupContext): void => {
    setContext<LayoutGroupContext>(LAYOUT_GROUP_CONTEXT_KEY, context)
}

/**
 * Read the nearest LayoutGroup context, or `undefined` if not inside one.
 *
 * `_MotionContainer.svelte` reads `id` to prefix `layoutId` when
 * snapshotting and consuming against the registry, and `group` to register
 * its projection node with the group.
 *
 * @returns The nearest LayoutGroup context, if any.
 */
export const getLayoutGroupContext = (): LayoutGroupContext => {
    return getContext<LayoutGroupContext>(LAYOUT_GROUP_CONTEXT_KEY)
}

/**
 * Combine a parent group's id with a descendant LayoutGroup's own id
 * to produce the effective scope id. Mirrors framer-motion's chaining
 * (`"parent-id"` + `"-"` + `"own-id"`).
 *
 * Either side can be `undefined`; the result is the other one, or
 * `undefined` if both are absent.
 *
 * @param parent The enclosing group's effective id.
 * @param own This group's own `id` prop.
 * @returns The effective scope id.
 */
export const chainLayoutGroupId = (
    parent: string | undefined,
    own: string | undefined
): string | undefined => {
    if (!parent) return own
    if (!own) return parent
    return `${parent}-${own}`
}

/**
 * Apply a LayoutGroup scope to a raw `layoutId` for registry lookups.
 * Returns the un-prefixed id when no group id is in scope. Uses
 * framer-motion's `${layoutGroupId}-${layoutId}` form (`motion/index.tsx`
 * `useLayoutId`).
 *
 * @param groupId The nearest group's effective id.
 * @param layoutId The element's own `layoutId`.
 * @returns The scoped registry key.
 */
export const scopeLayoutId = (groupId: string | undefined, layoutId: string): string => {
    return groupId ? `${groupId}-${layoutId}` : layoutId
}
