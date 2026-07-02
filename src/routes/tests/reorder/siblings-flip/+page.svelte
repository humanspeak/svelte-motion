<script lang="ts">
    import { Reorder } from '$lib'

    let items = $state(['a', 'b', 'c'])
</script>

<div class="page">
    <h1>Reorder — siblings FLIP during live drag</h1>
    <p>
        While an item is being dragged, the displaced sibling should animate into its new slot (not
        teleport) and the dragged item should stay pinned under the cursor when the swap moves its
        DOM position.
    </p>

    <Reorder.Group
        axis="y"
        values={items}
        onReorder={(next: string[]) => (items = next)}
        data-testid="reorder-group"
        style="list-style: none; padding: 0; margin: 0; width: 320px;"
    >
        {#each items as item (item)}
            <Reorder.Item
                value={item}
                data-testid={`item-${item}`}
                transition={{ duration: 0.4 }}
                style="display: flex; align-items: center; height: 60px; padding: 0 16px; margin-bottom: 12px; background: white; color: #0f1115; border-radius: 10px; cursor: grab; user-select: none; -webkit-user-select: none;"
            >
                Item {item.toUpperCase()}
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
        font-size: 20px;
        margin-bottom: 8px;
    }

    p {
        margin-bottom: 24px;
        max-width: 480px;
        color: #9ca3af;
    }

    [data-testid='order'] {
        margin-top: 24px;
        font-family: monospace;
        color: #6b7280;
    }
</style>
