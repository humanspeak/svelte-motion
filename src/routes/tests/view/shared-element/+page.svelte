<script lang="ts">
    import { animateView } from '$lib'

    type Album = { id: string; color: string; title: string }

    const albums: Album[] = [
        { id: 'coral', color: '#f87171', title: 'Coral Dreams' },
        { id: 'amber', color: '#fbbf24', title: 'Amber Waves' },
        { id: 'jade', color: '#4ade80', title: 'Jade Motion' },
        { id: 'sky', color: '#60a5fa', title: 'Sky Static' }
    ]

    let selected = $state<Album | null>(null)

    const open = (album: Album) => {
        // Morph the clicked thumbnail into the detail hero: the first
        // .add() argument resolves in the OLD snapshot, the second in
        // the NEW one — two different elements sharing one layer.
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

<div class="page">
    <h1>animateView — shared-element morph</h1>
    <p>
        Click a tile: it morphs into the detail hero (<code>.add(thumb, hero)</code>). Close and it
        morphs back. The "now playing" pattern from motion.dev/docs/view.
    </p>

    {#if selected}
        <section class="detail" data-testid="detail">
            <div class="hero" data-hero style={`background:${selected.color}`}></div>
            <h2 data-testid="detail-title">{selected.title}</h2>
            <button data-testid="close" onclick={close}>Back</button>
        </section>
    {:else}
        <div class="grid" data-testid="grid">
            {#each albums as album (album.id)}
                <button
                    class="thumb"
                    data-thumb={album.id}
                    data-testid={`thumb-${album.id}`}
                    style={`background:${album.color}`}
                    onclick={() => open(album)}
                    aria-label={`Open ${album.title}`}
                ></button>
            {/each}
        </div>
    {/if}
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

    .grid {
        display: grid;
        grid-template-columns: repeat(4, 96px);
        gap: 14px;
    }

    /*
     * Both morph endpoints use the SAME percentage radius: view-transition
     * snapshots bake corner rounding in as transparency, and a same-aspect
     * morph can't crop the outgoing silhouette away (upstream limitation) —
     * proportional radii make the two silhouettes coincide at every scale,
     * so the crossfade has no corner ghosting.
     */
    .thumb {
        width: 96px;
        height: 96px;
        border: none;
        border-radius: 12%;
        cursor: pointer;
    }

    .detail .hero {
        width: 280px;
        height: 280px;
        border-radius: 12%;
    }

    .detail h2 {
        margin: 16px 0;
        font-size: 24px;
    }

    .detail button {
        padding: 8px 16px;
        border: none;
        border-radius: 8px;
        background: #374151;
        color: #e5e7eb;
        cursor: pointer;
    }
</style>
