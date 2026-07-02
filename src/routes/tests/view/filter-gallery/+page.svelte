<script lang="ts">
    import { animateView } from '$lib'

    type Item = { id: number; kind: 'circle' | 'square' }

    const all: Item[] = Array.from({ length: 12 }, (_, index) => ({
        id: index,
        kind: index % 2 === 0 ? 'circle' : 'square'
    }))

    let filter = $state<'all' | 'circle' | 'square'>('all')
    const visible = $derived(filter === 'all' ? all : all.filter((item) => item.kind === filter))

    const setFilter = (next: typeof filter) => {
        if (next === filter) return
        // Survivors morph to their new grid slots; pure newcomers fade+
        // scale in via .enter(), pure leavers out via .exit().
        animateView(() => {
            filter = next
        })
            .add('[data-item]')
            .enter({ opacity: [0, 1], scale: [0.6, 1] })
            .exit({ opacity: [1, 0], scale: [1, 0.6] })
    }
</script>

<div class="page">
    <h1>animateView — filter gallery</h1>
    <p>
        Filtering the grid inside <code>animateView</code>: surviving items morph to their new slots
        while entering/leaving items scale-fade via <code>.enter()</code> /
        <code>.exit()</code>.
    </p>

    <div class="filters">
        {#each ['all', 'circle', 'square'] as const as kind (kind)}
            <button
                data-testid={`filter-${kind}`}
                class:active={filter === kind}
                aria-pressed={filter === kind}
                onclick={() => setFilter(kind)}
            >
                {kind}
            </button>
        {/each}
    </div>

    <div class="grid" data-testid="grid">
        {#each visible as item (item.id)}
            <div
                class={`item ${item.kind}`}
                data-item
                data-testid={`item-${item.id}`}
                aria-hidden="true"
            ></div>
        {/each}
    </div>

    <div data-testid="count">{visible.length}</div>
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
        max-width: 480px;
        margin-bottom: 24px;
        color: #9ca3af;
    }

    .filters {
        display: flex;
        gap: 8px;
        margin-bottom: 24px;
    }

    .filters button {
        padding: 8px 16px;
        border: none;
        border-radius: 8px;
        background: #1f2937;
        color: #e5e7eb;
        cursor: pointer;
        text-transform: capitalize;
    }

    .filters button.active {
        background: #6366f1;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(6, 64px);
        gap: 12px;
        width: max-content;
    }

    .item {
        width: 64px;
        height: 64px;
    }

    .item.circle {
        border-radius: 50%;
        background: #f472b6;
    }

    .item.square {
        border-radius: 12px;
        background: #38bdf8;
    }

    [data-testid='count'] {
        margin-top: 20px;
        font-family: monospace;
        color: #6b7280;
    }
</style>
