<script lang="ts">
    import { Reorder, styleString } from '@humanspeak/svelte-motion'

    // Reorder.Board (Motion 14.10): drag a card from one column into
    // another. The column it leaves calls `onReorder` without the card and
    // the column it joins calls `onReorder` with it, one after the other,
    // so each column writes its own key into the latest `columns` state.
    // Card titles are unique across the columns, as Board requires.

    type ColumnId = 'todo' | 'doing' | 'done'

    const titles: Record<ColumnId, string> = {
        todo: 'To do',
        doing: 'Doing',
        done: 'Done'
    }

    const columns = $state<Record<ColumnId, string[]>>({
        todo: [
            'Sketch the board',
            'Pick a palette',
            'Write the copy',
            'Plan the launch',
            'Book a review',
            'Draft the FAQ',
            'Order stickers'
        ],
        doing: ['Port the drag', 'Measure columns'],
        done: ['Ship the list']
    })

    const ids = Object.keys(titles) as ColumnId[]

    const cardStyle = styleString(() => ({
        display: 'flex',
        alignItems: 'center',
        minHeight: '44px',
        padding: '0 12px',
        marginBottom: '8px',
        background: 'var(--brut-bg-2, #eef4f1)',
        color: 'var(--brut-ink, #0a0a0a)',
        border: '1px solid var(--brut-rule-2, #bbc4c0)',
        boxShadow: '4px 4px 0 var(--brut-rule, #d6dedb)',
        cursor: 'grab',
        userSelect: 'none',
        fontFamily: 'var(--brut-mono, monospace)',
        fontSize: '0.75rem',
        fontWeight: 700
    }))

    const groupStyle = styleString(() => ({
        listStyle: 'none',
        margin: 0,
        padding: '10px',
        minHeight: '100%',
        boxSizing: 'border-box'
    }))
</script>

<!-- dk-strip: docs-kit positioning shell — stripped from the published code. -->
<div class="dk-demo-shell">
    <Reorder.Board>
        <div class="board">
            {#each ids as id (id)}
                <section class="column" aria-label={titles[id]}>
                    <header class="column-head">
                        <span class="micro">{titles[id]}</span>
                        <span class="micro readout">{columns[id].length}</span>
                    </header>
                    <!-- The column scrolls when its cards outgrow it. -->
                    <div class="column-scroll">
                        <Reorder.Group
                            axis="y"
                            values={columns[id]}
                            onReorder={(next: string[]) => (columns[id] = next)}
                            style={groupStyle}
                        >
                            {#each columns[id] as card (card)}
                                <Reorder.Item
                                    value={card}
                                    class="board-card"
                                    whileDrag={{
                                        scale: 1.04,
                                        boxShadow: '8px 8px 0 var(--brut-rule-2, #bbc4c0)'
                                    }}
                                    style={cardStyle}
                                >
                                    {card}
                                </Reorder.Item>
                            {/each}
                        </Reorder.Group>
                    </div>
                </section>
            {/each}
        </div>
    </Reorder.Board>
</div>

<style>
    .dk-demo-shell {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem 1rem;
        min-height: 400px;
    }

    .board {
        display: flex;
        gap: 12px;
        max-width: 100%;
        overflow-x: auto;
    }

    .column {
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        width: 180px;
        border: 1px solid var(--brut-rule-2, #bbc4c0);
        background: var(--brut-bg, #f8fcfb);
    }

    .column-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 10px;
        border-bottom: 1px dashed var(--brut-rule-2, #bbc4c0);
    }

    .column-scroll {
        height: 300px;
        overflow-y: auto;
    }

    .column-scroll :global(.board-card:focus-visible) {
        outline: 2px solid var(--brut-accent, #247768);
        outline-offset: 2px;
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
