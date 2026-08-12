<script lang="ts">
    import { Reorder } from '$lib'

    let items = $state(['aleph', 'bet', 'gimel', 'dalet'])
</script>

<div class="page">
    <h1>Reorder — RTL</h1>
    <p>
        The data remains logical while visual horizontal movement follows the group's RTL direction.
    </p>

    <Reorder.Group
        axis="x"
        dir="rtl"
        values={items}
        onReorder={(next: string[]) => (items = next)}
        data-testid="rtl-group"
        class="rtl-row"
    >
        {#each items as item (item)}
            <Reorder.Item value={item} data-testid={`item-${item}`} class="tile">
                {item}
            </Reorder.Item>
        {/each}
    </Reorder.Group>

    <div data-testid="order">{items.join(',')}</div>
</div>

<style>
    .page {
        min-height: 100vh;
        padding: 48px;
        background: #0f1115;
        color: #e5e7eb;
        font-family: system-ui, sans-serif;
    }

    h1 {
        margin: 0 0 8px;
        font-size: 20px;
    }

    p {
        margin-bottom: 24px;
        color: #9ca3af;
    }

    :global(.rtl-row) {
        display: flex;
        gap: 10px;
        width: max-content;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    :global(.tile) {
        display: grid;
        width: 90px;
        height: 90px;
        place-items: center;
        border-radius: 12px;
        background: #f8fafc;
        color: #111827;
        cursor: grab;
        user-select: none;
    }

    [data-testid='order'] {
        margin-top: 20px;
        color: #6b7280;
        font-family: monospace;
    }
</style>
