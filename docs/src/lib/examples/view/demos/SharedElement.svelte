<script lang="ts">
    import { animateView } from '@humanspeak/svelte-motion'

    // The "now playing" pattern: a thumbnail and a detail hero are two
    // DIFFERENT elements paired into one view-transition layer with
    // .add(oldTarget, newTarget), so the browser morphs between them.

    type Album = { id: string; color: string; title: string }

    const albums: Album[] = [
        { id: 'coral', color: '#f87171', title: 'Coral Dreams' },
        { id: 'amber', color: '#fbbf24', title: 'Amber Waves' },
        { id: 'jade', color: '#4ade80', title: 'Jade Motion' },
        { id: 'sky', color: '#60a5fa', title: 'Sky Static' }
    ]

    let selected = $state<Album | null>(null)

    const open = (album: Album) => {
        animateView(() => {
            selected = album
        }).add(`[data-thumb="${album.id}"]`, '[data-hero]')
    }

    const close = () => {
        const album = selected
        if (!album) return
        animateView(() => {
            selected = null
        }).add('[data-hero]', `[data-thumb="${album.id}"]`)
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    {#if selected}
        <div class="detail">
            <div data-hero class="hero" style={`background:${selected.color}`}></div>
            <p>{selected.title}</p>
            <button onclick={close}>Back</button>
        </div>
    {:else}
        <div class="grid">
            {#each albums as album (album.id)}
                <button
                    data-thumb={album.id}
                    class="thumb"
                    style={`background:${album.color}`}
                    aria-label={`Open ${album.title}`}
                    onclick={() => open(album)}
                ></button>
            {/each}
        </div>
    {/if}
</div>

<style>
    /* Fixed height (not min-height): the grid and detail states differ
       in natural height, and a content-driven shell makes the whole
       example card jump when the view swaps. */
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        height: 360px;
    }

    /* Matching PERCENTAGE radii on both morph endpoints — snapshots bake
       rounding in as transparency, so proportional radii keep the two
       silhouettes coincident at every scale (no corner ghosting). */
    .thumb,
    .hero {
        border-radius: 12%;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(4, 72px);
        gap: 12px;
    }

    .thumb {
        width: 72px;
        height: 72px;
        border: none;
        cursor: pointer;
    }

    .detail {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
    }

    .hero {
        width: 200px;
        height: 200px;
    }

    .detail p {
        margin: 0;
        font-weight: 600;
    }

    .detail button {
        padding: 6px 14px;
        border: none;
        border-radius: 8px;
        background: rgba(120, 120, 140, 0.25);
        cursor: pointer;
    }
</style>
