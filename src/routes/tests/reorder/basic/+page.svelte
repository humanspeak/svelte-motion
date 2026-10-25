<script lang="ts">
    import { Reorder } from '$lib'

    const slug = (item: string) => item.split(' ')[1].toLowerCase()

    let items = $state(['🍅 Tomato', '🥒 Cucumber', '🧀 Cheese', '🥬 Lettuce'])
    // The held item, mirrored from onDragStart/onDragEnd for e2e frame sampling.
    let dragging = $state<string | null>(null)
</script>

<div class="page">
    <h1>Reorder — basic (motion.dev/docs/react-reorder)</h1>
    <p>Drag items vertically to reorder the list. Items lock to the y axis.</p>

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
                data-testid={`item-${slug(item)}`}
                data-dragging={dragging === item}
                onDragStart={() => (dragging = item)}
                onDragEnd={() => (dragging = null)}
                style="display: flex; align-items: center; height: 44px; padding: 0 16px; margin-bottom: 10px; background: white; color: #0f1115; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.25); cursor: grab; user-select: none; -webkit-user-select: none;"
            >
                {item}
            </Reorder.Item>
        {/each}
    </Reorder.Group>

    <div data-testid="order">{items.map(slug).join(',')}</div>
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
        color: #9ca3af;
    }

    [data-testid='order'] {
        margin-top: 24px;
        font-family: monospace;
        color: #6b7280;
    }
</style>
