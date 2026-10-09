<script lang="ts">
    import { animateLayout } from '@humanspeak/svelte-motion'

    // Reordering a keyed {#each}: Svelte moves the existing tile nodes,
    // and animateLayout animates every <div data-layout> inside the grid
    // from its old slot to its new one. Passing the grid as the scope
    // limits the measurement to these tiles.

    const initial = Array.from({ length: 9 }, (_, index) => index + 1)

    let tiles = $state([...initial])
    let grid = $state<HTMLElement | null>(null)

    const shuffled = (list: number[]) => {
        const next = [...list]
        for (let i = next.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[next[i], next[j]] = [next[j], next[i]]
        }
        return next
    }

    const reorder = (next: number[]) => {
        if (!grid) return
        animateLayout(
            grid,
            () => {
                tiles = next
            },
            {
                type: 'spring',
                visualDuration: 0.5,
                bounce: 0.2
            }
        )
    }
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// shuffle grid</span>
            <span class="micro readout">order · {tiles.join('')}</span>
        </div>

        <div class="stage">
            <div class="grid" bind:this={grid}>
                {#each tiles as tile (tile)}
                    <div class="tile" class:accent={tile % 3 === 0} data-layout>
                        {String(tile).padStart(2, '0')}
                    </div>
                {/each}
            </div>
        </div>

        <div class="controls">
            <button type="button" onclick={() => reorder(shuffled(tiles))}>Shuffle</button>
            <button type="button" onclick={() => reorder([...initial])}>Sort</button>
        </div>

        <div class="strip-foot">
            <span class="micro">scope: grid</span>
            <span class="micro">keyed each · 09 tiles</span>
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
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 240px;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(3, 64px);
        gap: 10px;
    }

    .tile {
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        width: 64px;
        height: 64px;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
        font-family: var(--brut-mono, monospace);
        font-size: 0.875rem;
        font-weight: 700;
    }

    .tile.accent {
        background: var(--brut-accent, #247768);
        color: var(--brut-bg, #f8fcfb);
    }

    .controls {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
    }

    .controls button {
        padding: 0.4rem 0.8rem;
        border: 1px solid var(--brut-ink, #0a0a0a);
        background: var(--brut-bg, #f8fcfb);
        color: var(--brut-ink, #0a0a0a);
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        cursor: pointer;
    }
</style>
