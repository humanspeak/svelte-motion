<script lang="ts">
    import type { Snippet } from 'svelte'
    import {
        chainLayoutGroupId,
        getLayoutGroupContext,
        setLayoutGroupContext
    } from './layoutGroup.context'

    /**
     * Scope `layoutId` shared-layout animations to a subtree.
     *
     * Wrap a region in `<LayoutGroup id="…">` so descendants' `layoutId`
     * snapshots / consumes are prefixed with the group's id. Two groups
     * containing the same `layoutId` values won't cross-animate — useful
     * for repeated UI patterns (multiple tab indicators, kanban columns,
     * sibling carousels) where each instance should animate independently.
     *
     * Mirrors framer-motion's `<LayoutGroup>` (`inherit` defaults to true
     * — descendants chain onto the parent group's id, so nested groups
     * yield `"parent-child"`).
     *
     * @prop id Stable identifier for this group's scope. When omitted,
     *     the LayoutGroup is a transparent grouping with no own id
     *     (still useful for `inherit={false}` to break out of an outer
     *     group's scope, e.g. an embedded widget).
     * @prop inherit `true` (default) — chain onto the parent group's id.
     *     `false` — start a fresh scope, ignoring any outer LayoutGroup.
     * @prop children Slot rendered inside the group context.
     *
     * @example
     * ```svelte
     * <LayoutGroup id="tabs-a">
     *     <Tabs />
     * </LayoutGroup>
     * <LayoutGroup id="tabs-b">
     *     <Tabs /> <!-- same layoutId values, independent animations -->
     * </LayoutGroup>
     * ```
     *
     * @see https://motion.dev/docs/react-layout-animations#scoped-layout-animations
     */
    const {
        id,
        inherit = true,
        children
    }: {
        id?: string
        inherit?: boolean
        children?: Snippet
    } = $props()

    // setContext is one-shot at component init, so reading `id` and `inherit`
    // here captures their initial values intentionally — the scope id is
    // fixed for this subtree's lifetime. The warning would only matter if we
    // wanted descendants to react to prop changes, which we explicitly don't.
    // svelte-ignore state_referenced_locally
    const effectiveId = inherit ? chainLayoutGroupId(getLayoutGroupContext(), id) : id
    setLayoutGroupContext(effectiveId)
</script>

{@render children?.()}
