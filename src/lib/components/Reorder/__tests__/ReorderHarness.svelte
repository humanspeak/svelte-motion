<script lang="ts">
    import { Reorder } from '$lib/reorder'
    import type { ReorderElementTag } from '../types'

    let {
        values = [0, 1, 2],
        axis,
        as = 'ul',
        itemAs = 'li',
        itemSizeAnimation = false,
        groupStyle,
        onReorder = () => {}
    }: {
        values?: number[]
        axis?: 'x' | 'y' | 'xy'
        as?: ReorderElementTag
        itemAs?: ReorderElementTag
        itemSizeAnimation?: boolean
        groupStyle?: string
        onReorder?: (next: number[]) => void
    } = $props()
</script>

<Reorder.Group {as} {axis} {values} {onReorder} style={groupStyle} data-testid="group">
    {#each values as item (item)}
        <Reorder.Item
            as={itemAs}
            value={item}
            data-testid={`item-${item}`}
            data-layout-size-animation={itemSizeAnimation ? '' : undefined}
        >
            {item}
        </Reorder.Item>
    {/each}
</Reorder.Group>
