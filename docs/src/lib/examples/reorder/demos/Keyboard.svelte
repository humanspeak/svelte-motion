<script lang="ts">
    import { Reorder, styleString } from '@humanspeak/svelte-motion'

    // Keyboard reordering (Motion 14.6.0): every Reorder.Item is focusable.
    // Tab to an item, Space grabs it (its whileDrag state lifts it), the
    // arrow keys move it, Space drops it and Escape puts the list back.

    let items = $state(['🍓 Strawberry', '🍋 Lemon', '🫐 Blueberry', '🍑 Peach', '🥝 Kiwi'])

    const itemStyle = styleString(() => ({
        display: 'flex',
        alignItems: 'center',
        height: '40px',
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
            <span class="micro">// keyboard</span>
            <span class="micro readout">space · arrows · esc</span>
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
                <Reorder.Item
                    value={item}
                    class="keyboard-item"
                    whileDrag={{ scale: 1.03, boxShadow: '8px 8px 0 var(--brut-rule-2, #bbc4c0)' }}
                    style={itemStyle}
                >
                    {item}
                </Reorder.Item>
            {/each}
        </Reorder.Group>

        <p class="micro hint">Tab to an item, Space to grab, arrows to move</p>
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

    .strip :global(.keyboard-item:focus-visible) {
        outline: 2px solid var(--brut-accent, #247768);
        outline-offset: 3px;
    }

    .micro {
        font-family: var(--brut-mono, monospace);
        font-size: 0.6875rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--brut-ink-3, #9a9a9a);
    }

    .hint {
        margin: 0;
        width: 260px;
        text-transform: none;
        letter-spacing: 0.02em;
    }

    .readout {
        color: var(--brut-accent, #247768);
    }
</style>
