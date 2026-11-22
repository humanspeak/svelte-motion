<script lang="ts">
    /**
     * Object-valued Reorder list keyed by `id`, controlled by the test: it
     * rerenders with new `values`. Replacing an entry with `{ ...entry }`
     * keeps the item component (same key) but gives it a new value object.
     * Only the id is rendered, so a replacement changes no DOM and cannot
     * trigger a re-measure that would hide the bug.
     */
    import { Reorder } from '$lib/reorder'

    type Entry = { id: string; rev: number }

    let {
        values,
        onReorder
    }: {
        values: Entry[]
        onReorder?: (next: Entry[], moved: Entry) => void
    } = $props()
</script>

<Reorder.Group
    axis="y"
    {values}
    onReorder={(next, moved) => onReorder?.(next, moved)}
    data-testid="group"
>
    {#each values as entry (entry.id)}
        <Reorder.Item value={entry} data-testid={entry.id}>{entry.id}</Reorder.Item>
    {/each}
</Reorder.Group>
