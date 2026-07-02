<script lang="ts">
    import { animateView } from '@humanspeak/svelte-motion'

    // Filtering inside animateView: survivors morph to their new grid
    // slots, pure newcomers scale-fade in via .enter(), pure leavers
    // out via .exit().

    type Item = { id: number; kind: 'circle' | 'square' }

    const all: Item[] = Array.from({ length: 12 }, (_, index) => ({
        id: index,
        kind: index % 2 === 0 ? 'circle' : 'square'
    }))

    let filter = $state<'all' | 'circle' | 'square'>('all')
    const visible = $derived(filter === 'all' ? all : all.filter((item) => item.kind === filter))

    const setFilter = (next: typeof filter) => {
        if (next === filter) return
        animateView(() => {
            filter = next
        })
            .add('[data-view-item]')
            .enter({ opacity: [0, 1], scale: [0.6, 1] })
            .exit({ opacity: [1, 0], scale: [1, 0.6] })
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="stack">
        <div class="filters">
            {#each ['all', 'circle', 'square'] as const as kind (kind)}
                <button
                    class:active={filter === kind}
                    aria-pressed={filter === kind}
                    onclick={() => setFilter(kind)}
                >
                    {kind}
                </button>
            {/each}
        </div>

        <div class="grid">
            {#each visible as item (item.id)}
                <div class={`item ${item.kind}`} data-view-item aria-hidden="true"></div>
            {/each}
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 320px;
    }

    .stack {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .filters {
        display: flex;
        gap: 8px;
    }

    .filters button {
        padding: 6px 14px;
        border: none;
        border-radius: 8px;
        background: rgba(120, 120, 140, 0.25);
        cursor: pointer;
        text-transform: capitalize;
    }

    .filters button.active {
        background: #6366f1;
        color: white;
    }

    /* Fixed grid height for the 2-row "all" state: filtering down to
       one row must not shrink the stack, or the filter buttons above
       jump as the layout recenters. 40px items keep the 6-column row
       inside narrow mobile viewports. */
    .grid {
        display: grid;
        grid-template-columns: repeat(6, 40px);
        grid-auto-rows: 40px;
        gap: 8px;
        height: 88px;
        align-content: start;
    }

    .item {
        width: 40px;
        height: 40px;
    }

    .item.circle {
        border-radius: 50%;
        background: #f472b6;
    }

    .item.square {
        border-radius: 10px;
        background: #38bdf8;
    }
</style>
