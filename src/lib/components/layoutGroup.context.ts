import { getContext, setContext } from 'svelte'

/**
 * Identifier for a `<LayoutGroup>` subtree. Descendants prefix their
 * `layoutId` lookups with this so two `<LayoutGroup>`s containing the
 * same `layoutId` values don't cross-animate.
 *
 * `undefined` means "no enclosing LayoutGroup" — the descendant uses
 * `layoutId` verbatim against the global registry, preserving the
 * existing un-grouped behaviour.
 */
export type LayoutGroupContext = string | undefined

const LAYOUT_GROUP_CONTEXT_KEY = Symbol('layout-group')

/**
 * Publish a LayoutGroup id for descendants. Called by `<LayoutGroup>`
 * after computing its own (possibly inherited and chained) id.
 */
export const setLayoutGroupContext = (id: LayoutGroupContext): void => {
    setContext<LayoutGroupContext>(LAYOUT_GROUP_CONTEXT_KEY, id)
}

/**
 * Read the nearest LayoutGroup id, or `undefined` if not inside one.
 *
 * `_MotionContainer.svelte` reads this to prefix `layoutId` when
 * snapshotting and consuming against the registry, so shared-layout
 * animations stay scoped to the surrounding group.
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
 */
export const chainLayoutGroupId = (
    parent: LayoutGroupContext,
    own: string | undefined
): LayoutGroupContext => {
    if (!parent) return own
    if (!own) return parent
    return `${parent}-${own}`
}

/**
 * Apply a LayoutGroup scope to a raw `layoutId` for registry lookups.
 * Returns the un-prefixed id when no group is in scope.
 */
export const scopeLayoutId = (groupId: LayoutGroupContext, layoutId: string): string => {
    return groupId ? `${groupId}::${layoutId}` : layoutId
}
