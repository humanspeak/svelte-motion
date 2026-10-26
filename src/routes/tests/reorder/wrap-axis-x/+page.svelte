<script lang="ts">
    import { Reorder } from '$lib'

    // Port of upstream Motion #2255 (commit 9632e2c3d,
    // dev/react/src/tests/issue-2255.tsx at v14.6.0): a `Reorder.Group` with
    // axis="x" whose items wrap onto several rows. Dragging an item into
    // another row changes its layout on y, which motion-dom's drag controls
    // used to compensate by writing to the item's `y` even though y isn't a
    // drag axis, leaving a stale translateY after release.
    // e2e/reorder/wrap-axis-x.spec.ts.

    let items = $state(['apple', 'banana', 'kiwi', 'watermelon', 'fig', 'grape', 'pear'])
</script>

<div data-testid="order">{items.join(',')}</div>

<Reorder.Group
    axis="x"
    values={items}
    onReorder={(next: string[]) => (items = next)}
    data-testid="group"
    style="display: flex; flex-wrap: wrap; gap: 10px; width: 300px; list-style: none; padding: 0; margin: 0;"
>
    {#each items as item (item)}
        <Reorder.Item
            value={item}
            data-testid={item}
            transition={{ duration: 0.1 }}
            style="background: #ddd; padding: 10px; height: 20px; white-space: nowrap;"
        >
            {item}
        </Reorder.Item>
    {/each}
</Reorder.Group>
