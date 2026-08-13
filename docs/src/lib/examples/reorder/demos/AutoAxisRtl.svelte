<script lang="ts">
    import { Reorder, styleString } from '@humanspeak/svelte-motion'

    let items = $state(['Aleph', 'Bet', 'Gimel', 'Dalet'])

    const groupStyle = styleString(() => ({
        display: 'flex',
        gap: '8px',
        margin: 0,
        padding: 0,
        listStyle: 'none',
        direction: 'rtl'
    }))

    const itemStyle = styleString(() => ({
        display: 'grid',
        placeItems: 'center',
        width: '72px',
        height: '72px',
        border: '1px solid var(--brut-rule, #0a0a0a)',
        background: 'var(--brut-bg-2, #eef4f1)',
        color: 'var(--brut-ink, #0a0a0a)',
        boxShadow: '3px 3px 0 var(--brut-rule, #0a0a0a)',
        cursor: 'grab',
        userSelect: 'none',
        fontFamily: 'var(--brut-mono, monospace)',
        fontSize: '0.75rem',
        fontWeight: 700
    }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// axis — auto</span>
            <span class="micro readout">dir: rtl</span>
        </div>

        <Reorder.Group
            values={items}
            onReorder={(next: string[]) => (items = next)}
            style={groupStyle}
        >
            {#each items as item (item)}
                <Reorder.Item value={item} whileDrag={{ scale: 1.05 }} style={itemStyle}>
                    {item}
                </Reorder.Item>
            {/each}
        </Reorder.Group>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        min-height: 240px;
        align-items: center;
        justify-content: center;
        padding: 2rem;
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
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
        padding-bottom: 0.5rem;
    }

    .micro {
        color: var(--brut-ink-3, #9a9a9a);
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
    }

    .readout {
        color: var(--brut-accent, #247768);
    }
</style>
