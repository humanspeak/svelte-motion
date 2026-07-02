<script lang="ts">
    import { Reorder } from '$lib'

    let items = $state(['alpha', 'beta', 'gamma', 'delta'])
</script>

<div class="page">
    <h1>Reorder — below the fold (window scroll)</h1>
    <p data-testid="spacer-note">
        The list sits below an 800px spacer, so the window must scroll before dragging. Reordering
        and settling must stay correct with a non-zero window scroll offset.
    </p>

    <div class="spacer" aria-hidden="true"></div>

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
                style="display: flex; align-items: center; height: 50px; padding: 0 16px; margin-bottom: 10px; background: white; color: #0f1115; border-radius: 10px; cursor: grab; user-select: none; -webkit-user-select: none;"
            >
                {item}
            </Reorder.Item>
        {/each}
    </Reorder.Group>

    <div data-testid="order">{items.join(',')}</div>

    <div class="spacer" aria-hidden="true"></div>
</div>

<style>
    .page {
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

    .spacer {
        height: 800px;
        background: repeating-linear-gradient(180deg, transparent 0 99px, #1f2937 99px 100px)
            border-box;
    }

    [data-testid='order'] {
        margin-top: 16px;
        font-family: monospace;
        color: #6b7280;
    }
</style>
