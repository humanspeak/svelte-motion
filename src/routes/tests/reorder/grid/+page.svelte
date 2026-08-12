<script lang="ts">
    import { Reorder } from '$lib'

    type Tile = { id: string; color: string }

    let tiles = $state<Tile[]>([
        { id: 'a', color: '#fb7185' },
        { id: 'b', color: '#fbbf24' },
        { id: 'c', color: '#4ade80' },
        { id: 'd', color: '#38bdf8' },
        { id: 'e', color: '#818cf8' },
        { id: 'f', color: '#c084fc' }
    ])
</script>

<div class="page">
    <h1>Reorder — wrapped grid</h1>
    <p>Drag a tile continuously across columns and rows while displaced siblings spring.</p>

    <Reorder.Group
        axis="xy"
        values={tiles}
        onReorder={(next: Tile[]) => (tiles = next)}
        data-testid="grid-group"
        class="grid"
    >
        {#each tiles as tile (tile.id)}
            <Reorder.Item
                value={tile}
                data-testid={`tile-${tile.id}`}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                class="tile"
                style={`--tile-color: ${tile.color}`}
            >
                {tile.id.toUpperCase()}
            </Reorder.Item>
        {/each}
    </Reorder.Group>

    <div data-testid="order">{tiles.map(({ id }) => id).join(',')}</div>
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

    :global(.grid) {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        width: 288px;
        margin: 0;
        padding: 0;
        list-style: none;
    }

    :global(.tile) {
        display: grid;
        width: 88px;
        height: 88px;
        place-items: center;
        border-radius: 18px;
        background: var(--tile-color);
        color: #111827;
        font-size: 24px;
        font-weight: 800;
        cursor: grab;
        user-select: none;
        box-shadow: 0 10px 30px rgb(0 0 0 / 25%);
    }

    [data-testid='order'] {
        margin-top: 20px;
        color: #6b7280;
        font-family: monospace;
    }
</style>
