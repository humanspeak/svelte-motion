<script lang="ts">
    import { Reorder } from '$lib/reorder'

    const values = [0, 1]
</script>

<Reorder.Group {values} onReorder={() => {}}>
    {#each values as value (value)}
        <Reorder.Item {value} dragMomentum={false} data-testid={`detected-item-${value}`}>
            {value}
        </Reorder.Item>
    {/each}
</Reorder.Group>
