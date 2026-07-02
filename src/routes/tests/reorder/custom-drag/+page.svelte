<script lang="ts">
    import { Reorder } from '$lib'

    let items = $state(['one', 'two', 'three'])
</script>

<div class="page">
    <h1>Reorder — custom drag override</h1>
    <p>
        The group reorders on the y axis, but each item passes <code>drag</code> so the gesture is
        free on both axes (upstream: “To make draggable on both axes, set
        <code>&lt;Reorder.Item drag /&gt;</code>”).
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
                drag
                data-testid={`item-${item}`}
                style="display: flex; align-items: center; height: 44px; padding: 0 16px; margin-bottom: 10px; background: white; color: #0f1115; border-radius: 10px; cursor: grab; user-select: none; -webkit-user-select: none;"
            >
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
        font-size: 20px;
        margin-bottom: 8px;
    }

    p {
        margin-bottom: 24px;
        max-width: 480px;
        color: #9ca3af;
    }

    code {
        color: #93c5fd;
    }

    [data-testid='order'] {
        margin-top: 24px;
        font-family: monospace;
        color: #6b7280;
    }
</style>
