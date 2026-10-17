<script lang="ts">
    import { Reorder } from '$lib/reorder'

    /**
     * Mirrors the `Component` in upstream's "Reorder click after drag" unit
     * tests (`Reorder/__tests__/index.test.tsx` @ v14.2.0): a two-item y
     * group with click handlers on the group, each item and a button inside
     * each item.
     */
    let {
        onReorder,
        onGroupClick,
        onItemClick,
        onChildClick
    }: {
        onReorder: (next: string[]) => void
        onGroupClick: () => void
        onItemClick: () => void
        onChildClick: () => void
    } = $props()

    let items = $state(['a', 'b'])
</script>

<Reorder.Group
    axis="y"
    values={items}
    onReorder={(next: string[]) => {
        onReorder(next)
        items = next
    }}
    data-testid="group"
    onclick={onGroupClick}
>
    {#each items as item (item)}
        <Reorder.Item value={item} data-testid={item} onclick={onItemClick}>
            <button type="button" data-testid="{item}-child" onclick={onChildClick}>{item}</button>
        </Reorder.Item>
    {/each}
</Reorder.Group>
