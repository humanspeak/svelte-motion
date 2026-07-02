<script lang="ts">
    import { animateView } from '@humanspeak/svelte-motion'

    type Tile = { id: string; color: string; title: string }

    const tiles: Tile[] = [
        { id: 'coral', color: '#f87171', title: 'Coral Dreams' },
        { id: 'amber', color: '#fbbf24', title: 'Amber Waves' },
        { id: 'jade', color: '#4ade80', title: 'Jade Motion' }
    ]

    let selected = $state<Tile | null>(null)

    const open = (tile: Tile) => {
        animateView(() => {
            selected = tile
        }).add(`[data-view-thumb="${tile.id}"]`, '[data-view-hero]')
    }

    const close = () => {
        const tile = selected
        if (!tile) return
        animateView(() => {
            selected = null
        }).add('[data-view-hero]', `[data-view-thumb="${tile.id}"]`)
    }
</script>

<!-- Fixed height: the grid and detail states differ in natural height,
     and a content-driven wrapper makes the docs card jump on swap. -->
<div class="flex h-64 flex-col items-center justify-center gap-4">
    {#if selected}
        <div class="flex flex-col items-center gap-3">
            <div
                data-view-hero
                class="view-radius h-40 w-40"
                style={`background:${selected.color}`}
            ></div>
            <p class="text-sm font-medium">{selected.title}</p>
            <button
                class="rounded-lg bg-neutral-700 px-3 py-1.5 text-sm text-white"
                onclick={close}
            >
                Back
            </button>
        </div>
    {:else}
        <p class="text-text-muted text-sm">Click a tile — it morphs into the hero</p>
        <div class="flex gap-3">
            {#each tiles as tile (tile.id)}
                <button
                    data-view-thumb={tile.id}
                    class="view-radius h-16 w-16 cursor-pointer border-none"
                    style={`background:${tile.color}`}
                    aria-label={`Open ${tile.title}`}
                    onclick={() => open(tile)}
                ></button>
            {/each}
        </div>
    {/if}
</div>

<style>
    /* Matching PERCENTAGE radii on both morph endpoints: snapshots bake
       corner rounding in as transparency, so proportional radii keep the
       two silhouettes coincident at every scale — no corner ghosting. */
    .view-radius {
        border-radius: 12%;
    }
</style>
