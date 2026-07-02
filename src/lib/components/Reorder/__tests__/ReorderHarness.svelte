<script lang="ts">
    import { Reorder } from '$lib/reorder'
    import type { ReorderElementTag } from '../types'

    let {
        values = [0, 1, 2],
        axis = 'y',
        as = 'ul' as ReorderElementTag,
        itemAs = 'li' as ReorderElementTag,
        groupStyle,
        onReorder = () => {}
    }: {
        values?: number[]
        axis?: 'x' | 'y'
        as?: ReorderElementTag
        itemAs?: ReorderElementTag
        groupStyle?: string
        onReorder?: (next: number[]) => void
    } = $props()
</script>

<Reorder.Group {as} {axis} {values} {onReorder} style={groupStyle} data-testid="group">
    {#each values as item (item)}
        <Reorder.Item as={itemAs} value={item} data-testid={`item-${item}`}>
            {item}
        </Reorder.Item>
    {/each}
</Reorder.Group>
