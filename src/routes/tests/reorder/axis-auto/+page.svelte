<script lang="ts">
    import { Reorder } from '$lib'

    let horizontal = $state(['red', 'amber', 'green', 'blue'])
    let vertical = $state(['one', 'two', 'three', 'four'])
</script>

<div class="page">
    <h1>Reorder — automatic axis detection</h1>
    <p>Both groups omit <code>axis</code>; their measured geometry selects x or y.</p>

    <section>
        <h2>Horizontal row</h2>
        <Reorder.Group
            values={horizontal}
            onReorder={(next: string[]) => (horizontal = next)}
            data-testid="horizontal-group"
            class="horizontal"
        >
            {#each horizontal as item (item)}
                <Reorder.Item value={item} data-testid={`horizontal-${item}`} class="tile">
                    {item}
                </Reorder.Item>
            {/each}
        </Reorder.Group>
        <div data-testid="horizontal-order">{horizontal.join(',')}</div>
    </section>

    <section>
        <h2>Vertical stack</h2>
        <Reorder.Group
            values={vertical}
            onReorder={(next: string[]) => (vertical = next)}
            data-testid="vertical-group"
            class="vertical"
        >
            {#each vertical as item (item)}
                <Reorder.Item value={item} data-testid={`vertical-${item}`} class="row">
                    {item}
                </Reorder.Item>
            {/each}
        </Reorder.Group>
        <div data-testid="vertical-order">{vertical.join(',')}</div>
    </section>
</div>

<style>
    .page {
        min-height: 100vh;
        padding: 48px;
        background: #0f1115;
        color: #e5e7eb;
        font-family: system-ui, sans-serif;
    }

    p {
        color: #9ca3af;
    }

    section {
        margin-top: 28px;
    }

    h1,
    h2 {
        margin: 0 0 10px;
    }

    h1 {
        font-size: 20px;
    }

    h2 {
        font-size: 15px;
    }

    :global(.horizontal),
    :global(.vertical) {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    :global(.horizontal) {
        display: flex;
        gap: 10px;
    }

    :global(.vertical) {
        width: 320px;
    }

    :global(.tile),
    :global(.row) {
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8fafc;
        color: #111827;
        border-radius: 12px;
        cursor: grab;
        user-select: none;
    }

    :global(.tile) {
        width: 90px;
        height: 90px;
    }

    :global(.row) {
        box-sizing: border-box;
        height: 48px;
        margin-bottom: 10px;
    }

    [data-testid$='-order'] {
        margin-top: 14px;
        color: #6b7280;
        font-family: monospace;
    }
</style>
