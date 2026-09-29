<script module lang="ts">
    // Stable per-object labels so specs can compare node-group identity
    // across probes through the DOM (`data-group`).
    const groupLabels = new WeakMap<object, string>()
    let nextGroupLabel = 0
    const labelGroup = (group: object | undefined): string => {
        if (!group) return 'none'
        let label = groupLabels.get(group)
        if (!label) {
            label = `group-${nextGroupLabel++}`
            groupLabels.set(group, label)
        }
        return label
    }
</script>

<script lang="ts">
    import { getLayoutGroupContext } from '$lib/components/layoutGroup.context'

    let { testId = 'layout-group-probe' }: { testId?: string } = $props()

    const context = getLayoutGroupContext()
</script>

<div
    data-testid={testId}
    data-id={context?.id ?? 'none'}
    data-group={labelGroup(context?.group)}
    data-force-render={typeof context?.forceRender}
></div>
