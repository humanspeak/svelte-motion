<script lang="ts">
    import { MotionDomProjectionAdapter } from '$lib/utils/motionDomProjection'
    import { frame, nodeGroup } from 'motion-dom'
    import type { Snippet } from 'svelte'
    import {
        chainLayoutGroupId,
        getLayoutGroupContext,
        setLayoutGroupContext
    } from './layoutGroup.context'

    /**
     * Scope `layoutId` shared-layout animations to a subtree and group its
     * layout animations.
     *
     * Mirrors framer-motion's `<LayoutGroup>` (`LayoutGroup/index.tsx`),
     * which does two things:
     *
     * 1. Scopes `layoutId`: descendants' `layoutId` snapshots / consumes are
     *    prefixed with the group's id (`"group-layoutId"`). Two groups
     *    containing the same `layoutId` values won't cross-animate — useful
     *    for repeated UI patterns (multiple tab indicators, kanban columns,
     *    sibling carousels) where each instance should animate independently.
     * 2. Owns a projection node group: every `layout` / `layoutId` element in
     *    the group is re-measured when any member updates or unmounts, so
     *    siblings animate together (e.g. an item removed from a list lets
     *    the remaining items animate into the freed space).
     *
     * @prop id Stable identifier for this group's scope. When omitted,
     *     the LayoutGroup contributes no own id (still useful for
     *     `inherit={false}` to break out of an outer group, e.g. an
     *     embedded widget).
     * @prop inherit `true` (default) — chain onto the parent group's id
     *     (nested groups yield `"parent-child"`) and join the parent's node
     *     group. `'id'` — chain onto the parent's id but start a separate
     *     node group: the outer group's updates don't re-measure these
     *     elements; they follow their parent via relative projection
     *     instead of animating independently. `false` — start a fresh scope
     *     and a separate node group, ignoring any outer LayoutGroup.
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
     * @see https://motion.dev/docs/react-layout-group
     */
    const {
        id,
        inherit = true,
        children
    }: {
        id?: string
        inherit?: boolean | 'id'
        children?: Snippet
    } = $props()

    // setContext is one-shot at component init, so reading `id` and `inherit`
    // here captures their initial values intentionally — the scope id and
    // node group are fixed for this subtree's lifetime, exactly like
    // upstream's `context.current === null` one-time init. The warning would
    // only matter if we wanted descendants to react to prop changes, which
    // we explicitly don't.
    // svelte-ignore state_referenced_locally
    const shouldInheritGroup = inherit === true
    // svelte-ignore state_referenced_locally
    const shouldInheritId = shouldInheritGroup || inherit === 'id'
    const parentContext = getLayoutGroupContext()
    const group = shouldInheritGroup ? (parentContext?.group ?? nodeGroup()) : nodeGroup()
    // Upstream `forceRender` re-renders this subtree on the next frame, so
    // every member's MeasureLayout snapshots and animates whatever moved.
    // Our members are already rendered; re-commit the group from its cached
    // (or on-screen) snapshots instead. Already-consumed changes are no-ops.
    const forceRender = () => {
        frame.postRender(() => MotionDomProjectionAdapter.commitGroup(group))
    }
    // svelte-ignore state_referenced_locally
    setLayoutGroupContext({
        id: shouldInheritId ? chainLayoutGroupId(parentContext?.id, id) : id,
        group,
        forceRender
    })
</script>

{@render children?.()}
