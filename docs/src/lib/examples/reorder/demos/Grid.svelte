<script lang="ts">
    import { Reorder, styleString } from '@humanspeak/svelte-motion'

    const colors: Record<string, string> = {
        A: '#ff6b6b',
        B: '#ffd166',
        C: '#71d99e',
        D: '#58bde8',
        E: '#8f8df4',
        F: '#d18aef'
    }

    let items = $state(['A', 'B', 'C', 'D', 'E', 'F'])

    const groupStyle = styleString(() => ({
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        width: '260px',
        margin: 0,
        padding: 0,
        listStyle: 'none'
    }))

    const itemStyle = (item: string) =>
        styleString(() => ({
            display: 'grid',
            placeItems: 'center',
            width: '80px',
            height: '80px',
            border: '1px solid var(--brut-rule, #0a0a0a)',
            background: colors[item],
            color: '#0a0a0a',
            boxShadow: '4px 4px 0 var(--brut-rule, #0a0a0a)',
            cursor: 'grab',
            userSelect: 'none',
            fontFamily: 'var(--brut-mono, monospace)',
            fontSize: '1.125rem',
            fontWeight: 800
        }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <div class="strip">
        <div class="strip-head">
            <span class="micro">// reorder — xy</span>
            <span class="micro readout">{items.join(' · ')}</span>
        </div>

        <Reorder.Group
            axis="xy"
            values={items}
            onReorder={(next: string[]) => (items = next)}
            style={groupStyle}
        >
            {#each items as item (item)}
                <Reorder.Item
                    value={item}
                    whileDrag={{ scale: 1.08 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    style={itemStyle(item)}
                >
                    {item}
                </Reorder.Item>
            {/each}
        </Reorder.Group>
    </div>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        min-height: 300px;
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
        width: 260px;
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
