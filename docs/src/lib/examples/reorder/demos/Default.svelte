<script lang="ts">
    import { Reorder, styleString } from '@humanspeak/svelte-motion'

    // The motion.dev Reorder demo: drag items vertically to reorder the
    // list. Dragged items pin under the cursor while siblings FLIP out
    // of the way; releasing springs the item into its new slot.

    let items = $state(['🍅 Tomato', '🥒 Cucumber', '🧀 Cheese', '🥬 Lettuce'])

    const itemStyle = styleString(() => ({
        display: 'flex',
        alignItems: 'center',
        height: '44px',
        padding: '0 16px',
        marginBottom: '10px',
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
            <span class="micro">// reorder</span>
            <span class="micro readout">drag to sort</span>
        </div>

        <Reorder.Group
            axis="y"
            values={items}
            onReorder={(next: string[]) => (items = next)}
            style={styleString(() => ({
                listStyle: 'none',
                padding: 0,
                margin: 0,
                width: '260px'
            }))}
        >
            {#each items as item (item)}
                <Reorder.Item value={item} whileDrag={{ scale: 1.03 }} style={itemStyle}>
                    {item}
                </Reorder.Item>
            {/each}
        </Reorder.Group>
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
    }
</style>
