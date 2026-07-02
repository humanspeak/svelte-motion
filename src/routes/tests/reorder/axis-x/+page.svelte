<script lang="ts">
    import { Reorder } from '$lib'

    type Tile = { id: string; color: string }

    let tiles = $state<Tile[]>([
        { id: 'red', color: '#f87171' },
        { id: 'amber', color: '#fbbf24' },
        { id: 'green', color: '#4ade80' },
        { id: 'blue', color: '#60a5fa' }
    ])
</script>

<div class="page">
    <h1>Reorder — axis x</h1>
    <p>Drag tiles horizontally to reorder the row. Items lock to the x axis.</p>

    <Reorder.Group
        axis="x"
        values={tiles}
        onReorder={(next: Tile[]) => (tiles = next)}
        data-testid="reorder-group"
        style="list-style: none; padding: 0; margin: 0; display: flex; gap: 10px;"
    >
        {#each tiles as tile (tile.id)}
            <Reorder.Item
                value={tile}
                data-testid={`tile-${tile.id}`}
                style={`width: 90px; height: 90px; border-radius: 12px; background: ${tile.color}; cursor: grab; user-select: none; -webkit-user-select: none;`}
            />
        {/each}
    </Reorder.Group>

    <div data-testid="order">{tiles.map((tile) => tile.id).join(',')}</div>
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
