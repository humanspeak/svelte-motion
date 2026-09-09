<script lang="ts">
    import { Reorder } from '$lib/reorder'
    import type { DragInfo } from '$lib/types'
    import type { ReorderElementTag } from '../types'

    let {
        values = [0, 1, 2],
        axis,
        as = 'ul',
        itemAs = 'li',
        itemSizeAnimation = false,
        groupStyle,
        onDrag,
        onReorder = () => {}
    }: {
        values?: number[]
        axis?: 'x' | 'y' | 'xy'
        as?: ReorderElementTag
        itemAs?: ReorderElementTag
        itemSizeAnimation?: boolean
        groupStyle?: string
        onDrag?: (event: PointerEvent, info: DragInfo) => void
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
            {onDrag}
        >
            {item}
        </Reorder.Item>
    {/each}
</Reorder.Group>
