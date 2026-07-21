<script lang="ts">
    import { animateView, motion, styleString } from '@humanspeak/svelte-motion'

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

    // Brut filter chip: active state swaps the border + fill to accent.
    const filterButtonStyle = (active: boolean) =>
        styleString(() => ({
            fontFamily: 'var(--brut-mono, monospace)',
            fontSize: '0.6875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            border: `1px solid ${active ? 'var(--brut-accent, #247768)' : 'var(--brut-rule-2, #bbc4c0)'}`,
            backgroundColor: active
                ? 'var(--brut-accent-soft, rgba(36, 119, 104, 0.1))'
                : 'transparent',
            color: active ? 'var(--brut-accent, #247768)' : 'var(--brut-ink-2, #525252)',
            padding: '0.4rem 0.8rem',
            cursor: 'pointer'
        }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// filter gallery</span>
            <span class="micro readout">
                {filter} · {String(visible.length).padStart(2, '0')} / 12
            </span>
        </div>

        <div class="filters">
            {#each ['all', 'circle', 'square'] as const as kind (kind)}
                <motion.button
                    aria-pressed={filter === kind}
                    onclick={() => setFilter(kind)}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    style={filterButtonStyle(filter === kind)}
                >
                    {kind}
                </motion.button>
            {/each}
        </div>

        <div class="grid">
            {#each visible as item (item.id)}
                <div class={`item ${item.kind}`} data-view-item aria-hidden="true"></div>
            {/each}
        </div>

        <div class="strip-foot">
            <span class="micro">pattern: enter-exit</span>
            <span class="micro">layer: [data-view-item]</span>
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

    .filters {
        display: flex;
        gap: 8px;
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
        box-sizing: border-box;
        width: 40px;
        height: 40px;
        border: 1px solid var(--brut-ink, #0a0a0a);
    }

    /* Circles stay intrinsically round; squares are hard-cornered. Two
       silhouettes map onto the accent (circle) / ink (square) hues. */
    .item.circle {
        border-radius: 50%;
        background: var(--brut-accent, #247768);
    }

    .item.square {
        border-radius: 0;
        background: var(--brut-ink, #0a0a0a);
    }
</style>
