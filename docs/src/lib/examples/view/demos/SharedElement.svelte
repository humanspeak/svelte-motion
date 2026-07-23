<script lang="ts">
    import { animateView, motion, styleString } from '@humanspeak/svelte-motion'

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
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// shared element</span>
            <span class="micro readout">
                {selected ? `detail · ${selected.id}` : 'grid · 04 albums'}
            </span>
        </div>

        <!-- Fixed-height stage (not content-driven): the grid and detail
             states differ in natural height, and letting the stage flex
             would jerk the footer as the view swaps. -->
        <div class="stage">
            {#if selected}
                <div class="detail">
                    <div data-hero class="hero" style={`background:${selected.color}`}></div>
                    <p class="title">{selected.title}</p>
                    <motion.button
                        onclick={close}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        style={styleString(() => ({
                            fontFamily: 'var(--brut-mono, monospace)',
                            fontSize: '0.6875rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            border: '1px solid var(--brut-ink, #0a0a0a)',
                            backgroundColor: 'var(--brut-bg, #f8fcfb)',
                            color: 'var(--brut-ink, #0a0a0a)',
                            padding: '0.5rem 0.875rem',
                            cursor: 'pointer'
                        }))}
                    >
                        ← back
                    </motion.button>
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

        <div class="strip-foot">
            <span class="micro">pattern: add-pair</span>
            <span class="micro">morph: thumb ↔ hero</span>
        </div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        min-height: 400px;
    }

    .strip {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .strip-head,
    .strip-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .strip-foot {
        border-bottom: none;
        border-top: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-top: 0.75rem;
        padding-bottom: 0;
    }

    .readout {
        color: var(--brut-accent, #247768);
    }

    .stage {
        height: 300px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* Matching radii on both morph endpoints — snapshots bake corner
       rounding in as transparency, so identical radii keep the two
       silhouettes coincident at every scale. A hard 0/0 satisfies that
       (no corner ghosting) and reads as brutalist. */
    .thumb,
    .hero {
        box-sizing: border-box;
        border: 1px solid var(--brut-ink, #0a0a0a);
        border-radius: 0;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(4, 72px);
        gap: 12px;
    }

    .thumb {
        width: 72px;
        height: 72px;
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

    .title {
        margin: 0;
        font-family: var(--brut-mono, monospace);
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        color: var(--brut-ink, #0a0a0a);
    }
</style>
