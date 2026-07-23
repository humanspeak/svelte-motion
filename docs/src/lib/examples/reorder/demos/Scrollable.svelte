<script lang="ts">
    import { motion, Reorder, styleString } from '@humanspeak/svelte-motion'

    // A long list inside a fixed-height scroll container. `layoutScroll`
    // keeps layout measurements correct while the container scrolls, and
    // dragging an item near the top or bottom edge auto-scrolls the list
    // so the whole thing can be traversed in one gesture.

    let items = $state([
        'Aardvark',
        'Beaver',
        'Capybara',
        'Dingo',
        'Echidna',
        'Fennec',
        'Gecko',
        'Hedgehog',
        'Iguana',
        'Jackal'
    ])

    const itemStyle = styleString(() => ({
        display: 'flex',
        alignItems: 'center',
        height: '42px',
        padding: '0 16px',
        marginBottom: '8px',
        background: 'var(--brut-bg-2, #eef4f1)',
        color: 'var(--brut-ink, #0a0a0a)',
        border: '1px solid var(--brut-rule-2, #bbc4c0)',
        boxShadow: '4px 4px 0 var(--brut-rule, #d6dedb)',
        cursor: 'grab',
        userSelect: 'none',
        fontFamily: 'var(--brut-mono, monospace)',
        fontSize: '0.8125rem',
        fontWeight: 700
    }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// reorder — scrollable</span>
            <span class="micro readout">{items.length} items</span>
        </div>

        <motion.div
            layoutScroll
            style={styleString(() => ({
                height: '280px',
                width: '260px',
                overflowY: 'scroll',
                padding: '10px',
                border: '1px solid var(--brut-rule-2, #bbc4c0)',
                background: 'var(--brut-bg, #f8fcfb)'
            }))}
        >
            <Reorder.Group
                axis="y"
                values={items}
                onReorder={(next: string[]) => (items = next)}
                style={styleString(() => ({
                    listStyle: 'none',
                    padding: 0,
                    margin: 0
                }))}
            >
                {#each items as item (item)}
                    <Reorder.Item value={item} whileDrag={{ scale: 1.03 }} style={itemStyle}>
                        {item}
                    </Reorder.Item>
                {/each}
            </Reorder.Group>
        </motion.div>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        min-height: 360px;
    }

    .strip {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .strip-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        width: 260px;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .readout {
        color: var(--brut-accent, #247768);
        font-variant-numeric: tabular-nums;
    }
</style>
